# Configurable LLM Timeouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard-coded 4-second router and 2.5-second Text2SQL abort timers with validated environment-variable settings that default to 30 seconds, then deploy and verify the new image.

**Architecture:** Add a side-effect-free timeout configuration module and reuse it from both model call sites. Keep the existing `AbortController` and fallback behavior unchanged; Compose already injects all values from the remote `.env` file.

**Tech Stack:** TypeScript, Node.js 22 built-in test runner, Next.js 15, Docker Buildx, PowerShell deployment helpers, Docker Compose.

## Global Constraints

- `SILICONFLOW_ROUTER_TIMEOUT_MS` defaults to exactly `30000` milliseconds.
- `SILICONFLOW_TEXT2SQL_TIMEOUT_MS` defaults to exactly `30000` milliseconds.
- Only finite positive integer values are accepted; missing or invalid values use the default.
- Existing model, credential, payload, abort, and fallback behavior remains unchanged.

---

### Task 1: Timeout configuration and call-site integration

**Files:**
- Create: `src/lib/config/llm-timeout.ts`
- Create: `tests/deployment/llm-timeout.test.mjs`
- Modify: `src/lib/skills/llm-router.ts:283-284`
- Modify: `src/lib/skills/text2sql-engine.ts:153-154`
- Modify: `.env.example:4`

**Interfaces:**
- Produces: `resolveTimeoutMs(value: string | undefined, fallbackMs?: number): number`
- Produces: `getRouterTimeoutMs(env?: Record<string, string | undefined>): number`
- Produces: `getText2SqlTimeoutMs(env?: Record<string, string | undefined>): number`

- [ ] **Step 1: Write the failing behavioral test**

Create a Node `node:test` suite that imports the future module and asserts: an absent value gives `30000`; `45000` gives `45000`; `''`, `0`, `-1`, `1.5`, `NaN`, and `Infinity` give `30000`; and the two accessors independently read `SILICONFLOW_ROUTER_TIMEOUT_MS=31000` and `SILICONFLOW_TEXT2SQL_TIMEOUT_MS=32000`.

- [ ] **Step 2: Run the test and confirm RED**

```powershell
docker run --rm -v "${PWD}:/workspace" -w /workspace node:22-bookworm-slim node --experimental-strip-types --test tests/deployment/llm-timeout.test.mjs
```

Expected: FAIL because `src/lib/config/llm-timeout.ts` does not exist.

- [ ] **Step 3: Implement the parser and accessors**

```typescript
export const DEFAULT_LLM_TIMEOUT_MS = 30_000;
type TimeoutEnvironment = Record<string, string | undefined>;

export function resolveTimeoutMs(value: string | undefined, fallbackMs = DEFAULT_LLM_TIMEOUT_MS): number {
  if (!value || !/^\d+$/.test(value)) return fallbackMs;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallbackMs;
}

export function getRouterTimeoutMs(env: TimeoutEnvironment = process.env): number {
  return resolveTimeoutMs(env.SILICONFLOW_ROUTER_TIMEOUT_MS);
}

export function getText2SqlTimeoutMs(env: TimeoutEnvironment = process.env): number {
  return resolveTimeoutMs(env.SILICONFLOW_TEXT2SQL_TIMEOUT_MS);
}
```

- [ ] **Step 4: Integrate both timers and document the environment**

Use `getRouterTimeoutMs()` in `llm-router.ts`, use `getText2SqlTimeoutMs()` in `text2sql-engine.ts`, and add these exact lines to `.env.example`:

```dotenv
SILICONFLOW_ROUTER_TIMEOUT_MS=30000
SILICONFLOW_TEXT2SQL_TIMEOUT_MS=30000
```

- [ ] **Step 5: Verify GREEN and build**

Run the Node test again, then run:

```powershell
docker buildx build --platform linux/amd64 --load --tag agent-cdcbuddy:1.0.1 --build-arg NEXT_PUBLIC_TIANDITU_KEY=45052613ad935c678a6a702faf0511b1 .
```

Expected: tests PASS and build exits 0.

- [ ] **Step 6: Commit**

```powershell
git add .env.example src/lib/config/llm-timeout.ts src/lib/skills/llm-router.ts src/lib/skills/text2sql-engine.ts tests/deployment/llm-timeout.test.mjs
git commit -m "fix: make LLM request timeouts configurable"
```

### Task 2: Package and deploy image 1.0.1

**Files:**
- Generate: `.deploy-artifacts/agent-cdcbuddy-1.0.1-linux-amd64.tar` (ignored)
- Modify: `scripts/deploy/deploy.config.ps1` (ignored machine-local configuration)

**Interfaces:**
- Consumes: `agent-cdcbuddy:1.0.1`
- Produces: healthy remote container `agent-cdcbuddy` on preserved port `32112`

- [ ] **Step 1: Export the image**

```powershell
.\scripts\deploy\build-image.ps1 -ImageName agent-cdcbuddy:1.0.1 -OutputPath .deploy-artifacts/agent-cdcbuddy-1.0.1-linux-amd64.tar -TiandituKey 45052613ad935c678a6a702faf0511b1
```

Expected: platform `linux/amd64` and a non-empty tar.

- [ ] **Step 2: Update the ignored deployment config**

Set `ImageName = 'agent-cdcbuddy:1.0.1'` and `TarPath = '.deploy-artifacts/agent-cdcbuddy-1.0.1-linux-amd64.tar'`.

- [ ] **Step 3: Deploy**

```powershell
.\scripts\deploy\deploy-remote.ps1
```

Expected: image `agent-cdcbuddy:1.0.1`, port `32112`, and health `healthy`.

### Task 3: Production regression verification and publication

**Files:**
- No production file changes.

**Interfaces:**
- Consumes: `http://39.106.143.253:32112/api/agent/dispatch`
- Produces: evidence that requests no longer abort at 4 seconds and a branch ready for a separate PR.

- [ ] **Step 1: Verify remote image, health, and masked timeout environment state**

Use `docker inspect agent-cdcbuddy` and `docker exec` on the server. Missing timeout variables are valid because code defaults to 30000.

- [ ] **Step 2: Exercise the real dispatch endpoint five times**

Send `查询郑州市2024年蚊虫监测数据` with a 45-second client timeout and record elapsed time, source, and skill ID. Confirm logs do not show `This operation was aborted` at approximately 4 seconds; delays beyond 30 seconds may still use the existing fallback.

- [ ] **Step 3: Run final verification**

```powershell
docker run --rm -v "${PWD}:/workspace" -w /workspace node:22-bookworm-slim node --experimental-strip-types --test tests/deployment/llm-timeout.test.mjs
powershell -ExecutionPolicy Bypass -File tests/deployment/verify-docker-artifacts.ps1
powershell -ExecutionPolicy Bypass -File tests/deployment/verify-deploy-scripts.ps1
git diff --check
git status --short
```

Expected: all checks exit 0 and only intentional commits remain.

- [ ] **Step 4: Push and create a draft PR only after verification**

```powershell
git push -u fork codex/llm-timeout-config
gh pr create --repo NathanZhang/Agent-CdcBuddy --base main --head zp1103:codex/llm-timeout-config --draft
```

Expected: a new draft PR targets `main` and contains only the timeout design and implementation commits.
