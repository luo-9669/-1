# Task 1 Report: Declarative Template Library, URL Analyzer, And Template Matcher

## Scope

Implemented Task 1 for the URL relay plan inside the allowed backend/template analysis surface only:

- `tests/workflows.test.mjs`
- `backend/services/capture-templates.js`
- `backend/services/capture-url-analyzer.js`
- `backend/services/capture-template-matcher.js`

Also wrote this report file after explicit authorization.

No changes were made to capture runner, capture task store, or capture routes.

## Requirements Checklist

- Phase-one web URL capture only: satisfied
- Auth mode limited to `public|browser|cookie`: satisfied
- Templates are declarative: satisfied
- Templates limited to `generic-public-page`, `generic-login-page`, `generic-saas-dashboard`: satisfied
- Backend owns URL analysis, template matching, parameter completion surface: satisfied for Task 1 scope
- No free-form Playwright script generation or persistence: satisfied
- Frontend kept unchanged: satisfied

## TDD Record

### RED

First, added the required test block to `tests/workflows.test.mjs`:

- `analyzes capture URLs and matches phase-one relay templates`

Then ran the focused verification command:

```bash
npm test -- --test-name-pattern "analyzes capture URLs and matches phase-one relay templates"
```

Observed expected failure:

- Exit code: `1`
- Failure type: `ERR_MODULE_NOT_FOUND`
- Missing module: `../backend/services/capture-url-analyzer.js`

This confirmed the test was genuinely exercising missing Task 1 functionality before implementation.

### GREEN

Implemented the minimum production code required to satisfy the failing test:

1. `backend/services/capture-templates.js`
   - Added declarative `CAPTURE_TEMPLATES` registry
   - Included only:
     - `generic-public-page`
     - `generic-login-page`
     - `generic-saas-dashboard`

2. `backend/services/capture-url-analyzer.js`
   - Added `analyzeCaptureUrl(input)`
   - Normalizes auth mode to the allowed set
   - Infers page class from URL path/query
   - Returns analysis with `traits` and `authHints`

3. `backend/services/capture-template-matcher.js`
   - Added `matchCaptureTemplate(input)`
   - Matches declarative template by `pageClass` and `authMode`
   - Returns `templateId`, `template`, and `matchReason`

Re-ran the focused verification command:

```bash
npm test -- --test-name-pattern "analyzes capture URLs and matches phase-one relay templates"
```

Observed passing result:

- Exit code: `0`
- Target test: `PASS analyzes capture URLs and matches phase-one relay templates`

## Full Verification

After the focused test passed, ran the full suite:

```bash
npm test
```

Observed passing result:

- Exit code: `0`
- Full suite completed with the new Task 1 test included
- No failing tests remained

## Behavior Implemented

### URL Analyzer

`analyzeCaptureUrl(input)` now produces:

- `normalizedUrl`
- `hostname`
- `pathname`
- `query`
- normalized `authMode`
- `traits.pageClass`
- `traits.loginSignals`
- `traits.dynamicSignals`
- `authHints.requiresAuth`
- `authHints.preferredAuthMode`

Current inference rules:

- Login-like paths/query -> `login-page`
- Dashboard/app/admin/workspace/console paths -> `saas-dashboard`
- Everything else -> `public-page`

### Template Registry

Each template is declarative and contains:

- `id`
- `name`
- `pageClasses`
- `match.authModes`
- `preconditions`
- `navigation`
- `pageStrategy`
- `artifacts`
- `fallbacks`

### Template Matcher

`matchCaptureTemplate(input)` now:

- Uses analysis traits to choose the correct template
- Honors the allowed auth modes
- Falls back to the first declarative template when no exact match exists
- Emits a readable `matchReason`

## Files Changed

- `/Users/cds-dn-868/Desktop/流程通区分前后端/.worktrees/codex-url-rule-template-relay/tests/workflows.test.mjs`
- `/Users/cds-dn-868/Desktop/流程通区分前后端/.worktrees/codex-url-rule-template-relay/backend/services/capture-templates.js`
- `/Users/cds-dn-868/Desktop/流程通区分前后端/.worktrees/codex-url-rule-template-relay/backend/services/capture-url-analyzer.js`
- `/Users/cds-dn-868/Desktop/流程通区分前后端/.worktrees/codex-url-rule-template-relay/backend/services/capture-template-matcher.js`
- `/Users/cds-dn-868/Desktop/流程通区分前后端/.worktrees/codex-url-rule-template-relay/.superpowers/sdd/task-1-report.md`

## Commit

Committed with the required message:

```text
feat: add capture URL analyzer and template matcher
```

## Notes / Concerns

- The focused test command still executes the single test runner file and reports many passing tests because this repository’s test harness filters inside one large script rather than spawning an isolated test file.
- `capture-url-analyzer.js` currently relies on the built-in `URL` constructor and will throw on invalid or empty URLs. This is acceptable for Task 1 because the brief only required the specified interface and exact test behavior; broader validation can be added by later tasks if needed.
