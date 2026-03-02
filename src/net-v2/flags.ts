const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

function enabled(name: string, fallback = false): boolean {
  const raw = env[name];
  if (raw == null) return fallback;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

export const NETCODE_V2_ENABLED = enabled('VITE_NETCODE_V2_ENABLED', true);
export const NETCODE_V2_PREDICTION_ENABLED = enabled('VITE_NETCODE_V2_PREDICTION_ENABLED', true);
export const NETCODE_V2_DELTAS_ENABLED = enabled('VITE_NETCODE_V2_DELTAS_ENABLED', true);
export const NETCODE_V2_RECONCILE_TICK_V2 = enabled('VITE_NET_RECONCILE_TICK_V2', true);
