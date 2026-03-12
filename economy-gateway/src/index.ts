import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { envBool, envInt, readJsonFile, requireEnv } from './util.js';
import {
  CapabilityScope,
  issueCapabilityToken,
  isCapabilityRevoked,
  recordCapabilityIssued,
  recordCapabilityUse,
  revokeCapability,
  verifyCapabilityToken,
} from './capabilities.js';
import { mintRevenue } from './engineClient.js';
import { createStripeCheckoutSession, normalizeStripeCheckoutSessionCompleted, verifyStripeWebhook } from './providers/stripe.js';

const PORT = envInt('PORT', 8787);
const ENGINE_BASE_URL = requireEnv('ENGINE_BASE_URL');
const ADMIN_SECRET = requireEnv('ECONOMY_GATEWAY_ADMIN_SECRET');
const CAPABILITY_SIGNING_SECRET = requireEnv('CAPABILITY_SIGNING_SECRET');

const WORLD_DIR = process.env.WORLD_DIR; // optional but enables audit + event listing
const WORLD_ID = process.env.WORLD_ID ?? 'genesis';

const TREASURY_SHARE_PCT_DEFAULT = envInt('TREASURY_SHARE_PCT', 0);

const ALLOW_INSECURE_WEBHOOKS = envBool('ALLOW_INSECURE_WEBHOOKS', false);
const INTERNAL_WEBHOOK_SECRET = process.env.INTERNAL_WEBHOOK_SECRET ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const STRIPE_API_KEY = process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_API_KEY ?? '';
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL ?? 'https://example.com/success';
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL ?? 'https://example.com/cancel';

const app = express();
app.use(cors());

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'utopia-economy-gateway', time: new Date().toISOString() });
});

