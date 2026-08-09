# CdcBuddy Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, export, upload, and run a production Linux/amd64 image for CdcBuddy on `39.106.143.253` under `/data/Agent-CdcBuddy` using the first free port in `32100-32199`.

**Architecture:** A single container keeps the existing Next.js-to-Python subprocess boundary. SQLite databases and runtime environment configuration remain outside the image and are mounted from the remote deployment directory.

**Tech Stack:** Docker BuildKit/Buildx, Node.js 22, Next.js 15 standalone output, Python 3.11, SQLite, PowerShell 7/Windows PowerShell, SSH/SCP, Docker Compose.

## Global Constraints

- Build target is exactly `linux/amd64`.
- Remote host is exactly `root@39.106.143.253`.
- Remote project path is exactly `/data/Agent-CdcBuddy`.
- Published port must be the first free integer in `32100-32199`.
- `vector_monitoring.db`, `app_business.db`, and environment files must not be embedded in the image.
- `vector_monitoring.db` is mounted read-only; `app_business.db` is mounted read-write and persists across container replacement.
- Existing remote `.env`, databases, and selected port records must not be overwritten implicitly.

---

### Task 1: Production container contract

**Files:**
- Create: `tests/deployment/verify-docker-artifacts.ps1`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker/entrypoint.sh`
- Create: `compose.production.yml`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `package-lock.json`, `requirements.txt`, `scripts/init_business_db.py`.
- Produces: image entrypoint `/app/docker/entrypoint.sh`, HTTP port `3000`, health check, and Compose variables `APP_IMAGE`, `APP_PORT`, `DEPLOY_DIR`.

- [ ] **Step 1: Write the artifact contract test**

```powershell
$required = @('Dockerfile', '.dockerignore', 'docker/entrypoint.sh', 'compose.production.yml')
$required | ForEach-Object { if (-not (Test-Path $_)) { throw "Missing deployment artifact: $_" } }
$dockerignore = Get-Content .dockerignore -Raw
@('*.db', '.env', '.env*.local') | ForEach-Object { if ($dockerignore -notmatch [regex]::Escape($_)) { throw "Not excluded: $_" } }
$compose = Get-Content compose.production.yml -Raw
if ($compose -notmatch '32100' -and $compose -notmatch 'APP_PORT') { throw 'Missing external port variable' }
```

- [ ] **Step 2: Run the contract test and confirm it fails**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/deployment/verify-docker-artifacts.ps1`

Expected: failure reporting missing `Dockerfile`.

- [ ] **Step 3: Implement the minimal production container files**

Use a Node 22 builder with `npm ci` and `next build`, enable `output: 'standalone'`, then copy `.next/standalone`, `.next/static`, `public`, `analytics_engine`, `scripts/init_business_db.py`, `requirements.txt`, and the entrypoint into a Python 3.11 runtime that also contains the Node 22 runtime. Compose must mount `${DEPLOY_DIR}/vector_monitoring.db:/app/vector_monitoring.db:ro` and `${DEPLOY_DIR}/data:/app/data`.

- [ ] **Step 4: Run the contract test and syntax checks**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/deployment/verify-docker-artifacts.ps1`

Expected: `PASS: Docker deployment artifacts`.

Run: `docker compose -f compose.production.yml config --quiet`

Expected: exit code 0 with `APP_PORT=32100`, `DEPLOY_DIR` set to the repository root, and `APP_IMAGE=agent-cdcbuddy:1.0.0` supplied for validation.

### Task 2: Runtime secret and database safety

**Files:**
- Modify: `src/app/api/copilotkit/route.ts`
- Modify: `src/lib/skills/llm-router.ts`
- Modify: `src/lib/skills/text2sql-engine.ts`
- Modify: `scripts/check_models.js`
- Modify: `scripts/quick_test.js`
- Modify: `scripts/test_llm_tool_calling.js`
- Modify: `scripts/test_llm_tool_calling.ts`
- Modify: `.gitignore`
- Test: `tests/deployment/verify-docker-artifacts.ps1`

**Interfaces:**
- Consumes: runtime variables `SILICONFLOW_API_KEY`, `SILICONFLOW_BASE_URL`, `SILICONFLOW_MODEL`.
- Produces: source tree and final server bundle with no embedded `sk-` credential fallback.

- [ ] **Step 1: Extend the failing safety test**

```powershell
$trackedText = git grep -n "sk-[a-zA-Z0-9]" -- '*.ts' '*.js'
if ($LASTEXITCODE -eq 0 -and $trackedText) { throw 'Hard-coded API credential remains in tracked source' }
if ((Get-Content .gitignore -Raw) -notmatch 'scripts/deploy/deploy.config.ps1') { throw 'Local deploy config is not ignored' }
```

- [ ] **Step 2: Run and confirm the credential test fails**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/deployment/verify-docker-artifacts.ps1`

