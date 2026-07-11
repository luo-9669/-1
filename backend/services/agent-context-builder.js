import { buildRequirementDissectionGuidanceArtifact } from './requirement-dissection-guidance.js'

const MODEL_LABELS = {
  'gpt-4.1': 'GPT-4.1',
  'gpt-5.5': 'GPT-5.5',
  'gpt-4o': 'GPT-4o',
  codex: 'Codex'
}

export function modelLabel(model = '') {
  return MODEL_LABELS[model] || model || 'GPT-5.5'
}

export function classifyAgentAction(content = '') {
  if (/重新分析|重新解析|重跑分析|重新生成分析/.test(content)) return 'reanalysis'
  if (/补充资料|补充细节|补充信息|补充上下文|补资料|展开分析/.test(content)) return 'supplement-detail'
  if (/拆模块|展开结构|拆解模块|模块/.test(content)) return 'module-breakdown'
  if (/调整优先级|优先级|排序/.test(content)) return 'priority-adjustment'
  if (/生成页面|页面|低保真|框架图|wireframe/i.test(content)) return 'page-generation'
  if (/确认框架|确认结构|确认/.test(content)) return 'confirmation'
  if (/生成蓝图|出蓝图|蓝图/.test(content)) return 'blueprint'
  if (/重新生成|重新对比|重来/.test(content)) return 'regenerate'
  return 'context-note'
}

function compactText(value = '', maxLength = 600) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function compactMultilineText(value = '', maxLines = 18, maxLineLength = 180) {
  return String(value || '')
    .split(/\r?\n/)
    .map((line) => compactText(line, maxLineLength))
    .filter(Boolean)
    .slice(0, maxLines)
    .join('\n')
}

function compactList(items = [], limit = 6, maxLength = 220) {
  return items
    .map((item) => compactText(item, maxLength))
    .filter(Boolean)
    .slice(0, limit)
}

function firstProjectNameFromKnowledge(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => compactText(item?.projectName || item?.project?.name || '', 120))
    .find(Boolean) || ''
}

function resolveBusinessProject(payload = {}, run = {}) {
  const contextProject = payload.context?.project && typeof payload.context.project === 'object' && !Array.isArray(payload.context.project)
    ? payload.context.project
    : null
  const analysisProject = run.documentAnalysis?.project && typeof run.documentAnalysis.project === 'object' && !Array.isArray(run.documentAnalysis.project)
    ? run.documentAnalysis.project
    : null
  const runProject = run.project && typeof run.project === 'object' && !Array.isArray(run.project)
    ? run.project
    : null
  const project = contextProject || analysisProject || runProject || null
  const knowledgeProjectName = firstProjectNameFromKnowledge(payload.retrievedKnowledge)
  return {
    id: compactText(project?.id || run.projectId || '', 120),
    name: compactText(project?.name || project?.title || run.projectName || knowledgeProjectName || '', 160)
  }
}

function isWorkflowShellProjectName(value = '') {
  return /^流程通(?:默认项目)?$/.test(compactText(value, 80))
}

function businessProjectLine(project = {}) {
  const name = compactText(project.name || '', 160)
  const id = compactText(project.id || '', 120)
  if (name) return `当前业务项目：${name}${id ? `（${id}）` : ''}`
  if (id) return `当前业务项目：未命名项目（${id}）`
  return '当前业务项目：未绑定'
}

function businessProjectGuardInstruction() {
  // Contract: "流程通" names the workspace shell, not the user's bound business project.
  return '流程通只是工作台名称，不是当前业务项目名；除非当前业务项目名称本身就是“流程通”，否则不要写“服务于流程通”或把“流程通”当作业务产品。'
}

function knowledgeProjectLine(items = [], project = {}) {
  const names = Array.from(new Set([
    compactText(project.name || '', 120),
    ...(Array.isArray(items) ? items : []).map((item) => compactText(item?.projectName || '', 120))
  ].filter(Boolean)))
  return names.length ? `项目知识所属项目：${names.join('、')}` : ''
}

function compactReferences(references = []) {
  return references
    .filter((item) => item && item.status !== 'failed')
    .slice(0, 6)
    .map((item) => ({
      id: item.id || '',
      name: item.name || '未命名引用',
      kind: item.kind || item.type || 'document',
      status: item.status || 'ready',
      text: compactText(item.text || item.content || '', 800)
    }))
}

function compactHistory(run = {}, scopeId = '') {
  return ((run.agentSessions || {})[scopeId] || [])
    .slice(-6)
    .map((item) => ({
      role: item.role || 'user',
      content: compactText(item.content || '', 500)
    }))
    .filter((item) => item.content)
}

