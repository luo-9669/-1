# Task 5 Report

## Scope

- Task: Move backend page-generation gates off the frontend service file.
- Allowed write targets only:
  - `backend/services/capture-quality-gate.js`
  - `backend/services/capture-service.js`
  - `tests/workflows.test.mjs`
  - `.superpowers/sdd/task-5-report.md`

## Requirement Note

- The brief listed legacy helper names `semanticCaptureNodes`, `semanticPreviewNodes`, and `captureActionRecommendations`.
- Those helpers do not exist in the current worktree, including `frontend/src/services/factoryWorkspace.js`.
- User confirmed implementation should extract the helpers that actually exist today and are truly used by `captureRestoreReadiness()` and `captureQualityGate()`.

## TDD Evidence

### RED

1. Added failing test:
   - `backend capture service imports readiness and quality gate from backend services`
2. Ran focused check:
   - `node --input-type=module -e "...import('./backend/services/capture-quality-gate.js')..."`
   - Result: failed with `ERR_MODULE_NOT_FOUND` because `backend/services/capture-quality-gate.js` did not exist.
3. Ran full suite:
   - `npm test`
   - Result: failed at `backend capture service imports readiness and quality gate from backend services`
   - Failure reason: missing backend gate module import target.

### GREEN

1. Created `backend/services/capture-quality-gate.js` with backend-owned copies of the currently used helpers:
   - `captureRestoreReadiness`
   - `countMeaningfulTreeNodes`
   - `duplicateTextRatio`
   - `singleFilePlainText`
   - `detectInvalidCapturePage`
   - `capturePageHeight`
   - `captureQualityGate`
2. Switched `backend/services/capture-service.js` import from frontend `factoryWorkspace.js` to local `./capture-quality-gate.js`.
3. Re-ran focused check:
   - `node --input-type=module -e "..."`
   - Result: `PASS focus capture gate extraction`
4. Re-ran full suite:
   - `npm test`
   - Result: pass, including:
     - `backend capture service imports readiness and quality gate from backend services`
     - existing capture readiness / quality gate / page generation tests

## Changes Made

### `backend/services/capture-quality-gate.js`

- Added backend-owned readiness and quality gate logic.
- Kept behavior aligned with the current frontend implementation.
- Did not introduce new diagnostics, capture modes, or auth modes.

### `backend/services/capture-service.js`

- Removed backend dependency on `../../frontend/src/services/factoryWorkspace.js`.
- Now imports:
  - `captureRestoreReadiness`
  - `captureQualityGate`
  from `./capture-quality-gate.js`.

### `tests/workflows.test.mjs`

- Added import-ownership regression test to ensure:
  - backend service imports from `./capture-quality-gate.js`
  - backend service no longer imports frontend `factoryWorkspace.js`
  - extracted functions preserve expected screenshot-only / denied-page behavior

## Verification Summary

- Focused check: passed
- Full `npm test`: passed

## Commit

- `refactor: move capture quality gate logic into backend services`
