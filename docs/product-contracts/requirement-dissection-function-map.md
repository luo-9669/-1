# Requirement Dissection Function Map Contract

## Goal

The `需求解剖` stage owns the global product/function structure before page-level wireframes are generated.

## Data Source

Backend/model output should provide:

```js
totalDesignFlow.projectFunctionMap
```

The `需求解剖` stage should also provide a product-to-design artifact:

```js
totalDesignFlow.requirementDissectionArtifact
```

The same object should also be available on:

```js
totalDesignFlow.stageCanvases['requirement-dissection'].agentNode.projectFunctionMap
```

The same requirement artifact should also be available on:

```js
totalDesignFlow.stageCanvases['requirement-dissection'].agentNode.requirementDissectionArtifact
```

The requirement artifact should expose the product-analysis display plan:

```js
totalDesignFlow.requirementDissectionArtifact.productAnalysisPipeline
```

Each downstream page should also be traceable through:

```js
totalDesignFlow.requirementDissectionArtifact.pageFrameContracts
```

## Must Preserve

- New projects and full App/Web requests should produce a global function hierarchy map before `交互低保`.
- Small feature requests should produce an affected-scope map instead of pretending to know the full product.
- The function map should include root modules, page ownership, navigation/user-path relationships, and role or scope hints when available.
- `需求解剖` must behave as a product-requirement-to-design-requirement conversion layer. It should expose product definition, user scenarios, scope boundaries, page design requirements, business rules, competitive references, risks/open questions, and downstream hints.
- Ordinary `总流程` should show exactly nine stable requirement-analysis chapters from `productAnalysisPipeline`: `需求理解`, `缺口确认`, `用户旅程分析`, `功能与页面拆解`, `业务规则与状态流`, `流程与架构`, `设计机会`, `优先级与排期`, and `验收标准`.
- The `高级 UX 需求分析` workflow reuses the same six top-level total-flow stages, but its `requirement-dissection` stage uses the Markdown-imported ten-step UX chain from the latest Advanced UX Skill: `原始需求分析`, `设计问题定义`, `用户与场景`, `假设与验证`, `设计机会`, `整体交互链路`, `三套设计方案`, `异常流补充`, `推荐方案建议`, and `设计优先级与分阶段计划`.
- Advanced UX analysis has one primary generation path: user input plus the fixed repository protocol files `docs/skills/advanced-ux/需求分析阶段一skill.md` and `docs/skills/advanced-ux/需求阶段一产出约束.md`. Backend prompt assembly owns both documents and must not replace them with frontend-authored business fields or hardcoded domain examples.
- Advanced UX stage 1 may use `docs/skills/advanced-ux/AI视频爆款复刻-对照参考.md` only as a structure-completeness reference. It must not copy that reference's business content, competitors, data, product names, page names, metrics, links, or industry conclusions into unrelated projects.
- Advanced UX model generation should not be cut off by frontend or backend analysis timeouts. While the provider is still running, the run stays `analyzing`/`generating`, the canvas stays in loading state, and recovery/deep-link polling keeps waiting for backend completion.
- Advanced UX analysis starts as one backend Markdown generation task. During generation, `advancedUxReport.status` is `generating`, the ten requirement nodes use `artifactStatus: 'generating'`, and the frontend shows loading state only.
- After the advanced UX Markdown file is generated, the backend imports it into `requirementDissectionArtifact.productAnalysisPipeline.tabs` and `stageCanvases['requirement-dissection'].nodes`; the frontend must not parse or split business content from Markdown on its own.
- Advanced UX Markdown must stay a requirements Markdown artifact. It must not contain `:::page-layout-artifact`, page-skeleton protocols, JSON envelopes, or ordinary total-flow page layout artifacts. Page/framework/flow content should be expressed through Markdown tables, text code blocks, or explicit downstream image/Draw.io intent according to the UX output standard.
- Advanced UX Markdown import should parse fixed third-level subsection headings and Markdown tables/code blocks into typed backend `detailBlocks` such as `score-card`, `risk-matrix`, `feature-list`, `flow-wireframe`, `checklist`, and `metric-table`; the raw Markdown remains the source artifact but should not be the default fullscreen detail when structured blocks exist.
- If Markdown import fails, the Markdown file remains as the analysis artifact, `advancedUxReport.status` becomes `import_failed`, and the canvas may show failed placeholder nodes with a re-import action rather than polluting existing generated nodes.
- `productAnalysisPipeline.tabs[].detailBlocks` is a display plan. It should reference canonical artifact fields through `sourceRef` instead of copying full matrix rows into a second location.
- Ordinary `总流程` detail blocks must keep one canonical owner per `sourceRef`: page hierarchy belongs to `功能与页面拆解`, user journey belongs to `用户旅程分析`, state machine belongs to `业务规则与状态流`, and `流程与架构` owns navigation, data flow, cross-function relations, and exception recovery.
- `pageFrameContracts` should give each page a reconstruction contract for downstream 1:1 page framing: source refs, layout regions, navigation bindings, content hierarchy, interaction hotspots, state variants, and transition edges.
- `navigationStructure.navigationItems` should expose page-bound navigation items with `targetPageId`, `activeState`, `visibilityRule`, and permission hints so downstream page framing does not infer navigation only from titles.
- `pageHierarchyTree` page nodes should expose `pageId`, `parentId`, `level`, and `pageType` so the hierarchy is usable as structure, not just as display labels.
- `dataFlowGraph`, `stateMachineMap`, and `featureJumpGraph` should keep readable labels while also exposing structured ids, page ids, transition targets, trigger conditions, and state-preservation flags.
- Competitive analysis belongs in `需求解剖` under the `设计机会` tab. If the user did not provide concrete competitors, the artifact must mark the result as an industry assumption instead of inventing verified competitor research.
- Competitive analysis is displayed under the `设计机会` chapter; it should not become a separate duplicate requirement-dissection card.
- When no concrete competitor name, link, screenshot, or knowledge material is available, the `竞品参考` card must still be useful: show `evidenceStatus`, an evidence notice, industry baseline patterns, comparison dimensions, suggested search directions, and next actions such as `让 Agent 找 3 个竞品`, `上传竞品截图/链接`, and `从知识库选择参考`.
- Suggested competitor search directions are prompts for retrieval, not fixed competitor names. They should be derived from the active project/request, and must not lock every project to the same competitor list.
- Competitive-reference quick actions such as `让 Agent 找 3 个竞品`, `上传竞品截图/链接`, and `从知识库选择参考` must route through the dedicated Agent intent `competitor-reference-enrichment`; backend Agent prompts and proposal fallbacks must preserve evidence boundaries instead of degrading to generic canvas advice.
- Frontend renders the backend-owned function map in the `需求解剖` fullscreen detail; it must not hardcode business modules.
- Frontend renders the backend-owned requirement dissection artifact as a report in fullscreen detail; it must not hardcode product conclusions or competitor content.
- Requirement-dissection child fullscreen details should render the active pipeline tab with content-appropriate layouts: navigation/page hierarchy as trees, user journeys as timelines, page/decision matrices as tables, exceptions as risk matrices, data flow as graph blocks, state machine as state cards, and cross-function links as relation tables. Agent's first reply may stay concise, but it must not be treated as the complete persisted analysis when richer artifacts exist.
- Sparse model-owned `requirementDissectionArtifact` fields should be completed server-side from existing backend artifacts such as pages, requirement slices, and `projectFunctionMap`; empty arrays like `userScenarios.primaryUsers` must not render as a bare “待确认” when reliable upstream structure exists.
- Historical runs with an existing but thin `requirementDissectionArtifact` must be hydrated on detail load. A shell artifact with empty target users/JTBD, page rows missing primary action/state/data dependencies, or competitive references missing evidence status/action/search direction fields is not enough for the fullscreen detail.
- Requirement details should translate product analysis into design-usable output: target users, core scenarios, JTBD, design implications, page goals, primary actions, state coverage, data dependencies, and acceptance criteria.
- Requirement page rows must include a page-level control/interaction-hotspot inventory when enough structure exists. Each hotspot should identify target, gesture, operation, feedback/result, enable/disable conditions, data dependencies, and test points so `交互低保` can generate detailed page-level interaction specs without relying on later user clarification.
- Ordinary requirement-dissection tab nodes must not duplicate `projectFunctionMap`; it stays on `totalFlow.projectFunctionMap` and `stageCanvases['requirement-dissection'].agentNode.projectFunctionMap`.
- `交互低保` should consume the function map as upstream context, but page fullscreen wireframes should stay focused on the current page's `pageLayoutArtifact.asciiWireframe`.

