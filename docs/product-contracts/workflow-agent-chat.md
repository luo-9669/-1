# Workflow Agent Chat Contract

## Goal

The workflow uses one Agent conversation surface. The Agent should show the model result clearly without leaking test scaffolds, raw renderer code, or duplicate UI implementations.

## Must Preserve

- The workflow has a single Agent shell: sidebar, embedded/medium, and fullscreen/large are display modes of the same `WorkflowAgentDrawer`.
- Small/medium/large Agent variants must share the same conversation state, send path, quick replies, history, upload, retry, apply-to-canvas, and stage progression logic. Their only allowed difference is frontend display mode: size, placement, layering, and responsive layout.
- The first total-flow stage keeps the internal id `requirement-dissection`, but the user-facing stage label should be `需求分析`; old saved runs named `需求解剖` must display as `需求分析` without changing generated business artifacts.
- When the user selects any stage after `需求分析`, the side Agent should collapse by default. This only changes the Agent display mode and must not clear its session, quick replies, history, or write-back logic.
- In requirement dissection, assistant recommendation buttons must come from backend/model quick replies for the current reply. The frontend must not inject fixed recommendation chips such as `补充背景`, `列出风险`, or `进入交互低保`.
- In requirement dissection, stage progression is owned by the page-level `下一步` button. Legacy labels such as `输出页面框架` and `进入交互低保` may remain input/history aliases for old saved data, but they must not be inserted as visible recommendation fallbacks.
- In requirement dissection, model-authored recommendations such as `生成低保真`, `转低保真画布`, `低保真画布`, or `应用到画布` must not be rewritten into `进入交互低保`. The model should instead return context-specific follow-up operations, while the visible stage transition stays separate.
- In `交互低保`, Agent conversation is a continuation of the selected page wireframe result. It explains, adjusts, or supplements the current page plan, then writes accepted changes back to that page instead of starting a separate structure/wireframe tool.
- Canvas action context such as `给布局方案`, `补交互细节`, `重生成本页`, or typed update requests should first appear as a removable pending reference pill in the composer. If the user sends while the reference is still present, the sent user message should also render that context-reference block. The composer must not show a permanent canvas-reference block, and the reference content must come from the active canvas node/message metadata instead of hardcoded business fields.
- Canvas node/page actions inside a workflow stage must be stored in the stage-level Agent session, for example `interaction-lofi`. The page/node id is request context and citation metadata only; switching pages must not create a separate Agent conversation or hide the shared stage history.
- Advanced UX runs may persist messages under stage-level scopes for backend routing, but the visible Agent timeline must merge those stage sessions into one conversation. Switching from `需求分析` to `交互低保` must keep the generated Advanced UX Markdown file card visible and append downstream page-interaction artifacts in the same Agent list, not replace the list with a bridge-only "已打开..." message.
- When the model/backend exposes `应用到画布` as the apply action for a layout or canvas proposal, the Agent must not also show a duplicate `确认入画布` control for the same assistant message.
- Legacy recommendation labels such as `生成低保真`, `转低保真画布`, and `低保真画布` should be normalized to the single apply action `应用到画布` when the user is already in `交互低保` with page wireframe results.
- Agent project knowledge is available only when the active workflow run is project-scoped (`demandScope === 'project'`). The decision must use the active workflow run's own `demandScope`, not the current URL, current global project id, or a stale form value.
- Project-scoped Agent runs may retrieve current project knowledge and show `已引用项目知识` evidence under the assistant reply. Non-project runs must not show that evidence or send project knowledge references to the backend, even when the user is currently viewing a project URL.
- Restored historical workflow runs must keep their own knowledge behavior: a restored project run can use its project knowledge; a restored non-project run must remain non-project and cannot inherit the currently selected project.
- When backend provides `meta.evidencePack`, it is the unified evidence disclosure for the assistant reply. Frontend must not also render separate project-knowledge or proposal-evidence disclosures for the same message, because those sources are already represented inside the evidence pack.
- Agent answer evaluation metadata is backend-owned. When the backend marks an answer as low confidence or needing review, `meta.answerEvaluation.recommendedActions` may provide recovery actions such as `补充依据`; these actions should be rendered as evaluation metadata and may be merged into the existing quick-reply pipeline.
- Agent business context must be the active workflow run's bound project: resolve the project from the run's `projectId`, send it as the current business project, and treat `流程通` only as the workspace/shell name unless the bound project is actually named `流程通`.
- Stage Agent prompts must use the current business project, initial demand, current canvas, conversation history, and retrieved project knowledge as context. They must not fall back to hardcoded legacy scenarios such as tea-drink ordering or any previous project's business domain.
- Knowledge retrieval failure should be visible as retrieval status/error metadata, but it must not block the Agent from replying with the current conversation and canvas context.
- Ordinary prose remains prose. Do not render every normal text reply as a framed card.
- Only special structured outputs should use framed cards: page layout artifacts, structure trees, tables, code, JSON/code-like blocks, and explicit workflow artifacts.
- Generated UI visual image results must render through the existing `AgentVisualArtifactCard` using `meta.visualArtifact.imageUrl` or `imageDataUrl`. The URL should come from the current hydrated canvas node when that node already has the persisted generated image.
- Opening a generated UI visual node in Agent should repair historical assistant messages whose `meta.visualArtifact.imageUrl` is empty by reading the real image URL from the same canvas node and saving the repaired session.
- Generated HTML/Vue results must render through ordinary markdown fenced code and the shared `AgentCodeCard`. They must not introduce a separate code-artifact message renderer or a stage-specific Agent branch.
- Stage Agent replies should prefer complete, readable analysis when the user asks to continue or expand. Backend prompts must not instruct the model to compress `content` into a one-line short reply unless the user explicitly asks for brevity.
- While an Agent stream is waiting for the first model-readable token, the backend should emit an immediate visible progress delta so the pending message is not an empty waiting area. This applies to stage Agent chat and structured canvas/proposal streams. This preview is for live display only and must not be persisted as the final assistant answer when real model content arrives.
- Agent chat requests must use a model-length timeout window. The frontend must not abort long UI visual / component-supplement replies before the backend model call can complete, otherwise users see a failed message until a manual refresh hydrates the persisted backend result.
- If a model or provider returns a JSON envelope such as `{"content":"..."}` or `{"reply":"..."}`, the Agent should display the user-facing field value as prose, including after refreshing a persisted run. Raw JSON envelopes should not override normalized assistant content.
- Stream final events must be normalized the same way as streamed deltas. If the model sends only a final JSON envelope and no displayable delta, the persisted assistant content must still use the user-facing `content`/`reply` field, not the raw JSON string.
- Page layout plan proposals with `writeableContent.layoutOptions` should render as three vertical comparable candidates with framework previews, fit scenarios, and trade-offs; each candidate should preserve the same current-page functional outline and key controls while allowing clearly different product tones, layout patterns, visual weights, and organization strategies. They must not be shown as detached generic cards or collapsed into one plain summary paragraph.
- Page layout plan proposals should expose comparison rows such as design tone, layout organization, fit scenario, risk/trade-off, and retained framework. The frontend should render those rows as a scan-friendly comparison before the per-option framework details.
- Weak or duplicate layout plan model output should be quality-guarded by the backend. If fewer than three usable options are returned, if candidates lack previewable framework rows, or if tone/layout organization is not distinct enough, backend should replace the options with high-contrast fallback candidates while keeping the same current-page functional outline.
- Historical plain-text layout proposals that do not contain structured `writeableContent.layoutOptions` should remain visible as history, but the Agent should mark them as old-rule layout proposals and offer `按新规则重生成`. The frontend must not mutate old business content into the new structure.
- Selecting `选 1/2/3 应用到画布` should route through the same proposal-confirm path with `selectedLayoutOptionId`, `selectedLayoutOptionIndex`, and selected option metadata. Loading, success copy, and version history should name the selected option, for example `方案二 · 运营推荐型`.
- Stage-level `应用到画布` is a current-stage write-back action: if the backend/model reply has no persisted proposal id, the frontend should record the assistant content as current-stage confirmation context and trigger current-stage regeneration from `totalDesignFlow`; it must not send a new generic chat message.
- Stage-level `下一步` is a stage progression action: the frontend should immediately record a provisional current-stage confirmation, switch to the confirmed next stage, and show next-stage canvas loading/refresh state. In parallel, it asks the Agent/model to summarize the current stage; once the model summary returns, frontend saves that summary as the current-stage confirmation context and then triggers next-stage canvas regeneration from the current `totalDesignFlow`. It must not be treated as `应用到画布`.
- Clicking a visible stage progression recommendation such as `下一步` should append a user-facing message that reads `进入下一阶段` before the assistant/system confirmation appears. The internal action metadata may keep the original button label for routing.
- Recommendation chips belong only to the latest actionable assistant reply. Once the user clicks any recommendation and the next turn starts, previous assistant replies must no longer show their old recommendation buttons. System confirmation replies such as `stage-confirm-next` and `advanced-ux-stage-confirm-next` must not inherit stale quick replies.
- Total-flow stage entries stay visible in the stage strip. They unlock sequentially: from `需求分析`, clicking `下一步` only enters `交互低保`; later stages such as `UI视觉`, `HTML`, `Vue`, and `验收沉淀` remain visible but disabled until the user reaches, generates, or confirms them through the stage progression flow. Already reached/rendered stages stay clickable so users can switch freely among completed/current stages.
- The Agent conversation should show finished model output in the conversation, not a separate test-only structure page.
- Advanced UX analysis is an exception to the ordinary total-flow first assistant reply shape: the Agent should show a short `advanced-ux-markdown-report` file-entry message such as “高级 UX Markdown 文件已生成”, while the full Markdown stays on `advancedUxReport.markdown`/message metadata and the canvas nodes show the imported sections. It must not rebuild this reply as a generic `workflow-analysis-result`.
- Agent actions such as copy, retry, edit, confirm, upload, model select, and send must remain available in every display mode where they are relevant.

