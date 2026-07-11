# UI Layout Standards Contract

## Goal

Page development must follow a consistent product UI layout standard. Layout spacing, button order, title copy, and bottom safe spacing should not drift between pages or stages.

## Spacing

- All project spacing should use multiples of 4px.
- Preferred spacing values are `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, and `40px`.
- Avoid one-off spacing values such as `5px`, `10px`, `14px`, `18px`, `22px`, or `30px` unless there is a documented visual reason.
- Page frames, cards, canvas panels, fullscreen details, and scroll containers should reserve at least `24px` at the bottom so content does not stick to the bottom edge or fixed bottom areas.

## No Nested Frames

- All pages must avoid "frame inside frame" presentation. Do not wrap filter bars, content regions, or repeated list surfaces in extra card-like borders when the controls, table, or rows already provide their own visual structure.
- Filter areas should sit directly in the page flow. Inputs, selects, and buttons may keep their own control borders, but the filter group itself should not add another bordered/rounded/background container unless it is a modal, drawer, or intentionally separated panel.
- Tables may use one table-level frame: a single border, small radius, header background, and row dividers are allowed when they belong to the table component itself.
- Table pages must not wrap that framed table in another bordered/rounded/background page card. Use the shared data-table component for ordinary data lists so font size, header density, row spacing, and the single table frame stay consistent.
- Cards remain allowed for individual repeated items, modals, drawers, and genuinely framed tools, but not as decorative wrappers around another framed component.

## Buttons

- Button order must reflect usage frequency and action importance.
- Low-frequency, secondary, or management actions should sit to the left or earlier in the action group.
- The highest-frequency primary action should sit at the far right of the action group.
- A black solid button is reserved for the primary action and should be the rightmost button when an action group is horizontal.
- Do not make multiple competing black primary buttons in the same local action group.

## Titles And Subtitles

- Do not generate subtitles by default.
- Only render a subtitle when it adds necessary business context that the title cannot carry.
- Remove decorative, repetitive, or empty subtitles.
- Titles should not include English descriptions, English translations, or English type labels.
- English can appear only when it is the actual product name, brand name, technical term, file name, route, or user-provided original content.

## Frontend Owns

- Applying spacing tokens and responsive layout.
- Preserving the `24px` bottom safe spacing in page frames, canvas panels, detail panels, and generated wireframe displays.
- Rendering button groups in the correct visual order.
- Ensuring black primary buttons are visually distinct and right-aligned in horizontal action groups.
- Suppressing useless subtitles and avoiding title pollution in rendered UI.
- Removing unnecessary page-level wrapper borders/backgrounds so controls, table components, rows, and content are not visually boxed multiple times.
- Rendering knowledge-base `框架全览` as a clean canvas-first view: no redundant title/stat toolbar, no right-side duplicate detail panel, horizontal hierarchy columns, and scrollable canvas space. See [Knowledge Framework Overview](knowledge-framework-overview.md).

## Backend And Model Own

- Providing structured page sections, action lists, action frequency, action priority, and action risk level when available.
- Providing titles and subtitles as separate fields instead of mixing explanation into the title.
- Avoiding generated English descriptions in title fields unless they are user-provided or business-native terms.

## Must Not Do

- Do not add subtitle text just to make a page look fuller.
- Do not put English helper descriptions above or inside every Chinese title.
- Do not place the primary black action in the middle or left side of a horizontal action group.
- Do not use arbitrary spacing values when a 4px-grid value works.
- Do not let scroll content, page frames, or canvas detail content touch the bottom edge.
- Do not create nested framed surfaces such as a bordered page card around a bordered table component. Remove the outer wrapper frame and keep only the necessary control/table structure.
- Do not collapse mind-map hierarchy into a single indented column when the confirmed interaction requires each deeper level to open to the right.

## Key Files

- `frontend/src/styles.css`
- `frontend/src/App.vue`
- `frontend/src/features/workflow/components/WorkflowCanvasPage.vue`
- `frontend/src/features/workflow/components/WorkflowAgentDrawer.vue`
- `backend/services/total-design-flow.js`
- `backend/services/page-layout-artifact-renderer.js`

## Regression Checks

- Critical page frames and canvas/detail panels keep a `24px` bottom reserve.
- New spacing values use the 4px grid unless explicitly justified.
- Horizontal action groups put the primary black button at the far right.
- Useless subtitles are not rendered.
- Titles do not contain generated English descriptions or type labels.
- Page-specific tests should prevent filter/tool bars and page wrappers from reintroducing decorative outer borders around the shared table component.
