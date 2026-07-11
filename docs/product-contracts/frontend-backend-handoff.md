# Frontend Backend Handoff Contract

## Goal

Frontend and backend have clear ownership. Backend generates structured workflow results. Frontend renders those results faithfully without inventing business content.

## Backend Owns

- `totalDesignFlow`
- `projectFunctionMap`
- `stageCanvases`
- `stageSlices`
- Page nodes and page ids
- `pageLayoutArtifact`
- UI visual stage artifacts: `visualPreview`, `visualBrief`, `generationActions`, `targetGenerator`, `artifactStatus`, and generated `artifact`.
- Persisted generated image URLs and local image metadata after image data URLs are saved to workspace storage.
- Model recommendation
- Interaction details
- Frontend and backend handoff arrays
- Received Agent business-project context, knowledge context, and cited knowledge metadata when the frontend explicitly sends them for a project-scoped run.
- Agent prompt grounding for the current business project: backend should name the active run's bound project separately from the `流程通` workspace shell, and should reject hardcoded legacy scenario fallbacks when user input is noisy or incomplete.
- Agent answer evaluation and recommended recovery actions, including `meta.answerEvaluation.status`, `score`, `checks`, `warnings`, and `recommendedActions`.
- Generation/source metadata for version history when available, including whether output was model-generated, hydrated, cached, or regenerated and what user/system action triggered it.
- Fallback hydration for stale runs when required
- Model-owned page adjustment results and write-back payloads after the user asks Agent to refine a generated page wireframe.
- Model/backend-owned layout plan proposal quality for `交互低保`, including `writeableContent.layoutOptions`, `layoutComparisonRows`, selected layout option metadata, fallback quality status/reason, and layout-specific version history.
- Page-level interaction instruction artifacts for `交互低保`, including `interactionSpecArtifact`, annotation rows, state coverage, state prompt copy, gesture notes, transitions, motion notes, and test points.
- Advanced UX analysis prompt grounding, including reading the fixed repository protocols `docs/skills/advanced-ux/需求分析阶段一skill.md` and `docs/skills/advanced-ux/需求阶段一产出约束.md`, calling the model without analysis timeout, preserving `advancedUxReport.markdown`, and importing that Markdown into the seven requirement-dissection nodes.
- Advanced UX stage 1 may read `docs/skills/advanced-ux/AI视频爆款复刻-对照参考.md` only as a structure-completeness reference; backend prompts must explicitly prohibit copying its business content, competitors, data, product names, page names, metrics, links, or industry conclusions.
- Advanced UX complete-delivery grounding for downstream page interaction documentation: backend/model owns the `[产品名]-页面交互框架与说明.md` planning rules from `docs/skills/advanced-ux/交互低保阶段二.md`, page overview/flow/framework/interaction/exception tables, global interaction coverage, low-fidelity wireframe constraints, and Draw.io artifact status. Frontend must not fabricate low-fidelity images, Draw.io files, or page interaction business content when the backend/model has not generated those artifacts.

## Frontend Owns