## Must Not Do

- Do not create a second Agent implementation for a specific workflow stage.
- Do not split Agent logic by size. Names or implementations such as `SmallAgent`, `MediumAgent`, `LargeAgent`, stage-specific Agent drawers, or separate sessions for different Agent sizes are contract violations.
- Do not create visual-specific or code-specific Agent drawers, message branches, or renderer stacks for generated artifacts. Visual artifacts use `AgentVisualArtifactCard`; HTML/Vue code uses fenced code and `AgentCodeCard`.
- Do not trust a generation API `data.node` over the hydrated canvas node when building Agent artifact messages if the returned node lacks the persisted image URL or code source.
- Do not hardcode business output in the frontend to fake a model response.
- Do not show raw protocol text such as `:::page-layout-artifact` when a structured renderer exists.
- Do not keep canvas-node reference cards permanently inside the Agent composer. Composer references are temporary, user-removable draft context; sent-message references must come from `meta.contextReference`.
- Do not use a canvas node id as the Agent session key for stage workbench canvas actions. Keep the session scoped to the stage and pass the node id separately in context metadata.
- Do not wrap plain markdown paragraphs in decorative cards.
- Do not flatten three layout candidates into a single plain-text answer when the backend/model already returned structured `layoutOptions`.
- Do not make the three layout candidates differ by business content. They may differ by product tone, visual weight, layout pattern, and information organization, but the current page's key functions and controls must stay aligned.
- Do not automatically rewrite old saved layout messages into new structured layout options. Old messages may only show a regeneration affordance.
- Do not show two competing write-back actions for the same Agent answer. `应用到画布` is the visible write-back action for page-layout adjustment scenarios.
- Do not hardcode `应用到画布` or `进入交互低保` as requirement-dissection recommendation fallbacks. If the model returns an operation, render the normalized model operation; stage transition remains the top-level `下一步` flow.
- Do not infer project knowledge permission from `projectId` in the route. `projectId` only identifies where the run is viewed; `demandScope` decides whether knowledge can be retrieved and attached.
- Do not call the target business project `流程通` just because the Agent lives inside the Flow workspace. Use `流程通` only for the shell/tool identity.
- Do not hardcode old business examples or industry fallbacks into Agent prompts. If context is noisy or incomplete, continue from the active run's project, initial demand, current canvas, conversation history, and retrieved knowledge.
- Do not let the frontend invent answer-evaluation conclusions or recovery actions. It may only render `meta.answerEvaluation` from the backend and route provided action labels through the shared recommendation flow.
- Do not parse Advanced UX Markdown report messages as `page-layout-artifact`, even if historical content accidentally contains the marker. Advanced UX report messages are file entries plus backend-imported requirement sections, not page skeleton cards.