function buildDialogueAgentContext(payload = {}, base = {}) {
  const message = payload.message || {}
  const run = payload.run || {}
  const scopeId = payload.scopeId || base.scopeId || 'dialogue-agent'
  const model = payload.model || run.model || 'gpt-5.5'
  const history = compactHistory(run, scopeId)
    .filter((item) => item.content !== message.content)
    .slice(-10)
  const references = compactReferences(payload.references || [])
  const referenceText = references.length
    ? renderLines('用户上传资料', references.map((item) => `${item.name}：${item.text || item.kind}`))
    : '用户上传资料：暂无'
  const historyText = history.length
    ? renderLines('最近对话', history.map((item) => `${item.role === 'assistant' ? '助手' : '用户'}：${item.content}`))
    : '最近对话：暂无'
  return {
    mode: 'dialogue-chat',
    actionType: 'dialogue-chat',
    scopeId,
    model,
    modelLabel: modelLabel(model),
    run,
    step: payload.step || {},
    node: {
      id: scopeId,
      title: '对话 Skill',
      summary: '普通模型对话'
    },
    message: {
      role: message.role || 'user',
      content: message.content || ''
    },
    references,
    retrievedKnowledge: [],
    knowledgeRetrievalError: '',
    history,
    now: payload.now || new Date().toISOString(),
    systemPrompt: [
      '你是流程通里的普通对话助手。',
      '当前是“对话 Skill”：像自然对话助手一样回复用户，不要把用户输入拆成固定步骤。',
      '按自然语言正常回复即可，不要套用工作流格式，不要要求用户确认写入。',
      '用户如果只是提需求，就直接分析、追问或给建议；只有用户明确要求生成页面画布时，才按页面画布内容组织。',
      pageLayoutArtifactInstruction()
    ].join('\n'),
    userPrompt: [
      `初始需求：${run.input || '暂无'}`,
      historyText,
      referenceText,
      `用户：${message.content || ''}`
    ].join('\n\n')
  }
}

function compactRetrievedKnowledge(items = []) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 6)
    .map((item) => ({
      title: item.title || '未命名知识',
      snippet: compactText(item.snippet || item.content || item.text || '', 800),
      evidence: Array.isArray(item.evidence) ? item.evidence.slice(0, 3) : [],
      projectId: item.projectId || '',
      projectName: item.projectName || '',
      sourceTitle: item.sourceTitle || item.evidence?.[0]?.title || item.title || '',
      materialType: item.materialType || item.type || item.category || '',
      sourceType: item.sourceType || '',
      sourceUrl: item.sourceUrl || '',
      roleScopes: Array.isArray(item.roleScopes) ? item.roleScopes : [],
      matchReason: item.matchReason || item.chunk?.heading || item.category || '',
      verification: item.verification || { status: 'unverified' }
    }))
    .filter((item) => item.snippet || item.evidence.length)
}

function compactCanvasNode(node = {}) {
  const artifact = node.pageLayoutArtifact && typeof node.pageLayoutArtifact === 'object' && !Array.isArray(node.pageLayoutArtifact)
    ? node.pageLayoutArtifact
    : null
  return {
    id: node.id || '',
    title: node.title || node.id || '未命名节点',
    summary: compactText(node.summary || '', 260),
    content: compactList(node.content || [], 8, 260),
    agentScope: compactText(node.agentScope || '', 220),
    ...(artifact
      ? {
          pageLayoutArtifact: {
            title: compactText(artifact.title || '', 120),
            modelDecision: compactText(artifact.modelDecision || '', 500),
            asciiWireframe: compactMultilineText(artifact.asciiWireframe || '', 24, 180),
            interactionDetails: compactMultilineText(artifact.interactionDetails || '', 14, 180)
          }
        }
      : {})
  }
}

function resolveTotalFlowContext(run = {}, rawNode = {}, scopeId = '') {
  const totalFlow = run.documentAnalysis?.totalDesignFlow || null
  if (!totalFlow) return null
  const currentStageId = rawNode.stageId ||
    totalFlow.currentStage ||
    Object.entries(totalFlow.stageCanvases || {}).find(([, canvas]) =>
      Array.isArray(canvas?.nodes) && canvas.nodes.some((node) => node?.id === (rawNode.id || scopeId))
    )?.[0] ||
    ''
  const stages = Array.isArray(totalFlow.stages) ? totalFlow.stages : []
  const currentStage = stages.find((stage) => stage?.id === currentStageId) || { id: currentStageId, name: currentStageId }
  const stageCanvas = totalFlow.stageCanvases?.[currentStageId] || {}
  const stageNodes = (Array.isArray(stageCanvas.nodes) ? stageCanvas.nodes : [])
    .filter((node) => node && typeof node === 'object' && !Array.isArray(node))
  const currentSliceId = totalFlow.activeSliceId ||
    stageNodes.find((node) => node?.id === (rawNode.id || scopeId))?.sliceId ||
    ''
  const slices = Array.isArray(totalFlow.requirementSlices) ? totalFlow.requirementSlices : []
  const activeSlice = slices.find((slice) => slice?.id === currentSliceId) || slices[0] || null
  const currentIndex = stageNodes.findIndex((node) => node.id === (rawNode.id || scopeId))
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  const currentNode = stageNodes[safeIndex] || rawNode || {}
  return {
    currentStage: {
      id: currentStage.id || '',
      name: currentStage.name || currentStage.id || ''
    },
    activeSlice: activeSlice
      ? {
          id: activeSlice.id || '',
          title: activeSlice.title || activeSlice.name || '',
          goal: compactText(activeSlice.goal || activeSlice.summary || '', 260),
          sourceExcerpt: compactText(activeSlice.sourceExcerpt || '', 260)
        }
      : null,
    stageCanvas: {
      nodes: stageNodes.map(compactCanvasNode),
      edges: Array.isArray(stageCanvas.edges) ? stageCanvas.edges.slice(0, 20) : [],
      orderedTabs: Array.isArray(stageCanvas.orderedTabs) ? stageCanvas.orderedTabs.slice(0, 20) : []
    },
    currentNode: compactCanvasNode(currentNode),
    upstreamNodes: safeIndex > 0 ? stageNodes.slice(0, safeIndex).map(compactCanvasNode) : [],
    downstreamNodes: currentIndex >= 0 ? stageNodes.slice(safeIndex + 1).map(compactCanvasNode) : []
  }
}