## Must Not Do

- Do not attach the global function hierarchy to a single interaction page node as if it were page-local content.
- Do not reconstruct the product function hierarchy in the frontend from page titles alone when the backend artifact exists.
- Do not render `需求解剖` as only the raw input, document count, or a generic model output block.
- Do not render requirement dissection as many parallel matrix cards when `productAnalysisPipeline` exists; the pipeline tabs are the stable canvas entry points.
- Do not duplicate `pageCoverageMatrix` under `designRequirementMap`, and do not duplicate cross-page relations as `crossPageFunctionGraph`.
- Do not let Advanced UX output fall back to ordinary total-flow analysis, page skeleton generation, or frontend business-field presets when Markdown generation is slow or incomplete.
- Do not let generic model summary fields overwrite artifact-specific card content when a requirement-dissection node already has its own content from `requirementDissectionArtifact`.
- Do not invent real competitor names, research conclusions, pricing, compliance facts, or market claims when the user has not provided evidence.
- Do not leave `竞品参考` effectively empty just because there is no verified competitor evidence; show industry-mode caveats and concrete next actions instead.
- Do not hide page wireframes in `交互低保` by replacing them with the global function map.

## Key Files

- `backend/services/total-design-flow.js`
- `frontend/src/features/workflow/components/WorkflowCanvasPage.vue`
- `tests/system-skills.test.mjs`
- `tests/workflow-agent-actions.test.mjs`

## Regression Checks

- `buildTotalDesignFlow` returns `projectFunctionMap`.
- `buildTotalDesignFlow` returns `requirementDissectionArtifact`.
- Requirement-dissection `agentNode` carries the same `projectFunctionMap`.
- Requirement-dissection `agentNode` carries the same `requirementDissectionArtifact`.
- Requirement-dissection stage canvas renders ordinary nine chapter nodes, or the advanced UX ten-node variant, with `requirementPipelineTabId`.
- Advanced UX backend route tests cover fixed framework/spec prompt injection, no analysis timeout, no `page-layout-artifact` leakage, ten generated nodes, and imported Markdown status.
- Requirement-dissection fullscreen renders `productAnalysisPipeline.detailBlocks` and resolves `sourceRef` from canonical artifact fields.
- Requirement-dissection `整体交互链路` tab renders top navigation, page hierarchy, user journey, data flow, state machine, and cross-function relations without duplicate fields.
- `pageFrameContracts` exists for every page and references canonical source ids.
- Navigation, hierarchy, data-flow, state-machine, and jump-graph tests verify structured ids and page bindings, not only human-readable summaries.
