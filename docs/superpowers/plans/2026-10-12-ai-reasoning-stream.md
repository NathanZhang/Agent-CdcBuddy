# AI reasoning display implementation plan

**Goal:** Display provider-returned LLM reasoning and answer content, with automatic scrolling in both chat surfaces.

**Architecture:** Decode bounded provider SSE into the existing Agent run stream; retain tool validation and server authorization. Update one pending assistant message in the shared workbench controller and render the existing reasoning card in both surfaces.

**Tech stack:** TypeScript, React, Next.js, Vitest.

**Spec:** User request in this chat: 修改AI交互，显示LLM的推理过程和内容（推理内容也要自动滚动）。

## Constraints and review focus

- Show only actual provider reasoning; do not transform or fabricate it.
- Preserve bounded requests, validated tool calls and final results.
- Handle split Unicode/tool arguments, retries, truncation, cancellation and stale callbacks.
- Avoid duplicate assistant replies; preserve reasoning in session history.
- Scroll both the reasoning container and the outer chat as content arrives.

## Steps

- [x] Add failing provider, dispatch and controller tests for incremental reasoning/content and cancellation.
- [x] Implement provider streaming and project reasoning/content through the Agent and legacy SSE boundary.
- [x] Update the pending message, history persistence and shared rendering in main chat and widget.
- [x] Verify targeted tests, lint, TypeScript and the project suite; inspect the resulting UI.

## Verification

- Provider, transport, controller and Agent tests verify early delivery, Unicode/tool assembly, incomplete streams, retry reset, cancellation, history restoration and duplicate-free final answers.
- Independent review found field-order assumptions in the JSON preview. Added a failing regression, then replaced the preview with a top-level parser preserving the evidence gate.
- Full `npm test`: 147 refactor tests, 29 scientific tests, 24 integration tests and 44 legacy cases passed. A final focused run added and passed the eighth reasoning-stream test for retry reset.
- `npm run lint`, `npx tsc --noEmit --incremental false` and `git diff --check` passed.
- Real local browser/model verification: reasoning arrived before completion; final reply rendered; main reasoning scrollTop=105 at scrollHeight=360/clientHeight=255, widget scrollTop=129 at scrollHeight=384/clientHeight=255.
- Initial sandbox test run could not start the isolated auth HTTP server; authorized rerun outside the sandbox passed.

## Follow-up: idle timeout

- Root cause: the request deadline ran from fetch start without renewal while reasoning was arriving.
- Streaming requests now renew the existing 60-second timeout on nonempty reasoning, answer or native tool-call fragments. Initial silence and stalled streams still time out and retry; heartbeat comments and empty deltas do not renew it. Non-streaming requests keep their total deadline.
- Added `llm-idle-timeout.test.ts`: reproduced premature retries before the fix, then verified 225 seconds of continuous output without retry, a full idle window after the last output, heartbeat handling, user cancellation and timer cleanup.
- Independent review: no actionable issues. Final full suite: 152 refactor tests, 29 scientific tests, 24 integration tests and 44 legacy cases passed. TypeScript, lint and diff whitespace checks passed.