function resolveCanvas(run = {}, rawNode = {}, scopeId = '') {
  const totalFlowContext = resolveTotalFlowContext(run, rawNode, scopeId)
  if (totalFlowContext?.stageCanvas?.nodes?.length) {
    return {
      fullCanvas: totalFlowContext.stageCanvas,
      currentNode: totalFlowContext.currentNode,
      upstreamNodes: totalFlowContext.upstreamNodes,
      downstreamNodes: totalFlowContext.downstreamNodes,
      totalFlowContext
    }
  }
  const canvas = run.documentAnalysis?.canvas || run.projectBlueprint?.canvas || {}
  const nodes = (Array.isArray(canvas.nodes) ? canvas.nodes : [])
    .filter((node) => node && typeof node === 'object' && !Array.isArray(node))
  const currentIndex = nodes.findIndex((node) => node.id === (rawNode.id || scopeId))
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  const currentNode = nodes[safeIndex] || rawNode || {}
  return {
    fullCanvas: {
      nodes: nodes.map(compactCanvasNode),
      edges: Array.isArray(canvas.edges) ? canvas.edges.slice(0, 20) : [],
      orderedTabs: Array.isArray(canvas.orderedTabs) ? canvas.orderedTabs.slice(0, 20) : []
    },
    currentNode: compactCanvasNode(currentNode),
    upstreamNodes: safeIndex > 0 ? nodes.slice(0, safeIndex).map(compactCanvasNode) : [],
    downstreamNodes: currentIndex >= 0 ? nodes.slice(safeIndex + 1).map(compactCanvasNode) : []
  }
}

function compactProposals(run = {}, scopeId = '') {
  const proposalsByNode = run.agentProposals || {}
  const scoped = Array.isArray(proposalsByNode[scopeId]) ? proposalsByNode[scopeId] : []
  return scoped
    .slice(-4)
    .map((proposal) => ({
      id: proposal.id || '',
      nodeId: proposal.nodeId || scopeId,
      title: proposal.title || '',
      summary: compactText(proposal.summary || proposal.writeableContent?.summary || '', 320),
      status: proposal.status || 'pending'
    }))
    .filter((proposal) => proposal.id || proposal.summary)
}

function renderLines(title, items = []) {
  if (!items.length) return `${title}：暂无`
  return `${title}：\n${items.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
}

function pageLayoutArtifactInstruction() {
  return [
    '页面布局输出协议：当用户要求页面框架、页面骨架、线框图、布局方案、页面转框架、框架转页面，或询问瀑布流/卡片流/信息流/左右分栏/表单流/结算流如何选择时，必须在正文中输出一个 :::page-layout-artifact 卡片块。',
    '卡片块标题固定为“页面骨架”，用于前端渲染成浅色边框卡片；卡片块外可以保留必要解释，但核心方案必须放进卡片块。',
    '卡片块必须包含四段：## 模型推荐方案、## ASCII 页面线框图、## 模块交互明细、## 前后端交付。',
    '模型推荐方案必须写清：页面类型、推荐布局、推荐原因；推荐布局要从瀑布流、卡片流、信息流、左右分栏、表单流、结算流、顶部操作区+主体滚动区+底部固定操作栏等通用布局中选择，不要套业务专属模板。',
    'ASCII 页面线框图必须用 ┌ ┐ └ ┘ ├ ─ │ 表达真实页面空间：左侧导航/顶部固定区/右侧工具区/主体滚动区/底部固定区/按钮/输入框/图片/卡片/弹窗/悬浮层的大致位置。若知识库、源码或截图证明桌面端是左侧 Sidebar/AppNavRail，禁止改写成顶部导航。',
    '输入框、搜索框、composer、textarea 这类容器必须画出内部层级：placeholder、已输入内容、上传/附件入口、快捷 Chips、清空/换一批、主按钮/发送按钮、错误/加载提示分别在容器内或容器下方的位置，不能只写成“输入框：xxx”的普通文案。',
    '禁止把纯树状目录当线框图，例如“页面骨架 ├─ 顶部 ├─ 列表”；禁止输出一行流程箭头图，例如“是否有门店 --> 菜单页”。这些只能作为信息架构或流程说明，不能作为 ASCII 页面线框图。',
    '每个关键页面至少要画出一个手机/页面容器边界，并用横向分割线标出顶部、主体滚动、底部/悬浮/弹窗区域；如果是点餐页这类双栏页面，主体区必须画出左右分栏。',
    '模块交互明细必须说明按钮、输入框、图片、卡片、滚动区域、手势、点击/长按/滑动/下拉刷新/加载更多、空/错/加载/权限状态。',
    '前后端交付必须明确前端接管页面布局、状态、组件、交互和埋点，后端提供接口数据、字段、分页、价格/会员/点赞等业务状态和错误码。',
    '为了让系统用统一线框图渲染器生成最终成果，建议在正文末尾附带一个 ```json 代码块，字段为 pageLayoutSpec；pageLayoutSpec.pages 每项包含 page, pageType, layoutType, topFixed, scrollModules, bottomFixed, overlays, interactions, frontendTasks, backendTasks。该结构化数据只作为渲染输入，前端最终会隐藏源码，只展示页面骨架成果卡片。',
    '示例外壳：:::page-layout-artifact title="页面骨架"\\n## 模型推荐方案\\n页面类型：...\\n推荐布局：...\\n推荐原因：...\\n\\n## ASCII 页面线框图\\n┌────────────────────────┐\\n│ 顶部固定导航：返回/标题/搜索 │\\n├────────────────────────┤\\n│ 主体滚动区：图片/卡片/列表   │\\n│ 主要按钮/输入框/状态提示     │\\n├────────────────────────┤\\n│ 底部固定操作：次按钮/主按钮   │\\n└────────────────────────┘\\n\\n## 模块交互明细\\n- ...\\n\\n## 前后端交付\\n- 前端：...\\n- 后端：...\\n:::'
  ].join('\n')
}

