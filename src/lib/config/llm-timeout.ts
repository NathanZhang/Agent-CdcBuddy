export const DEFAULT_LLM_TIMEOUT_MS = 30_000;

type TimeoutEnvironment = Record<string, string | undefined>;

export function resolveTimeoutMs(
  value: string | undefined,
  fallbackMs = DEFAULT_LLM_TIMEOUT_MS,
): number {
  if (!value || !/^\d+$/.test(value)) {
    return fallbackMs;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallbackMs;
}

export function getRouterTimeoutMs(env: TimeoutEnvironment = process.env): number {
  return resolveTimeoutMs(env.SILICONFLOW_ROUTER_TIMEOUT_MS);
}

export function getText2SqlTimeoutMs(env: TimeoutEnvironment = process.env): number {
  return resolveTimeoutMs(env.SILICONFLOW_TEXT2SQL_TIMEOUT_MS);
}
