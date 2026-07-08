# Task 4 Report

## Scope

Implemented Task 4 only:

- wired `POST /api/capture/start` in `backend/server/mock-api.mjs` through the existing relay dispatcher chain
- updated backend capture responsibility docs in `backend/README.md`
- added/updated tests in `tests/workflows.test.mjs`

Did not change frontend code, capture-service quality gate ownership, or any files outside the allowed write set.

## TDD Evidence

### RED

Added the required route-wiring test in `tests/workflows.test.mjs` and ran:

```bash
npm test -- --test-name-pattern "mock api wires capture start through the relay dispatcher and returns relay metadata|capture API returns backend timing metadata|backend capture dispatcher compiles relay metadata before task-store execution"
```

Observed failure:

- test: `mock api wires capture start through the relay dispatcher and returns relay metadata`
- assertion failed because `backend/server/mock-api.mjs` did not import `createCaptureDispatcher`
- the source still wired `captureTaskStore.runTask(payload, captureRunner)` directly

Relevant failure excerpt:

```text
FAIL mock api wires capture start through the relay dispatcher and returns relay metadata
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /import \{ createCaptureDispatcher \} from '\.\.\/services\/capture-dispatcher\.js'/
...
captureStart: async (payload) => captureTaskStore.runTask(payload, captureRunner)
```

### GREEN

Updated `backend/server/mock-api.mjs` to:

- import `createCaptureDispatcher`
- import `analyzeCaptureUrl`
- import `matchCaptureTemplate`
- import `compileCaptureTask`
- import `classifyCaptureDiagnostics`
- create `captureDispatcher` with those dependencies plus `captureRunner`
- wire `captureStart` through `captureTaskStore.runTask(payload, captureDispatcher)`

Re-ran focused tests:

```bash
npm test -- --test-name-pattern "mock api wires capture start through the relay dispatcher and returns relay metadata|capture API returns backend timing metadata|backend capture dispatcher compiles relay metadata before task-store execution|backend readme documents materials and restored page APIs"
```

Result: pass.

## Implementation Notes

### Backend entrypoint wiring

`backend/server/mock-api.mjs` now assembles the phase-one relay backend chain exactly at the capture entrypoint:

1. analyzer: `analyzeCaptureUrl`
2. matcher: `matchCaptureTemplate`
3. compiler: `compileCaptureTask`
4. diagnostics: `classifyCaptureDiagnostics`
5. executor: existing `captureRunner`
6. task persistence: existing `captureTaskStore`

This preserves the existing task store and runner behavior while making `/api/capture/start` return relay metadata such as `templateId`, `diagnostics`, and `recoveryActions`.

### README update

Updated `backend/README.md` capture backend responsibilities to document:

- `capture-url-analyzer.js`
- `capture-template-matcher.js`
- `capture-compiler.js`
- `capture-dispatcher.js`
- `capture-diagnostics.js`

and clarified that `server/mock-api.mjs` now composes the relay dispatcher for `capture/start`.

## Verification

Focused test run:

```bash
npm test -- --test-name-pattern "mock api wires capture start through the relay dispatcher and returns relay metadata|capture API returns backend timing metadata|backend capture dispatcher compiles relay metadata before task-store execution|backend readme documents materials and restored page APIs"
```

Result: passed.

Full suite:

```bash
npm test
```

Result: passed.

## Commit

Created commit:

```text
feat: wire capture start through relay dispatcher
```

## Concerns

No blocking concerns within Task 4 scope.

The relay chain is now only wired at the backend entrypoint as requested; deeper service extraction or expanded capture modes remain intentionally untouched.