function stageAgentQuickRepliesInstruction() {
  return [
    '回复末尾必须附带最多 3 个大模型推荐按钮，推荐按钮要贴合当前回复内容，不要默认使用“补充背景/列出风险”。',
    '输出格式为可解析 JSON：{"content":"中文 Markdown 正文","quickReplies":["继续细化用户路径","补齐异常状态","补齐页面边界"]}。',
    'content 字段放完整中文 Markdown 正文；quickReplies 字段只放短按钮文案，每个 4-12 个字，优先给下一步可点击动作。',
    '如果当前是需求分析阶段，quickReplies 只能给与本轮分析内容直接相关的追问、补充或细化操作，不要固定返回“进入交互低保”；阶段推进由页面上的“下一步”按钮负责。'
  ].join('\n')
}

function renderNodeLines(title, nodes = []) {
  return renderLines(title, nodes.map((node) => {
    const content = Array.isArray(node.content) && node.content.length ? `；内容：${node.content.join(' / ')}` : ''
    return `${node.title || node.id}（${node.id}）：${node.summary || '暂无摘要'}${content}`
  }))
}

function compactStageConfirmations(totalFlow = {}) {
  return Object.values(totalFlow?.stageConfirmations || {})
    .filter((item) => item && (item.stageName || item.summary))
    .slice(-3)
    .map((item) => `阶段确认：${item.stageName || item.stageId || '阶段'}｜${item.summary || '已确认'}`)
}

function normalizeCanvasActionIntent(canvasAction = {}) {
  const action = compactText(canvasAction.actionLabel || canvasAction.action || '', 80)
  const normalized = action.replace(/\s+/g, '')
  const explicitIntent = compactText(canvasAction.actionIntent || '', 120)
  const knownIntents = new Set([
    'target-user-enrichment',
    'positioning-adjustment',
    'acceptance-criteria-enrichment',
    'api-contract-enrichment',
    'exception-state-enrichment',
    'analytics-enrichment',
    'competitor-reference-enrichment',
    'page-layout-plan',
    'interaction-detail-enrichment',
    'supplement-detail',
    'reanalysis',
    'canvas-action-advice'
  ])
  const actionIntent = knownIntents.has(explicitIntent)
    ? explicitIntent
    : /目标用户|用户人群|人群/.test(normalized)
    ? 'target-user-enrichment'
    : /调整定位|定位|页面定位|产品定位/.test(normalized)
    ? 'positioning-adjustment'
    : /验收标准|补验收|验收|测试口径|通过条件|失败条件/.test(normalized)
    ? 'acceptance-criteria-enrichment'
    : /接口契约|补接口|接口字段|接口|API|错误码|Mock|前后端/.test(normalized)
    ? 'api-contract-enrichment'
    : /异常状态|补异常|错误态|空状态|加载态|失败态|权限态|恢复入口|状态/.test(normalized)
    ? 'exception-state-enrichment'
    : /埋点指标|补埋点|埋点|指标|转化|事件|数据观察|漏斗/.test(normalized)
    ? 'analytics-enrichment'
    : /竞品|对标|参考对象|截图链接|知识库选择参考|找3个竞品|找三个竞品|找竞品/.test(normalized)
    ? 'competitor-reference-enrichment'
    : /给布局方案|布局方案|布局/.test(normalized)
    ? 'page-layout-plan'
    : /补交互细节|交互细节|交互/.test(normalized)
    ? 'interaction-detail-enrichment'
    : /补充资料|补充细节|补充信息|补资料|资料/.test(normalized)
    ? 'supplement-detail'
    : /重新分析|重新解析|重跑分析|重新生成分析/.test(normalized)
    ? 'reanalysis'
    : 'canvas-action-advice'
  const expectedSections = compactList(canvasAction.expectedSections || [
    '结论',
    '依据与假设',
    '缺口与风险',
    '可写入画布内容',
    '后续画布影响'
  ], 8, 80)
  return {
    ...canvasAction,
    action,
    actionLabel: action,
    nodeId: canvasAction.nodeId || '',
    actionIntent,
    actionTemplate: canvasAction.actionTemplate || canvasActionOutputGuide(actionIntent),
    expectedSections
  }
}

