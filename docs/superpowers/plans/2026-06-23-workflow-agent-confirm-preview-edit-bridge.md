# Workflow Agent Confirm Preview Edit Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workflow "confirm write to canvas" modal use a fixed-height layout with internal scrolling, sticky footer actions, and a top-right edit action that opens the same fullscreen canvas editing interaction.

**Architecture:** Keep the existing confirm-preview submit flow intact and limit changes to the existing Vue surfaces. Add a small parent-to-canvas bridge so `App.vue` can request fullscreen edit mode for a specific node without duplicating canvas edit logic.

**Tech Stack:** Vue 3 SFCs, existing app CSS, root Node test suite in `tests/workflows.test.mjs`

## Global Constraints

- Keep the confirmation modal flow and backend confirmation API unchanged.
- Reuse the existing fullscreen canvas node editing interaction instead of adding a second editor.
- Limit code changes to the current workflow UI surfaces and their regression tests.

---

### Task 1: Lock the UI contract with regression tests

**Files:**
- Modify: `tests/workflows.test.mjs`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: Existing `workflowAgentConfirmPreview` modal markup and `WorkflowCanvasPage` fullscreen editing API.
- Produces: Static regression coverage for the modal layout hooks and fullscreen edit bridge prop.

- [ ] **Step 1: Write the failing test**

```js
testAsync('workflow agent confirmation preview can hand off into fullscreen canvas editing with fixed footer layout', async () => {
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')
  const canvasPageSource = await readFile(new URL('../frontend/src/components/workflow/WorkflowCanvasPage.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(appSource, /class="agent-confirm-preview-scroll"/)
  assert.match(appSource, /class="agent-confirm-preview-footer"/)
  assert.match(appSource, /aria-label="编辑当前画布节点"/)
  assert.match(appSource, /@click="openWorkflowAgentConfirmPreviewEditor"/)
  assert.match(appSource, /function openWorkflowAgentConfirmPreviewEditor\(\)/)
  assert.match(appSource, /workflowFullscreenNodeId\.value = targetNodeId/)
  assert.match(appSource, /workflowFullscreenEditNodeId\.value = targetNodeId/)
  assert.match(appSource, /:fullscreen-edit-node-id="workflowFullscreenEditNodeId"/)

  assert.match(canvasPageSource, /fullscreenEditNodeId:\s*\{ type: String, default: '' \}/)
  assert.match(canvasPageSource, /if \(props\.fullscreenEditNodeId && props\.fullscreenNode\?\.id === props\.fullscreenEditNodeId\) startFullscreenEdit\(props\.fullscreenNode\)/)

  assert.match(styles, /\.agent-confirm-preview-scroll/)
  assert.match(styles, /\.agent-confirm-preview-footer/)
  assert.match(styles, /position:\s*sticky/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="workflow agent confirmation preview can hand off into fullscreen canvas editing with fixed footer layout"`
Expected: FAIL because the new modal classes, edit handoff helper, and canvas bridge prop do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```vue
<WorkflowCanvasPage :fullscreen-edit-node-id="workflowFullscreenEditNodeId" />

<div class="agent-confirm-preview-scroll">
  ...
</div>
<div class="agent-confirm-preview-footer">
  ...
</div>
```

```js
function openWorkflowAgentConfirmPreviewEditor() {
  const targetNodeId = workflowAgentResolvedNodeId(workflowAgentConfirmPreview.nodeId)
  if (!targetNodeId) return
  workflowFullscreenNodeId.value = targetNodeId
  workflowFullscreenEditNodeId.value = targetNodeId
  closeWorkflowAgentConfirmPreview()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="workflow agent confirmation preview can hand off into fullscreen canvas editing with fixed footer layout"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/workflows.test.mjs frontend/src/App.vue frontend/src/components/workflow/WorkflowCanvasPage.vue frontend/src/styles.css docs/superpowers/plans/2026-06-23-workflow-agent-confirm-preview-edit-bridge.md
git commit -m "feat: align workflow confirm modal with canvas edit flow"
```