- Canvas rendering.
- Requirement-dissection function map rendering from `totalDesignFlow.projectFunctionMap`.
- Agent conversation rendering.
- Agent stream display pacing: frontend may buffer backend/model `delta` events and reveal them in small chunks for readability, while preserving the complete streamed source for failure recovery and final assistant-message merge.
- Slice switching interaction.
- Fullscreen detail rendering.
- Popup and modal layering.
- Adaptive embedded Agent placement.
- Agent project-knowledge permission gating from the active workflow run `demandScope`.
- Project knowledge retrieval for Agent requests: retrieve only when the active workflow run's `demandScope === 'project'` and it has a valid run project id; send retrieved knowledge to the backend only in that case.
- Agent business-project context resolution: for project-scoped Agent requests, resolve the project object from the active workflow run's `projectId` and send it to the backend; for non-project runs, do not inherit the current login project, route project id, or stale form project.
- Non-project Agent isolation: skip retrieval, avoid inherited URL/current-project ids, and omit project knowledge references from the request payload.
- Display fallbacks when backend artifacts are absent.
- Rendering generated artifacts from `totalDesignFlow.stageCanvases` without reconstructing business page structure in frontend code.
- Rendering page-level interaction instructions from backend-owned `interactionSpecArtifact` when present, including state prompt copy and gesture notes, while keeping the page wireframe as the default fullscreen view.
- Rendering UI visual image tools such as local download and fullscreen image preview from generated image URLs/data URLs without altering the generated image artifact.
- Agent artifact message orchestration: append generated visual/code results to the same Agent session, render them with shared Agent cards, and repair missing visual result URLs from the current backend-owned canvas node when opening historical generated nodes.
- Agent answer-evaluation display: frontend renders backend-provided evaluation status, checks, warnings, and recommended action labels, and routes action labels through the shared quick-reply/recommendation flow without inventing evaluation outcomes.
- Unified Agent evidence display: when `meta.evidencePack` exists, frontend renders it as the single evidence disclosure and suppresses separate project-knowledge/proposal-evidence detail disclosures for that same assistant message.
- Fixed UI capability entries that route the active node context to Agent/model, such as page-level layout-plan or interaction-detail buttons.
- Rendering structured layout proposals only when backend/model provides `writeableContent.layoutOptions`, including comparison rows, vertical option details, framework previews, select/regenerate quick replies, and legacy old-rule notices.
- Passing selected layout option ids and metadata back to the backend when the user chooses `选 1/2/3 应用到画布`, and reflecting the selected option in local loading/success UI.
- Current-stage Agent write-back orchestration: for `应用到画布` without a persisted backend proposal id, frontend may save the assistant answer as current-stage confirmation context and trigger current-stage regeneration; backend remains responsible for the refreshed stage canvas content.
- Stage progression orchestration: after a user confirms `下一步`, frontend should immediately switch to the confirmed next stage and show canvas loading/refresh state. The Agent/model summary for the previous stage runs in parallel; when it returns, frontend saves that summary as stage confirmation context and then triggers the existing backend stage-generation stream with the current `totalDesignFlow`; backend remains responsible for generated next-stage canvas content.
- Advanced UX analysis display orchestration: frontend shows the seven backend-provided generating nodes while `advancedUxReport.status` is `generating`, keeps waiting across stream interruption/refresh while the backend run is still active, renders the short Markdown file-entry message in Agent, and renders node details from backend-imported section/detail blocks only.
- Historical label normalization for UI-only compatibility, so old persisted actions map to the current interaction model without changing generated business artifacts.
- Workflow analysis history records open the same workflow canvas page through a run-specific deep link in a new browser tab. Opening a saved record hydrates backend-owned run detail for that run id; it must not start a new analysis or regenerate stage artifacts.
- Knowledge-base `框架全览` rendering: frontend renders backend/project-owned framework nodes as a horizontal mind-map canvas with SVG connectors, while preserving `流程图` as the screenshot-backed path surface. See [Knowledge Framework Overview](knowledge-framework-overview.md).
- Verification discipline: before judging a UI change from screenshots, confirm the frontend and backend dev processes are running the latest code or restart them.

## Data Priority

For backend-owned workspace collections such as projects and restored page assets, backend hydration is authoritative. When `/api/workspace` returns a collection, frontend must replace its local cached list for that collection instead of merging stale local items back in. Deleted backend projects or restored assets must disappear from project switchers, asset grids, and selected ids after hydration.

For current-stage rendering, frontend should prefer current stage data:

```js
totalDesignFlow.stageCanvases[currentStage].nodes
```

For interaction lofi page wireframes, frontend should prefer:

```js
totalDesignFlow.stageCanvases['interaction-lofi'].nodes[].pageLayoutArtifact
```

For page-level interaction instructions, frontend should read:

```js
totalDesignFlow.stageCanvases['interaction-lofi'].nodes[].interactionSpecArtifact
```

## Requirement Documents And Knowledge Deposit

Requirement documents and knowledge materials are separate workspace material types. Uploading a requirement document must create or refresh only `type: 'requirements'` materials with pending knowledge status. It must not create `type: 'knowledge'` materials, switch the user into the knowledge base, or make the requirement available to knowledge retrieval until the user explicitly chooses `沉淀到知识库` and saves the deposit.

