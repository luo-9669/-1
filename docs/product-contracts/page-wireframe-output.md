# Page Wireframe Output Contract

## Goal

Generated page wireframes should be understandable as page layout and interaction plans. They should not be only a list of modules.

## Must Include

For each page-level wireframe, the model output should cover:

- Page layout type: card flow, list flow, information flow, waterfall, left-image-right-text, image-top-text-bottom, form flow, checkout flow, etc.
- Placement of key UI elements: buttons, inputs, images, icons, tabs, filters, cards, price, likes, member level, status badges.
- Fixed and scroll regions: top fixed navigation, scroll body, bottom fixed bar, floating action, popup layer.
- Interaction behavior: tap, scroll, horizontal swipe, open detail, select option, submit, back, close, expand/collapse.
- Navigation and transition: which page or popup opens after the action.
- State coverage: loading, empty, failure, permission, disabled, selected, success, pending.
- Page-level interaction specs should be control-level rows generated from the upstream page hotspot/control inventory. They should not collapse to one or two generic main-button actions when the page framework contains multiple controls.
- Page-level state coverage belongs in `interactionSpecArtifact.stateMatrix`; row-level `states` should stay specific to the target control and should not repeat the entire global page state list in every row.
- Frontend and backend handoff notes.

These are model output requirements and layout-pattern candidates. They are not fixed frontend content and should only appear when the page context calls for them.

## Must Preserve

- Page can be converted into a wireframe.
- Wireframe can guide page implementation.
- Wireframes should be detailed enough that frontend can identify where controls live.
- Popup and nested popup layers must be represented as top layers when relevant.
- `pageLayoutSpec`, `layoutPlan`, `structuredLayoutPlan`, or `page_layout_spec` should be preferred when the model returns them; renderer fallback is only for sparse or legacy runs.

## Must Not Do

- Do not output only abstract module names.
- Do not omit layout type when a page clearly needs a known layout pattern.
- Do not treat all pages as the same top-scroll-bottom template when content calls for a different layout.
- Do not interpret layout patterns such as waterfall, left-image-right-text, card flow, or checkout flow as mandatory fields for every page.

## Key Files

- `backend/services/total-design-flow.js`
- `backend/services/page-layout-artifact-renderer.js`
- `frontend/src/features/workflow/components/WorkflowCanvasPage.vue`
- `frontend/src/features/workflow/components/WorkflowAgentDrawer.vue`

## Regression Checks

- `pageLayoutArtifact.asciiWireframe` is present for interaction page nodes.
- Agent and canvas render the artifact instead of raw protocol text.
- Fullscreen detail exposes interaction and handoff details.