Expected: failure `Hard-coded API credential remains in tracked source`.

- [ ] **Step 3: Replace credential fallbacks and ignore local configuration**

Use `process.env.SILICONFLOW_API_KEY || 'missing-siliconflow-api-key'`; keep the non-secret base URL and model defaults. Add `/scripts/deploy/deploy.config.ps1` to `.gitignore`.

- [ ] **Step 4: Re-run the safety test**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/deployment/verify-docker-artifacts.ps1`

Expected: PASS.

### Task 3: Repeatable local build and remote deployment scripts

**Files:**
- Create: `scripts/deploy/remote-common.ps1`
- Create: `scripts/deploy/build-image.ps1`
- Create: `scripts/deploy/deploy-remote.ps1`
- Create: `scripts/deploy/status.ps1`
- Create: `scripts/deploy/logs.ps1`
- Create: `scripts/deploy/deploy.config.ps1.example`
- Test: `tests/deployment/verify-deploy-scripts.ps1`

**Interfaces:**
- Consumes: SSH target, remote path, image name, tar output path, port range.
- Produces: `Get-FirstFreeRemotePort`, `Invoke-Remote`, `Copy-ToRemote`, local tar under `.deploy-artifacts`, remote `deploy.env`, and running container `agent-cdcbuddy`.

- [ ] **Step 1: Write deployment helper safety tests**

```powershell
. scripts/deploy/remote-common.ps1
Assert-SafeRemotePath '/data/Agent-CdcBuddy'
try { Assert-SafeRemotePath '/'; throw 'Unsafe root path accepted' } catch { }
if ((Get-DeploymentPortCandidates)[0] -ne 32100) { throw 'Wrong first port' }
if ((Get-DeploymentPortCandidates)[-1] -ne 32199) { throw 'Wrong last port' }
```

- [ ] **Step 2: Run and confirm the helper test fails**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/deployment/verify-deploy-scripts.ps1`

Expected: failure because `remote-common.ps1` does not exist.

- [ ] **Step 3: Implement helpers and scripts**

Centralize exact configuration defaults in `remote-common.ps1`. `deploy-remote.ps1` must create the validated remote path, preserve an existing `.env`, copy `.env.example` only when `.env` is absent, select and persist the first free port, upload/load the tar, and run `docker compose up -d --pull never`.

- [ ] **Step 4: Run helper tests and PowerShell parser checks**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/deployment/verify-deploy-scripts.ps1`

Expected: PASS.

Run: parse every `scripts/deploy/*.ps1` with `[System.Management.Automation.Language.Parser]::ParseFile(...)` and assert zero errors.

Expected: zero parser errors.

### Task 4: Build, export, deploy, and verify

**Files:**
- Create at runtime: `.deploy-artifacts/agent-cdcbuddy-1.0.0-linux-amd64.tar`
- Create remotely: `/data/Agent-CdcBuddy/{image tar,compose.production.yml,.env,deploy.env,vector_monitoring.db,data/app_business.db}`

**Interfaces:**
- Consumes: Tasks 1-3 artifacts and the verified local `vector_monitoring.db`.
- Produces: healthy remote container and reachable URL `http://39.106.143.253:<selected-port>/`.

- [ ] **Step 1: Run repository checks before building**

Run: deployment tests, `npm ci`, `npm run build`, and `python tests/comprehensive_evaluation_test.py` where dependency availability permits.

Expected: all deployment tests and Next.js build pass; database quick check remains `ok`.

- [ ] **Step 2: Build and export the image**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/build-image.ps1`

Expected: image platform `linux/amd64`; tar exists and has non-zero size.

- [ ] **Step 3: Run a local container smoke test**

Run the image with the real monitoring DB mounted read-only and a temporary business DB directory, wait for Docker health, request `/`, then remove only the temporary smoke-test container and directory.

Expected: HTTP 200 and healthy container.

- [ ] **Step 4: Upload and start remotely**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/deploy-remote.ps1`

Expected: remote image loads, first free port is persisted, and `agent-cdcbuddy` becomes healthy.

- [ ] **Step 5: Verify remote state**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy/status.ps1`

Expected: container status is healthy, mounted databases point under `/data/Agent-CdcBuddy`, and HTTP request to the selected published port returns 200.

- [ ] **Step 6: Final repository verification**

Run: `git diff --check`, deployment tests, and `git status --short`.

Expected: no whitespace errors; only intentional tracked deployment changes are listed; databases, environment files, build output, tar, and local deployment config remain ignored.
