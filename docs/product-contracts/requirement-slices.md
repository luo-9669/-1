# Requirement Slices Contract

## Goal

Small requirement slices are the user-facing filter for the current workflow stage. Clicking a slice must change the canvas content below it.

## Slice Id Rule

Stage slices can have stage-scoped ids:

```txt
interaction-lofi-rs1
ui-visual-rs1
```

Page nodes can still use source ids:

```txt
rs1
rs2
rs3
```

Filtering must map the active stage slice back to `sourceSliceId` before comparing with page node `sliceId`.

## Must Preserve

- Clicking a small requirement tab changes lower canvas content.
- The active slice can be a stage-scoped id, but filtering uses the source slice id.
- Small requirement cards show only title plus metadata: priority, page count, pending confirmation count.
- Small requirement cards do not show the goal subtitle line.
- Slice tabs remain clickable even when embedded Agent is visible.

## Must Not Do

- Do not compare `interaction-lofi-rs1` directly to node `sliceId: 'rs1'`.
- Do not fall back to all pages when the selected slice has matching stage nodes.
- Do not let embedded Agent intercept pointer events on the top slice area.

## Key Files

- `frontend/src/features/workflow/components/WorkflowCanvasPage.vue`
- `frontend/src/App.vue`
- `backend/services/total-design-flow.js`
- `tests/workflow-agent-actions.test.mjs`

## Regression Checks

- `sourceSliceIdForActiveSlice` exists and is used for filtering.
- Small cards do not render `slice.goal`.
- Topbar layer remains above embedded Agent where the slice cards live.
