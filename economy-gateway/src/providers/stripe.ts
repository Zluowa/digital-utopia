import { createHmac } from 'node:crypto';
import { safeTimingEqualHex } from '../util.js';

export interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: { object: any };
}

export function verifyStripeWebhook(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
  toleranceSec = 300,
): { ok: boolean; error?: string } {
  if (!signatureHeader) return { ok: false, error: 'missing Stripe-Signature' };

  const parts = signatureHeader.split(',').map(p => p.trim()).filter(Boolean);
  const kv = new Map<string, string[]>();
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i <= 0) continue;
    const k = p.slice(0, i);
    const v = p.slice(i + 1);
    const arr = kv.get(k) ?? [];
    arr.push(v);
    kv.set(k, arr);
  }

  const tRaw = (kv.get('t') ?? [])[0];
  const v1Sigs = kv.get('v1') ?? [];
  if (!tRaw || v1Sigs.length === 0) return { ok: false, error: 'invalid Stripe-Signature format' };

  const ts = Number(tRaw);
  if (!Number.isFinite(ts)) return { ok: false, error: 'invalid Stripe-Signature timestamp' };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSec) return { ok: false, error: 'stripe signature timestamp outside tolerance' };

  const signedPayload = `${ts}.${rawBody.toString('utf8')}`;
  const expectedHex = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const ok = v1Sigs.some(sig => safeTimingEqualHex(sig, expectedHex));
  return ok ? { ok: true } : { ok: false, error: 'stripe signature mismatch' };
}

export function normalizeStripeCheckoutSessionCompleted(ev: StripeEvent): {
  agentId: string;
  provider: 'stripe';
  eventId: string;
  idempotencyKey: string;
  externalAmount: number;
  externalCurrency: string;
  source: string;
  proof: string;
  metadata: Record<string, unknown>;
} | null {
  if (ev.type !== 'checkout.session.completed') return null;
  const session = ev.data?.object ?? {};
  if (session.payment_status && session.payment_status !== 'paid') return null;

  const currency = (session.currency ?? 'usd').toString().toUpperCase();
  const amountTotal = Number(session.amount_total ?? 0);
  if (!Number.isFinite(amountTotal) || amountTotal <= 0) return null;

  const metadata = session.metadata ?? {};
  const agentId =
    metadata.agentId ??
    metadata.agent_id ??
    parseAgentIdFromClientRef(session.client_reference_id);
  if (!agentId) return null;

  return {
    agentId,
    provider: 'stripe',
    eventId: String(session.id ?? ev.id),
    idempotencyKey: `stripe:checkout_session:${String(session.id ?? ev.id)}`,
    externalAmount: amountTotal / 100,
    externalCurrency: currency,
    source: `stripe:${ev.type}`,
    proof: ev.id,
    metadata: {
      stripeEventId: ev.id,
      stripeEventType: ev.type,
      checkoutSessionId: session.id,
      paymentIntent: session.payment_intent,
      customer: session.customer,
    },
  };
}

export async function createStripeCheckoutSession(params: {
  apiKey: string;
  amountCents: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  clientReferenceId?: string;
}): Promise<{ id: string; url: string }> {
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('success_url', params.successUrl);
  body.set('cancel_url', params.cancelUrl);

  body.set('line_items[0][price_data][currency]', params.currency.toLowerCase());
  body.set('line_items[0][price_data][unit_amount]', String(params.amountCents));
  body.set('line_items[0][price_data][product_data][name]', params.description);
  body.set('line_items[0][quantity]', '1');

  if (params.clientReferenceId) body.set('client_reference_id', params.clientReferenceId);
  for (const [k, v] of Object.entries(params.metadata)) {
    body.set(`metadata[${k}]`, v);
  }

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${params.apiKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json: any = await r.json();
  if (!r.ok) throw new Error(`stripe error: ${json?.error?.message ?? r.statusText}`);
  return { id: String(json.id), url: String(json.url) };
}

function parseAgentIdFromClientRef(ref: unknown): string | null {
  if (typeof ref !== 'string' || !ref) return null;
  // expected: "<worldId>:<agentId>" or "<agentId>"
  const parts = ref.split(':').filter(Boolean);
  if (parts.length === 1) return parts[0];
  if (parts.length >= 2) return parts[parts.length - 1];
  return null;
}