function canvasActionOutputGuide(actionIntent = '') {
  const guides = {
    'target-user-enrichment': '动作指南：按用户分层、进入场景、核心任务、顾虑点、成功标准输出，避免泛泛写“所有用户”。',
    'positioning-adjustment': '动作指南：按页面/弹窗定位、核心价值、不包含范围、上下游依赖、业务边界输出，避免只复述按钮名。',
    'acceptance-criteria-enrichment': '动作指南：按验收场景、成功路径、失败态、通过条件、测试口径和埋点观察输出，避免只写“功能正常”。',
    'api-contract-enrichment': '动作指南：按接口端点、请求字段、返回字段、错误码、前端接管、后端接管、Mock 数据和依赖影响输出。',
    'exception-state-enrichment': '动作指南：按状态名称、触发条件、UI 反馈、恢复入口、后端条件和可测试标准输出，覆盖加载、空、错、权限和超时。',
    'analytics-enrichment': '动作指南：按事件名、触发时机、事件属性、成功指标、漏斗影响和隐私边界输出，避免只写“需要埋点”。',
    'competitor-reference-enrichment': '动作指南：围绕当前业务项目和需求分析节点补齐竞品参考。先区分真实证据、项目知识库证据、用户上传截图/链接和行业假设；没有明确证据时，不要编造真实竞品名称、价格、研究结论或市场事实，只输出可检索方向、对比维度、行业模式启发、需要用户补充的材料和下一步采集动作。',
    'page-layout-plan': '动作指南：必须输出 3 套候选框架方案，写入 proposal.writeableContent.layoutOptions；每套包含 id、label、title、summary、layoutStyle、layoutStrategy、frameworkRows、bestFor、layout、risk、acceptanceCriteria。还必须写入 proposal.writeableContent.layoutComparisonRows，用“设计调性、布局组织、适合场景、风险取舍、保留大纲”等行对比方案一/二/三。三套方案必须保留当前页面同一套功能大纲、主要控件、状态、顶部/底部固定区和内容滚动区，但可以采用明显不同的产品调性、版式结构和视觉权重，例如轻量入口型、运营推荐型、效率任务型、科技感、内容沉浸型、数据看板型等；不要只给泛化布局名称，也不要把当前页面功能换成另一套业务内容。',
    'interaction-detail-enrichment': '动作指南：基于当前页面线框，按点击、滑动、输入、长按、弹窗、反馈、状态流转、异常恢复和跳转目标输出；必须补齐状态提示文案、启用条件、禁用条件、显示条件、隐藏条件、操作结果、动效说明、测试点，并包含“下拉手势 → 触发接口刷新页面数据”“内容区域纵向滚动 → 顶部/底部固定区不跟随滚动”。不要只写“补充交互”。',
    'supplement-detail': '动作指南：按当前结论补充、依据、缺口风险、可写入条目、待确认问题输出，直接给可用资料。',
    reanalysis: '动作指南：先给重新分析结论，再指出原画布不足、修正内容、后续节点需要重算的影响。'
  }
  return [
    '输出要求：直接给出详细建议、依据、缺口风险、可补充到画布的结构化内容；不要回复“已接收”这类过程说明。',
    `动作意图：${actionIntent || 'canvas-action-advice'}`,
    guides[actionIntent] || '动作指南：按动作目标输出清晰结论、依据、缺口风险、可写入画布内容和后续画布影响。',
    '必须包含：结论、依据与假设、缺口与风险、可写入画布内容、后续画布影响。'
  ].join('\n')
}

const AGENT_WORKBENCH_SCOPES = new Set([
  'requirement-dissection',
  'requirement-dissection-agent',
  'requirement-slicing',
  'requirement-slicing-agent',
  'gap-confirmation',
  'gap-confirmation-agent'
])

function isAgentWorkbenchScope(scopeId = '') {
  const normalized = compactText(scopeId, 120)
  return AGENT_WORKBENCH_SCOPES.has(normalized) ||
    /^(requirement-dissection|requirement-slicing|gap-confirmation)(-|$)/.test(normalized)
}

function isPreAnalysisStage(scopeId = '', stageTitle = '') {
  return /requirement-dissection|requirement-slicing|gap-confirmation/.test(scopeId) ||
    /需求分析|需求解剖|小需求切片|缺口确认/.test(stageTitle)
}

function compactAnalysisGuidance(guidance = null) {
  if (!guidance || typeof guidance !== 'object' || Array.isArray(guidance)) return null
  const compactGroup = (items = [], limit = 8) => (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: compactText(item?.id || '', 120),
      title: compactText(item?.title || '', 160),
      path: compactText(item?.path || '', 220),
      summary: compactText(item?.summary || '', 260),
      sourceType: compactText(item?.sourceType || '', 80)
    }))
    .filter((item) => item.title || item.path || item.summary)
    .slice(0, limit)
  const compacted = {
    version: compactText(guidance.version || '', 120),
    hardConstraints: compactGroup(guidance.hardConstraints),
    methodGuides: compactGroup(guidance.methodGuides),
    referenceNotes: compactGroup(guidance.referenceNotes)
  }
  return compacted.hardConstraints.length || compacted.methodGuides.length || compacted.referenceNotes.length
    ? compacted
    : null
}

function renderAnalysisGuidance(guidance = null) {
  if (!guidance) return ''
  const renderGroup = (label, items = []) => items.length
    ? renderLines(label, items.map((item) => `${item.title || item.path}｜${item.path}${item.summary ? `｜${item.summary}` : ''}`))
    : ''
  return [
    '分析规则来源：以下内容是需求分析方法、产品合同和研究记录，不是业务事实证据；不要写入 evidencePack，也不要当作项目知识。',
    guidance.version ? `规则版本：${guidance.version}` : '',
    renderGroup('硬约束', guidance.hardConstraints),
    renderGroup('方法指南', guidance.methodGuides),
    renderGroup('参考记录', guidance.referenceNotes)
  ].filter(Boolean).join('\n')
}

function compactAdvancedUxReport(report = null) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null
  const markdown = String(report.markdown || '').trim()
  if (!markdown) return null
  return {
    status: compactText(report.status || '', 80),
    fileName: compactText(report.fileName || '高级 UX 需求分析.md', 180),
    artifactType: compactText(report.artifactType || 'requirements-markdown', 120),
    markdown
  }
}

function advancedUxReportForPayload(payload = {}, run = {}) {
  return compactAdvancedUxReport(payload.context?.advancedUxReport) ||
    compactAdvancedUxReport(run.documentAnalysis?.advancedUxReport) ||
    compactAdvancedUxReport(run.documentAnalysis?.totalDesignFlow?.advancedUxReport)
}