Knowledge deposit is the only conversion path from a requirement document into a knowledge material. The created knowledge material must keep source metadata such as `sourceType: 'requirements'` and `sourceMaterialId` so it remains traceable to the requirement that produced it.

Deleting a requirement document deletes only that requirement material. Already deposited knowledge is an independent workspace material and must not be cascade-deleted when the source requirement is removed. The UI may explain this in the delete confirmation, but the backend deletion contract is still id-specific material deletion rather than relationship-based deletion.

Regression coverage should include the requirement upload type freeze and the non-cascade delete behavior for deposited requirement knowledge.

## Image To HTML Preview Rendering

Image-to-HTML preview must preserve the backend/model artifact boundary. Backend owns the generated single-file HTML, visual verification result, failure reason, stream artifact order, and persisted `restoredPage`. Frontend owns only the preview shell, iframe rendering, source-code display, interaction buttons, and fallback display.

When backend returns generated HTML, frontend must render that exact HTML in the left preview pane through an iframe `srcdoc`, and show the same HTML source in the right pane. Frontend must not hardcode business page content, use the uploaded screenshot as a fake webpage, replace model output with a frontend preset, or mutate generated business structure to improve the preview.

Restored asset cards must use the generated HTML/frame preview when HTML exists, so the asset grid and the standalone detail page show the same generated page. The uploaded screenshot or `coverImage` is the original reference/fallback, not the primary preview for generated HTML assets.

Failed visual verification is still a previewable artifact when HTML exists. Low-similarity or visual mismatch results must keep the iframe preview visible, show the failure status and similarity reason, and keep source download/debug affordances available. Only missing HTML or backend render failure may fall back to a failure page.

The iframe fit layer may inject only minimal display-safe CSS such as `body { margin: 0 }`, `min-height: 100vh`, `height: auto`, and `overflow-x: auto`. It must not globally rewrite layout, text, images, component hierarchy, or business semantics. Fixed-width generated pages must remain horizontally scrollable instead of being clipped.

The image-to-HTML render pane must preserve a complete iframe height chain. When the frontend adds toolbars, size switches, wrappers, or report areas around the render iframe, `.preview-panel`, `.preview-stage`, `.preview-frame-wrap`, and `.generated-preview-frame` must keep explicit `height: 100%` / `min-height` continuity so the iframe fills the render pane instead of falling back to the browser's small default iframe height. Size switches may change preview width only; they must not reduce render-pane height.

During streaming generation, status/delta/artifact transitions must not clear the visible source area. If the final result is failed but has HTML, backend should emit the previewable `artifact` before the failed status so the frontend can render the result and then mark it as not passing verification.

Image-to-HTML has one visible generation path. The primary `生成页面代码` action and all `重新生成` actions must use the enhanced generation behavior: preserve the existing page framework, include the MD enhancement rules, use the current project icon system, request contextual image replacement, and require text/image overlap checks. Frontend may keep historical `advanced-generate` routes or `image-html-advanced` messages only as compatibility shims, and those shims must call the same enhanced generation path.

Image-to-HTML generation must use a temporary preview id only as a routing bridge. Frontend creates a `clientTaskId` such as `image-html-*`, opens `/assets/{clientTaskId}/preview`, and sends the same id to backend. Backend must persist the final `restoredPage` with that `clientTaskId` and use it as `captureResult.taskId` so lookups can resolve by real asset id, `clientTaskId`, or `captureResult.taskId`. Once a real restored asset id exists, the preview tab should replace the route with `/assets/{realRestoredPageId}/preview`; if the tab was originally written via `document.write`, it must reload so the Vue route takes over. Users should not need a manual refresh to enter the final asset page.

