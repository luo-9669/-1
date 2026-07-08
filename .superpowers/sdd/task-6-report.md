# Task 6 Report: Expose Relay Metadata In The Frontend Capture Result UI

## Scope

- Modified `/Users/cds-dn-868/Desktop/流程通区分前后端/.worktrees/codex-url-rule-template-relay/frontend/src/App.vue`
- Modified `/Users/cds-dn-868/Desktop/流程通区分前后端/.worktrees/codex-url-rule-template-relay/frontend/src/styles.css`
- Modified `/Users/cds-dn-868/Desktop/流程通区分前后端/.worktrees/codex-url-rule-template-relay/tests/workflows.test.mjs`

No backend contract changes were made. The frontend only renders backend-provided `templateId`, `diagnostics`, and `recoveryActions` inside the existing capture detail area.

## TDD Evidence

### RED

1. Added the required source test:
   - `web factory capture detail renders backend relay diagnostics and recovery actions`
2. Ran:

```bash
npm test -- --grep "web factory capture detail renders backend relay diagnostics and recovery actions"
```

3. Observed expected failure:
   - `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /const captureRelayDiagnostics = computed/`

This confirmed the relay display hooks and markup were missing before implementation.

### GREEN

Implemented the minimum UI needed to satisfy the brief:

- Added computed helpers:
  - `captureRelayDiagnostics`
  - `captureRelayActions`
  - `captureRelayTemplateId`
- Added a compact relay diagnostics panel inside capture detail
- Added compact relay panel styles

Re-ran:

```bash
npm test -- --grep "web factory capture detail renders backend relay diagnostics and recovery actions"
```

Observed:

- The new relay test passed

## Implementation Notes

- The panel only renders when at least one of these backend fields is present:
  - `templateId`
  - `diagnostics`
  - `recoveryActions`
- The UI does not infer relay status or synthesize rules on the client
- The template label falls back to `未命中模板` only when the section is shown without a backend `templateId`
- The panel was inserted after the existing capture diagnostics block to keep the change localized

## Verification

### Focused test

```bash
npm test -- --grep "web factory capture detail renders backend relay diagnostics and recovery actions"
```

- PASS

### Full test suite

```bash
npm test
```

- PASS

### Production build

```bash
npm run build
```

- PASS

## Commit

Expected commit message from brief:

```bash
feat: show capture relay diagnostics in web factory
```

## Concerns

- Current coverage is source-structure based, consistent with the existing frontend test style in this repo, but it does not mount the Vue component at runtime.