function renderAdvancedUxReport(report = null) {
  if (!report?.markdown) return ''
  return [
    `高级 UX Markdown 产物：${report.fileName || '高级 UX 需求分析.md'}`,
    `产物状态：${report.status || 'generated'}；类型：${report.artifactType || 'requirements-markdown'}`,
    '以下是本轮高级 UX 分析生成的完整 Markdown 文件正文。用户询问“这个文件/Markdown/报告”时，优先基于这份正文回答；不要说你看不到文件。',
    report.markdown
  ].join('\n')
}

function requirementDissectionGuidanceForRun(run = {}) {
  return run.documentAnalysis?.totalDesignFlow?.requirementDissectionArtifact?.analysisGuidance ||
    buildRequirementDissectionGuidanceArtifact()
}

function stageAgentOutputFocus(scopeId = '', stageTitle = '') {
  if (/requirement-dissection/.test(scopeId) || /需求分析|需求解剖/.test(stageTitle)) {
    return '阶段输出重点：先判断需求类型和业务目标，再拆核心闭环、关键角色、主要页面/能力、边界假设、明显缺口和下一阶段需要带走的结论。'
  }
  if (/requirement-slicing/.test(scopeId) || /小需求切片/.test(stageTitle)) {
    return '阶段输出重点：确认小需求切片的目标、优先级、页面数量、边界重叠、阻塞状态和是否可进入缺口确认。'
  }
  if (/gap-confirmation/.test(scopeId) || /缺口确认/.test(stageTitle)) {
    return '阶段输出重点：收口已确认事实、待确认问题、阻塞项、影响范围和建议下一步，区分必须确认与可后补问题。'
  }
  return '阶段输出重点：围绕当前阶段给出结论、拆解、依据、缺口、风险和下一步建议。'
}

function buildAgentWorkbenchContext(payload = {}, base = {}) {
  const message = payload.message || {}
  const run = payload.run || {}
  const rawNode = payload.context?.activeNode || {}
  const scopeId = base.scopeId || rawNode.id || 'stage-agent'
  const model = payload.model || run.model || 'gpt-5.5'
  const history = compactHistory(run, scopeId)
    .filter((item) => item.content !== message.content)
    .slice(-10)
  const references = compactReferences(payload.references || [])
  const referenceText = references.length
    ? renderLines('用户上传资料', references.map((item) => `${item.name}：${item.text || item.kind}`))
    : '用户上传资料：暂无'
  const historyText = history.length
    ? renderLines('最近对话', history.map((item) => `${item.role === 'assistant' ? '助手' : '用户'}：${item.content}`))
    : '最近对话：暂无'
  const analysis = run.documentAnalysis || {}
  const isNonProjectDemand = run.demandScope === 'non-project' || analysis.demandScope === 'non-project'
  const blueprint = analysis.blueprint || {}
  const businessProject = resolveBusinessProject(payload, run)
  const productName = blueprint.profile?.productName ||
    blueprint.title ||
    (!isWorkflowShellProjectName(run.workflowName) ? run.workflowName : '') ||
    businessProject.name ||
    run.input ||
    '当前需求'
  const stageTitle = rawNode.title || scopeId
  const stageAgentScope = rawNode.agentScope || `当前只围绕「${stageTitle}」回答。`
  const canvasContext = resolveCanvas(run, rawNode, scopeId)
  const totalFlowContext = canvasContext.totalFlowContext || null
  const retrievedKnowledge = compactRetrievedKnowledge(payload.retrievedKnowledge || [])
  const knowledgeText = retrievedKnowledge.length
    ? renderLines('知识库召回', retrievedKnowledge.map((item) => `${item.title}：${item.snippet}`))
    : '知识库召回：暂无'
  const outputFocus = stageAgentOutputFocus(scopeId, stageTitle)
  const analysisGuidance = isPreAnalysisStage(scopeId, stageTitle)
    ? compactAnalysisGuidance(requirementDissectionGuidanceForRun(run))
    : null
  const analysisGuidanceText = renderAnalysisGuidance(analysisGuidance)
  const advancedUxReport = advancedUxReportForPayload(payload, run)
  const advancedUxReportText = renderAdvancedUxReport(advancedUxReport)
  return {
    mode: 'dialogue-chat',
    actionType: 'stage-agent-chat',
    scopeId,
    model,
    modelLabel: modelLabel(model),
    run,
    step: payload.step || {},
    node: {
      id: scopeId,
      title: stageTitle,
      summary: rawNode.summary || stageAgentScope
    },
    message: {
      role: message.role || 'user',
      content: message.content || ''
    },
    references,
    analysisGuidance,
    advancedUxReport,
    retrievedKnowledge,
    knowledgeRetrievalError: compactText(payload.context?.knowledgeRetrievalError || '', 220),
    history,
    now: payload.now || new Date().toISOString(),
    systemPrompt: [
      `你是流程通里的「${stageTitle}」阶段助手。`,
      `当前阶段目标：${stageAgentScope}`,
      '像产品与交互顾问一样自然回复用户，实时输出分析结论和建议。',
      '默认给产品级展开回答，不要只给一句结论；除非用户明确要求简短，否则要把判断过程讲清楚。',
      '输出中文 Markdown 长文，不要固定死模板；根据用户需求动态组织内容，通常保持 1200-2500 字。',
      '如果是产品方案类需求，优先覆盖产品定位与目标、目标用户与场景、信息架构、核心流程、页面结构、异常边界、视觉与组件建议、后续开发注意点。',
      '至少覆盖：核心闭环、关键页面/功能、依赖与边界、待确认问题、建议下一步。',
      '回答可以使用 Markdown 小标题和列表，让前端直接展示为完整可读的分析。',
      '不要输出 JSON，不要包裹代码块，不要要求用户确认写入画布。',
      '直接给出分析、建议或追问，帮助用户快速完成当前阶段。',
      '信息不足时先给合理默认假设，并把假设和风险说清楚，不要只说“请补充信息”。',
      '如果用户消息口语化、像吐槽、打字错误或无意义，不要只判定无效；要把它理解为“继续基于已有上下文推进”，结合初始需求和最近对话继续展开当前阶段。',
      '遇到噪声输入时，先轻描淡写说明会沿用当前业务项目、初始需求和最近对话上下文，再直接给完整分析，不要停在一句“等待确认/不扩展范围”。',
      businessProjectGuardInstruction(),
      outputFocus,
      analysisGuidance ? '需求分析 guidance 只能作为方法与约束使用，不能作为业务事实证据、项目知识或上传资料引用。' : '',
      pageLayoutArtifactInstruction(),
      stageAgentQuickRepliesInstruction(),
      '如果有知识库召回内容，结合知识库给出更准确的回复。'
    ].join('\n'),
    userPrompt: [
      businessProjectLine(businessProject),
      knowledgeProjectLine(retrievedKnowledge, businessProject),
      `需求模式：${isNonProjectDemand ? '非项目需求' : '项目需求'}`,
      `项目/需求：${productName}`,
      `初始需求：${run.input || '暂无'}`,
      totalFlowContext?.currentStage?.name ? `当前总流程阶段：${totalFlowContext.currentStage.name}` : '',
      totalFlowContext?.activeSlice?.title ? `当前小需求：${totalFlowContext.activeSlice.title}${totalFlowContext.activeSlice.goal ? `；目标：${totalFlowContext.activeSlice.goal}` : ''}` : '',
      rawNode.content?.length ? renderLines('当前阶段内容', rawNode.content) : '',
      outputFocus,
      analysisGuidanceText,
      advancedUxReportText,
      knowledgeText,
      historyText,
      referenceText,
      `用户：${message.content || ''}`
    ].filter(Boolean).join('\n\n')
  }
}