Image-to-HTML quality ownership is backend-owned. Backend prompt rules must require usable, responsive pages rather than screenshot-only posters: semantic page structure, contextual images, current icon system, text/image non-overlap, short text nowrap rules, responsive layout, 4px base-grid spacing, font/density normalization, grayscale readability, and 390 / 768 / 1440 / 1920 viewport reasoning. Backend must require Element Plus / Eleme-style basic component density for search boxes, inputs, buttons, filters, tags, and sidebars: desktop buttons should not exceed 40px height, inputs/search boxes should align to the same 32-40px control scale, sidebars should use compact expanded/collapsed widths, and hover/focus/active/disabled/loading/clearable states should be represented. Typography should use 14px body text as the baseline and progress on a 4px-oriented scale where practical; spacing, gaps, component heights, icon containers, and avatar sizes should prefer 4px multiples. Radius should use a restrained gradient such as 2/4/6/8px for tables, tags, controls, cards, and panels, with 12/16px reserved for large media or hero containers. Backend must require one refined icon-library style such as Lucide/Heroicons/Tabler/Remix/Phosphor, proportional icon scaling close to adjacent text size, PNG or transparent PNG replacement for logos where suitable, and image-slot classification between pure people, pure elements, and composite scenes. Text, buttons, labels, status badges, charts, and key prices must remain readable after grayscale/desaturation, and states must not rely on color as the only signal. Backend must not directly trust screenshot pixels as production dimensions; it should normalize page density, use design tokens or CSS variables for typography, avoid page-level `transform: scale` / `zoom`, and keep icons/images sized by component semantics rather than blindly scaling with fonts.

Image-to-HTML prompts must also guard against the latest observed UI defects. Short labels, buttons, tabs, chips, dropdown options, navigation items, and status pills must not be split across lines; if space is insufficient, generated HTML should use nowrap, horizontal scroll, ellipsis, or shorter copy instead of awkward wrapping. Icons must use the fixed 12px / 16px / 20px / 24px ladder, preserve aspect ratio, and never visually exceed the adjacent text height. Generated CSS should avoid browser default focus boxes on inputs, search boxes, selects, buttons, and tabs by using `outline: none` only with a custom accessible `:focus-visible` replacement. Dropdowns must follow Element Plus-style trigger/menu/option interaction, including hover, selected, disabled, focus-visible, keyboard-highlight, placement, and z-index behavior. Overflowing tab bars and horizontal filters must scroll horizontally, keep text uncompressed, and expose a right-side fade mask. Layouts must avoid exaggerated staggered composition, random vertical offsets, or floating controls unless the source design explicitly requires it; headings, avatars, tabs, forms, buttons, and cards should align to the 4px grid and shared baselines.

Desktop web generation should be 1920px-first, then adapted down to 1440 / 768 / 390. For SaaS, backend, tool, and content-grid pages, 1920px preview must use the wide canvas through additional columns, wider tables, expanded content grids, balanced sidebars/toolbars, or full-width layout bands; it must not render a 1440px content island centered in a 1920px frame or leave the main work area as a narrow middle island. Landing pages may keep readable content max-widths, but their sections should still use full-width bands, backgrounds, imagery, or multi-column composition so the page does not look like a centered 1440 design pasted into a larger viewport.

For 390px / H5 mobile restoration, generated pages must not squeeze desktop sidebars, video entry panels, or many top buttons into a cramped grid. If the source has sidebar-video navigation or multiple creation buttons, the model should follow Eleme / large-company H5 patterns: keep at most one primary action visible, hide or collapse secondary top buttons into a `更多` trigger, bottom navigation, floating entry, or drawer menu, and use horizontal chips/tabs for lightweight mode switching. This remains backend/model quality ownership; the frontend must not rewrite the generated DOM to fake this mobile adaptation.

After model generation, backend must run validation before marking the artifact quality: topic validation, backend visual verification, and static HTML quality audit. The static audit may flag missing viewport meta, page-level scale/zoom, oversized fixed widths, abnormal font sizes, missing image `alt`, missing interaction states, missing form labels, insufficient click target sizing, insufficient responsive signals, and inferred `pageType` / `densityMode` problems. Static audit results must be merged into `visualVerification.qualityAudit` with quality viewports such as 390, 768, 1440, and 1920. If visual verification already failed, the primary failure reason should preserve the visual-similarity reason; if visual verification passed but static audit failed, the result should still be failed while keeping the HTML previewable.

