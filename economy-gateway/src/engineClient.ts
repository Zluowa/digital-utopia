export interface VkApiResponse<T> {
  success: boolean;
  data: T | null;
  error_data: unknown;
  message: string | null;
}

export interface RevenueMintRequest {
  agentId: string;
  provider: string;
  eventId: string;
  externalAmount: number;
  externalCurrency: string;
  source: string;
  proof?: string;
  idempotencyKey?: string;
  treasurySharePct?: number;
  metadata?: Record<string, unknown>;
}

export async function mintRevenue(engineBaseUrl: string, req: RevenueMintRequest): Promise<unknown> {
  const url = new URL('/api/world/revenue/mint', engineBaseUrl);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  const json = (await r.json()) as VkApiResponse<unknown>;
  if (!json.success) throw new Error(json.message ?? 'engine error');
  return json.data;
}