// Stripe webhook needs the raw body for signature verification.
app.post('/webhooks/stripe', express.raw({ type: 'application/json', limit: '2mb' }), async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');

    if (!ALLOW_INSECURE_WEBHOOKS) {
      const check = verifyStripeWebhook(rawBody, req.header('stripe-signature') ?? undefined, STRIPE_WEBHOOK_SECRET, 300);
      if (!check.ok) return res.status(400).json({ ok: false, error: check.error });
    }

    const ev = JSON.parse(rawBody.toString('utf8'));
    const normalized = normalizeStripeCheckoutSessionCompleted(ev);
    if (!normalized) return res.json({ ok: true, ignored: true });

    const treasurySharePct = TREASURY_SHARE_PCT_DEFAULT;
    const minted = await mintRevenue(ENGINE_BASE_URL, {
      agentId: normalized.agentId,
      provider: normalized.provider,
      eventId: normalized.eventId,
      externalAmount: normalized.externalAmount,
      externalCurrency: normalized.externalCurrency,
      source: normalized.source,
      proof: normalized.proof,
      idempotencyKey: normalized.idempotencyKey,
      treasurySharePct,
      metadata: normalized.metadata,
    });

    res.json({ ok: true, minted });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// JSON routes (non-webhook)
app.use(express.json({ limit: '1mb' }));

function requireAdmin(req: express.Request): void {
  const s = req.header('x-admin-secret');
  if (!s || s !== ADMIN_SECRET) throw new Error('unauthorized');
}

function requireInternalWebhookSecret(req: express.Request): void {
  if (INTERNAL_WEBHOOK_SECRET) {
    const s = req.header('x-internal-secret');
    if (!s || s !== INTERNAL_WEBHOOK_SECRET) throw new Error('unauthorized');
    return;
  }
  if (!ALLOW_INSECURE_WEBHOOKS) throw new Error('internal webhook secret not configured');
}

function requireScope(payload: { scopes: CapabilityScope[] }, scope: CapabilityScope): void {
  if (!payload.scopes.includes(scope)) throw new Error(`missing scope: ${scope}`);
}

async function authCapability(req: express.Request): Promise<ReturnType<typeof verifyCapabilityToken>> {
  const auth = req.header('authorization') ?? '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error('missing bearer token');
  const token = m[1];
  const payload = verifyCapabilityToken(CAPABILITY_SIGNING_SECRET, token);
  if (WORLD_DIR && (await isCapabilityRevoked(WORLD_DIR, payload.jti))) throw new Error('capability revoked');
  return payload;
}

function normalizeScopes(input: unknown): CapabilityScope[] {
  if (!Array.isArray(input)) throw new Error('scopes must be an array');
  const scopes: CapabilityScope[] = [];
  for (const s of input) {
    if (typeof s !== 'string') continue;
    if (s === 'payments.stripe.create_checkout' || s === 'revenue.read' || s === 'revenue.mint') {
      scopes.push(s);
    }
  }
  if (scopes.length === 0) throw new Error('no valid scopes');
  return scopes;
}

// ── Admin: Capability issuance / revocation ──────────────────────────

app.post('/admin/capabilities/issue', async (req, res) => {
  try {
    requireAdmin(req);
    const agentId = String(req.body?.agentId ?? '');
    if (!agentId) throw new Error('missing agentId');
    const scopes = normalizeScopes(req.body?.scopes);
    const expiresInSec = Number(req.body?.expiresInSec ?? 3600);
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;

    const { token, payload } = issueCapabilityToken(CAPABILITY_SIGNING_SECRET, {
      agentId,
      scopes,
      expiresInSec: Number.isFinite(expiresInSec) ? expiresInSec : 3600,
      note,
    });

    if (WORLD_DIR) {
      await recordCapabilityIssued(WORLD_DIR, payload, { issuedFromIp: req.ip });
    }

    res.json({ ok: true, token, payload });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post('/admin/capabilities/revoke', async (req, res) => {
  try {
    requireAdmin(req);
    if (!WORLD_DIR) throw new Error('WORLD_DIR not configured');
    const jti = String(req.body?.jti ?? '');
    if (!jti) throw new Error('missing jti');
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    await revokeCapability(WORLD_DIR, jti, reason);
    res.json({ ok: true, revoked: jti });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// ── Agent: Create a Stripe checkout session (收款链接) ─────────────────

app.post('/payments/stripe/checkout', async (req, res) => {
  try {
    const cap = await authCapability(req);
    requireScope(cap, 'payments.stripe.create_checkout');

    if (!STRIPE_API_KEY) throw new Error('STRIPE_API_KEY not configured');

    const amount = Number(req.body?.amount ?? 0);
    const currency = String(req.body?.currency ?? 'USD').toUpperCase();
    const description = String(req.body?.description ?? 'Utopia token purchase');

    if (!Number.isFinite(amount) || amount <= 0) throw new Error('invalid amount');
    const amountCents = Math.round(amount * 100);

    const session = await createStripeCheckoutSession({
      apiKey: STRIPE_API_KEY,
      amountCents,
      currency,
      description,
      successUrl: String(req.body?.successUrl ?? STRIPE_SUCCESS_URL),
      cancelUrl: String(req.body?.cancelUrl ?? STRIPE_CANCEL_URL),
      clientReferenceId: `${WORLD_ID}:${cap.sub}`,
      metadata: {
        agentId: cap.sub,
        worldId: WORLD_ID,
      },
    });

    if (WORLD_DIR) {
      await recordCapabilityUse(WORLD_DIR, cap, 'payments/stripe/checkout', { sessionId: session.id, amount, currency });
    }

    res.json({ ok: true, session });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// ── Agent: List revenue events (requires WORLD_DIR) ───────────────────

app.get('/revenue/events', async (req, res) => {
  try {
    const cap = await authCapability(req);
    requireScope(cap, 'revenue.read');
    if (!WORLD_DIR) throw new Error('WORLD_DIR not configured');

    const dir = path.join(WORLD_DIR, '.world', 'revenue-events');
    let files: string[] = [];
    try {
      files = (await fs.readdir(dir)).filter(f => f.endsWith('.json'));
    } catch {
      files = [];
    }

    const items: any[] = [];
    for (const f of files) {
      const rec = await readJsonFile<any>(path.join(dir, f));
      if (!rec) continue;
      if (rec.agentId !== cap.sub) continue;
      items.push(rec);
    }
    items.sort((a, b) => String(b.receivedAt ?? '').localeCompare(String(a.receivedAt ?? '')));

    await recordCapabilityUse(WORLD_DIR, cap, 'revenue/events/list', { count: items.length });
    res.json({ ok: true, items });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// ── Agent: Trigger mint manually (for non-webhook providers) ──────────

app.post('/revenue/mint', async (req, res) => {
  try {
    const cap = await authCapability(req);
    requireScope(cap, 'revenue.mint');

    const provider = String(req.body?.provider ?? '');
    const eventId = String(req.body?.eventId ?? '');
    const externalAmount = Number(req.body?.externalAmount ?? NaN);
    const externalCurrency = String(req.body?.externalCurrency ?? 'USD').toUpperCase();
    const source = String(req.body?.source ?? provider);

    if (!provider || !eventId) throw new Error('missing provider/eventId');
    if (!Number.isFinite(externalAmount) || externalAmount <= 0) throw new Error('invalid externalAmount');

    const minted = await mintRevenue(ENGINE_BASE_URL, {
      agentId: cap.sub,
      provider,
      eventId,
      externalAmount,
      externalCurrency,
      source,
      proof: typeof req.body?.proof === 'string' ? req.body.proof : undefined,
      idempotencyKey: typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : undefined,
      treasurySharePct: Number(req.body?.treasurySharePct ?? TREASURY_SHARE_PCT_DEFAULT),
      metadata: typeof req.body?.metadata === 'object' ? req.body.metadata : undefined,
    });

    if (WORLD_DIR) {
      await recordCapabilityUse(WORLD_DIR, cap, 'revenue/mint', { provider, eventId, externalAmount, externalCurrency });
    }
    res.json({ ok: true, minted });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// ── Admin: Manual mint (no capability token) ──────────────────────────

app.post('/admin/revenue/mint', async (req, res) => {
  try {
    requireAdmin(req);

    const agentId = String(req.body?.agentId ?? '');
    const provider = String(req.body?.provider ?? '');
    const eventId = String(req.body?.eventId ?? '');
    const externalAmount = Number(req.body?.externalAmount ?? NaN);
    const externalCurrency = String(req.body?.externalCurrency ?? 'USD').toUpperCase();
    const source = String(req.body?.source ?? provider);

    if (!agentId || !provider || !eventId) throw new Error('missing agentId/provider/eventId');
    if (!Number.isFinite(externalAmount) || externalAmount <= 0) throw new Error('invalid externalAmount');

    const minted = await mintRevenue(ENGINE_BASE_URL, {
      agentId,
      provider,
      eventId,
      externalAmount,
      externalCurrency,
      source,
      proof: typeof req.body?.proof === 'string' ? req.body.proof : undefined,
      idempotencyKey: typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : undefined,
      treasurySharePct: Number(req.body?.treasurySharePct ?? TREASURY_SHARE_PCT_DEFAULT),
      metadata: typeof req.body?.metadata === 'object' ? req.body.metadata : undefined,
    });

    res.json({ ok: true, minted });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// ── Webhooks (stubs): Alipay / WeChat ──────────────────────────────────
// These endpoints intentionally start as "normalized event" ingestion.
// Plug in real signature verification using your existing payment services.

app.post('/webhooks/alipay', async (req, res) => {
  try {
    requireInternalWebhookSecret(req);
    const agentId = String(req.body?.agentId ?? '');
    const eventId = String(req.body?.eventId ?? '');
    const externalAmount = Number(req.body?.externalAmount ?? NaN);
    const externalCurrency = String(req.body?.externalCurrency ?? 'CNY').toUpperCase();
    const source = String(req.body?.source ?? 'alipay');
    if (!agentId || !eventId) throw new Error('missing agentId/eventId');
    if (!Number.isFinite(externalAmount) || externalAmount <= 0) throw new Error('invalid externalAmount');

    const minted = await mintRevenue(ENGINE_BASE_URL, {
      agentId,
      provider: 'alipay',
      eventId,
      externalAmount,
      externalCurrency,
      source,
      proof: typeof req.body?.proof === 'string' ? req.body.proof : undefined,
      idempotencyKey: typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : `alipay:${eventId}`,
      treasurySharePct: Number(req.body?.treasurySharePct ?? TREASURY_SHARE_PCT_DEFAULT),
      metadata: typeof req.body?.metadata === 'object' ? req.body.metadata : undefined,
    });

    res.json({ ok: true, minted });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post('/webhooks/wechat', async (req, res) => {
  try {
    requireInternalWebhookSecret(req);
    const agentId = String(req.body?.agentId ?? '');
    const eventId = String(req.body?.eventId ?? '');
    const externalAmount = Number(req.body?.externalAmount ?? NaN);
    const externalCurrency = String(req.body?.externalCurrency ?? 'CNY').toUpperCase();
    const source = String(req.body?.source ?? 'wechat');
    if (!agentId || !eventId) throw new Error('missing agentId/eventId');
    if (!Number.isFinite(externalAmount) || externalAmount <= 0) throw new Error('invalid externalAmount');

    const minted = await mintRevenue(ENGINE_BASE_URL, {
      agentId,
      provider: 'wechat',
      eventId,
      externalAmount,
      externalCurrency,
      source,
      proof: typeof req.body?.proof === 'string' ? req.body.proof : undefined,
      idempotencyKey: typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : `wechat:${eventId}`,
      treasurySharePct: Number(req.body?.treasurySharePct ?? TREASURY_SHARE_PCT_DEFAULT),
      metadata: typeof req.body?.metadata === 'object' ? req.body.metadata : undefined,
    });

    res.json({ ok: true, minted });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[economy-gateway] listening on :${PORT}`);
});