Quality reports are display-only in frontend. When `visualVerification.qualityAudit` exists, frontend may show page type, density mode, quality viewports, issues, warnings, and recommendations above the iframe. This report must not mutate generated HTML, rewrite DOM, resize business content, replace images, or hide a failed-but-previewable artifact.

## Image To HTML Implementation Notes

- Generation is initiated from the frontend image-to-code form, but the generated business HTML remains backend/model owned. The frontend sends the uploaded image, prompt, palette, project design rules, and enhanced generation flags; backend returns streamed status, deltas, generated HTML, visual verification, and `restoredPage` data.
- The left preview pane renders backend HTML with an iframe `srcdoc`. The right pane displays the same backend artifact as usable project source, with semantically equivalent whitespace formatting and a project-like file layout when helpful. These two panes must stay tied to the same backend artifact, including failed-but-previewable results.
- During streaming, frontend keeps a local streamed source buffer and passes it into the status shell. Status updates must not replace the code pane with an empty typing placeholder after deltas have arrived.
- During image-to-HTML streaming, if backend emits a previewable `artifact` and then emits `status: failed`, frontend must keep the already-rendered result shell and only update status metadata. It must not overwrite the iframe result with the loading/status shell.
- The result shell may inject only display-safe iframe CSS for fitting and horizontal scrolling. It must not rewrite generated layout, component hierarchy, text, image choices, or business semantics.
- The result shell may display backend-owned quality audit metadata above the iframe, but generated HTML in the iframe must remain exactly the backend artifact. The source panel may format whitespace and indentation for readability/copying, but it must remain a complete, runnable representation of the same single-file HTML unless the backend explicitly provides a multi-file source package.
- Restored asset cards and standalone restored-asset detail pages should prefer generated HTML/frame previews when HTML exists. Original screenshots and `coverImage` are fallback/reference media, not the primary rendered result after generation succeeds.
- Standalone preview routes should wait and retry for backend-persisted restored-page HTML before showing a missing-result failure. A hard refresh immediately after generation may arrive before the backend workspace hydration catches up.
- Backend workspace collections are authoritative for restored assets. If backend deletes a restored asset, frontend hydration must remove it from local lists instead of merging stale local cached assets back into the UI.

## Repeated Regression Notes

- Do not diagnose screenshot-only UI states before confirming that the frontend and backend dev servers are running current code. A forced refresh or stale server process can make fixed behavior look broken.
- If a low-similarity result has generated HTML, show it anyway with the similarity/failure reason. Hiding it makes debugging impossible and violates the previewable-artifact contract.
- Fixed-width generated HTML must remain horizontally scrollable in the preview frame. Do not compress or scale it until the layout becomes unreadable.
- Size-switching controls in the image-to-HTML result shell must keep the render iframe height chain intact. If a wrapper is added, add or preserve a regression test that fails when the iframe height falls back to a small default value.
- Project switching and tab navigation must restore the route-backed project state before judging whether a tab is selected. The `设计方案` tab should highlight and render after switching away and clicking it again.
- Do not split normal versus advanced image-to-HTML generation in the UI. The product behavior is "normal generation is enhanced generation"; legacy advanced route/message names exist only so older opened pages keep working.
- When changing image replacement or icon behavior, preserve the requirement that current project icons/lucide-style icons are used and contextual images match detected content categories such as food, cosmetics, portraits, or cartoon imagery.

## Must Not Do

