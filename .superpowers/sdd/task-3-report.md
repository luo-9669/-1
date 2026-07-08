# Task 3 Report: URL Relay Dispatcher

## Scope

- Implemented `backend/services/capture-dispatcher.js`
- Updated `backend/services/capture-task-store.js` to support executors exposing either `execute()` or `makeCaptureResult()`
- Updated `backend/services/capture-runner.js` to preserve relay metadata in `raw`
- Added workflow coverage in `tests/workflows.test.mjs`
- Kept within phase-one constraints:
  - web URL capture only
  - auth mode constrained to `public|browser|cookie`
  - declarative template flow preserved
  - diagnostics left to existing four-category classifier
  - reused existing runner/task-store flow without mock-api wiring or frontend changes

## TDD Evidence

### RED

1. Added failing integration test:
   - `backend capture dispatcher compiles relay metadata before task-store execution`
2. Ran focused test command:

```bash
npm test -- --test-name-pattern="backend capture dispatcher compiles relay metadata before task-store execution"
```

3. Observed expected failure:
   - `Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../backend/services/capture-dispatcher.js`

This confirmed the test was exercising missing dispatcher behavior rather than passing on existing code.

### GREEN

Implemented:

- `createCaptureDispatcher(deps).execute(payload)`
- task-store executor compatibility branch
- relay metadata passthrough into runner result `raw.templateId` and `raw.relayMatchReason`

Ran focused verification:

```bash
npm test -- --test-name-pattern="backend capture dispatcher compiles relay metadata before task-store execution|backend capture runner assembles capture result from injected target capture|backend capture task store persists every run and resolves latest result|backend capture task store persists failed capture tasks"
```

Observed:

- dispatcher integration test passed
- existing task-store success/failure tests passed
- runner assembly test passed with new relay assertions

## Implementation Notes

### Dispatcher

`createCaptureDispatcher()` now orchestrates:

1. URL analysis
2. template matching
3. task compilation
4. capture execution through existing runner
5. diagnostics classification

It returns the original capture result plus:

- `templateId`
- classified `diagnostics`
- `recoveryActions`
- `relay.analysis`
- `relay.compiledTask`
- `relay.matchReason`

If diagnostics classify the result as blocked, the returned status is normalized to `blocked`.

### Task Store Compatibility

`runTask()` now accepts either:

- a dispatcher-like executor with `execute(input)`
- the legacy runner contract with `makeCaptureResult(input)`

This preserves existing behavior while allowing relay orchestration to plug into the same store lifecycle.

### Runner Relay Metadata

`capture-runner` now includes:

- `raw.templateId`
- `raw.relayMatchReason`

when `payload.relay` is present, preserving relay provenance for downstream consumers without replacing the current result shape.

## Verification

Focused verification:

```bash
npm test -- --test-name-pattern="backend capture dispatcher compiles relay metadata before task-store execution|backend capture runner assembles capture result from injected target capture|backend capture task store persists every run and resolves latest result|backend capture task store persists failed capture tasks"
```

Result:

- exit code `0`

Full suite verification:

```bash
npm test
```

Result:

- exit code `0`

## Commit

Committed with:

```bash
git commit -m "feat: dispatch compiled relay tasks through capture store"
```

## Concerns

- No additional route wiring was added by design; this task only introduced dispatcher/store/runner compatibility.
- Dispatcher currently assumes injected dependencies are present and valid, matching the existing lightweight service style.

## Reviewer Fix: Blocked Task Status Persistence

Reviewer feedback identified that `runTask()` persisted every non-throwing executor result as task status `success`, even when the executor returned a semantic result status like `blocked`.

### RED

1. Added regression test:
   - `backend capture task store persists blocked dispatcher results as blocked status`
2. Ran focused test command:

```bash
npm test -- --test-name-pattern="backend capture task store persists blocked dispatcher results as blocked status"
```

3. Observed expected failure:
   - assertion failure on stored task status
   - actual: `success`
   - expected: `blocked`

This confirmed the persistence layer was overwriting dispatcher result semantics.

### GREEN

Implemented a minimal task-store status normalization step so persisted task status now follows result semantics:

- `blocked` -> `blocked`
- `failed` -> `failed`
- all other non-throwing result statuses -> `success`

Ran focused verification:

```bash
npm test -- --test-name-pattern="backend capture task store persists blocked dispatcher results as blocked status|backend capture task store persists every run and resolves latest result|backend capture task store persists failed capture tasks|backend capture dispatcher compiles relay metadata before task-store execution"
```

Observed:

- blocked regression test passed
- existing success path task-store test passed
- existing thrown failure path task-store test passed
- dispatcher integration test still passed
