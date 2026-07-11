# Commit Note: Stage Artifact Rendering

## Scope

This version preserves the confirmed stage canvas artifact rendering approach:

- Vue DOM workflow canvas with CSS scaling and SVG edges.
- Backend-owned `totalDesignFlow.stageCanvases`.
- Interaction lofi page artifacts rendered from `pageLayoutArtifact.asciiWireframe`.
- UI visual generation state through `visualPreview`, `visualBrief`, `generationActions`, `targetGenerator`, and `artifactStatus`.
- Agent actions continue from the current node artifact instead of becoming a second page generator.

## Included

- Product contracts under `docs/product-contracts`.
- Page layout artifact renderer and ASCII diagram generator.
- Workflow stage canvas, Agent rendering, artifact generation, and related focused tests:
  - `backend/services/agent-context-builder.js`
  - `backend/services/agent-context-builder.test.js`
  - `backend/services/agent-service.js`
  - `backend/services/agent-service.test.js`
  - `backend/services/diagram-generator.js`
  - `backend/services/diagram-generator.test.js`
  - `backend/services/page-layout-artifact-renderer.js`
  - `backend/services/page-layout-artifact-renderer.test.js`
  - `backend/services/total-design-flow.js`
  - `backend/services/workflow-runner.js`
  - `backend/services/workflow-runner.test.js`
  - `frontend/src/App.vue`
  - `frontend/src/features/workflow/components/WorkflowAgentDrawer.vue`
  - `frontend/src/features/workflow/components/WorkflowCanvasPage.vue`
  - `frontend/src/styles.css`
  - `tests/system-skills.test.mjs`
  - `tests/workflow-agent-actions.test.mjs`

## Excluded

The working tree also contains unrelated dirty files for upload routes, URL/code factory, visual verification, model provider, prompt builder, document parsing, diagram workbench routes/pages/services, and broad workflow tests. They are intentionally left unstaged for a separate review/version.

## Verification

Passed:

- `node --test backend/services/page-layout-artifact-renderer.test.js`
- `node --test tests/workflow-agent-actions.test.mjs`
- `node --test backend/services/workflow-runner.test.js backend/routes/workspace.test.js`
- `npm --prefix frontend run build`
- `git diff --check` on staged contract/code paths

Known failing command not included in this version:

- `node --test backend/routes/workflows.test.js`
- Failure: first two tests expect provider `deterministic`, actual provider is `slow-provider`.