- Frontend must not hardcode tea-drink business output to pretend a model generated it.
- Frontend must not duplicate generation entry points on UI visual cards when a fixed page action row already exposes the generation capability.
- Frontend must not replace the workflow canvas artifact model with Mermaid, ReactFlow, AntV X6, Excalidraw, HTML Canvas, or a separate diagram workbench without an intentional contract redesign.
- Agent requests for non-project workflow runs must not inherit the URL/current project id or send retrieved project knowledge to the backend.
- Frontend must not use `workflowForm.demandScope` or the route project id to override a restored run's own `demandScope` when deciding whether Agent can use project knowledge.
- Backend must not invent or attach project knowledge citations when the frontend did not send retrieved knowledge for the active request.
- Backend must not treat `流程通` as the business project name unless the active run's bound project is actually named `流程通`.
- Backend must not use hardcoded old project or industry scenarios as Agent fallback context. No tea-drink, ordering, or other legacy domain should appear unless it comes from the active run, current canvas, retrieved knowledge, or user input.
- Backend must not return only generic page lists when stage canvas artifacts are expected.
- Backend fallback presets or heuristics must not override model-provided `stageCanvases`, `pageLayoutArtifact`, or UI visual artifacts.
- Frontend must not silently swap rich stage nodes for plain fallback pages.
- Frontend must not interpret stale dev-server output as a product regression without checking that the running frontend/backend processes are current.
- Frontend must not fabricate generated image URLs, HTML, Vue code, or business page content. If an Agent message is missing artifact metadata, it may only recover it from the active run's backend-owned `stageCanvases` node.
- Frontend must not create separate Agent implementations or renderer branches for visual/code artifacts; it should route through the shared Agent shell and shared visual/code card renderers.
- Frontend must not mutate old generated business conclusions just to update labels. Compatibility normalization is for visible actions and Agent routing only.
- Frontend must not fabricate layout options, comparison matrices, or selected business content when the backend/model did not return structured layout proposal data. Old plain-text layout answers can show `按新规则重生成`, but their business content remains historical text.
- Frontend must not hide a failed image-to-HTML result by clearing generated HTML, disabling iframe preview, or replacing it with a frontend-authored fake page when backend returned previewable HTML.
- Frontend must not reintroduce a separate visible `高级生成` action for image-to-HTML. Normal generation is already the enhanced path; legacy advanced labels may exist only for route/message compatibility.
- Backend must not suppress previewable image-to-HTML HTML solely because visual similarity is low; it should preserve the artifact and attach failed verification metadata.
- Backend must not convert Advanced UX Markdown generation into ordinary total-flow/page-layout generation when the provider is slow. Frontend must not create a fake Advanced UX report, split Markdown business content locally, or display `:::page-layout-artifact` as part of an Advanced UX report.

## Key Files

- `backend/services/total-design-flow.js`
- `backend/services/image-to-html-service.js`
- `backend/routes/workspace.js`
- `frontend/src/App.vue`
- `frontend/src/features/workflow/components/WorkflowCanvasPage.vue`
- `frontend/src/features/workflow/components/WorkflowAgentDrawer.vue`

## Regression Checks

- Backend route tests cover stale run hydration and artifact generation.
- Frontend tests cover stage node priority, slice mapping, wireframe display, Agent layout, modal layering, and project-knowledge gating.
- Tests cover stage artifact rendering: stage canvas node priority, ASCII artifact rendering, visual pending/generated state, and generation result patching back into `totalDesignFlow.stageCanvases`.
- Tests cover Agent generated artifact recovery: visual result messages use hydrated canvas-node image URLs, historical empty image messages are repaired from canvas nodes, and HTML/Vue code renders through the shared code-card path.
- Frontend tests cover that project knowledge retrieval is gated by the active run `demandScope`, that non-project runs do not inherit URL project ids, and that skipped retrieval happens before backend Agent requests.
- Tests cover that Agent requests send the active run's bound project as business context, and backend Agent prompts separate that project from the `流程通` shell name while rejecting legacy scenario fallbacks.
- Frontend tests cover historical action-label normalization and ensure `应用到画布` is the only visible write-back action for page adjustment.
- Frontend/backend verification includes checking or restarting dev processes before final UI validation.
- Image-to-HTML regression tests cover low-similarity failure keeping HTML, failed results rendering iframe preview, stream artifact emission before failed status, source display not clearing during status changes, iframe horizontal scrolling, restored asset cards preferring generated HTML previews, and standalone action route fallback after refresh.
- Image-to-HTML regression tests cover that generated status/result shells expose one enhanced generation action, do not show `高级生成`, and still route old `advanced-generate` compatibility actions into the enhanced generation payload.
- Image-to-HTML regression tests cover temporary preview id resolution to real restored asset routes, automatic takeover of document-written preview tabs, backend static quality audit, page type/density mode inference, quality audit report display, and the rule that frontend quality reports do not mutate generated HTML.
