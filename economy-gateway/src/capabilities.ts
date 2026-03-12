import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  b64urlEncode,
  b64urlDecode,
  hmacSha256Base64Url,
  readJsonFile,
  writeJsonFile,
} from './util.js';

export type CapabilityScope =
  | 'payments.stripe.create_checkout'
  | 'revenue.read'
  | 'revenue.mint';

export interface CapabilityPayload {
  iss: string;
  sub: string; // agentId
  scopes: CapabilityScope[];
  iat: number;
  exp: number;
  jti: string;
  note?: string;
}

export interface IssueCapabilityInput {
  agentId: string;
  scopes: CapabilityScope[];
  expiresInSec: number;
  note?: string;
}

export function issueCapabilityToken(secret: string, input: IssueCapabilityInput): { token: string; payload: CapabilityPayload } {
  const now = Math.floor(Date.now() / 1000);
  const payload: CapabilityPayload = {
    iss: 'utopia-economy-gateway',
    sub: input.agentId,
    scopes: input.scopes,
    iat: now,
    exp: now + input.expiresInSec,
    jti: randomUUID(),
    note: input.note,
  };

  const header = { alg: 'HS256', typ: 'CAP' };
  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(payload));
  const toSign = `${h}.${p}`;
  const sig = hmacSha256Base64Url(secret, toSign);
  return { token: `${toSign}.${sig}`, payload };
}

export function verifyCapabilityToken(secret: string, token: string): CapabilityPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid capability token');
  const [h, p, sig] = parts;
  const expected = hmacSha256Base64Url(secret, `${h}.${p}`);
  if (sig !== expected) throw new Error('invalid capability signature');

  const payload = JSON.parse(b64urlDecode(p).toString('utf8')) as CapabilityPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) throw new Error('capability token expired');
  if (!payload.sub) throw new Error('invalid capability payload');
  return payload;
}

export async function recordCapabilityIssued(worldDir: string, payload: CapabilityPayload, extra?: Record<string, unknown>): Promise<void> {
  const p = path.join(worldDir, '.world', 'capabilities', 'issued', `${payload.jti}.json`);
  await writeJsonFile(p, {
    ...payload,
    issuedAt: new Date(payload.iat * 1000).toISOString(),
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    ...extra,
  });
}

export async function revokeCapability(worldDir: string, jti: string, reason?: string): Promise<void> {
  const p = path.join(worldDir, '.world', 'capabilities', 'revoked', `${jti}.json`);
  await writeJsonFile(p, { jti, reason, revokedAt: new Date().toISOString() });
}

export async function isCapabilityRevoked(worldDir: string, jti: string): Promise<boolean> {
  const p = path.join(worldDir, '.world', 'capabilities', 'revoked', `${jti}.json`);
  const rec = await readJsonFile<any>(p);
  return !!rec;
}

export async function recordCapabilityUse(worldDir: string, payload: CapabilityPayload, action: string, extra?: Record<string, unknown>): Promise<void> {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const p = path.join(worldDir, '.world', 'capabilities', 'audit', `${ts}-${payload.jti}.json`);
  await writeJsonFile(p, {
    jti: payload.jti,
    agentId: payload.sub,
    scopes: payload.scopes,
    action,
    at: new Date().toISOString(),
    ...extra,
  });
}

