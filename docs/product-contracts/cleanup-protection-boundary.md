# Cleanup Protection Boundary Contract

## Goal

Code cleanup must preserve the current working product surface. A module is not deletable just because it is not part of the Advanced UX Markdown-first path. If the module is a confirmed current capability, cleanup may simplify or document it, but must not remove its entry points, backend services, tests, model providers, storage path, or generated-artifact rendering without explicit user confirmation.

## Protected Capabilities

The following capabilities are current product surface and must be preserved during cleanup:

- Advanced UX analysis.
- Interaction low-fidelity stage.
- Competitor analysis.
- Python competitor monitoring system.
- Image-to-code / design-image-to-code generation.
- Knowledge base.
- Requirement documents.
- Unified Agent conversation.
- File cards, Markdown artifacts, and PDF downloads.
- Draw.io artifacts and low-fidelity image artifacts.
- Design solution module.
- Engineering development module.
- Delivery assets module.
- Skill center.
- Codex model calling capability.
- Image generation model capability.

## Protected Implementation Areas

Cleanup must treat these areas as protected unless a targeted replacement plan has been approved:

- Frontend navigation, routes, pages, and services for the protected capabilities.
- Backend routes, services, adapters, and storage/hydration logic for the protected capabilities.
- Python code under the competitor monitoring engine.
- Model-provider configuration, provider routing, Codex model calls, streaming, retry, and error display.
- Image-generation provider configuration, generation pipeline, artifact persistence, preview, download, and Agent/canvas display.
- Workspace material types for requirement documents and knowledge base materials.
- Tests that protect any current product behavior, even when they are outside the default release gate.
- Product contracts and docs that describe current behavior.

## Cleanup Rules

- Do not delete a protected capability because it is unrelated to the active Advanced UX flow.
- Do not delete Python competitor-analysis code, model-provider code, image-generation code, knowledge-base code, or requirement-document code without explicit confirmation.
- Do not remove tests for a protected capability unless equivalent current tests replace them in the same change.
- Do not collapse distinct material types such as requirement documents and knowledge materials.
- Do not remove side-navigation entries or routes that represent protected modules without a product decision to retire that module.
- Do not remove backend APIs that the frontend still calls or that current tests cover.
- Do not delete code based only on filename age, legacy wording, or visual similarity to old work.

## Allowed Cleanup

Cleanup may remove or simplify:

- Clearly obsolete plans, temporary reports, generated backups, and local-only artifacts.
- Historical tests that assert deleted product directions, when the current release gate already covers the active behavior and the deletion is documented.
- Duplicate render paths that conflict with the current shared Agent/canvas contracts.
- Fallback business-output logic that fabricates content instead of using backend/model artifacts.
- Compatibility wrappers with no route, import, backend reference, or test coverage, after `rg` and git history checks.

## Required Checks Before Deleting A Module

Before deleting any non-trivial file group, verify and document:

- `rg` references across frontend, backend, tests, docs, and scripts.
- Whether the files support a protected capability listed above.
- Whether tests exist and whether they pass or need replacement.
- Whether the module owns runtime storage, generated artifacts, provider configuration, or local Python execution.
- Whether deleting it changes user-visible navigation, Agent behavior, canvas rendering, downloads, or model generation.

If any answer is uncertain, keep the module and ask for explicit confirmation before removal.

## Versioning Rule

Cleanup should be committed in small, runnable batches. Each batch must keep the app buildable and should be verified with the relevant release gate:

```bash
npm test
npm run build
git diff --check
```

For documentation-only contract updates, `git diff --check` is the minimum required verification.