export function buildAgentContext(payload = {}) {
  const message = payload.message || {}
  const run = payload.run || {}
  const step = payload.step || {}
  const rawNode = payload.context?.activeNode || {}
  const scopeId = payload.scopeId || rawNode.id || step.id || 'step'
  if (run.skillId === 'dialogue-skill' || run.resolvedSkillId === 'dialogue-skill' || run.workflowId === 'dialogue-skill') {
    return buildDialogueAgentContext(payload, { scopeId })
  }
  if (isAgentWorkbenchScope(scopeId)) {
    return buildAgentWorkbenchContext(payload, { scopeId })
  }
  const model = payload.model || run.model || 'gpt-5.5'
  const canvasAction = payload.context?.canvasAction && typeof payload.context.canvasAction === 'object'
    ? payload.context.canvasAction
    : null
  const normalizedCanvasAction = canvasAction ? normalizeCanvasActionIntent(canvasAction) : null
  const explicitAction = payload.action || message.meta?.action || (canvasAction ? 'canvas-action-advice' : '')
  const knownExplicitActions = new Set(['canvas-action-advice', 'reanalysis'])
  const actionType = knownExplicitActions.has(explicitAction)
    ? explicitAction
    : classifyAgentAction(message.content || '')
  const references = compactReferences(payload.references || [])
  const history = compactHistory(run, scopeId)
  const canvasContext = resolveCanvas(run, rawNode, scopeId)
  const totalFlowContext = canvasContext.totalFlowContext || null
  const resolvedNode = canvasContext.currentNode || {}
  const resolvedPageLayoutArtifact = compactCanvasNode(resolvedNode).pageLayoutArtifact || compactCanvasNode(rawNode).pageLayoutArtifact
  const node = {
    id: resolvedNode.id || rawNode.id || scopeId,
    title: resolvedNode.title || rawNode.title || step.title || '当前环节',
    summary: resolvedNode.summary || rawNode.summary || rawNode.agentScope || step.goal || '围绕当前小画板继续补充。',
    content: compactList(resolvedNode.content?.length ? resolvedNode.content : (rawNode.content || []), 8, 260),
    agentScope: resolvedNode.agentScope || rawNode.agentScope || '',
    interactionGoal: rawNode.agentInteraction?.goal || '',
    ...(resolvedPageLayoutArtifact ? { pageLayoutArtifact: resolvedPageLayoutArtifact } : {})
  }
  const pendingProposals = compactProposals(run, scopeId)
  const stageConfirmationText = compactStageConfirmations(totalFlowContext || run.documentAnalysis?.totalDesignFlow || {})
  const retrievedKnowledge = compactRetrievedKnowledge(payload.retrievedKnowledge || [])
  const businessProject = resolveBusinessProject(payload, run)
  const advancedUxReport = advancedUxReportForPayload(payload, run)
  const advancedUxReportText = renderAdvancedUxReport(advancedUxReport)
  const demandProjectName = !isWorkflowShellProjectName(run.workflowName)
    ? run.workflowName
    : (businessProject.name || run.input || '未命名项目')
  const knowledgeRetrievalError = compactText(payload.context?.knowledgeRetrievalError || '', 220)
  const systemPrompt = [
    '你是流程通的产品级工作流 Agent。',
    businessProjectGuardInstruction(),
    '你只围绕当前画布节点回答，必须区分项目事实、引用资料和模型推断。',
    '只输出 JSON，不要输出 Markdown，不要包裹代码块。',
    'JSON 结构必须是 {"content":"","quickReplies":[],"proposal":{"title":"","summary":"","rationale":[],"contextSources":[{"type":"","title":"","snippet":"","matchReason":""}],"writeableContent":{"summary":"","items":[],"acceptanceCriteria":[],"layoutComparisonRows":[{"label":"","option1":"","option2":"","option3":""}],"layoutOptions":[{"id":"","label":"","title":"","summary":"","layoutStyle":"","layoutStrategy":"","frameworkRows":[],"bestFor":"","layout":[],"risk":"","acceptanceCriteria":[]}],"interactionRows":[{"target":"","gesture":"","enableCondition":"","disableCondition":"","displayCondition":"","hideCondition":"","operation":"","feedback":"","statePromptCopy":"","result":"","motion":"","states":[],"testPoints":[]}],"stateMatrix":[{"state":"","trigger":"","display":"","promptCopy":"","recovery":""}],"gestureNotes":[]}},"downstreamImpact":[{"nodeId":"","reason":""}]}}。',
    'content 是给用户看的完整回复，不要只给一句结论；proposal 是后端用于“确认入画布”的可写入提案。',
    'content 需要包含可读分析、关键依据、可执行建议和必要的待确认点；除非用户明确要求简短，否则不要压缩成摘要。',
    'quickReplies 是给 Agent 回复下方展示的大模型推荐按钮，最多 3 个，必须贴合当前回复内容。',
    'proposal.rationale 必须解释为什么这么建议；proposal.contextSources 必须列出来源标题、片段和命中原因，用于前端确认前审计。',
    '你必须基于原始需求、完整画布、当前节点、上下游节点和对话历史生成可确认提案。',
    '知识库为空时，也要基于原始需求和当前画布给出结构化建议，不要只说缺少资料。',
    '不要声称已完成后端没有执行的动作。'
  ].join('\n')
  const userPrompt = [
    `原始需求：${run.input || run.workflowName || '未命名项目'}`,
    businessProjectLine(businessProject),
    knowledgeProjectLine(retrievedKnowledge, businessProject),
    `项目：${demandProjectName}`,
    totalFlowContext?.currentStage?.name ? `当前总流程阶段：${totalFlowContext.currentStage.name}（${totalFlowContext.currentStage.id}）` : '',
    totalFlowContext?.activeSlice?.title ? `当前小需求：${totalFlowContext.activeSlice.title}${totalFlowContext.activeSlice.goal ? `；目标：${totalFlowContext.activeSlice.goal}` : ''}` : '',
    `当前节点：${node.title}`,
    `节点说明：${node.summary}`,
    `动作类型：${actionType}`,
    normalizedCanvasAction?.action ? `画布动作：${normalizedCanvasAction.action}` : '',
    normalizedCanvasAction?.nodeId ? `画布动作节点：${normalizedCanvasAction.nodeId}` : '',
    normalizedCanvasAction ? `动作意图：${normalizedCanvasAction.actionIntent}` : '',
    normalizedCanvasAction ? `输出章节：${normalizedCanvasAction.expectedSections.join('、')}` : '',
    normalizedCanvasAction?.actionTemplate ? `动作模板：${normalizedCanvasAction.actionTemplate}` : '',
    `用户消息：${message.content || ''}`,
    normalizedCanvasAction ? canvasActionOutputGuide(normalizedCanvasAction.actionIntent) : '',
    advancedUxReportText,
    renderNodeLines('完整画布', canvasContext.fullCanvas.nodes),
    totalFlowContext ? renderNodeLines('阶段画布节点', totalFlowContext.stageCanvas.nodes) : '',
    stageConfirmationText.length ? renderLines('阶段确认摘要', stageConfirmationText) : '',
    renderNodeLines('上游节点', canvasContext.upstreamNodes),
    renderNodeLines('下游节点', canvasContext.downstreamNodes),
    renderLines('已有提案', pendingProposals.map((proposal) => `${proposal.id}｜${proposal.status}｜${proposal.summary || proposal.title}`)),
    '知识库为空时：仍需结合原始需求、完整画布和当前节点输出可确认、可写入画布的结构化建议。',
    renderLines('画布事实', node.content),
    renderLines('引用资料', references.map((item) => `${item.name}：${item.text || item.kind}`)),
    `知识检索状态：${knowledgeRetrievalError || (retrievedKnowledge.length ? '已召回项目知识' : '未命中项目知识')}`,
    renderLines('知识库召回', retrievedKnowledge.map((item) => {
      const evidence = item.evidence.map((source) => source.url || source.title || source.text).filter(Boolean).join('、')
      return `${item.title}：${item.snippet}${evidence ? `；证据：${evidence}` : ''}`
    })),
    renderLines('最近对话', history.map((item) => `${item.role}：${item.content}`))
  ].join('\n\n')

  return {
    actionType,
    scopeId,
    model,
    modelLabel: modelLabel(model),
    run,
    step,
    node,
    fullCanvas: canvasContext.fullCanvas,
    currentNode: canvasContext.currentNode,
    upstreamNodes: canvasContext.upstreamNodes,
    downstreamNodes: canvasContext.downstreamNodes,
    totalFlow: totalFlowContext,
    canvasAction: normalizedCanvasAction || canvasAction,
    message: {
      role: message.role || 'user',
      content: message.content || ''
    },
    references,
    advancedUxReport,
    retrievedKnowledge,
    knowledgeRetrievalError,
    history,
    pendingProposals,
    now: payload.now || new Date().toISOString(),
    systemPrompt,
    userPrompt
  }
}
