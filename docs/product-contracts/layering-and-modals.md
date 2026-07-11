# Layering And Modals Contract

## Goal

Layering must be predictable. Agent, canvas details, topbars, fullscreen panels, and nested modals should not randomly cover each other.

## Layer Order

From lower to higher:

1. Page content and canvas cards.
2. Embedded Agent.
3. Workflow topbar and small requirement tabs.
4. Canvas fullscreen/detail content.
5. Agent fullscreen.
6. Ordinary modal backdrops.
7. Agent confirm/nested modal.
8. System overlay.

## Current Tokens

Defined in `frontend/src/styles.css`:

```css
--z-canvas-fullscreen
--z-agent-embedded
--z-workflow-topbar
--z-agent-fullscreen
--z-modal
--z-agent-confirm-modal
--z-system-overlay
```

## Must Preserve

- Canvas fullscreen/detail content is above embedded Agent and the workflow topbar when the user opens `全屏`.
- Opening a canvas card `全屏` must close the side/embedded Agent first; fullscreen canvas detail is the only main view while it is open, and the user can reopen Agent from the normal entry afterward.
- Workflow topbar and small requirement tabs remain clickable above embedded Agent.
- Agent fullscreen is above embedded Agent.
- Agent confirm modal is above Agent fullscreen and ordinary modals.
- Nested modal behavior favors the later opened modal being visually above the previous layer.

## Must Not Do

- Do not add random `z-index: 9999`.
- Do not use one-off layer values without adding or reusing a token.
- Do not fix one modal by breaking small requirement tab clickability.

## Key Files

- `frontend/src/styles.css`
- `frontend/src/App.vue`
- `frontend/src/features/workflow/components/WorkflowAgentDrawer.vue`
- `tests/workflow-agent-actions.test.mjs`

## Regression Checks

- Tests assert the layer tokens and key class usage.
- Tests assert `openWorkflowCanvasFullscreen()` closes the Agent display mode before setting `workflowFullscreenNodeId`.
- Agent confirm modal uses `agent-confirm-backdrop`.
- Embedded Agent uses `--z-agent-embedded`.
- Topbar uses `--z-workflow-topbar`.
