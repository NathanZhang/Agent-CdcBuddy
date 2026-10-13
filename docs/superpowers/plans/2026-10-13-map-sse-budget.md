# Map SSE budget repair

> **For agentic workers:** Execute this plan inline using test-driven development.

**Goal:** Complete Henan city/county map turns over fragmented SSE without clearing successful maps.

**Architecture:** Negotiate a frame-local geometry pool for the application client. Restore the original event shape before consumption. Share bounded byte budgets between server encoding and client decoding, while retaining the smaller default for LLM streams.

**Tech Stack:** TypeScript, Next.js streams, Vitest.

**Spec:** User-approved diagnosis in this chat: remove repeated geometry, align budgets, and test fragmented delivery.

## Constraints

- Preserve run events, AG-UI schemas, authorization, persisted results, and session restoration.
- Retain plain JSON SSE for clients that do not request the compact encoding.
- Keep the existing 8 MiB map composition limit; allow up to 32 MiB per dispatch frame for all result projections and non-map evidence.
- Work in the current clean checkout and leave changes reviewable; no publish or merge.

## Review focus

- A complete oversized frame must fail just like a fragmented one.
- Budget accounting must use UTF-8 bytes and ignore the total size of multiple valid frames.
- Geometry pooling must preserve exclusions, properties, repeated geometries, and unrelated user data.
- Truncated or malformed compact payloads must fail visibly without inheriting stale data.
- Legacy consumers and LLM streams must retain their existing event shapes and smaller LLM budget.

## Task 1: Reproduction and bounded decoding

- [x] Add real-route/client Henan city/county regression tests with 64 KiB delivery fragments.
- [x] Add complete/fragmented, Unicode, and multi-frame budget tests; observe failures.
- [x] Implement configurable byte-based frame checks and shared map/dispatch constants.

## Task 2: Lossless geometry pooling

- [x] Add compact round-trip, malformed-path, and plain-format compatibility tests; observe failures.
- [x] Add frame-local pool encoding and restoration; negotiate it in dispatch requests.
- [x] Encode server frames and decode application frames with the same dispatch budget.
- [x] Verify small frames, restored results, successful map state, and legacy compatibility.

## Task 3: Verification

- [x] Run targeted tests, full `npm test`, lint, type checks, and production build.
- [x] Review the diff independently and address important findings.
- [x] Record actual results and report any limitations.

## Verification record

- Initial map/client regression failed with the original decoder; complete-frame and UTF-8 budget tests also failed.
- Targeted dispatch/session tests: 73 passed. Final new regression files: 18 passed.
- Full `npm test`: 401 TypeScript tests (before the additional large-client test), 32 scientific tests, 24 integration tests, and 44 legacy cases passed. The additional client case also passed, with an old-budget mutation proving it fails before the fix.
- `npm run lint`, `npx tsc --noEmit`, and `npm run build`: exit 0.
- Independent read-only review: no critical or important findings; all 18 new tests independently passed.
- The sandbox denies HTTP listener creation (`listen EPERM`); full HTTP integration was rerun successfully with approved escalation.
- Geometry pooling intentionally supports the JSON-shaped result contracts produced here. Peak browser memory at the 32 MiB limit was not benchmarked.
- Evidence: `docs/reviews/2026-10-13/map-sse-budget/`. Original databases remained unchanged during isolated legacy verification.
