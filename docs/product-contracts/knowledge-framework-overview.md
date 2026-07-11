# Knowledge Framework Overview Contract

## Goal

The knowledge base `框架全览` view is a project-level framework map. It shows the global product/module/page hierarchy as a mind-map style canvas, while `流程图` remains responsible for user paths, screenshots, hotspots, and page-to-page interaction details.

## Data Ownership

- Backend/project import owns the structured framework data: node ids, parent-child hierarchy, titles, node kinds, metadata, project blueprint, and knowledge counts.
- Frontend owns only rendering, canvas interaction, zoom/scroll fit, horizontal hierarchy layout, and connector recalculation.
- Frontend must not hardcode business buckets such as login/register/home/profile, and must not invent hierarchy levels that are missing from backend/project data.

## Framework Overview Rendering

- The visible tab label is `框架全览`; legacy `结构树` labels must not reappear in this knowledge-base tab.
- `框架全览` should not render a right-side node-detail inspector, screenshot locator panel, or duplicated project details. Node details, screenshots, and interaction paths belong to flow/detail surfaces.
- The view should avoid redundant page titles, stats, and zoom toolbars when they crowd the canvas. The canvas itself is the primary content.
- Hierarchy must expand horizontally like a mind map: root node to first-level nodes, then second/third/fourth/fifth levels keep opening to the right in separate columns. Do not simulate deeper levels by indenting within one column.
- The canvas may scroll horizontally and vertically when the project hierarchy is wider or taller than the viewport.

## Connector Behavior

- Connectors must be SVG paths calculated from actual DOM node rectangles.
- Each connector starts at the parent node's right-side midpoint and ends at the child node's left-side midpoint.
- Connectors must recalculate after expand/collapse, zoom changes, container resize, and framework data changes.
- Fixed CSS pseudo-element connector lines are not acceptable for this view because they drift when node height, depth, or expansion state changes.

## Must Not Do

- Do not make `框架全览` a vertical tree list with indentation-only hierarchy.
- Do not show the whole project framework again in a right-side detail panel.
- Do not mix flow-path screenshots into `框架全览`; keep screenshot-backed paths in `流程图` and `交互 Demo`.
- Do not replace backend/project hierarchy with frontend fallback business categories unless backend data is absent and the fallback is explicitly neutral.

## Key Files

- `frontend/src/pages/knowledge/KnowledgeHubPanel.vue`
- `frontend/src/services/knowledgeHub.js`
- `frontend/src/styles.css`

## Regression Checks

- `tests/knowledge-framework-overview.test.mjs` protects the tab label, clean canvas layout, horizontal depth columns, SVG connector layer, DOM-based connector recalculation, and absence of old inspector/detail behavior.
- `tests/knowledge-prototype-upload.test.mjs` and `tests/knowledge-flow-image-preview.test.mjs` protect the separation between framework overview and screenshot-backed flow/prototype surfaces.
