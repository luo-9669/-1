# Task 2 Report: Capture Compiler And Diagnostic Classifier

## Scope

- Implemented only the Task 2 files allowed for write access:
  - `tests/workflows.test.mjs`
  - `backend/services/capture-compiler.js`
  - `backend/services/capture-diagnostics.js`
- Did not modify capture runner, capture task store, routes, or frontend.
- Kept phase-one scope as web URL capture only.
- Kept auth mode constrained to `public | browser | cookie`.
- Kept diagnostics constrained to:
  - `LOGIN_REQUIRED`
  - `COOKIE_EXPIRED`
  - `DOM_NOT_RESTORABLE`
  - `ANTI_BOT_SUSPECTED`
- Did not introduce any free-form Playwright script generation or persistence.

## TDD Evidence

### RED

1. Added the exact contract test from the brief to `tests/workflows.test.mjs`.
2. Ran the focused test command:

```bash
npm test -- --test-name-pattern="compiles relay capture tasks and classifies capture diagnostics"
```

3. Observed the expected failure:

```text
FAIL compiles relay capture tasks and classifies capture diagnostics
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../backend/services/capture-compiler.js'
```

This confirmed the new behavior was not already implemented and the failing test was exercising the missing compiler/diagnostics layer.

### GREEN

1. Implemented `compileCaptureTask(input)` in `backend/services/capture-compiler.js`.
2. Implemented `classifyCaptureDiagnostics(input)` in `backend/services/capture-diagnostics.js`.
3. Re-ran the same focused test command and observed:

```text
PASS compiles relay capture tasks and classifies capture diagnostics
```

## Implementation Summary

### `compileCaptureTask`

- Normalizes auth mode to `public | browser | cookie`, defaulting invalid values to `public`.
- Compiles declarative relay data from:
  - request payload
  - URL analysis result
  - template match result
- Produces:
  - `taskType: 'web-capture'`
  - `projectId`
  - `templateId`
  - `source.url`
  - auth payload limited to `sessionId` for browser mode and `cookieText` for cookie mode
  - execution settings copied from declarative template navigation/page strategy
  - artifact flags copied from declarative template
  - fixed diagnostics policy flags
  - relay metadata including match reason, page class, and auth requirement hint

### `classifyCaptureDiagnostics`

- Detects and returns only the allowed diagnostic codes.
- Maps auth-required public captures to `LOGIN_REQUIRED`.
- Maps fetch errors containing cookie/auth expiration signals to `COOKIE_EXPIRED`.
- Maps empty HTML/static/layout output to `DOM_NOT_RESTORABLE`.
- Maps blocked HTML or blocked fetch messages (`405`, `异常访问`, `access denied`, `forbidden`, etc.) to `ANTI_BOT_SUSPECTED`.
- Returns:
  - `status: 'blocked'` when any diagnostic is present
  - `diagnostics`
  - deduplicated `recoveryActions`

## Verification

### Focused test

```bash
npm test -- --test-name-pattern="compiles relay capture tasks and classifies capture diagnostics"
```

Result:

```text
PASS compiles relay capture tasks and classifies capture diagnostics
```

### Full test suite

```bash
npm test
```

Result:

```text
PASS compiles relay capture tasks and classifies capture diagnostics
```

The full suite completed green after the Task 2 changes.

## Commit

Committed with the brief-required message:

```text
feat: add capture compiler and diagnostics
```

## Concerns

- The current anti-bot and cookie-expired detection is intentionally heuristic and string-based, which matches the brief and current task boundary.
- No runner or route integration was added in this task by design; this commit only establishes the compiler/diagnostics contract and tests.

## Reviewer Fix Follow-up

### Additional RED

1. Extended the Task 2 test to lock the other three allowed diagnostics:
   - `LOGIN_REQUIRED`
   - `COOKIE_EXPIRED`
   - `DOM_NOT_RESTORABLE`
2. Added a regression case where top-level `captureResult.layoutNodes` contains data while `raw.layoutNodeCount` stays `0`, to ensure this does not get misclassified as `DOM_NOT_RESTORABLE`.
3. Added a structured auth-expiry case using `raw.fetchStatus = 403`.
4. Ran the focused test again:

```bash
npm test -- --test-name-pattern="compiles relay capture tasks and classifies capture diagnostics"
```

5. Observed the expected failure:

```text
FAIL compiles relay capture tasks and classifies capture diagnostics
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ 'completed'
- 'blocked'
```

This failure came from the new `COOKIE_EXPIRED` regression using structured `raw.fetchStatus`, confirming the missing branch before the fix.

### Additional GREEN

1. Updated `classifyCaptureDiagnostics(input)` to:
   - treat top-level `captureResult.layoutNodes` as restorable DOM evidence
   - treat `raw.fetchStatus === 401 || 403` as `COOKIE_EXPIRED`
2. Re-ran the same focused command and confirmed:

```text
PASS compiles relay capture tasks and classifies capture diagnostics
```

3. Re-ran the full suite:

```bash
npm test
```

4. Confirmed the full suite stayed green after the follow-up fix.
