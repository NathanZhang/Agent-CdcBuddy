export const DEFAULT_LLM_FIRST_OUTPUT_TIMEOUT_MS = 300_000;
export const DEFAULT_LLM_IDLE_TIMEOUT_MS = 180_000;
// Retained for callers of the original configuration helpers.
export const DEFAULT_LLM_TIMEOUT_MS = DEFAULT_LLM_FIRST_OUTPUT_TIMEOUT_MS;

type TimeoutEnvironment = Record<string, string | undefined>;

export function resolveTimeoutMs(
  value: string | undefined,
  fallbackMs = DEFAULT_LLM_TIMEOUT_MS,
): number {
  if (!value || !/^\d+$/.test(value)) {
    return fallbackMs;
  }

  const parsed = Number(value);
  // Node timers overflow to 1ms above this bound.
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : fallbackMs;
}

export function getRouterTimeoutMs(env: TimeoutEnvironment = process.env): number {
  return resolveTimeoutMs(env.SILICONFLOW_ROUTER_TIMEOUT_MS);
}

export function getText2SqlTimeoutMs(env: TimeoutEnvironment = process.env): number {
  return resolveTimeoutMs(env.SILICONFLOW_TEXT2SQL_TIMEOUT_MS);
}

/** Explicit phase settings take precedence over the deprecated per-client timeout. */
export function getLLMTimeouts(env: TimeoutEnvironment = process.env, profile: 'router' | 'text2sql' = 'router') {
  const legacy = profile === 'text2sql' ? env.SILICONFLOW_TEXT2SQL_TIMEOUT_MS : env.SILICONFLOW_ROUTER_TIMEOUT_MS;
  const firstOutputMs = resolveTimeoutMs(env.SILICONFLOW_FIRST_OUTPUT_TIMEOUT_MS, resolveTimeoutMs(legacy));
  return {
    firstOutputMs,
    idleMs: resolveTimeoutMs(env.SILICONFLOW_IDLE_TIMEOUT_MS, resolveTimeoutMs(legacy, DEFAULT_LLM_IDLE_TIMEOUT_MS)),
    nonStreamMs: resolveTimeoutMs(env.SILICONFLOW_NON_STREAM_TIMEOUT_MS, firstOutputMs),
  };
}