## Key Files

- `frontend/src/features/workflow/components/WorkflowAgentDrawer.vue`
- `frontend/src/App.vue`
- `frontend/src/services/workflowWorkbench.js`
- `tests/workflow-agent-actions.test.mjs`

## Regression Checks

- Agent has one shell across sidebar/inline/fullscreen, and the size modes share one session, send handler, quick-reply source, history source, and action pipeline.
- Requirement dissection recommendation chips are model-authored. Fixed fallbacks such as `补充背景`, `列出风险`, and `进入交互低保` must not be auto-injected.
- Legacy requirement-dissection stage-advance labels can keep routing to the stage progression flow when typed or restored, but should be cleaned from visible quick replies instead of being rewritten into current recommendations.
- Model/backend quick replies appear before fallback recommendations in ordinary stages; requirement dissection uses model/backend quick replies only.
- `应用到画布` recommendations suppress duplicate confirm-to-canvas buttons for the same assistant reply.
- Historical low-fidelity generation recommendations are normalized to `应用到画布` in existing `交互低保` conversations.
- Non-project Agent runs skip project knowledge retrieval before model replies.
- Project-scoped Agent runs may display cited project knowledge; non-project runs never display `已引用项目知识`.
- Restored runs keep their stored `demandScope` for project-knowledge decisions.
- Agent context includes the active run's business project name and prevents shell-name leakage, for example a `jogg- podcast` project must not be described as "serving 流程通".
- Agent prompts have regression coverage that rejects hardcoded legacy scenario fallbacks such as tea-drink ordering context.
- Ordinary markdown is rendered as prose.
- Structured artifacts still render as cards.
- Generated UI visual Agent messages show an image result card after generation and after reopening a historical generated node whose message had an empty image URL.
- HTML/Vue generation appends fenced code into the same Agent conversation and renders via `AgentCodeCard`, with no `codeArtifact` renderer branch.
- Layout option proposals render as three visible vertical comparable candidates and keep select/regenerate recommendation buttons.
- Layout option proposals include backend/model comparison rows and selected-option metadata through apply-to-canvas loading, success, and version history.
- Weak layout option proposals fall back to three distinct candidates and expose a `fallback-applied` quality reason.
- Old plain-text layout proposals show `按新规则重生成` instead of pretending to be current structured output.
- Raw protocol text is hidden from the user-facing view.
- Advanced UX restored/resumed runs rebuild `advanced-ux-markdown-report` messages from backend report metadata and do not generate ordinary total-flow page artifact replies.
