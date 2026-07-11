# Agent Inline Layout Contract

## Goal

Embedded Agent must visually attach to the workflow canvas area without being clipped by the workflow topbar. The gap between the workflow topbar bottom and the embedded Agent top must be `0px`.

## Adaptive Placement Rule

Do not use a fixed top offset for embedded Agent.

Runtime should measure:

```js
document.querySelector('.workflow-canvas-topbar').getBoundingClientRect().bottom
```

Then pass that value to Agent as the CSS variable:

```css
--workflow-agent-embedded-top
```

The Agent then uses:

```css
top: var(--workflow-agent-embedded-top);
height: calc(100vh - var(--workflow-agent-embedded-top));
```

## Must Preserve

- Embedded/medium Agent is only a display mode of the shared `WorkflowAgentDrawer`. It must not introduce separate Agent logic, sessions, quick replies, history, upload/retry/apply actions, or stage progression behavior.
- Gap between `.workflow-canvas-topbar` bottom and `.agent-drawer-embedded` top is `0px`.
- The behavior adapts across `需求解剖`, `交互低保`, `UI视觉`, and other stages.
- The behavior adapts to different viewport heights and topbar content heights.
- Window resize and stage switch update the measured top.

## Must Not Do

- Do not build a separate medium Agent implementation. Medium/embedded differs from sidebar/fullscreen only by size, placement, and layering.
- Do not hardcode one value such as `112px` or `280px` as the real placement logic.
- Do not move Agent upward by covering the small requirement tabs.
- Do not rely on z-index to solve a geometric clipping problem.

## Key Files

- `frontend/src/App.vue`
- `frontend/src/features/workflow/components/WorkflowAgentDrawer.vue`
- `frontend/src/styles.css`
- `tests/workflow-agent-actions.test.mjs`

## Regression Checks

- App has `updateWorkflowAgentInlineTop`.
- Agent receives `inlineTop`.
- Browser QA should check `agentTop - topbarBottom === 0` for at least `需求解剖` and `交互低保`.
