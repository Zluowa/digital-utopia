export function closeSocketSafely(ws: WebSocket, reason = 'cleanup'): void {
  // Avoid noisy browser warning when closing while CONNECTING.
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.onopen = () => ws.close(1000, reason);
    return;
  }
  if (ws.readyState === WebSocket.OPEN) {
    ws.close(1000, reason);
  }
}

export function getExponentialBackoffDelay(
  attempt: number,
  options?: { baseMs?: number; maxMs?: number; factor?: number },
): number {
  const baseMs = options?.baseMs ?? 1000;
  const maxMs = options?.maxMs ?? 8000;
  const factor = options?.factor ?? 2;
  return Math.min(maxMs, baseMs * Math.pow(factor, attempt));
}

export function toWebSocketEndpoint(baseUrl: string, endpoint: string): string {
  const fullEndpoint = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`
    : endpoint;
  return fullEndpoint.replace(/^http/i, 'ws');
}
