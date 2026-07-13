import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { analyzeRequirementDocuments, analyzeRequirementDocumentsWithGeneration, parseUploadedDocuments } from '../services/document-parser.js'
import { createAgentProviderFromModelSettings, createImageProviderFromModelSettings } from '../services/llm-provider.js'
import {
  buildAdvancedUxMarkdownReport,
  failAdvancedUxMarkdownGenerationInTotalFlow,
  importAdvancedUxMarkdownReportToTotalFlow,
  TOTAL_DESIGN_FLOW_STAGES,
  withDownstreamStageArtifactContext
} from '../services/total-design-flow.js'
import {
  buildInteractionSpecArtifactFromPageLayoutArtifact,
  parsePageLayoutArtifactFromText
} from '../services/page-layout-artifact-renderer.js'
import { withWorkflowStageRuntime } from '../services/stage-runtime.js'
import { buildAdvancedUxWebEvidencePack } from '../services/web-evidence-search.js'
import { advancedUxInteractionLofiCanvasFromPageInteractionDocument as buildAdvancedUxInteractionLofiCanvasFromPageInteractionDocument } from '../services/advanced-ux-page-interaction.js'
import { addModelCallLog, getModelSettingsRaw, getWorkflowRun, skillOrchestrationSettingsView, upsertWorkflowRun } from '../services/workspace-store.js'

const DEFAULT_ANALYSIS_GENERATION_TIMEOUT_MS = 600000
const DEFAULT_ADVANCED_UX_MARKDOWN_TIMEOUT_MS = 0
const DEFAULT_ADVANCED_UX_FRAMEWORK_PATH = fileURLToPath(new URL('../../docs/skills/advanced-ux/需求分析阶段一skill.md', import.meta.url))
const DEFAULT_UX_DOC_OUTPUT_STANDARD_PATH = fileURLToPath(new URL('../../docs/skills/advanced-ux/需求阶段一产出约束.md', import.meta.url))
const DEFAULT_UX_PAGE_INTERACTION_SKILL_PATH = fileURLToPath(new URL('../../docs/skills/advanced-ux/交互低保阶段二.md', import.meta.url))
const DEFAULT_ADVANCED_UX_REFERENCE_EXAMPLE_PATH = fileURLToPath(new URL('../../docs/skills/advanced-ux/AI视频爆款复刻-对照参考.md', import.meta.url))
const DEFAULT_UX_PAGE_INTERACTION_REFERENCE_EXAMPLE_PATH = fileURLToPath(new URL('../../docs/skills/advanced-ux/AI视频爆款复刻工具-阶段二产出参考.md', import.meta.url))
const ADVANCED_UX_AGENT_SCOPE_ID = 'requirement-dissection'
const ADVANCED_UX_CURRENT_SECTION_NAMES = [
  '原始需求分析',
  '设计问题定义',
  '用户与场景',
  '假设与验证',
  '设计机会',
  '整体交互链路',
  '三套设计方案',
  '异常流补充',
  '推荐方案建议',
  '设计优先级与分阶段计划'
]
const ADVANCED_UX_CURRENT_SECTION_LIST = ADVANCED_UX_CURRENT_SECTION_NAMES.map((name) => `## ${name}`).join('、')

export function uploadRoutes(options = {}) {
  const resolveAgentProvider = () => {
    if (options.store) {
      const settings = getModelSettingsRaw(options.store)
      if (settings.enabled) return createAgentProviderFromModelSettings(settings, options.fetchImpl)
    }
    return options.agentProvider || null
  }
  const resolveImageProvider = () => {
    if (options.imageProvider) return options.imageProvider
    if (options.store) {
      const settings = getModelSettingsRaw(options.store)
      return createImageProviderFromModelSettings(settings, options.fetchImpl)
    }
    return null
  }
  const resolveSkillOrchestration = () => {
    if (options.skillOrchestration) return options.skillOrchestration
    if (options.store) return skillOrchestrationSettingsView(options.store)
    return null
  }
  const analyzeDocuments = (payload = {}) => analyzeRequirementDocumentsWithGeneration({
    ...payload,
    documents: Array.isArray(payload.documents) ? payload.documents : payload.files || []
  }, {
    ...options,
    skillOrchestration: resolveSkillOrchestration(),
    agentProvider: resolveAgentProvider(),
    timeoutMs: payload.timeoutMs ?? (options.store ? getModelSettingsRaw(options.store)?.timeoutMs : options.timeoutMs),
    generationTimeoutMs: payload.generationTimeoutMs ?? payload.timeoutMs ?? options.generationTimeoutMs ?? DEFAULT_ANALYSIS_GENERATION_TIMEOUT_MS,
    model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model),
    onModelDelta: payload.onModelDelta,
    onModelEvent: payload.onModelEvent,
    modelCallLog: options.store ? (log) => addModelCallLog(options.store, log) : options.modelCallLog
  })
  const sseEvent = (event, data = {}) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const isNoSkillPayload = (payload = {}) =>
    payload.skillSelectionMode === 'manual' && String(payload.skillId || payload.selectedWorkflowId || '').trim() === 'none'
  const isTotalDesignFlowPayload = (payload = {}) =>
    payload.skillId === 'auto' ||
    payload.skillId === 'total-design-flow' ||
    payload.selectedWorkflowId === 'total-design-flow' ||
    payload.requestedSkillId === 'total-design-flow'
  const isAdvancedUxPayload = (payload = {}, result = {}) =>
    payload.skillId === 'advanced-ux-requirement-analysis' ||
    payload.selectedWorkflowId === 'advanced-ux-requirement-analysis' ||
    payload.requestedSkillId === 'advanced-ux-requirement-analysis' ||
    result.skillId === 'advanced-ux-requirement-analysis' ||
    result.routing?.resolvedSkillId === 'advanced-ux-requirement-analysis' ||
    result.routing?.requestedSkillId === 'advanced-ux-requirement-analysis'
  const advancedUxReportFileName = (date = new Date(), suffix = '') => {
    const pad = (value) => String(value).padStart(2, '0')
    return `高级UX需求分析-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${suffix}.md`
  }
  const advancedUxFrameworkPath = () => options.advancedUxFrameworkPath || DEFAULT_ADVANCED_UX_FRAMEWORK_PATH
  const uxDocOutputStandardPath = () => options.uxDocOutputStandardPath || DEFAULT_UX_DOC_OUTPUT_STANDARD_PATH
  const uxPageInteractionSkillPath = () => options.uxPageInteractionSkillPath || DEFAULT_UX_PAGE_INTERACTION_SKILL_PATH
  const advancedUxReferenceExamplePath = () => options.advancedUxReferenceExamplePath || DEFAULT_ADVANCED_UX_REFERENCE_EXAMPLE_PATH
  const uxPageInteractionReferenceExamplePath = () => options.uxPageInteractionReferenceExamplePath || DEFAULT_UX_PAGE_INTERACTION_REFERENCE_EXAMPLE_PATH
  const readAdvancedUxFrameworkMarkdown = async () => readFile(advancedUxFrameworkPath(), 'utf8')
  const readUxDocOutputStandardMarkdown = async () => readFile(uxDocOutputStandardPath(), 'utf8')
  const readOptionalMarkdownFile = async (filePath = '') => {
    try {
      return await readFile(filePath, 'utf8')
    } catch {
      return ''
    }
  }
  const advancedUxNoTimeoutMs = () => 0
  const advancedUxEvidencePackPrompt = (evidencePack = {}) => {
    const status = String(evidencePack?.status || '').trim()
    const sources = Array.isArray(evidencePack?.sources) ? evidencePack.sources : []
    const sourceLines = sources.slice(0, 8).map((item, index) => [
      `来源 ${index + 1}`,
      `标题：${item.title || '未命名来源'}`,
      `链接：${item.url || ''}`,
      `摘要：${item.snippet || ''}`,
      `检索词：${item.query || evidencePack.query || ''}`
    ].join('\n'))
    if (status === 'ready' && sourceLines.length) {
      return [
        '下面是后端受控联网检索得到的 Evidence Pack。它是本次竞品事实、行业链接、真实数据和市场结论的唯一外部事实来源。',
        '模型可以引用这些来源，但必须标注来源；禁止写入 Evidence Pack 之外的真实链接、竞品事实、行业数据或市场结论。',
        '',
        sourceLines.join('\n\n')
      ].join('\n')
    }
    if (status === 'disabled') {
      return [
        '联网检索状态：用户已关闭。',
        '禁止写入 Evidence Pack 之外的真实链接、竞品事实、行业数据或市场结论；若需要外部资料，只能写“待验证/需补充资料”。'
      ].join('\n')
    }
    if (status === 'failed' || status === 'empty') {
      return [
        `联网检索状态：${status === 'failed' ? '检索失败' : '未找到可用结果'}。`,
        (evidencePack.uncertainties || []).join('；'),
        '禁止写入 Evidence Pack 之外的真实链接、竞品事实、行业数据或市场结论；外部事实只能标注为待验证。'
      ].filter(Boolean).join('\n')
    }
    return [
      '联网检索状态：未提供 Evidence Pack。',
      '禁止写入 Evidence Pack 之外的真实链接、竞品事实、行业数据或市场结论。'
    ].join('\n')
  }
  const advancedUxDirectMarkdownPrompt = (payload = {}, frameworkMarkdown = '', outputStandardMarkdown = '', referenceExampleMarkdown = '', evidencePack = {}) => ({
    systemPrompt: [
      '你是企业场景高级 UX 需求分析专家与体验策略顾问。',
      '本次任务是高级 UX 需求分析 Markdown 生成。',
      '下面是一份固定的“需求分析阶段一 Skill”。你必须把它当作本次思考方法、分析深度和阶段一输出协议，而不是参考资料之一。',
      '',
      frameworkMarkdown,
      '',
      '下面是一份固定的“需求阶段一产出约束”。你必须把它当作展示、排版、信息密度、方法论框架和图文表达协议。',
      '',
      outputStandardMarkdown,
      '',
      referenceExampleMarkdown
        ? [
            '下面是一份结构完整度对照参考。它只用于理解“完整高级 UX 文档”的颗粒度、表格密度和章节完整性。',
            '禁止复制、套用或改写参考文档中的业务内容、竞品、数据、产品名、页面名、指标、链接或行业结论。',
            '',
            referenceExampleMarkdown
          ].join('\n')
        : '',
      '',
      advancedUxEvidencePackPrompt(evidencePack),
      '',
      '输出要求：',
      '- 只输出 Markdown 正文。',
      `- 严格按最新高级 UX 10 步链路输出，必须包含且仅使用以下 10 个 H2 二级标题：${ADVANCED_UX_CURRENT_SECTION_LIST}。`,
      '- 不得使用旧标题：需求理解、需求拆解、风险假设、流程与信息架构、机会与方案、优先级与分期、交付与验收。',
      '- 不输出 JSON。',
      '- 禁止输出 :::page-layout-artifact。',
      '- 禁止输出页面骨架协议；如需表达页面框架，只能按 UX 分析文档输出规范使用 Markdown 表格、text 代码块或说明后续需出图。',
      '- 不用代码块包裹整篇文档。',
      '- 必须使用 Markdown 层级标题（H1→H2→H3→H4），禁止跳级。',
      '- 一级章节（H2）之间用 --- 分隔。',
      '- 单段文字不超过100字，超过则分段或转为表格。',
      '- 表格与文字比例约 6:4。',
      '- 禁止裸编号引用：编号定义列可以只写 A1/O3/P01/M01；凡是来源、依据、关联、承接、去向、页面、状态、弹窗、风险、机会、HMW、步骤等引用字段，必须写成“编号 - 名称/说明”。',
      '- 示例：不要写“A1”“O3, R2”“HMW5, R6, O7”“P01”“M03”；要写“A1 - 原始诉求：一键复刻爆款视频”“O3 - 本地上传兜底机会；R2 - 链接解析失败风险”“HMW5 - 降低版权误用；R6 - 新手无从开始；O7 - 引导式新手流程”“P01 - 爆款复刻首页”“M03 - 生成排队弹窗”。',
      '- 页面框架：≤3个区域用表格，>4个区域的核心页面必须出低保真线框图。',
      '- 步骤①“原始需求分析”必须包含 GWT 行为描述（Given / When / Then）和 5 Whys 根因追溯；5 Whys 至少 5 层，不得停留在表层需求。',
      '- 步骤①必须在“### 1. 原始诉求识别”之后、“### 2. 需求清晰度评分表”之前输出“### 2. 需求理解清单”；随后原“需求清晰度评分表”顺延为“### 3. 需求清晰度评分表”。',
      '- 需求理解清单必须使用 Markdown 表格，表头至少覆盖：需求要素、理解转译、置信度、依据；也可增加“类型（事实/推断）”。至少 6 行，语义覆盖产品形态、核心任务、用户对象、输入方式、输出规格、使用场景、技术约束、成功标准中的主要项。',
      '- 步骤①必须包含需求清晰度评分表，至少 5 个评分维度；关键缺口清单至少 5 个缺口；追问清单至少 5 个追问，每个追问给出暂不确认时的处理方式。',
      '- 步骤①必须包含 L1/L2/L3 需求拆解表，表头覆盖层级、功能模块、子功能、优先级、置信度；至少 3 个 L1、2 个 L2、1 个 L3。',
      '- GWT 功能行为描述至少 3 条，覆盖入口行为、核心提交行为、失败/异常边界行为。',
      '- 步骤②“设计问题定义”必须包含 HMW 问题转译，把 5 Whys 根因转成 3-5 个“我们如何可能……”设计问题。',
      '- 步骤② HMW 问题至少 3 条，必须用 Markdown 表格输出，表头至少包含：编号、HMW 问题、洞察来源、选中。',
      '- 步骤②必须包含目标矩阵表，表头至少包含：目标类型、目标描述、可衡量指标、置信度；至少 5 行，并覆盖业务目标、用户目标、设计目标。',
      '- 步骤②必须包含体验矛盾表，表头至少包含：矛盾对/矛盾描述、倾向、处理策略、置信度；至少 4 行。',
      '- 步骤③“用户与场景”必须包含标准 Journey Map 表格，覆盖阶段、触点、用户行为、情绪曲线/情绪、痛点、机会点、证据/置信度；至少 4 个阶段。',
      '- 步骤③必须包含页面优先级初判表，表头覆盖页面编号、页面名称、用户阶段、价值、复杂度、建议优先级。',
      '- 步骤④“假设与验证”必须包含假设分类总表、高风险假设聚焦、假设回检点；假设分类总表表头覆盖假设内容、分类、来源追溯、不成立的影响、验证方式、置信度、当前状态。',
      '- 步骤④高风险假设聚焦表头覆盖高风险假设、置信度、降级策略、触发验证的时间节点；假设回检点必须说明后续在推荐方案建议中如何回检。',
      '- 步骤⑤“设计机会”必须包含设计机会总表、优先 Top 3-5 机会、机会→步骤映射；设计机会总表表头覆盖机会描述、类型、上游依据、可承接步骤、预期价值、优先级。',
      '- 步骤⑤优先 Top 3-5 机会表头覆盖排序、机会编号、机会描述、优先理由、设计方向提示；机会→步骤映射表头覆盖机会编号、承接步骤、承接方式。',
      '- 步骤⑥必须包含入口定义表和主流程步骤表；主流程步骤表至少 6 步，表头覆盖步骤、用户行为、系统响应、产出、页面。',
      '- 步骤⑥“整体交互链路”必须包含页面三件套：页面总览表、页面流转表、页面框架表；必须包含弹窗/抽屉定义表，弹窗/抽屉编号使用 M01/M02/M03，字段覆盖编号、名称、触发动作、关闭行为、提交/取消去向、关联页面。',
      '- 页面三件套必须分别给出表格：页面总览表至少 3 个页面/入口，页面流转表至少 3 条流转，页面框架表表头覆盖区域、内容、说明。',
      '- 步骤⑥必须包含信息架构实体表，字段覆盖信息实体、核心属性、关系/依赖、状态/流转、设计提示；全量小程序/App/网站默认 10-14 个实体，若少于 10 个必须说明当前范围为何不适用。',
      '- 步骤⑥“整体交互链路”必须包含完整状态机：状态迁移表、状态迁移图（用 ```text 代码块表达 ST0→ST1 可视化流向）、独立迁移规则表。',
      '- 步骤⑥必须包含关键断点与优化节点表，至少 5 个断点，覆盖主路径、异常路径、回流路径；全局交互规范必须用表格覆盖类型、规则、示例、例外。',
      '- 步骤⑥或⑦必须实际输出至少 1 个关键页面 ASCII 低保真线框图，不得只写“需要生成”；线框图放在 ```text 代码块中，区域必须和页面框架表对应。',
      '- 图编号（如图1、图6）只能对应真实流程图、状态图或 ASCII 低保真代码块；不得把“当前仅输出 ASCII 文本布局 / 图片待后续生成 / Draw.io 待生成”当作图内容。',
      '- 步骤⑦“三套设计方案”必须输出方案对比矩阵，至少覆盖目标用户/核心路径/页面组织/关键交互/异常处理/实现复杂度/体验风险/推荐条件；矩阵可用 Markdown 表格横向比较方案一/方案二/方案三。',
      '- 步骤⑦“三套设计方案”必须输出关键节点低保真分方案对比：选择三方案差异最大的 1 个关键节点，禁止把方案A/方案B/方案C挤在同一个 ASCII 代码块；每个方案单独一个 ```text 代码块，用四级标题“#### 方案A - 名称 / #### 方案B - 名称 / #### 方案C - 名称”垂直展示，最后追加差异表。',
      '- 步骤⑧“异常流补充”必须包含异常流表格，至少 8 种异常场景，覆盖输入、处理、网络、权限、超时、并发等类型。',
      '- 步骤⑨“推荐方案建议”必须包含 Problem-Solution Fit 验证、六顶思考帽评审和假设回检，再给推荐方案；不得直接跳到推荐结论。',
      '- “推荐方案建议”章节内必须出现三级标题“### 2. 六顶思考帽评审”，并覆盖白帽、红帽、黑帽、黄帽、绿帽、蓝帽；不能只在别的章节零散提到六帽。',
      '- “推荐方案建议”必须包含最终方案页面清单、假设回检、数据埋点方案、竞品对标总结、设计原则、下一步行动；对应表格分别覆盖页面/弹窗、假设回检、埋点事件、竞品维度、设计原则和行动责任。',
      '- 步骤⑩“设计优先级与分阶段计划”必须包含优先级排序总览、分期交付计划、待确认决策；优先级表头覆盖功能/机会、用户价值、业务价值、实施成本、综合优先级、分期建议。',
      '- 步骤⑩分期交付计划表头覆盖阶段、范围、核心目标、交付物、验证标准、预计周期；待确认决策表头覆盖决策事项、影响范围、需要谁确认、确认时限、不确认的影响。',
      '- 必须说明可视化真实产物状态：低保真线框图、Draw.io 主流程图、Draw.io 状态图的触发条件和当前状态；没有真实图片或 .drawio 文件时只能写“待生成”。',
      '- 必须输出状态机表格，表头语义必须覆盖：当前状态、触发事件、目标状态、页面表现、数据变更；状态超过 5 个或多分支交叉时，仍先给状态机表格，再说明需要 Draw.io 状态图承接。',
      '- 必须输出页面框架表格，表头语义必须覆盖：区域、内容、说明；涉及具体页面时按 P 编号输出页面定位、页面框架表格、交互规则表格、异常状态表格。',
      '- 产出页面框架时先用表格描述布局，再判断是否需要低保真线框图；不要用大段纯文字代替页面框架表格。',
      '- 在“设计问题定义 / 功能点总览”中，不要把用户故事写成一个长字段；必须拆成三个独立表格字段：As a、I want to、so that。',
      '- 本轮主产物仍是高级 UX 10 节点 Markdown；但必须在“推荐方案建议”中加入“页面交互文档产物规划”，明确下一产物文件名为“[产品名]-页面交互框架与说明.md”。',
      '- 页面交互文档产物规划必须说明：逐页文档包含页面定位、页面框架、交互规则、异常状态；每页交互规则不少于 5 条，且每条写清系统反馈；异常状态覆盖加载中、空状态、错误态、无权限和业务异常。',
      '- 必须输出一个页面交互规则表格，表头覆盖：用户操作、系统反馈、备注；必须输出一个异常状态表格，表头覆盖：状态、表现、处理方式。',
      '- 必须输出全局交互规范规划，覆盖 7 类：加载状态、Toast、空状态、网络异常、弹窗规范、表单规范、返回/导航；每类说明规则、示例、例外。',
      '- 必须输出低保真线框图产物约束：核心页面每页 1 张，不一次生成多张；灰度色值包含 #F5F5F5、#CCCCCC、#E0E0E0、#D0D0D0、#666666、#999999；禁止使用任何品牌色、禁止出现真实文案、禁止出现真实图片、禁止使用装饰性元素、禁止混合不同设备比例。',
      '- Draw.io 只作为真实后续产物状态说明：流程 >8 步或分支 >3 层时才需要 Draw.io 流程图；状态 >5 个或分支复杂时才需要 Draw.io 状态图；如果未实际生成 .drawio/.xml，不得写“已生成”。',
      '- 如需写竞品事实、行业链接、真实数据、市场结论，必须来自 Evidence Pack 或用户上传文档，并在依据/来源列标注；没有来源时只能写“待验证/低置信度/需补充资料”。',
      '- 禁止写入 Evidence Pack 之外的真实链接、竞品事实、行业数据或市场结论。',
      '- 信息不足时标注低置信度、推断、风险和待确认项。',
      '- 不编造真实数据、价格、竞品、法规或业务事实。'
    ].join('\n'),
    userPrompt: [
      `用户输入：${payload.input || '暂无输入'}`,
      '',
      '上传文档：',
      (Array.isArray(payload.documents) ? payload.documents : payload.files || [])
        .map((doc) => `## ${doc.name || '未命名文档'}\n${doc.text || doc.content || doc.summary || doc.reason || ''}`)
        .join('\n\n') || '无'
    ].join('\n'),
    responseFormat: 'markdown',
    maxOutputTokens: 16000
  })
  const advancedUxMarkdownCompletenessPrompt = (payload = {}, markdown = '', qualityIssues = [], evidencePack = {}) => ({
    systemPrompt: [
      '你是高级 UX Markdown 完整性自检与修稿专家。',
      '任务：检查并修复上一轮高级 UX 需求分析 Markdown，使它能作为后端导入画布的源文件。',
      Array.isArray(qualityIssues) && qualityIssues.length
        ? `上一轮质量问题：${qualityIssues.slice(0, 12).join('；')}`
        : '',
      '',
      '硬性要求：',
      '- 只输出修复后的 Markdown 正文。',
      '- 不输出 JSON、解释、代码围栏或修改说明。',
      '- 禁止输出 :::page-layout-artifact。',
      '- 禁止写入 Evidence Pack 之外的真实链接、竞品事实、行业数据或市场结论。',
      advancedUxEvidencePackPrompt(evidencePack),
      '- 禁止输出页面骨架协议；如需表达页面框架，只能使用 Markdown 表格、text 代码块或说明后续需出图。',
      `- 保持最新高级 UX 10 节点结构：${ADVANCED_UX_CURRENT_SECTION_NAMES.join('、')}。`,
      '- 不得使用旧标题：需求理解、需求拆解、风险假设、流程与信息架构、机会与方案、优先级与分期、交付与验收。',
      '- 每个节点必须有独立二级标题，标题可以自然表达，例如“## 节点 02：设计问题定义”或“## 02 设计问题定义：真正要解决什么？”。',
      '- 必须使用 Markdown 层级标题（H1→H2→H3→H4），禁止跳级。',
      '- 一级章节（H2）之间用 --- 分隔。',
      '- 单段文字不超过100字，超过则分段或转为表格。',
      '- 表格与文字比例约 6:4。',
      '- 禁止裸编号引用：编号定义列可以只写 A1/O3/P01/M01；凡是来源、依据、关联、承接、去向、页面、状态、弹窗、风险、机会、HMW、步骤等引用字段，必须写成“编号 - 名称/说明”。',
      '- 修复已有 Markdown 时，必须把“A1”“O3, R2”“HMW5, R6, O7”“P01”“M03”这类裸编号补成“编号 - 名称/说明”，不得保留读者看不懂的暗号式引用。',
      '- 页面框架：≤3个区域用表格，>4个区域的核心页面必须出低保真线框图。',
      '- 必须补齐方法论骨架：原始需求分析含 GWT 和 5Whys，设计问题定义含 HMW，用户与场景含标准 Journey Map，假设与验证含假设分类/高风险假设/假设回检点，设计机会含机会总表/Top 机会/机会映射，推荐方案建议含 Problem-Solution Fit、六顶思考帽评审和假设回检，设计优先级与分阶段计划含优先级排序/分期计划/待确认决策。',
      '- 必须补齐细颗粒度验收项：需求理解清单至少 6 行且放在原始诉求识别之后、需求清晰度评分表之前；需求清晰度评分表至少 5 个维度；关键缺口清单至少 5 个缺口；追问清单至少 5 个追问；GWT 至少 3 条；5 Whys 至少 5 层；HMW 至少 3 条；Journey Map 至少 4 个阶段。',
      '- 必须补齐新版阶段一强制表格：L1/L2/L3 需求拆解表、目标矩阵表、体验矛盾表、页面优先级初判表、假设分类总表、高风险假设聚焦表、设计机会总表、优先 Top 3-5 机会表、机会→步骤映射表、入口定义表、主流程步骤表、关键断点与优化节点表、异常流表、优先级排序总览表、分期交付计划表、待确认决策表。',
      '- 必须补齐链路评审产物：整体交互链路含页面三件套、弹窗/抽屉定义表、状态迁移图、迁移规则表和至少 1 个 ASCII 低保真线框图。',
      '- 页面三件套必须分别输出页面总览表、页面流转表、页面框架表；不要只写“如下”或把三者混成一个表。',
      '- 必须补齐信息架构实体表：字段覆盖信息实体、核心属性、关系/依赖、状态/流转、设计提示；全量小程序/App/网站默认 10-14 个实体，若少于 10 个必须说明当前范围为何不适用。',
      '- 必须补齐方案对比力：三套设计方案下要有方案对比矩阵、三方案对比说明和关键节点低保真分方案对比，不得只分别描述三个方案。',
      '- 必须补齐推荐交付表：最终方案页面清单、假设回检表、数据埋点方案、竞品对标总结、设计原则、下一步行动。',
      '- 必须补齐可视化产出状态：整体交互链路中说明低保真线框图、Draw.io 主流程图、Draw.io 状态图的触发条件和当前产物状态；未真实生成 .drawio/.xml 时写待生成。',
      '- 必须输出状态机表格，表头语义必须覆盖：当前状态、触发事件、目标状态、页面表现、数据变更；状态超过 5 个或多分支交叉时，仍先给状态机表格，再说明需要 Draw.io 状态图承接。',
      '- 必须输出页面框架表格，表头语义必须覆盖：区域、内容、说明；涉及具体页面时按 P 编号输出页面定位、页面框架表格、交互规则表格、异常状态表格。',
      '- 产出页面框架时先用表格描述布局，再判断是否需要低保真线框图；不要用大段纯文字代替页面框架表格。',
      '- 不要编造真实数据、价格、竞品、法规或业务事实；证据不足时标注推断、风险、待确认和低置信度。',
      '',
      '完整度自检标准：',
      '- 如果某个章节只有一句话、只有结论、只有表格、或缺少解释，需要补成可读的分析段落。',
      '- 凡是遇到“判断 / 结论 / 下一步 / 是否继续 / 是否追问”类小节，不得只输出一句话。',
      '- 这类判断小节至少覆盖这些语义：判断结果、判断依据/理由、关键假设、不确定性/风险、待确认事项、下一步建议、置信度。',
      '- 字段名称可根据上下文自然生成，不要求固定叫“判断结果/理由/核心假设集”，但语义必须完整。',
      '- 在“原始需求分析 / GWT 功能行为”中，必须用 Given / When / Then 描述核心功能行为和触发边界。',
      '- 在“原始需求分析 / 需求理解清单”中，必须用表格输出模型对原始需求的结构化理解，表头至少包含需求要素、理解转译、置信度、依据；该小节必须紧跟“原始诉求识别”，并位于“需求清晰度评分表”之前。',
      '- 在“原始需求分析 / 5Whys 根因追溯”中，必须至少追问 5 层，把表层需求追到用户动机、业务目标、操作成本、失败风险或交付约束；不能只写泛泛结论。',
      '- 在“设计问题定义 / 功能点总览”表格中，如果存在“用户故事”单列，必须拆成三个字段：As a、I want to、so that；不要继续把 As a / I want to / so that 写在同一个单元格。',
      '- 在“设计问题定义 / HMW 机会问题”中，必须把根因转成 3-5 个 How Might We 问题，并标注面向的用户/场景/设计机会。',
      '- HMW 必须用 Markdown 表格输出，表头至少包含：编号、HMW 问题、洞察来源、选中；不能只用普通列表或段落。',
      '- 目标矩阵表必须用 Markdown 表格输出，表头至少包含：目标类型、目标描述、可衡量指标、置信度；至少 5 行，且行内容必须出现业务目标、用户目标、设计目标。',
      '- 体验矛盾表必须用 Markdown 表格输出，表头至少包含：矛盾对/矛盾描述、倾向、处理策略、置信度；至少 4 行。',
      '- 在“设计问题定义 / 功能点详情”中，每个功能点必须补齐：补充体验要求里的边界条件、信息表达；依赖关系里的前置依赖、被依赖；优先级判断里的用户价值、实现复杂度、建议优先级。',
      '- 在“用户与场景 / 旅程地图”中，必须用表格覆盖阶段、用户目标、用户行为、触点、情绪、痛点、机会点、证据/置信度。',
      '- 在“用户与场景 / 体验风险清单”或“异常流补充 / 异常与风险”中，触发路径不能只写页面名或入口名，必须写成 3 步以上路径链，用当前项目里的真实用户动作、系统状态、业务结果动态表达。',
      '- 在“假设与验证 / 假设分类总表”中，必须用表格覆盖假设内容、分类、来源追溯、不成立的影响、验证方式、置信度、当前状态。',
      '- 在“假设与验证 / 高风险假设聚焦”中，必须用表格覆盖高风险假设、置信度、降级策略、触发验证的时间节点。',
      '- 在“假设与验证 / 假设回检点”中，必须说明后续推荐方案建议如何逐条回检。',
      '- 在“设计机会 / 设计机会总表”中，必须用表格覆盖机会描述、类型、上游依据、可承接步骤、预期价值、优先级。',
      '- 在“设计机会 / 优先 Top 3-5 机会”中，必须用表格覆盖排序、机会编号、机会描述、优先理由、设计方向提示。',
      '- 在“设计机会 / 机会→步骤映射”中，必须用表格覆盖机会编号、承接步骤、承接方式。',
      '- 在“整体交互链路 / 信息架构”中，表格必须包含：信息实体、核心属性、关系/依赖、状态/流转、设计提示；全量小程序/App/网站需求默认输出 10-14 个信息实体，若少于 10 个必须写明为什么当前范围不适用。',
      '- 信息实体不要写死行业模板，必须从当前需求、功能点、用户流程、业务流程、风险和验收项反推；输出前按抽象覆盖面自检：用户/身份、核心业务对象、配置/规格、任务或交易容器、状态对象、结算或确认记录、凭证/码/证书/确认材料、权益/激励、通知/消息、评价/反馈/支持、运营配置/审核、位置/服务资源；不适用的覆盖面要跳过。',
      '- 在“整体交互链路 / 用户流程图、业务流程图”中，不要只输出一行箭头串；必须使用 ```text 代码块输出多行 ASCII 流程图，由模型按当前项目内容生成主路径、关键决策/分支、异常回退、用户心理/意图、系统处理、状态变化、失败/重试路径。',
      '- 在“整体交互链路 / 状态机表格”中，必须输出 Markdown 表格，表头包含当前状态、触发事件、目标状态、页面表现、数据变更；行内容由当前项目的真实对象生命周期反推，不写固定行业状态。',
      '- 在“整体交互链路 / 状态迁移图”中，必须用 ```text 代码块输出 ST0→ST1→ST2 形式的可视化流向，并补独立“迁移规则表”。',
      '- 在“整体交互链路 / 页面三件套”中，必须分别输出页面总览表、页面流转表、页面框架表；页面框架表必须和 ASCII 低保真区域一致。',
      '- 在“整体交互链路 / 弹窗与抽屉定义表”中，必须包含编号、名称、触发动作、关闭行为、提交/取消去向、关联页面；弹窗/抽屉编号使用 M01/M02/M03。',
      '- 在“整体交互链路 / 低保真线框图”中，必须实际输出至少 1 个关键页面 ASCII 线框图，放入 ```text 代码块；不得只写后续生成。',
      '- 图编号（如图1、图6）必须指向真实图形内容或 ASCII 代码块；“待生成/触发条件/真实图片尚未生成/Draw.io 尚未生成”只能写在产物状态表中，不得作为图内容。',
      '- 在“整体交互链路 / 页面框架表格”或“三套设计方案 / 页面级方案”中，必须输出至少 1 个核心页面的页面框架表格，表头包含区域、内容、说明；页面区域由当前项目页面职责反推，不写固定行业区域。',
      '- 在“整体交互链路 / 关键断点与优化节点”中，节点不能只写页面名，必须写成“当前项目阶段-具体动作/场景”；全量小程序/App/网站默认输出 8-12 个断点节点，覆盖当前项目的主路径阶段、关键对象生命周期、异常路径、回流路径；不适用的路径类型要跳过。',
      '- 在“三套设计方案 / 关键交互流程（Top 3 优先机会）”中，每个 Top 必须用四级标题“#### Top N：当前项目方案名”，并为每个 Top 输出结构表，至少覆盖状态流转、界面/触点跳转、关键反馈、异常/回退路径、低保真描述；字段可按项目改名，但语义不能缺失。',
      '- 在“三套设计方案 / 方案对比矩阵”中，必须用 Markdown 表格比较三套方案，表头至少包含维度、方案一、方案二、方案三、取舍说明；维度由当前项目动态生成，但必须覆盖效率、学习成本、异常恢复、实现复杂度、风险。',
      '- 在“三套设计方案 / 关键节点低保真对比”中，禁止把方案A/方案B/方案C挤在同一个 ASCII 代码块；每个方案单独一个 ```text 代码块，用“#### 方案A - 名称 / #### 方案B - 名称 / #### 方案C - 名称”垂直展示，最后追加差异表。',
      '- 在“三套设计方案 / 六顶思考帽评审”中，必须按白帽/红帽/黑帽/黄帽/绿帽/蓝帽输出对三套方案的评审摘要和结论。',
      '- 在“三套设计方案 / 优先方案收敛（Top 3）”中，Top 字段不能只写 1/2/3，必须写成“Top 1：方案名称”；方案名称要和上方 Top 1/2/3 三级标题保持一致。',
      '- 在“推荐方案建议 / Problem-Solution Fit 验证”中，必须用表格说明核心问题、对应方案、匹配证据、未匹配风险、验证方式、置信度。',
      '- 在“推荐方案建议 / 六顶思考帽评审”中，必须用白帽、红帽、黑帽、黄帽、绿帽、蓝帽多维审视后再给推荐结论。',
      '- “推荐方案建议”章节内必须保留明确三级标题“### 2. 六顶思考帽评审”；如果上一轮只在“三套设计方案”或正文里提到六帽，必须移动或补写到这里。',
      '- 在“推荐方案建议 / 假设回检”中，必须逐条回检“假设与验证”的关键假设，说明是否成立、对推荐方案的影响和后续验证动作。',
      '- 在“推荐方案建议 / 页面交互文档产物规划”中，必须明确下一产物文件名为“[产品名]-页面交互框架与说明.md”，并说明它基于本高级 UX 10 节点结论继续生成。',
      '- 在“设计优先级与分阶段计划 / 优先级排序总览”中，必须用表格覆盖功能/机会、用户价值、业务价值、实施成本、综合优先级、分期建议。',
      '- 在“设计优先级与分阶段计划 / 分期交付计划”中，必须用表格覆盖阶段、范围、核心目标、交付物、验证标准、预计周期。',
      '- 在“设计优先级与分阶段计划 / 待确认决策”中，必须用表格覆盖决策事项、影响范围、需要谁确认、确认时限、不确认的影响。',
      '- 页面交互文档规划必须包含页面定位、页面框架表格、交互规则表格、异常状态表格；每页交互规则不少于 5 条；交互规则表头覆盖用户操作、系统反馈、备注；异常状态表头覆盖状态、表现、处理方式，并覆盖加载中、空状态、错误态、无权限和业务异常。',
      '- 全局交互规范规划必须覆盖 7 类：加载状态、Toast、空状态、网络异常、弹窗规范、表单规范、返回/导航；每类按“规则 / 示例 / 例外”三段式表达。',
      '- 低保真线框图规划必须包含：核心页面每页 1 张、单张生成、不一次生成多张；灰度色值 #F5F5F5、#CCCCCC、#E0E0E0、#D0D0D0、#666666、#999999；必须逐条写出 5 项禁止项：禁止使用任何品牌色、禁止出现真实文案、禁止出现真实图片、禁止使用装饰性元素、禁止混合不同设备比例；验收必须包含“区域数量与框架表格中的区域一致”。',
      '- Draw.io 规划必须只写触发条件和产物状态：流程 >8 步或分支 >3 层才需要 Draw.io 流程图；状态 >5 个或分支复杂才需要 Draw.io 状态图；未实际生成 .drawio/.xml 时不得声称已生成。',
      '- 表格、列表、引用块和正文可以混合使用，优先保证可读、可导入、可沉淀。'
    ].filter(Boolean).join('\n'),
    userPrompt: [
      `用户输入：${payload.input || '暂无输入'}`,
      '',
      '待自检 Markdown：',
      markdown || '无'
    ].join('\n'),
    responseFormat: 'markdown',
    maxOutputTokens: 16000
  })
  const splitAdvancedUxUserStory = (story = '') => {
    const text = String(story || '').replace(/\*\*/g, '').trim()
    const english = text.match(/^As\s+a\s+(.+?),?\s+I\s+want\s+to\s+(.+?)(?:,?\s+so\s+that\s+(.+))?$/i)
    if (english) return [cleanMarkdownCell(english[1]), cleanMarkdownCell(english[2]), cleanMarkdownCell(english[3] || '')]
    const chinese = text.match(/^作为\s*(.+?)[，,]\s*我想(?:要)?\s*(.+?)[，,]\s*以便\s*(.+)$/)
    if (chinese) return [cleanMarkdownCell(chinese[1]), cleanMarkdownCell(chinese[2]), cleanMarkdownCell(chinese[3])]
    return ['', cleanMarkdownCell(text), '']
  }
  const cleanMarkdownCell = (value = '') => String(value || '').replace(/\s+/g, ' ').trim()
  const splitAdvancedUxUserStoryTables = (markdown = '') => {
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
    const next = []
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      const separator = lines[index + 1] || ''
      const isTableHeader = line.trim().startsWith('|') &&
        separator.trim().startsWith('|') &&
        /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(separator.trim())
      if (!isTableHeader) {
        next.push(line)
        continue
      }
      const parseRow = (row = '') => row
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())
      const formatRow = (cells = []) => `| ${cells.join(' | ')} |`
      const columns = parseRow(line)
      const storyIndex = columns.findIndex((column) => /^用户故事$/.test(cleanMarkdownCell(column)))
      const alreadySplit = columns.some((column) => /^As a$/i.test(cleanMarkdownCell(column))) &&
        columns.some((column) => /^I want to$/i.test(cleanMarkdownCell(column))) &&
        columns.some((column) => /^so that$/i.test(cleanMarkdownCell(column)))
      if (storyIndex < 0 || alreadySplit) {
        next.push(line)
        continue
      }
      const rewrittenColumns = [
        ...columns.slice(0, storyIndex),
        'As a',
        'I want to',
        'so that',
        ...columns.slice(storyIndex + 1)
      ]
      next.push(formatRow(rewrittenColumns))
      next.push(formatRow(rewrittenColumns.map(() => '---')))
      index += 1
      while (index + 1 < lines.length && lines[index + 1].trim().startsWith('|')) {
        index += 1
        const cells = parseRow(lines[index])
        const storyParts = splitAdvancedUxUserStory(cells[storyIndex] || '')
        next.push(formatRow([
          ...cells.slice(0, storyIndex),
          ...storyParts,
          ...cells.slice(storyIndex + 1)
        ]))
      }
    }
    return next.join('\n')
  }
  const normalizeAdvancedUxTopLabels = (markdown = '') => {
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
    const next = []
    const parseRow = (row = '') => row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
    const formatRow = (cells = []) => `| ${cells.join(' | ')} |`
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      const separator = lines[index + 1] || ''
      const isTableHeader = line.trim().startsWith('|') &&
        separator.trim().startsWith('|') &&
        /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(separator.trim())
      if (!isTableHeader) {
        next.push(line)
        continue
      }
      const columns = parseRow(line).map((column) => cleanMarkdownCell(column))
      const topIndex = columns.findIndex((column) => /^Top$/i.test(column))
      const solutionIndex = columns.findIndex((column) => /^(方案|方案名称|机会|优先机会)$/.test(column))
      if (topIndex < 0 || solutionIndex < 0) {
        next.push(line)
        continue
      }
      next.push(line)
      next.push(separator)
      index += 1
      while (index + 1 < lines.length && lines[index + 1].trim().startsWith('|')) {
        index += 1
        const cells = parseRow(lines[index])
        const topValue = cleanMarkdownCell(cells[topIndex] || '')
        const solutionValue = cleanMarkdownCell(cells[solutionIndex] || '')
        const numericTop = topValue.match(/^(?:Top\s*)?(\d+)$/i)
        if (numericTop && solutionValue) cells[topIndex] = `Top ${numericTop[1]}：${solutionValue}`
        next.push(formatRow(cells))
      }
    }
    return next.join('\n')
  }
  const advancedUxMarkdownFailure = (message = '高级 UX Markdown 生成失败', details = {}) => {
    const error = new Error(message)
    error.code = 'ADVANCED_UX_MARKDOWN_FAILED'
    error.recoveryActions = ['检查模型配置', '重新分析文档']
    if (details && typeof details === 'object') {
      Object.assign(error, details)
    }
    return error
  }
  const parseAdvancedUxMarkdownTables = (markdown = '') => {
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
    const tables = []
    const parseRow = (row = '') => row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cleanMarkdownCell(cell.replace(/\*\*/g, '')))
    for (let index = 0; index < lines.length - 1; index += 1) {
      const header = lines[index] || ''
      const separator = lines[index + 1] || ''
      const isTableHeader = header.trim().startsWith('|') &&
        separator.trim().startsWith('|') &&
        /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(separator.trim())
      if (!isTableHeader) continue
      const rows = []
      index += 1
      while (index + 1 < lines.length && lines[index + 1].trim().startsWith('|')) {
        index += 1
        rows.push(parseRow(lines[index]))
      }
      tables.push({ headers: parseRow(header), rows })
    }
    return tables
  }
  const advancedUxTableHasColumns = (tables = [], requiredColumns = []) => tables.some((table) => {
    const headers = Array.isArray(table.headers) ? table.headers : []
    return requiredColumns.every((required) =>
      headers.some((header) => cleanMarkdownCell(header).includes(required))
    )
  })
  const advancedUxTablesWithColumns = (tables = [], requiredColumns = []) =>
    (Array.isArray(tables) ? tables : []).filter((table) => {
      const headers = Array.isArray(table.headers) ? table.headers : []
      return requiredColumns.every((required) =>
        headers.some((header) => cleanMarkdownCell(header).includes(required))
      )
    })
  const advancedUxTableRows = (table = null) =>
    Array.isArray(table?.rows)
      ? table.rows.filter((row) =>
          Array.isArray(row) &&
          row.some((cell) => cleanMarkdownCell(cell))
        )
      : []
  const advancedUxMaxRowsForColumns = (tables = [], requiredColumns = []) =>
    advancedUxTablesWithColumns(tables, requiredColumns)
      .reduce((max, table) => Math.max(max, advancedUxTableRows(table).length), 0)
  const advancedUxRowsForAnyColumnGroup = (tables = [], columnGroups = []) =>
    columnGroups
      .flatMap((columns) => advancedUxTablesWithColumns(tables, columns))
      .flatMap((table) => advancedUxTableRows(table))
  const advancedUxMaxRowsForAnyColumnGroup = (tables = [], columnGroups = []) =>
    columnGroups.reduce((max, columns) => Math.max(max, advancedUxMaxRowsForColumns(tables, columns)), 0)
  const advancedUxHasTableWithAnyColumnGroup = (tables = [], columnGroups = []) =>
    columnGroups.some((columns) => advancedUxTableHasColumns(tables, columns))
  const advancedUxTextHasAll = (text = '', tokens = []) =>
    tokens.every((token) => String(text || '').includes(token))
  const advancedUxSectionBody = (text = '', sectionName = '') => {
    const source = String(text || '').replace(/\r\n/g, '\n')
    const sectionMatch = new RegExp(`^##\\s+.*${sectionName}.*$`, 'm').exec(source)
    if (!sectionMatch) return ''
    const start = (sectionMatch.index || 0) + sectionMatch[0].length
    const nextSectionMatch = /^##\s+.+$/m.exec(source.slice(start))
    const end = nextSectionMatch ? start + (nextSectionMatch.index || 0) : source.length
    return source.slice(start, end).trim()
  }
  const advancedUxSixHatsReviewPattern = /^#{3,4}\s*(?:\d+\.\s*)?六顶思考帽评审\s*$/m
  const advancedUxRecommendationHasSixHatsReview = (text = '') => {
    const recommendationBody = advancedUxSectionBody(text, '推荐方案建议')
    return advancedUxSixHatsReviewPattern.test(recommendationBody) &&
      advancedUxTextHasAll(recommendationBody, ['白帽', '红帽', '黑帽', '黄帽', '绿帽', '蓝帽'])
  }
  const advancedUxLowFiDrawioStatusPattern = (text = '') => {
    const source = String(text || '')
    const hasSingleImageRule =
      /每(?:个|页|张)?核心页面(?:生成|产出)?\s*1\s*张/.test(source) ||
      /核心页面每页\s*1\s*张/.test(source) ||
      /单张生成/.test(source) ||
      /不一次生成多张/.test(source)
    const hasRegionConsistency =
      /区域数量.{0,12}框架表格.{0,12}一致/.test(source) ||
      /区域.{0,12}页面框架表.{0,12}一致/.test(source)
    const hasDrawioTrigger =
      /Draw\.io/.test(source) &&
      (/流程\s*[>＞]\s*8\s*步|分支\s*[>＞]\s*3\s*层|状态\s*[>＞]\s*5\s*个|触发条件|产物状态|待生成/.test(source))
    return hasSingleImageRule && hasRegionConsistency && hasDrawioTrigger
  }
  const advancedUxPageInteractionPlanningIssues = (text = '', tables = []) => {
    const issues = []
    if (!String(text || '').includes('页面交互框架与说明.md')) {
      issues.push('缺少页面交互文档文件命名：需说明下一产物为[产品名]-页面交互框架与说明.md')
    }
    if (!advancedUxTableHasColumns(tables, ['用户操作', '系统反馈', '备注'])) {
      issues.push('缺少页面交互规则表格：表头需覆盖用户操作、系统反馈、备注')
    }
    if (!advancedUxTableHasColumns(tables, ['状态', '表现', '处理方式'])) {
      issues.push('缺少异常状态表格：表头需覆盖状态、表现、处理方式')
    }
    if (!advancedUxTextHasAll(text, ['加载中', '空状态', '错误态', '无权限'])) {
      issues.push('缺少基础异常状态覆盖：加载中、空状态、错误态、无权限')
    }
    if (!advancedUxTextHasAll(text, ['加载状态', 'Toast', '空状态', '网络异常', '弹窗规范', '表单规范', '返回/导航'])) {
      issues.push('缺少全局交互规范 7 类：加载状态、Toast、空状态、网络异常、弹窗规范、表单规范、返回/导航')
    }
    if (!advancedUxTextHasAll(text, ['#F5F5F5', '#CCCCCC', '#E0E0E0', '#D0D0D0', '#666666', '#999999'])) {
      issues.push('缺少低保真线框图 6 项灰度色值约束')
    }
    if (!advancedUxTextHasAll(text, ['禁止使用任何品牌色', '禁止出现真实文案', '禁止出现真实图片', '禁止使用装饰性元素', '禁止混合不同设备比例'])) {
      issues.push('缺少低保真线框图 5 项禁止项')
    }
    if (!advancedUxLowFiDrawioStatusPattern(text)) {
      issues.push('缺少低保真/Draw.io 产物状态约束：需说明单张生成规则、区域一致性和 Draw.io 触发条件')
    }
    return issues
  }
  const advancedUxMethodologyReviewIssues = (text = '', tables = []) => {
    const issues = []
    const textCodeBlocks = Array.from(text.matchAll(/```text\s*([\s\S]*?)```/gi), (match) => match[1] || '')
    const hasTextCodeBlock = textCodeBlocks.length > 0
    if (!advancedUxHasTableWithAnyColumnGroup(tables, [
      ['需求要素', '理解转译', '置信度', '依据'],
      ['维度', '当前理解', '类型', '依据', '置信度'],
      ['维度', '理解转译', '类型', '依据', '置信度']
    ])) {
      issues.push('缺少需求理解清单：步骤①需在原始诉求识别之后、需求清晰度评分表之前输出需求要素、理解转译、置信度、依据')
    } else {
      const understandingRows = advancedUxRowsForAnyColumnGroup(tables, [
        ['需求要素', '理解转译', '置信度', '依据'],
        ['维度', '当前理解', '类型', '依据', '置信度'],
        ['维度', '理解转译', '类型', '依据', '置信度']
      ])
      if (understandingRows.length < 6) issues.push('需求理解清单至少需要 6 行有效理解项')
    }
    const understandingIndex = text.search(/需求理解清单/)
    const originalNeedIndex = text.search(/原始诉求识别|原始需求复述|原始诉求/)
    const clarityIndex = text.search(/需求清晰度评分/)
    if (understandingIndex < 0 || originalNeedIndex < 0 || clarityIndex < 0 || !(originalNeedIndex < understandingIndex && understandingIndex < clarityIndex)) {
      issues.push('需求理解清单位置错误：必须放在原始诉求识别之后、需求清晰度评分表之前')
    }
    if (!advancedUxHasTableWithAnyColumnGroup(tables, [
      ['维度', '评分'],
      ['子维度', '评分'],
      ['评分', '主要缺口']
    ])) {
      issues.push('缺少需求清晰度评分表：步骤①需覆盖产品形态、主流程、用户定位、输出标准、体验标准等维度')
    } else if (advancedUxMaxRowsForColumns(tables, ['评分']) < 5) {
      issues.push('需求清晰度评分表至少需要 5 个评分维度')
    }
    if (!advancedUxHasTableWithAnyColumnGroup(tables, [
      ['优先级', '缺口'],
      ['缺口描述', '影响范围'],
      ['缺口', '不补齐的风险']
    ])) {
      issues.push('缺少关键缺口清单：步骤①需列出优先级、缺口、影响范围/用户行为、风险和处理建议')
    } else if (advancedUxMaxRowsForColumns(tables, ['缺口']) < 5 && advancedUxMaxRowsForColumns(tables, ['缺口描述']) < 5) {
      issues.push('关键缺口清单至少需要 5 个有效缺口')
    }
    if (!advancedUxHasTableWithAnyColumnGroup(tables, [
      ['追问问题', '优先级'],
      ['追问问题', '目的'],
      ['追问问题', '阻塞对象'],
      ['追问问题', '处理方式']
    ])) {
      issues.push('缺少追问清单：步骤①需列出追问问题、优先级、目的/阻塞对象和暂不确认时的处理方式')
    } else if (advancedUxMaxRowsForColumns(tables, ['追问问题']) < 5) {
      issues.push('追问清单至少需要 5 个有效追问')
    }
    if (!/Given/i.test(text) || !/When/i.test(text) || !/Then/i.test(text)) {
      issues.push('缺少 GWT 功能行为描述：步骤①需包含 Given / When / Then')
    } else if (advancedUxMaxRowsForColumns(tables, ['Given', 'When', 'Then']) < 3) {
      issues.push('GWT 功能行为描述至少需要 3 条核心行为')
    }
    if (!/5\s*Whys|5\s*Why|五问|五个为什么/i.test(text)) {
      issues.push('缺少 5 Whys 根因追溯：步骤①需至少追问 5 层')
    } else {
      const whyRows = [
        ...advancedUxTablesWithColumns(tables, ['层级', '问题', '回答']),
        ...advancedUxTablesWithColumns(tables, ['层级', '追问', '回答'])
      ]
        .flatMap((table) => advancedUxTableRows(table))
        .filter((row) => /Why\s*\d|根因|原始问题|为什么/.test(row.map((cell) => cleanMarkdownCell(cell)).join(' ')))
      if (whyRows.length < 5) issues.push('5 Whys 根因追溯至少需要 5 层有效追问')
    }
    if (!/HMW|How\s+Might\s+We|我们如何可能/.test(text)) {
      issues.push('缺少 HMW 问题转译：步骤②需把根因转成设计问题')
    } else {
      const hmwRows = advancedUxTablesWithColumns(tables, ['HMW'])
        .flatMap((table) => advancedUxTableRows(table))
        .filter((row) => /HMW|如何可能|How\s+Might\s+We/i.test(row.map((cell) => cleanMarkdownCell(cell)).join(' ')))
      if (hmwRows.length < 3) issues.push('HMW 问题至少需要 3 条，并标注洞察来源和选中状态')
    }
    const decompositionRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['层级', '功能模块', '子功能', '优先级', '置信度']
    ])
    if (!decompositionRows.length) {
      issues.push('缺少 L1/L2/L3 需求拆解表：需覆盖层级、功能模块、子功能、优先级、置信度')
    } else {
      const levelText = decompositionRows.map((row) => row.map((cell) => cleanMarkdownCell(cell)).join(' ')).join('\n')
      const l1Count = decompositionRows.filter((row) => /L1|核心|P0/.test(row.map((cell) => cleanMarkdownCell(cell)).join(' '))).length
      const l2Count = decompositionRows.filter((row) => /L2|增强|P1/.test(row.map((cell) => cleanMarkdownCell(cell)).join(' '))).length
      const l3Count = decompositionRows.filter((row) => /L3|增值|P2/.test(row.map((cell) => cleanMarkdownCell(cell)).join(' '))).length
      if (!/L1|核心/.test(levelText) || !/L2|增强/.test(levelText) || !/L3|增值/.test(levelText) || l1Count < 3 || l2Count < 2 || l3Count < 1) {
        issues.push('L1/L2/L3 需求拆解表需至少包含 3 个 L1、2 个 L2、1 个 L3')
      }
    }
    const targetRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['目标类型', '目标描述', '可衡量指标', '置信度'],
      ['目标类型', '目标描述', '指标', '置信度']
    ])
    if (!targetRows.length) {
      issues.push('缺少目标矩阵表：需覆盖目标类型、目标描述、可衡量指标、置信度')
    } else {
      const targetText = targetRows.map((row) => row.map((cell) => cleanMarkdownCell(cell)).join(' ')).join('\n')
      if (targetRows.length < 5 || !/业务目标/.test(targetText) || !/用户目标/.test(targetText) || !/设计目标/.test(targetText)) {
        issues.push('目标矩阵表需至少 5 行，并覆盖业务目标、用户目标、设计目标')
      }
    }
    const contradictionRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['矛盾对', '倾向', '处理策略', '置信度'],
      ['矛盾名称', '倾向', '处理策略', '置信度'],
      ['矛盾描述', '倾向', '处理策略', '置信度']
    ])
    if (!contradictionRows.length) {
      issues.push('缺少体验矛盾表：需覆盖矛盾、倾向、处理策略、置信度')
    } else if (contradictionRows.length < 4) {
      issues.push('体验矛盾表至少需要 4 对矛盾，并明确倾向和处理策略')
    }
    if (!advancedUxTableHasColumns(tables, ['阶段', '触点', '情绪', '痛点', '机会'])) {
      issues.push('缺少标准 Journey Map：表头需覆盖阶段、触点、情绪、痛点、机会点')
    } else if (advancedUxMaxRowsForColumns(tables, ['阶段', '触点', '情绪', '痛点']) < 4) {
      issues.push('Journey Map 至少需要 4 个阶段，覆盖进入、使用、完成和离开/回流')
    }
    const pagePriorityRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['页面编号', '页面名称', '用户阶段', '价值', '复杂度', '建议优先级'],
      ['编号', '页面名称', '用户阶段', '价值', '复杂度', '优先级']
    ])
    if (!pagePriorityRows.length) {
      issues.push('缺少页面优先级初判表：需覆盖页面编号、页面名称、用户阶段、价值、复杂度、建议优先级')
    } else if (pagePriorityRows.length < 5) {
      issues.push('页面优先级初判表至少需要 5 个页面/入口')
    }
    const assumptionRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['假设内容', '分类', '来源追溯', '不成立的影响', '验证方式', '置信度', '当前状态']
    ])
    if (!assumptionRows.length) {
      issues.push('缺少假设与验证下的假设分类总表')
    }
    const highRiskAssumptionRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['高风险假设', '置信度', '降级策略', '触发验证的时间节点']
    ])
    if (!highRiskAssumptionRows.length) {
      issues.push('缺少假设与验证下的高风险假设聚焦表')
    }
    if (!/假设回检/.test(text)) {
      issues.push('缺少假设回检')
    }
    const opportunityRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['机会描述', '类型', '上游依据', '可承接步骤', '预期价值', '优先级']
    ])
    if (!opportunityRows.length) {
      issues.push('缺少设计机会下的设计机会总表')
    }
    const topOpportunityRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['排序', '机会编号', '机会描述', '优先理由', '设计方向提示']
    ])
    if (!topOpportunityRows.length) {
      issues.push('缺少设计机会下的优先 Top 3-5 机会')
    }
    const opportunityMappingRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['机会编号', '承接步骤', '承接方式']
    ])
    if (!opportunityMappingRows.length) {
      issues.push('缺少设计机会下的机会→步骤映射表')
    }
    const entryRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['入口位置', '入口形态', '触发条件', '优先级'],
      ['入口', '触发条件', '优先级']
    ])
    if (!entryRows.length) {
      issues.push('缺少入口定义表：需覆盖入口位置、入口形态、触发条件、优先级')
    } else if (entryRows.length < 2) {
      issues.push('入口定义表至少需要 2 个入口')
    }
    const mainFlowRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['步骤', '用户行为', '系统响应', '产出', '页面'],
      ['步骤号', '节点名称', '用户动作', '系统反馈', '跳转目标']
    ])
    if (!mainFlowRows.length) {
      issues.push('缺少主流程步骤表：需覆盖步骤、用户行为、系统响应、产出、页面')
    } else if (mainFlowRows.length < 6) {
      issues.push('主流程步骤表至少需要 6 个步骤')
    }
    if (!advancedUxTextHasAll(text, ['页面总览表', '页面流转表', '页面框架表'])) {
      issues.push('缺少页面三件套：页面总览表、页面流转表、页面框架表')
    }
    const pageOverviewRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['编号', '页面名称', '核心职责'],
      ['页面编号', '页面名称', '核心职责']
    ])
    if (!pageOverviewRows.length) {
      issues.push('页面三件套缺少页面总览表：需覆盖编号、页面名称、核心职责')
    } else if (pageOverviewRows.length < 3) {
      issues.push('页面总览表至少需要 3 个页面/入口')
    }
    const pageFlowRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['源页面', '目标页面', '触发动作'],
      ['源页面', '目标页面', '触发操作'],
      ['源页面', '目标页面', '传递数据']
    ])
    if (!pageFlowRows.length) {
      issues.push('页面三件套缺少页面流转表：需覆盖源页面、目标页面、触发动作/传递数据')
    } else if (pageFlowRows.length < 3) {
      issues.push('页面流转表至少需要 3 条页面流转')
    }
    if (!advancedUxTableHasColumns(tables, ['编号', '触发动作', '关闭行为', '去向'])) {
      issues.push('缺少弹窗/抽屉定义表：需覆盖编号、触发动作、关闭行为、去向')
    } else if (advancedUxMaxRowsForColumns(tables, ['编号', '触发动作', '关闭行为']) < 3) {
      issues.push('弹窗/抽屉定义表至少需要 3 个关键浮层或写明不适用原因')
    }
    const informationEntityRows = advancedUxMaxRowsForColumns(tables, ['信息实体', '核心属性', '关系/依赖', '状态/流转', '设计提示'])
    if (!informationEntityRows) {
      issues.push('缺少信息架构实体表：需覆盖信息实体、核心属性、关系/依赖、状态/流转、设计提示')
    } else if (informationEntityRows < 10 && !/(少于\s*10|不足\s*10|不适用|当前范围不适用|轻量范围)/.test(text)) {
      issues.push('信息架构实体表至少需要 10 个实体；若少于 10 个必须说明当前范围不适用')
    }
    const stateRows = advancedUxMaxRowsForColumns(tables, ['当前状态', '触发事件', '目标状态', '页面表现', '数据变更'])
    if (stateRows && stateRows < 5) {
      issues.push('状态机表格至少需要 5 个状态，覆盖初始、加载、成功、失败/错误、空态')
    }
    if (!/ST0\s*(?:→|->)|状态迁移图|状态流向/.test(text)) {
      issues.push('缺少状态迁移图：需用 ST0→ST1 形式表达可视化流向')
    }
    const migrationRuleRows = advancedUxMaxRowsForAnyColumnGroup(tables, [
      ['当前状态', '触发事件', '目标状态', '迁移条件'],
      ['源状态', '触发', '目标状态']
    ])
    if (!/迁移规则表/.test(text) && !advancedUxTableHasColumns(tables, ['源状态', '触发', '目标状态'])) {
      issues.push('缺少独立迁移规则表')
    } else if (migrationRuleRows < 3) {
      issues.push('迁移规则表至少需要 3 条状态迁移规则')
    }
    const breakpointRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['断点节点', '断点风险', '优化动作', '覆盖路径']
    ])
    if (!breakpointRows.length) {
      issues.push('缺少关键断点与优化节点表：需覆盖断点节点、断点风险、优化动作、覆盖路径')
    } else if (breakpointRows.length < 5) {
      issues.push('关键断点与优化节点表至少需要 5 个断点，覆盖主路径、异常路径、回流路径')
    }
    const globalRuleRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['类型', '规则', '示例', '例外'],
      ['规范类型', '规则', '示例', '例外']
    ])
    if (!globalRuleRows.length) {
      issues.push('缺少全局交互规范表：需覆盖类型、规则、示例、例外')
    } else if (globalRuleRows.length < 7) {
      issues.push('全局交互规范表需要覆盖加载状态、Toast、空状态、网络异常、弹窗、表单、返回/导航 7 类')
    }
    if (!/低保真线框图|ASCII\s*线框|线框图/.test(text) || !hasTextCodeBlock) {
      issues.push('缺少实际 ASCII 低保真线框图：不得只写待生成')
    }
    if (/图\s*\d+[\s\S]{0,80}当前仅输出\s*ASCII\s*文本布局[\s\S]{0,80}(?:真实低保真图片|Draw\.io|待后续)/.test(text)) {
      issues.push('图编号内容仍是兜底说明：图1/图6等必须对应真实 ASCII 图形代码块，待生成状态只能放在产物状态表')
    }
    if (!advancedUxTableHasColumns(tables, ['维度', '方案一', '方案二', '方案三'])) {
      issues.push('缺少三方案横向对比矩阵：需覆盖维度、方案一、方案二、方案三')
    } else if (advancedUxMaxRowsForColumns(tables, ['维度', '方案一', '方案二', '方案三']) < 5) {
      issues.push('三方案横向对比矩阵至少需要 5 个维度，覆盖效率、学习成本、异常恢复、实现复杂度和风险')
    }
    const hasSeparatedSolutionWireframes = /关键节点低保真对比[\s\S]*####\s*方案(?:A|一)[^\n]*[\s\S]*```text[\s\S]*```[\s\S]*####\s*方案(?:B|二)[^\n]*[\s\S]*```text[\s\S]*```[\s\S]*####\s*方案(?:C|三)[^\n]*[\s\S]*```text[\s\S]*```/.test(text)
    const hasSqueezedSolutionWireframe = textCodeBlocks.some((block) => /方案(?:A|一)[\s\S]{0,120}方案(?:B|二)[\s\S]{0,120}方案(?:C|三)/.test(block))
    if (!hasSeparatedSolutionWireframes) {
      issues.push('缺少关键节点低保真分方案对比：每个方案需单独标题和单独 text 代码块')
    }
    if (hasSqueezedSolutionWireframe) {
      issues.push('关键节点低保真对比不可把方案A/方案B/方案C挤在同一个 ASCII 代码块')
    }
    const exceptionRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['异常类型', '触发场景', '用户影响', '页面表现', '处理方式']
    ])
    if (!exceptionRows.length) {
      issues.push('缺少异常流补充表：需覆盖异常类型、触发场景、用户影响、页面表现、处理方式')
    } else if (exceptionRows.length < 8) {
      issues.push('异常流补充表至少需要 8 种异常场景')
    }
    if (!/白帽/.test(text) || !/红帽/.test(text) || !/黑帽/.test(text) || !/黄帽/.test(text) || !/绿帽/.test(text) || !/蓝帽/.test(text)) {
      issues.push('缺少六顶思考帽评审')
    }
    if (!advancedUxRecommendationHasSixHatsReview(text)) {
      issues.push('缺少推荐方案建议下的六顶思考帽评审')
    }
    if (!/Problem-?Solution\s*Fit|问题-方案匹配|问题方案匹配/i.test(text)) {
      issues.push('缺少 Problem-Solution Fit 验证')
    }
    const dataTrackingRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['事件名称', '触发条件', '上报参数', '用途', '优先级']
    ])
    if (!dataTrackingRows.length) {
      issues.push('缺少数据埋点方案表：需覆盖事件名称、触发条件、上报参数、用途、优先级')
    } else if (dataTrackingRows.length < 10) {
      issues.push('数据埋点方案表至少需要 10 个埋点事件，覆盖核心转化漏斗')
    }
    const finalPageRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['页面编号', '页面名称', '页面类型', '核心职责', '状态机', '优先级']
    ])
    if (!finalPageRows.length) {
      issues.push('缺少最终方案页面清单：需覆盖页面编号、页面名称、页面类型、核心职责、状态机、优先级')
    } else if (finalPageRows.length < 5) {
      issues.push('最终方案页面清单至少需要 5 个页面或弹窗')
    }
    const competitorRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['能力维度', '置信度']
    ])
    if (!competitorRows.length) {
      issues.push('缺少竞品对标总结表：需覆盖能力维度、自身规划、竞品列和置信度')
    } else if (competitorRows.length < 8) {
      issues.push('竞品对标总结表至少需要 8 个能力维度')
    }
    const principleRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['原则', '描述', '置信度']
    ])
    if (!principleRows.length) {
      issues.push('缺少设计原则表：需覆盖原则、描述、置信度')
    } else if (principleRows.length < 4) {
      issues.push('设计原则表至少需要 4 条原则')
    }
    const nextActionRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['行动项', '负责角色', '优先级']
    ])
    if (!nextActionRows.length) {
      issues.push('缺少下一步行动表：需覆盖行动项、负责角色、优先级')
    } else if (nextActionRows.length < 5) {
      issues.push('下一步行动表至少需要 5 个行动项')
    }
    if (!advancedUxTableHasColumns(tables, ['功能/机会', '用户价值', '业务价值', '实施成本', '综合优先级', '分期建议'])) {
      issues.push('缺少设计优先级与分阶段计划下的优先级排序总览')
    }
    if (!advancedUxTableHasColumns(tables, ['阶段', '范围', '核心目标', '交付物', '验证标准', '预计周期'])) {
      issues.push('缺少设计优先级与分阶段计划下的分期交付计划')
    }
    if (!advancedUxTableHasColumns(tables, ['决策事项', '影响范围', '需要谁确认', '确认时限', '不确认的影响'])) {
      issues.push('缺少设计优先级与分阶段计划下的待确认决策')
    }
    return issues
  }
  const advancedUxMarkdownQualityIssues = (markdown = '', evidencePack = {}) => {
    const text = String(markdown || '').replace(/\r\n/g, '\n').trim()
    const issues = []
    if (!text) return ['Markdown 内容为空']
    ADVANCED_UX_CURRENT_SECTION_NAMES.forEach((name) => {
      if (!new RegExp(`^##\\s+.*${name}`, 'm').test(text)) issues.push(`缺少章节：${name}`)
    })
    const legacySectionNames = ['需求理解', '需求拆解', '风险假设', '流程与信息架构', '机会与方案', '优先级与分期', '交付与验收']
    legacySectionNames.forEach((name) => {
      if (new RegExp(`^##\\s+.*${name}`, 'm').test(text)) issues.push(`包含旧章节标题：${name}`)
    })
    const headings = [...text.matchAll(/^(#{2,6})\s+(.+?)\s*$/gm)].map((match) => ({
      level: match[1].length,
      title: cleanMarkdownCell(match[2]),
      start: match.index || 0,
      end: (match.index || 0) + match[0].length
    }))
    headings.forEach((heading, index) => {
      if (heading.level < 3) return
      const nextSameOrHigher = headings.slice(index + 1).find((item) => item.level <= heading.level)
      const end = nextSameOrHigher?.start ?? text.length
      const body = text.slice(heading.end, end).trim()
      const meaningfulBody = body
        .replace(/```[\s\S]*?```/g, '流程或线框内容')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, '')
        .replace(/^#{1,6}\s+.+$/gm, '')
        .replace(/^\s*[-*_]{3,}\s*$/gm, '')
        .trim()
      const hasStructuredContent = /```[\s\S]*?```/.test(body) || /^\s*\|.+\|\s*$/m.test(body)
      if (!hasStructuredContent && meaningfulBody.length < 4) {
        issues.push(`标题无正文：${heading.title}`)
      }
    })
    const tables = parseAdvancedUxMarkdownTables(text)
    const allowedUrls = new Set((Array.isArray(evidencePack?.sources) ? evidencePack.sources : [])
      .map((item) => String(item?.url || '').trim())
      .filter(Boolean))
    const markdownUrls = Array.from(new Set([...text.matchAll(/https?:\/\/[^\s)\]>"]+/g)]
      .map((match) => String(match[0] || '').replace(/[.,，。；;]+$/, ''))))
    markdownUrls.forEach((url) => {
      if (!allowedUrls.has(url)) issues.push(`包含 Evidence Pack 之外的链接：${url}`)
    })
    if (!advancedUxTableHasColumns(tables, ['当前状态', '触发事件', '目标状态', '页面表现', '数据变更'])) {
      issues.push('缺少状态机表格：表头需覆盖当前状态、触发事件、目标状态、页面表现、数据变更')
    }
    if (!advancedUxTableHasColumns(tables, ['区域', '内容', '说明'])) {
      issues.push('缺少页面框架表格：表头需覆盖区域、内容、说明')
    }
    issues.push(...advancedUxMethodologyReviewIssues(text, tables))
    issues.push(...advancedUxPageInteractionPlanningIssues(text, tables))
    return issues
  }
  const sanitizeMarkdownFileSegment = (value = '') => String(value || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .slice(0, 36)
  const pageInteractionDocumentFileName = (markdown = '', payload = {}) => {
    const title = String(markdown || '').match(/^#\s+(.+?)\s*$/m)?.[1] || ''
    const fromTitle = title.replace(/[-—_ ]*页面交互框架与说明\s*$/i, '')
    const fromInput = String(payload.input || '').match(/(?:做一个|做一款|我要做|我想做|开发一个|开发一款)(.+?)(?:的)?(?:小程序|App|APP|网站|系统|平台|应用)/)?.[1] || ''
    const productName = sanitizeMarkdownFileSegment(fromTitle || fromInput || '产品')
    return `${productName || '产品'}-页面交互框架与说明.md`
  }
  const advancedUxFirstTableWithColumns = (tables = [], requiredColumns = []) =>
    (Array.isArray(tables) ? tables : []).find((table) => advancedUxTableHasColumns([table], requiredColumns)) || null
  const advancedUxTableFilledRows = (table = null) =>
    Array.isArray(table?.rows)
      ? table.rows.filter((row) =>
          Array.isArray(row) &&
          row.some((cell) => cleanMarkdownCell(cell))
        )
      : []
  const pageInteractionHeadingBlocks = (markdown = '') => {
    const text = String(markdown || '').replace(/\r\n/g, '\n')
    const headings = [...text.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)].map((match) => ({
      level: match[1].length,
      title: cleanMarkdownCell(match[2]),
      start: match.index || 0,
      end: (match.index || 0) + match[0].length
    }))
    const pageHeadings = headings
      .map((heading, index) => ({ ...heading, index }))
      .filter((heading) => heading.level === 3 && /^P\d{2}\b/.test(heading.title))
    return pageHeadings.map((heading) => {
      const next = headings
        .slice(heading.index + 1)
        .find((item) => item.level <= heading.level)
      return {
        id: heading.title.match(/^(P\d{2})\b/)?.[1] || '',
        title: heading.title,
        body: text.slice(heading.end, next?.start ?? text.length).trim()
      }
    })
  }
  const pageInteractionOverviewPageIds = (markdown = '') => {
    const tables = parseAdvancedUxMarkdownTables(markdown)
    const overview = advancedUxFirstTableWithColumns(tables, ['编号', '页面名称', '类型', '所属模块', '核心职责'])
    return advancedUxTableFilledRows(overview)
      .map((row) => cleanMarkdownCell(row[0] || '').match(/^P\d{2}\b/)?.[0] || '')
      .filter(Boolean)
  }
  const advancedUxTableColumnIndex = (table = {}, columnName = '') =>
    (Array.isArray(table?.headers) ? table.headers : [])
      .findIndex((header) => cleanMarkdownCell(header).includes(columnName))
  const pageInteractionOverviewPages = (markdown = '') => {
    const tables = parseAdvancedUxMarkdownTables(markdown)
    const overview = advancedUxFirstTableWithColumns(tables, ['编号', '页面名称', '类型', '所属模块', '核心职责'])
    const idIndex = advancedUxTableColumnIndex(overview, '编号')
    const nameIndex = advancedUxTableColumnIndex(overview, '页面名称')
    const typeIndex = advancedUxTableColumnIndex(overview, '类型')
    const moduleIndex = advancedUxTableColumnIndex(overview, '所属模块')
    const entryIndex = advancedUxTableColumnIndex(overview, '入口来源')
    const responsibilityIndex = advancedUxTableColumnIndex(overview, '核心职责')
    const roleIndex = advancedUxTableColumnIndex(overview, '角色权限')
    const dataIndex = advancedUxTableColumnIndex(overview, '数据来源')
    const permissionIndex = advancedUxTableColumnIndex(overview, '权限规则')
    const routeIndex = advancedUxTableColumnIndex(overview, '路由路径')
    return advancedUxTableFilledRows(overview).map((row) => {
      const pageId = cleanMarkdownCell(row[idIndex >= 0 ? idIndex : 0] || '').match(/^P\d{2}\b/)?.[0] || ''
      return {
        pageId,
        pageName: cleanMarkdownCell(row[nameIndex >= 0 ? nameIndex : 1] || ''),
        type: cleanMarkdownCell(row[typeIndex] || ''),
        module: cleanMarkdownCell(row[moduleIndex] || ''),
        entrySource: cleanMarkdownCell(row[entryIndex] || ''),
        responsibility: cleanMarkdownCell(row[responsibilityIndex] || ''),
        roleAccess: cleanMarkdownCell(row[roleIndex] || ''),
        dataSource: cleanMarkdownCell(row[dataIndex] || ''),
        permissionRule: cleanMarkdownCell(row[permissionIndex] || ''),
        routePath: cleanMarkdownCell(row[routeIndex] || '')
      }
    }).filter((page) => page.pageId)
  }
  const pageInteractionCorePages = (markdown = '') => {
    const overviewPages = pageInteractionOverviewPages(markdown)
    const headingPages = pageInteractionHeadingBlocks(markdown)
    const headingMap = new Map(headingPages.map((page) => [page.id, page]))
    const candidates = overviewPages.filter((page) => /核心|主流程|关键|MVP|首版|P0/i.test(`${page.type} ${page.module} ${page.responsibility}`))
    const selected = candidates.length ? candidates : overviewPages.slice(0, 3)
    return selected.map((page) => ({
      ...page,
      title: headingMap.get(page.pageId)?.title || `${page.pageId} ${page.pageName}`.trim(),
      body: headingMap.get(page.pageId)?.body || ''
    })).filter((page) => page.body)
  }
  const pageInteractionPageIssues = (markdown = '') => {
    const issues = []
    const overviewPageIds = pageInteractionOverviewPageIds(markdown)
    const pages = pageInteractionHeadingBlocks(markdown)
    const pageMap = new Map(pages.map((page) => [page.id, page]))
    overviewPageIds.forEach((pageId) => {
      if (!pageMap.has(pageId)) issues.push(`页面总览中的 ${pageId} 缺少逐页交互说明章节`)
    })
    pages.forEach((page) => {
      const body = page.body || ''
      const tables = parseAdvancedUxMarkdownTables(body)
      const frameTable = pageInteractionFrameTable(tables)
      const interactionTable = advancedUxFirstTableWithColumns(tables, ['用户操作', '系统反馈', '备注'])
      const exceptionTable = advancedUxFirstTableWithColumns(tables, ['状态', '表现', '处理方式'])
      const hasAsciiWireframe = /```(?:text)?\s*[\s\S]*?[┌┐└┘│][\s\S]*?```/i.test(body)
      if (!/页面定位/.test(body)) issues.push(`${page.id} 缺少页面定位`)
      if (!/页面框架/.test(body) && !frameTable) issues.push(`${page.id} 缺少页面框架模块`)
      if (!hasAsciiWireframe) {
        issues.push(`${page.id} 缺少文本布局图（ASCII）：每页必须包含字符线框图`)
      }
      if (!/交互规则/.test(body) && !interactionTable) issues.push(`${page.id} 缺少交互规则模块`)
      if (!/异常状态/.test(body) && !exceptionTable) issues.push(`${page.id} 缺少异常状态模块`)
      if (!frameTable) {
        issues.push(`${page.id} 缺少页面框架表格：表头需覆盖区域、内容、说明，或新版区域编号、区域名称、区域类型、位置、内容摘要、关键元素`)
      } else if (advancedUxTableFilledRows(frameTable).length < 2) {
        issues.push(`${page.id} 页面框架表格至少需要 2 个有效区域`)
      }
      if (!interactionTable) {
        issues.push(`${page.id} 缺少交互规则表格：表头需覆盖用户操作、系统反馈、备注`)
      } else if (advancedUxTableFilledRows(interactionTable).length < 5) {
        issues.push(`${page.id} 交互规则不少于 5 条`)
      }
      if (!exceptionTable) {
        issues.push(`${page.id} 缺少异常状态表格：表头需覆盖状态、表现、处理方式`)
      } else {
        const exceptionRows = advancedUxTableFilledRows(exceptionTable)
        const exceptionText = exceptionRows.flat().map((cell) => cleanMarkdownCell(cell)).join(' ')
        if (!advancedUxTextHasAll(exceptionText, ['加载中', '空状态', '错误态', '无权限'])) {
          issues.push(`${page.id} 基础异常状态必须覆盖加载中、空状态、错误态、无权限`)
        }
        if (exceptionRows.length < 5) {
          issues.push(`${page.id} 异常状态需包含 4 种基础状态和至少 1 个业务异常`)
        }
      }
    })
    return issues
  }
  const pageInteractionFrameTable = (tables = []) =>
    advancedUxFirstTableWithColumns(tables, ['区域', '内容', '说明']) ||
    advancedUxFirstTableWithColumns(tables, ['区域编号', '区域名称', '区域类型', '位置', '内容摘要', '关键元素']) ||
    advancedUxFirstTableWithColumns(tables, ['region_id', 'region_name', 'region_type', 'position', 'content_summary', 'key_elements'])
  const pageInteractionFlowIssues = (markdown = '', tables = []) => {
    const text = String(markdown || '')
    const issues = []
    const overviewPageIds = pageInteractionOverviewPageIds(text)
    if (!/页面总览统计/.test(text) || !advancedUxTextHasAll(text, ['总页面数', '核心流程页面', '已分析', '覆盖率', '页面类型分布'])) {
      issues.push('缺少页面总览统计：需包含总页面数、核心流程页面、已分析、覆盖率、页面类型分布')
    }
    const overview = advancedUxFirstTableWithColumns(tables, ['编号', '页面名称', '类型', '所属模块', '核心职责'])
    if (overview) {
      ;['入口来源', '角色权限', '数据来源', '权限规则', '路由路径'].forEach((column) => {
        if (advancedUxTableColumnIndex(overview, column) < 0) {
          issues.push(`页面总览表缺少自有产品扩展字段：${column}`)
        }
      })
    }
    const flowTable = advancedUxFirstTableWithColumns(tables, ['源页面', '目标页面', '触发操作', '流转类型']) ||
      advancedUxFirstTableWithColumns(tables, ['from_page', 'to_page', 'trigger', 'flow_type'])
    if (!flowTable) {
      issues.push('缺少页面流转关系表：表头需覆盖源页面、目标页面、触发操作、流转类型')
    } else {
      const flowRows = advancedUxTableFilledRows(flowTable)
      if (!flowRows.length) issues.push('页面流转关系表至少需要 1 条有效流转')
      const flowText = flowRows.flat().map((cell) => cleanMarkdownCell(cell)).join(' ')
      overviewPageIds.forEach((pageId) => {
        if (!flowText.includes(pageId)) {
          issues.push(`页面总览中的 ${pageId} 未出现在页面流转关系表中`)
        }
      })
      if (!/主流程/.test(flowText)) issues.push('页面流转关系表必须标注至少一条主流程')
      if (!/(返回|异常流)/.test(flowText)) issues.push('页面流转关系表必须覆盖返回或异常流')
    }
    if (!/```(?:text)?[\s\S]*P\d{2}[\s\S]*[├└│─→][\s\S]*```/m.test(text)) {
      issues.push('缺少页面流转文本流程图：需使用 P编号 页面名称 和字符连线表达主流程/分支/异常')
    }
    return issues
  }
  const pageInteractionOwnProductRuleIssues = (markdown = '', tables = []) => {
    const issues = []
    const ruleTable = advancedUxFirstTableWithColumns(tables, ['规则编号', '页面编号', '区域编号', '触发元素', '触发动作', '前置条件', '交互行为']) ||
      advancedUxFirstTableWithColumns(tables, ['rule_id', 'page_id', 'region_id', 'target_element', 'trigger', 'pre_condition', 'behavior'])
    if (!ruleTable) {
      issues.push('缺少自有产品交互规则表：表头需覆盖规则编号、页面编号、区域编号、触发元素、触发动作、前置条件、交互行为')
      return issues
    }
    const rows = advancedUxTableFilledRows(ruleTable)
    if (rows.length < 3) issues.push('自有产品交互规则表至少需要 3 条核心交互规则')
    const ruleText = rows.flat().map((cell) => cleanMarkdownCell(cell)).join(' ')
    pageInteractionOverviewPageIds(markdown).forEach((pageId) => {
      if (!ruleText.includes(pageId)) issues.push(`${pageId} 缺少对应的自有产品交互规则`)
    })
    if (!/(失败反馈|错误反馈|error_feedback)/.test((ruleTable.headers || []).join(' '))) {
      issues.push('自有产品交互规则表缺少失败反馈/错误反馈字段')
    }
    return issues
  }
  const advancedUxTableRowText = (rows = []) =>
    rows.map((row) => row.map((cell) => cleanMarkdownCell(cell)).join(' ')).join('\n')
  const advancedUxHasAnyText = (text = '', tokens = []) =>
    tokens.some((token) => new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(text))
  const pageInteractionMainFlowStepRows = (tables = []) => {
    const sourceTables = Array.isArray(tables) ? tables : []
    return sourceTables.flatMap((table) => {
      const headers = Array.isArray(table?.headers) ? table.headers.map((header) => cleanMarkdownCell(header)) : []
      const headerText = headers.join(' ')
      if (/源页面/.test(headerText) && /目标页面/.test(headerText)) return []
      const hasStep = /(步骤|步骤编号|步骤号|Step|S编号|流程节点|序号)/i.test(headerText)
      const hasUser = /(用户行为|用户动作|用户操作|操作|动作|行为)/.test(headerText)
      const hasSystem = /(系统响应|系统反馈|系统处理|反馈|响应|处理)/.test(headerText)
      const hasPage = /(页面|页面编号|关联页面|目标页面|P编号|page_id)/i.test(headerText)
      if (!hasStep || !hasUser || !hasSystem || !hasPage) return []
      return advancedUxTableRows(table).filter((row) => {
        const rowText = row.map((cell) => cleanMarkdownCell(cell)).join(' ')
        return /(?:^|\b)S\d{1,2}\b|步骤\s*\d|Step\s*\d/i.test(rowText) || /P(?:G)?\d{1,2}\b/i.test(rowText)
      })
    })
  }
  const pageInteractionLatestStageTwoIssues = (markdown = '', tables = []) => {
    const text = String(markdown || '')
    const issues = []
    ;[
      '信息架构实体表',
      '页面流转总览',
      '弹窗与抽屉定义表',
      '关键断点与优化节点',
      '页面3方案',
      '方案验证与收敛'
    ].forEach((heading) => {
      if (!new RegExp(`^##\\s+.*${heading}`, 'm').test(text)) issues.push(`缺少章节：${heading}`)
    })
    const assumptionRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['假设', '依据', '风险', '验证'],
      ['核心假设', '依据', '风险', '验证方式']
    ])
    if (assumptionRows.length < 5) issues.push('核心假设清单不少于 5 条，需覆盖假设、依据、风险、验证方式')
    const entityRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['信息实体', '核心属性', '关系/依赖', '状态/流转', '设计提示'],
      ['实体', '属性', '关系', '状态', '设计提示']
    ])
    if (entityRows.length < 5) issues.push('信息架构实体表至少需要 5 条实体记录')
    const stepRows = [
      ...advancedUxRowsForAnyColumnGroup(tables, [
      ['步骤', '名称', '用户行为', '系统响应', '页面'],
      ['步骤编号', '步骤名称', '用户行为', '系统反馈', '关联页面']
      ]),
      ...pageInteractionMainFlowStepRows(tables)
    ]
    const stepRowKeys = new Set()
    const uniqueStepRows = stepRows.filter((row) => {
      const key = row.map((cell) => cleanMarkdownCell(cell)).join('|')
      if (!key || stepRowKeys.has(key)) return false
      stepRowKeys.add(key)
      return true
    })
    const stepRowsWithPage = uniqueStepRows.filter((row) => /P(?:G)?\d{1,2}\b/i.test(row.map((cell) => cleanMarkdownCell(cell)).join(' ')))
    if (uniqueStepRows.length < 6 || stepRowsWithPage.length < Math.min(6, uniqueStepRows.length)) issues.push('主流程步骤表至少需要 6 步，并关联 P 页面编号')
    const dataFlowRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['源页面', '目标页面', '传递数据', '触发动作'],
      ['from_page', 'to_page', 'data', 'trigger']
    ])
    if (!dataFlowRows.length) issues.push('缺少页面间数据流表：表头需覆盖源页面、目标页面、传递数据、触发动作')
    const modalRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['编号', '名称', '触发动作', '关闭行为', '提交/取消去向', '关联页面'],
      ['编号', '弹窗名称', '触发动作', '关闭行为', '去向', '关联页面']
    ])
    const modalNotApplicable = /弹窗与抽屉定义表[\s\S]{0,300}(不适用|无需弹窗|无弹窗|无抽屉)/.test(text)
    if (!modalNotApplicable && modalRows.length < 4) {
      issues.push('弹窗与抽屉定义表需 4 条以上，或明确说明当前项目不适用')
    }
    const breakpointRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['断点节点', '断点风险', '优化动作', '覆盖路径'],
      ['断点', '位置', '问题描述', '用户影响', '优化方案']
    ])
    if (breakpointRows.length < 4) issues.push('关键断点与优化节点至少需要 4 条')
    const planRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['对比维度', '方案A', '方案B', '方案C'],
      ['维度', '方案一', '方案二', '方案三']
    ])
    if (planRows.length < 8) issues.push('页面3方案对比矩阵至少需要 8 个对比维度')
    const psFitRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['核心问题', '对应方案', '匹配证据', '未匹配风险', '验证方式'],
      ['问题', '方案', '证据', '风险', '验证']
    ])
    if (psFitRows.length < 4) issues.push('Problem-Solution Fit 验证至少需要 4 条')
    const decisionRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['维度', '内容'],
      ['决策项', '内容'],
      ['字段', '内容'],
      ['项目', '说明'],
      ['决策字段', '决策内容']
    ])
    const decisionText = advancedUxTableRowText(decisionRows)
    ;['推荐方案', '核心理由', '核心交付物', '置信度', '融合', '不优先'].forEach((token) => {
      if (!decisionText.includes(token)) issues.push(`推荐决策卡片缺少字段：${token}`)
    })
    const trackingRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['事件名称', '触发条件', '上报参数', '用途'],
      ['事件', '触发时机', '参数', '用途']
    ])
    if (trackingRows.length < 8) issues.push('数据埋点表至少需要 8 条')
    const pendingRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['优先级', '问题', '影响范围', '建议确认对象', '置信度'],
      ['优先级', '待确认事项', '影响范围', '确认对象', '置信度']
    ])
    if (pendingRows.length < 5) issues.push('后续待确认事项表至少需要 5 条')
    const stateRows = advancedUxRowsForAnyColumnGroup(tables, [
      ['当前状态', '触发事件', '目标状态', '页面表现', '数据变更']
    ])
    if (stateRows.length < 3) issues.push('状态机表格至少需要 3 条状态迁移')
    if (!advancedUxHasAnyText(text, ['IR01', 'IR1', 'ST0', 'ST1', 'S1', 'P01'])) {
      issues.push('缺少全局编号串联：P / S / ST / IR 编号需在文档中交叉引用')
    }
    return issues
  }
  const pageInteractionArtifactClaimIssues = (markdown = '') => {
    const text = String(markdown || '')
    const issues = []
    const lines = text.split(/\r?\n/)
    const claimsGenerated = (line = '') => /(?:已生成|生成完成|已输出|已产出)/.test(line) &&
      !/(?:未生成|待生成|不声明已生成|不得写\s*Draw\.io\s*已生成|尚未生成|无需生成|按需生成)/i.test(line)
    if (lines.some((line) => /(?:Draw\.io|\.drawio|\.xml)/i.test(line) && claimsGenerated(line))) {
      issues.push('Draw.io 未生成真实文件前不得写已生成')
    }
    if (lines.some((line) => /(?:低保真|线框图)/.test(line) && claimsGenerated(line))) {
      issues.push('低保真线框图未生成真实图片前不得写已生成')
    }
    return issues
  }
  const pageInteractionDocumentQualityIssues = (markdown = '') => {
    const text = String(markdown || '').replace(/\r\n/g, '\n').trim()
    const issues = []
    if (!text) return ['页面交互文档为空']
    if (!/^#\s+.+页面交互框架与说明\s*$/m.test(text)) {
      issues.push('缺少 H1 标题：[产品名]-页面交互框架与说明')
    }
    ;['文档概述', '页面总览', '页面流转总览', '信息架构实体表', '核心用户流程', '状态机', '弹窗与抽屉定义表', '逐页交互说明', '关键断点与优化节点', '交互规则表', '全局交互规范', '页面3方案', '方案验证与收敛', '交付物清单'].forEach((heading) => {
      if (!new RegExp(`^##\\s+.*${heading}`, 'm').test(text)) issues.push(`缺少章节：${heading}`)
    })
    if (!/^###\s+P\d{2}\s+/m.test(text)) issues.push('缺少逐页说明：需包含 ### P01 这类页面编号标题')
    const tables = parseAdvancedUxMarkdownTables(text)
    if (!advancedUxTableHasColumns(tables, ['编号', '页面名称', '类型', '所属模块', '核心职责'])) {
      issues.push('缺少页面总览表：表头需覆盖编号、页面名称、类型、所属模块、核心职责')
    }
    if (!advancedUxTableHasColumns(tables, ['源页面', '目标页面', '触发操作', '流转类型']) &&
      !advancedUxTableHasColumns(tables, ['from_page', 'to_page', 'trigger', 'flow_type'])) {
      issues.push('缺少页面流转关系表：表头需覆盖源页面、目标页面、触发操作、流转类型')
    }
    if (!advancedUxTableHasColumns(tables, ['当前状态', '触发事件', '目标状态', '页面表现', '数据变更'])) {
      issues.push('缺少状态机表格：表头需覆盖当前状态、触发事件、目标状态、页面表现、数据变更')
    }
    if (!advancedUxTableHasColumns(tables, ['区域', '内容', '说明'])) {
      issues.push('缺少页面框架表格：表头需覆盖区域、内容、说明')
    }
    if (!advancedUxTableHasColumns(tables, ['用户操作', '系统反馈', '备注'])) {
      issues.push('缺少交互规则表格：表头需覆盖用户操作、系统反馈、备注')
    }
    if (!advancedUxTableHasColumns(tables, ['状态', '表现', '处理方式'])) {
      issues.push('缺少异常状态表格：表头需覆盖状态、表现、处理方式')
    }
    if (!advancedUxTextHasAll(text, ['加载中', '空状态', '错误态', '无权限'])) {
      issues.push('缺少基础异常状态：加载中、空状态、错误态、无权限')
    }
    if (!advancedUxTextHasAll(text, ['加载状态', 'Toast', '空状态', '网络异常', '弹窗规范', '表单规范', '返回/导航'])) {
      issues.push('缺少全局交互规范 7 类：加载状态、Toast、空状态、网络异常、弹窗规范、表单规范、返回/导航')
    }
    const globalSpecTable = advancedUxFirstTableWithColumns(tables, ['规范类型', '规则', '示例', '例外'])
    if (!globalSpecTable) {
      issues.push('缺少全局交互规范表格：表头需覆盖规范类型、规则、示例、例外')
    }
    issues.push(...pageInteractionFlowIssues(text, tables))
    issues.push(...pageInteractionOwnProductRuleIssues(text, tables))
    issues.push(...pageInteractionLatestStageTwoIssues(text, tables))
    issues.push(...pageInteractionPageIssues(text))
    issues.push(...pageInteractionArtifactClaimIssues(text))
    return issues
  }
  const advancedUxContextLine = (value = '', maxLength = 500) => {
    const text = cleanMarkdownCell(value)
    if (!text) return ''
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
  }
  const advancedUxMessageContextLines = (sessions = {}) =>
    Object.entries(sessions || {}).flatMap(([scopeId, messages]) => {
      if (!Array.isArray(messages)) return []
      return messages
        .filter((message) => message && typeof message === 'object')
        .filter((message) => ['user', 'assistant'].includes(message.role))
        .map((message) => {
          const content = advancedUxContextLine(message.content || message.text || message.summary || '')
          return content ? `- [${scopeId}/${message.role}] ${content}` : ''
        })
        .filter(Boolean)
    })
  const advancedUxStageConfirmationContextLines = (confirmations = {}) =>
    Object.entries(confirmations || {}).map(([stageId, confirmation]) => {
      const summary = advancedUxContextLine(confirmation?.summary || confirmation?.action || confirmation?.content || '')
      if (!summary) return ''
      return `- [${stageId}] ${summary}`
    }).filter(Boolean)
  const advancedUxStageTwoContext = (payload = {}) => {
    const currentTotalDesignFlow = payload.currentTotalDesignFlow || {}
    const run = existingWorkflowRun(workflowRunIdFromStagePayload(payload))
    const runFlow = run?.documentAnalysis?.totalDesignFlow || {}
    const sessionSources = [
      run?.agentSessions,
      runFlow.agentSessions,
      currentTotalDesignFlow.agentSessions,
      payload.agentSessions
    ]
    const confirmationSources = [
      runFlow.stageConfirmations,
      currentTotalDesignFlow.stageConfirmations,
      payload.stageConfirmations
    ]
    const messageLines = sessionSources.flatMap(advancedUxMessageContextLines)
    const confirmationLines = confirmationSources.flatMap(advancedUxStageConfirmationContextLines)
    const directConversationLines = []
    ;['messages', 'conversation', 'conversationHistory'].forEach((key) => {
      const value = payload[key]
      if (!Array.isArray(value)) return
      value.forEach((message, index) => {
        const content = advancedUxContextLine(message?.content || message?.text || message?.summary || '')
        if (content) directConversationLines.push(`- [${key}#${index + 1}] ${content}`)
      })
    })
    const unique = (items = []) => [...new Set(items.filter(Boolean))]
    return {
      dialogueLines: unique([...messageLines, ...directConversationLines]).slice(-20),
      confirmationLines: unique(confirmationLines).slice(-10)
    }
  }
  const pageInteractionDocumentPrompt = (payload = {}, report = {}, outputStandardMarkdown = '', pageInteractionSkillMarkdown = '', pageInteractionReferenceMarkdown = '', qualityIssues = []) => {
    const stageTwoContext = advancedUxStageTwoContext(payload)
    return {
      systemPrompt: [
      '你是 UX 页面交互文档生成专家。',
      '任务：基于用户需求、阶段一最终产出文档、阶段一对话过程中的变更和补充、Agent 上下文中的确认信息，继续生成一份独立 Markdown 文件。',
      '这份文件是后端产物，文件名必须是“[产品名]-页面交互框架与说明.md”。',
      '不要重新向用户确认；如果上下文缺失，只能在待确认事项或风险中标注，不能兜底编造业务内容。',
      '阶段二结论不得违背阶段一已确认结论；若对话补充与最终文档不一致，以明确的用户/Agent 确认补充为优先，并在文档概述中标明来源。',
      '',
      '固定 UX 分析文档输出规范：',
      outputStandardMarkdown,
      '',
      pageInteractionSkillMarkdown
        ? ['固定页面交互文档生成 Skill：', pageInteractionSkillMarkdown].join('\n')
        : [
            '页面交互文档硬性结构：',
            '# [产品名]-页面交互框架与说明',
            '## 1. 文档概述',
            '## 2. 页面总览',
            '## 3. 页面流转总览',
            '## 4. 信息架构实体表',
            '## 5. 核心用户流程',
            '## 6. 状态机',
            '## 7. 弹窗与抽屉定义表',
            '## 8. 逐页交互说明',
            '## 9. 关键断点与优化节点',
            '## 10. 交互规则表（自有产品）',
            '## 11. 全局交互规范',
            '## 12. 页面3方案',
            '## 13. 方案验证与收敛',
            '## 14. 交付物清单'
          ].join('\n'),
      '',
      pageInteractionReferenceMarkdown
        ? [
            '下面是一份阶段二页面交互文档产出结构完整度对照参考。它只用于理解页面总览、页面流转、逐页说明、状态机、交互规则、交付物清单的颗粒度和完整度。',
            '禁止复制、套用或改写参考文档中的业务内容、竞品、数据、产品名、页面名、指标、链接或行业结论。',
            '',
            pageInteractionReferenceMarkdown
          ].join('\n')
        : '',
      '',
      Array.isArray(qualityIssues) && qualityIssues.length ? `上一轮质量问题：${qualityIssues.slice(0, 12).join('；')}` : '',
      '',
      '输出要求：',
      '- 只输出 Markdown 正文，不输出 JSON、解释或前后缀。',
      '- 不要用代码块包裹整篇文档；但页面流转文本流程图、每页文本布局图（ASCII）必须使用 ```text 代码块。',
      '- 不要输出 :::page-layout-artifact。',
      '- 不要写“已生成低保真图”或“已生成 Draw.io”，除非输入中已经提供真实图片 URL 或 .drawio/.xml 文件。',
      '- 必须保留精确二级标题：## 1. 文档概述、## 2. 页面总览、## 3. 页面流转总览、## 4. 信息架构实体表、## 5. 核心用户流程、## 6. 状态机、## 7. 弹窗与抽屉定义表、## 8. 逐页交互说明、## 9. 关键断点与优化节点、## 10. 交互规则表（自有产品）、## 11. 全局交互规范、## 12. 页面3方案、## 13. 方案验证与收敛、## 14. 交付物清单。',
      '- 文档概述必须包含“核心假设清单”，不少于 5 条，表头覆盖：核心假设、依据、风险、验证方式、置信度。',
      '- 页面总览必须使用表格，表头覆盖：编号、页面名称、类型、所属模块、入口来源、核心职责、角色权限、数据来源、权限规则、路由路径、analyzed。',
      '- 页面总览后必须输出“页面总览统计”，包含：总页面数、核心流程页面、已分析、未分析、覆盖率、页面类型分布；覆盖率低于 80% 必须说明原因。',
      '- 页面总览原则上覆盖当前产品完整页面，常规产品建议 8-15 个页面；范围较小时可少于 8 个，但必须解释范围边界，且页面总览中的每个 P 编号都必须有逐页说明。',
      '- 禁止裸编号引用：编号定义列可以只写 P01/M01/ST1/S1/IR1/E1；凡是来源、依据、关联、承接、去向、页面、状态、弹窗、规则、异常等引用字段，必须写成“编号 - 名称/说明”。',
      '- 弹窗与抽屉编号使用 M01/M02/M03，不占用页面 P 编号；引用弹窗或抽屉时必须写成“编号 - 名称/说明”，例如“M03 - 生成排队弹窗”。',
      '- 页面流转总览必须包含“页面流转关系表”和“文本流程图”。流转关系表表头覆盖：源页面编号、源页面名称、目标页面编号、目标页面名称、触发操作、前置条件、流转类型、触发角色、跳转方式、备注；不要输出空白 ID 列或只有编号没有名称的列。',
      '- 页面流转总览必须额外包含“页面间数据流表”，表头覆盖：源页面编号、源页面名称、目标页面编号、目标页面名称、传递数据、触发动作、数据用途、异常处理。',
      '- 页面流转关系表必须覆盖页面总览中每个 analyzed=true 的页面；每个页面至少作为源页面或目标页面出现一次。',
      '- 页面流转关系表必须至少包含 1 行“主流程”，并至少包含 1 行“返回”或“异常流”。',
      '- 必须使用 ```text 代码块输出页面流转文本流程图；流程图必须使用“P编号 - 页面名称”，字符连线表达主流程、关键分支、异常流和返回路径。',
      '- 信息架构实体表必须 5-10 行，表头覆盖：信息实体、核心属性、关系/依赖、状态/流转、设计提示。',
      '- 核心用户流程必须包含主流程步骤表，6-10 步，使用 S 编号并关联 P 页面编号。',
      '- 状态机必须使用表格，表头覆盖：当前状态、触发事件、目标状态、页面表现、数据变更。',
      '- 状态机必须包含 3-8 条状态迁移，并使用 ST 编号或在状态名称中可追踪状态编号；需要有文本状态迁移图。',
      '- 弹窗与抽屉定义表必须 4-8 条，表头覆盖：编号、名称、触发动作、关闭行为、提交/取消去向、关联页面；如当前项目完全不需要弹窗/抽屉，必须明确写“不适用”及理由。',
      '- 每个页面必须包含页面定位、页面框架表格、文本布局图（ASCII）、交互规则表格、异常状态表格。',
      '- 页面总览表中出现的每一个 P 编号，都必须在“逐页交互说明”中有对应的 ### Pxx 页面章节。',
      '- 页面框架表格可使用旧表头“区域、内容、说明”，也可使用新版区域结构表头“区域编号、区域名称、区域类型、位置、布局、内容摘要、关键元素、交互、响应式、优先级、状态变体、状态说明、组件引用”。',
      '- 页面框架表格每页至少 2 个有效区域；移动端/小程序核心页面通常需要顶部、内容、底部或等价区域。',
      '- 文本布局图（ASCII）每页必须有，用 ┌─┐│└─┘ 等字符表达区域布局；这是标配产物，低保真图片只是后续核心页面的视觉补充。',
      '- 交互规则表格表头覆盖：用户操作、系统反馈、备注；每个核心页面不少于 5 条。',
      '- 交互规则表（自有产品）必须独立输出，表头覆盖：规则编号、页面编号、区域编号、触发元素、触发动作、前置条件、交互行为、成功反馈、失败反馈、边界情况、关联接口。',
      '- 自有产品交互规则表必须覆盖每个页面的核心区域/核心交互元素；按钮至少覆盖正常点击、异常状态、防重复点击；表单至少覆盖校验和提交。',
      '- 交互规则必须使用 IR 编号；页面编号 P、流程步骤 S、状态 ST、交互规则 IR 要能互相引用。',
      '- 异常状态表格表头覆盖：状态、表现、处理方式；每个页面必须覆盖加载中、空状态、错误态、无权限，并至少补充 1 个当前项目的业务异常。',
      '- 关键断点与优化节点必须 4-8 条，表头覆盖断点节点、断点风险、优化动作、覆盖路径、置信度。',
      '- 全局交互规范必须覆盖：加载状态、Toast、空状态、网络异常、弹窗规范、表单规范、返回/导航；必须使用表格，表头覆盖规范类型、规则、示例、例外。',
      '- 页面3方案必须包含三方案横向对比矩阵，至少 8 个维度，表头使用：对比维度、方案A、方案B、方案C、推荐判断。',
      '- 方案验证与收敛必须包含 Problem-Solution Fit 验证表（4-6 条）、推荐决策卡片（推荐方案/核心理由/核心交付物/置信度/融合点/不优先项）、数据埋点表（8-15 条）、后续待确认事项表（5-10 条）。',
      '- 推荐决策卡片必须使用两列表格，不要用段落或列表代替；表头可用“维度｜内容”或“字段｜内容”，第一列必须逐行出现：推荐方案、核心理由、融合点、不优先项、核心交付物、置信度。',
      '- 必须输出交叉校验结论：页面总览 ↔ 页面流转 ↔ 页面框架 ↔ 交互规则是否一致；不一致要列出待补充项。',
      '- 低保真线框图和 Draw.io 只写待生成/触发条件/验收标准，不要假装已经生成文件；如果没有真实图片 URL 或真实 .drawio/.xml 文件，严禁写“已生成”。',
      '- 页面、流程、状态、区域、交互规则都必须从当前项目需求和高级 UX Markdown 动态推导，不要套茶饮、鞋子或任何固定行业模板。',
      '- 信息不足时标注推断、低置信度和待确认项，不要编造真实数据、价格、法规或竞品事实。'
      ].filter(Boolean).join('\n'),
      userPrompt: [
      `用户需求：${payload.input || '暂无输入'}`,
      '',
      '上传文档：',
      (Array.isArray(payload.documents) ? payload.documents : payload.files || [])
        .map((doc) => `## ${doc.name || '未命名文档'}\n${doc.text || doc.content || doc.summary || doc.reason || ''}`)
        .join('\n\n') || '无',
      '',
      '阶段一最终产出文档 / 高级 UX 10 节点 Markdown：',
      report.markdown || '无',
      '',
      '阶段一对话过程中的变更和补充：',
      stageTwoContext.dialogueLines.length ? stageTwoContext.dialogueLines.join('\n') : '无明确对话补充；请在文档中将缺失补充标为待确认风险，不要编造。',
      '',
      'Agent 上下文中的隐性信息/确认过的假设：',
      stageTwoContext.confirmationLines.length ? stageTwoContext.confirmationLines.join('\n') : '无明确阶段确认；请只基于阶段一最终文档和用户输入继续。'
      ].join('\n'),
      responseFormat: 'markdown',
      maxOutputTokens: 20000
    }
  }
  const generateAdvancedUxPageInteractionDocument = async (payload = {}, report = {}) => {
    const provider = resolveAgentProvider()
    if (!provider || provider.name === 'deterministic' || typeof provider.generate !== 'function') {
      throw advancedUxMarkdownFailure('未配置可用模型，无法生成页面交互文档。')
    }
    const [outputStandardMarkdown, pageInteractionSkillMarkdown, pageInteractionReferenceMarkdown] = await Promise.all([
      readUxDocOutputStandardMarkdown(),
      readOptionalMarkdownFile(uxPageInteractionSkillPath()),
      readOptionalMarkdownFile(uxPageInteractionReferenceExamplePath())
    ])
    const timeoutMs = advancedUxNoTimeoutMs()
    const buildPrompt = (markdown = '', issues = []) => pageInteractionDocumentPrompt(
      payload,
      { ...report, markdown: markdown || report.markdown || '' },
      outputStandardMarkdown,
      pageInteractionSkillMarkdown,
      pageInteractionReferenceMarkdown,
      issues
    )
    const modelResult = await withTimeout(
      provider.generate({
        ...buildPrompt(),
        model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model),
        timeoutMs
      }),
      timeoutMs,
      '页面交互文档生成超时'
    )
    let markdown = extractMarkdownReplyText(modelResult?.content || modelResult?.markdown || modelResult?.text || '')
    let qualityIssues = pageInteractionDocumentQualityIssues(markdown)
    for (let repairAttempt = 0; qualityIssues.length && repairAttempt < 2; repairAttempt += 1) {
      const repairResult = await withTimeout(
        provider.generate({
          ...buildPrompt(markdown, qualityIssues),
          model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model),
          timeoutMs
        }),
        timeoutMs,
        '页面交互文档规范修复超时'
      )
      const repairedMarkdown = extractMarkdownReplyText(repairResult?.content || repairResult?.markdown || repairResult?.text || '')
      if (repairedMarkdown) {
        markdown = repairedMarkdown
        qualityIssues = pageInteractionDocumentQualityIssues(markdown)
      }
    }
    if (qualityIssues.length) {
      throw advancedUxMarkdownFailure(`页面交互文档未符合输出规范：${qualityIssues.slice(0, 6).join('；')}`, {
        markdown,
        qualityIssues,
        artifactType: 'page-interaction-markdown',
        fileName: pageInteractionDocumentFileName(markdown, payload)
      })
    }
    return {
      status: 'generated',
      artifactType: 'page-interaction-markdown',
      fileName: pageInteractionDocumentFileName(markdown, payload),
      markdown,
      sourceReportFileName: report.fileName || '',
      outputStandardPath: uxDocOutputStandardPath(),
      skillPath: uxPageInteractionSkillPath(),
      referenceExamplePath: pageInteractionReferenceMarkdown ? uxPageInteractionReferenceExamplePath() : '',
      generatedAt: new Date().toISOString(),
      provider: modelResult?.provider || provider.name || '',
      model: modelResult?.model || payload.model || ''
    }
  }
  const extractDrawioXml = (value = '') => {
    const text = String(value || '').trim()
    if (!text) return ''
    const fenced = text.match(/```(?:xml|drawio)?\s*([\s\S]*?<mxfile[\s\S]*?<\/mxfile>)\s*```/i)
    if (fenced?.[1]) return fenced[1].trim()
    const raw = text.match(/<mxfile[\s\S]*?<\/mxfile>/i)
    return raw?.[0]?.trim() || ''
  }
  const drawioQualityIssues = (xml = '') => {
    const text = String(xml || '').trim()
    const issues = []
    if (!text) return ['Draw.io XML 为空']
    if (!/^<mxfile[\s\S]*<\/mxfile>$/.test(text)) issues.push('缺少 mxfile 根节点')
    if (!/<diagram\b[\s\S]*<\/diagram>/.test(text)) issues.push('缺少 diagram 节点')
    if (!/<mxGraphModel\b[\s\S]*<\/mxGraphModel>/.test(text)) issues.push('缺少 mxGraphModel')
    if (!/<mxCell\b[\s\S]*vertex="1"/.test(text)) issues.push('缺少图形节点 mxCell')
    if (!/<mxCell\b[\s\S]*edge="1"/.test(text)) issues.push('缺少连线 mxCell')
    if (/```\s*<?mxfile|<\/mxfile>\s*```/.test(text)) issues.push('Draw.io XML 不能包含 Markdown 代码围栏')
    return issues
  }
  const drawioPrompt = (payload = {}, pageInteractionDocument = {}, diagram = {}, qualityIssues = []) => ({
    systemPrompt: [
      '你是 Draw.io / diagrams.net XML 文件生成专家。',
      '任务：基于页面交互文档生成一个真实可打开的 .drawio XML 文件。',
      '输出必须是完整 <mxfile>...</mxfile> XML，不能输出 Markdown、解释、JSON 或代码围栏。',
      '',
      Array.isArray(qualityIssues) && qualityIssues.length ? `上一轮质量问题：${qualityIssues.slice(0, 8).join('；')}` : '',
      '',
      '通用约束：',
      '- XML 必须包含 mxfile、diagram、mxGraphModel、root、mxCell。',
      '- 至少包含 5 个 vertex 节点和 4 条 edge 连线。',
      '- 图形语义必须来自当前页面交互文档，不要套固定行业示例。',
      '- 节点文字使用中文短句，避免超长段落。',
      '- 流程图：矩形表示步骤，菱形表示判断，圆角矩形表示开始/结束，异常路径用虚线。',
      '- 状态图：圆角矩形表示状态，箭头标注触发事件，初始/结束状态明确表达。',
      '- 不要写“待生成”，本任务就是生成真实 .drawio XML。'
    ].filter(Boolean).join('\n'),
    userPrompt: [
      `用户需求：${payload.input || '暂无输入'}`,
      '',
      `图类型：${diagram.label || diagram.type || ''}`,
      `文件名：${diagram.fileName || ''}`,
      `生成目标：${diagram.instruction || ''}`,
      '',
      '页面交互文档 Markdown：',
      pageInteractionDocument.markdown || '无'
    ].join('\n'),
    responseFormat: 'xml',
    maxOutputTokens: 9000
  })
  const generateDrawioArtifact = async (payload = {}, pageInteractionDocument = {}, diagram = {}) => {
    const provider = resolveAgentProvider()
    if (!provider || provider.name === 'deterministic' || typeof provider.generate !== 'function') {
      throw advancedUxMarkdownFailure('未配置可用模型，无法生成 Draw.io 文件。')
    }
    const timeoutMs = advancedUxNoTimeoutMs()
    const modelResult = await withTimeout(
      provider.generate({
        ...drawioPrompt(payload, pageInteractionDocument, diagram),
        model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model),
        timeoutMs
      }),
      timeoutMs,
      `${diagram.label || 'Draw.io'} 生成超时`
    )
    let xml = extractDrawioXml(modelResult?.content || modelResult?.xml || modelResult?.text || '')
    let qualityIssues = drawioQualityIssues(xml)
    if (qualityIssues.length) {
      const repairResult = await withTimeout(
        provider.generate({
          ...drawioPrompt(payload, pageInteractionDocument, diagram, qualityIssues),
          model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model),
          timeoutMs
        }),
        timeoutMs,
        `${diagram.label || 'Draw.io'} 修复超时`
      )
      const repairedXml = extractDrawioXml(repairResult?.content || repairResult?.xml || repairResult?.text || '')
      if (repairedXml) {
        xml = repairedXml
        qualityIssues = drawioQualityIssues(xml)
      }
    }
    if (qualityIssues.length) {
      throw advancedUxMarkdownFailure(`${diagram.label || 'Draw.io 文件'}未符合输出规范：${qualityIssues.slice(0, 6).join('；')}`)
    }
    return {
      id: diagram.id,
      type: diagram.type,
      label: diagram.label,
      status: 'generated',
      artifactType: 'drawio',
      fileName: diagram.fileName,
      content: xml,
      sourceFileName: pageInteractionDocument.fileName || '',
      generatedAt: new Date().toISOString(),
      provider: modelResult?.provider || provider.name || '',
      model: modelResult?.model || payload.model || ''
    }
  }
  const generateAdvancedUxDrawioArtifacts = async (payload = {}, pageInteractionDocument = {}) => {
    const productName = sanitizeMarkdownFileSegment(
      String(pageInteractionDocument.fileName || '').replace(/-?页面交互框架与说明\.md$/i, '') ||
      pageInteractionDocumentFileName(pageInteractionDocument.markdown || '', payload).replace(/-?页面交互框架与说明\.md$/i, '')
    ) || '产品'
    const diagrams = [
      {
        id: 'advanced-ux-main-flow-drawio',
        type: 'flowchart',
        label: 'Draw.io 主流程图',
        fileName: `${productName}-主流程图.drawio`,
        instruction: '根据“核心用户流程”和逐页交互说明生成主流程图，覆盖主路径、关键判断、异常回退。'
      },
      {
        id: 'advanced-ux-state-machine-drawio',
        type: 'state-machine',
        label: 'Draw.io 状态图',
        fileName: `${productName}-状态机.drawio`,
        instruction: '根据“状态机”表格生成状态图，覆盖当前状态、触发事件、目标状态和异常状态。'
      }
    ]
    const artifacts = []
    for (const diagram of diagrams) {
      artifacts.push(await generateDrawioArtifact(payload, pageInteractionDocument, diagram))
    }
    return artifacts
  }
  const advancedUxTableToMarkdown = (table = null) => {
    const headers = Array.isArray(table?.headers) ? table.headers.map(cleanMarkdownCell).filter(Boolean) : []
    const rows = advancedUxTableFilledRows(table)
    if (!headers.length) return ''
    return [
      `| ${headers.join(' | ')} |`,
      `| ${headers.map(() => '---').join(' | ')} |`,
      ...rows.map((row) => `| ${headers.map((_, index) => cleanMarkdownCell(row[index] || '')).join(' | ')} |`)
    ].join('\n')
  }
  const lowFiWireframePrompt = (payload = {}, pageInteractionDocument = {}, page = {}, pageArtifacts = {}) => {
    const pageTypeText = /网站|后台|管理|PC|Web/i.test(`${payload.input || ''} ${pageInteractionDocument.markdown || ''}`)
      ? 'Web/桌面端页面优先使用 16:9；如果文档明确是小程序/App/H5，则使用移动端 9:16。'
      : '小程序/App/H5 页面使用移动端 9:16。'
    return [
      '任务：生成一张低保真线框图图片。',
      `页面：${page.pageId} ${page.pageName || page.title || ''}`,
      `页面职责：${page.responsibility || '以页面交互文档为准'}`,
      '',
      '生成规则：',
      '- 单张生成：本次只生成当前这一页，不要一次生成多张，不要拼接多个页面。',
      `- 设备比例：${pageTypeText}`,
      '- 视觉风格：低保真、灰度、线框、结构优先，不要高保真视觉稿。',
      '- 灰度色值只能使用或接近：#F5F5F5、#CCCCCC、#E0E0E0、#D0D0D0、#666666、#999999。',
      '- 禁止使用任何品牌色。',
      '- 禁止出现真实文案；所有文本用短占位标签表达，例如“标题”“按钮”“列表项”。',
      '- 禁止出现真实图片；图片区域用灰色占位框表达。',
      '- 禁止使用装饰性元素。',
      '- 禁止混合不同设备比例。',
      '- 区域数量、区域顺序与下面页面框架表格一致；不要自行新增业务区域。',
      '',
      '页面框架表格：',
      pageArtifacts.frameMarkdown || '无',
      '',
      '交互规则表格：',
      pageArtifacts.interactionMarkdown || '无',
      '',
      '异常状态表格：',
      pageArtifacts.exceptionMarkdown || '无'
    ].join('\n')
  }
  const lowFiWireframeValidation = (artifact = {}, prompt = '', pageArtifacts = {}) => {
    const checks = []
    const add = (id, passed, label) => checks.push({ id, passed: Boolean(passed), label })
    const imageSource = String(artifact.imageDataUrl || artifact.imageUrl || '').trim()
    add('real-image-result', /^data:image\/[a-z0-9.+-]+;base64,/i.test(imageSource) || /^https?:\/\//i.test(imageSource) || /^\/api\/workspace\/generated-images\//.test(imageSource), '图片生成服务返回真实图片')
    add('single-page-prompt', /单张生成/.test(prompt) && /不要一次生成多张/.test(prompt), 'Prompt 限定单页单张生成')
    add('gray-palette', ['#F5F5F5', '#CCCCCC', '#E0E0E0', '#D0D0D0', '#666666', '#999999'].every((color) => prompt.includes(color)), 'Prompt 包含 6 项灰度色值约束')
    add('prohibitions', ['禁止使用任何品牌色', '禁止出现真实文案', '禁止出现真实图片', '禁止使用装饰性元素', '禁止混合不同设备比例'].every((token) => prompt.includes(token)), 'Prompt 包含 5 项禁止项')
    add('frame-region-match', Number(pageArtifacts.frameRowCount || 0) >= 2, '页面框架区域来自页面框架表格且不少于 2 个')
    return {
      passed: checks.every((check) => check.passed),
      checks
    }
  }
  const pageLowFiArtifactsFromInteractionDocument = (page = {}) => {
    const tables = parseAdvancedUxMarkdownTables(page.body || '')
    const frameTable = advancedUxFirstTableWithColumns(tables, ['区域', '内容', '说明'])
    const interactionTable = advancedUxFirstTableWithColumns(tables, ['用户操作', '系统反馈', '备注'])
    const exceptionTable = advancedUxFirstTableWithColumns(tables, ['状态', '表现', '处理方式'])
    return {
      frameTable,
      interactionTable,
      exceptionTable,
      frameMarkdown: advancedUxTableToMarkdown(frameTable),
      interactionMarkdown: advancedUxTableToMarkdown(interactionTable),
      exceptionMarkdown: advancedUxTableToMarkdown(exceptionTable),
      frameRowCount: advancedUxTableFilledRows(frameTable).length
    }
  }
  const generateAdvancedUxLowFiWireframeArtifacts = async (payload = {}, pageInteractionDocument = {}) => {
    const provider = resolveImageProvider()
    const generateImage = provider?.generateImage || provider?.generate
    if (!provider || typeof generateImage !== 'function') {
      throw advancedUxMarkdownFailure('未配置可用图片生成模型，无法生成低保真线框图。')
    }
    const productName = sanitizeMarkdownFileSegment(
      String(pageInteractionDocument.fileName || '').replace(/-?页面交互框架与说明\.md$/i, '') ||
      pageInteractionDocumentFileName(pageInteractionDocument.markdown || '', payload).replace(/-?页面交互框架与说明\.md$/i, '')
    ) || '产品'
    const pages = pageInteractionCorePages(pageInteractionDocument.markdown || '')
    if (!pages.length) {
      throw advancedUxMarkdownFailure('页面交互文档缺少可生成低保真线框图的核心页面。')
    }
    const timeoutMs = advancedUxNoTimeoutMs()
    const artifacts = []
    for (const page of pages) {
      const pageArtifacts = pageLowFiArtifactsFromInteractionDocument(page)
      const prompt = lowFiWireframePrompt(payload, pageInteractionDocument, page, pageArtifacts)
      const modelResult = await withTimeout(
        generateImage.call(provider, {
          prompt,
          userPrompt: prompt,
          page,
          sourceFileName: pageInteractionDocument.fileName || '',
          targetGenerator: 'gpt-image-2',
          timeoutMs,
          aspectRatio: /网站|后台|管理|PC|Web/i.test(`${payload.input || ''} ${pageInteractionDocument.markdown || ''}`) ? '16:9' : '9:16',
          targetImageSize: /网站|后台|管理|PC|Web/i.test(`${payload.input || ''} ${pageInteractionDocument.markdown || ''}`) ? '1536x864' : '1024x1536'
        }),
        timeoutMs,
        `${page.pageId} 低保真线框图生成超时`
      )
      const imageDataUrl = modelResult?.imageDataUrl || modelResult?.dataUrl || ''
      const imageUrl = modelResult?.imageUrl || modelResult?.url || ''
      const artifact = {
        id: `advanced-ux-lowfi-${page.pageId}`,
        type: 'low-fi-wireframe',
        artifactType: 'low-fi-wireframe-image',
        status: 'generated',
        pageId: page.pageId,
        pageName: page.pageName || page.title.replace(/^P\d{2}\s*/, ''),
        fileName: `${productName}-${page.pageId}-${sanitizeMarkdownFileSegment(page.pageName || page.title.replace(/^P\d{2}\s*/, '') || '页面')}-低保真线框图.png`,
        ...(imageDataUrl ? { imageDataUrl } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        prompt,
        sourceFileName: pageInteractionDocument.fileName || '',
        generatedAt: new Date().toISOString(),
        provider: modelResult?.provider || provider.name || '',
        model: modelResult?.model || 'gpt-image-2',
        revisedPrompt: modelResult?.revisedPrompt || '',
        validation: null
      }
      artifact.validation = lowFiWireframeValidation(artifact, prompt, pageArtifacts)
      if (!artifact.validation.passed) {
        throw advancedUxMarkdownFailure(`${page.pageId} 低保真线框图未通过验收：${artifact.validation.checks.filter((check) => !check.passed).map((check) => check.label).join('；')}`)
      }
      artifacts.push(artifact)
    }
    return artifacts
  }
  const attachAdvancedUxDeliveryArtifactsToFlow = (totalDesignFlow = {}, { pageInteractionDocument = null, drawioArtifacts = [], lowFiWireframeArtifacts = [] } = {}) => {
    if (!pageInteractionDocument?.markdown && !drawioArtifacts.length && !lowFiWireframeArtifacts.length) return totalDesignFlow
    const advancedUxReport = {
      ...(totalDesignFlow.advancedUxReport || {}),
      ...(pageInteractionDocument?.markdown ? { pageInteractionDocument } : {}),
      ...(drawioArtifacts.length ? { drawioArtifacts } : {}),
      ...(lowFiWireframeArtifacts.length ? { lowFiWireframeArtifacts } : {})
    }
    const flowWithArtifacts = {
      ...totalDesignFlow,
      advancedUxReport,
      ...(pageInteractionDocument?.markdown ? { pageInteractionDocumentArtifact: pageInteractionDocument } : {}),
      ...(drawioArtifacts.length ? { drawioArtifacts } : {}),
      ...(lowFiWireframeArtifacts.length ? { lowFiWireframeArtifacts } : {})
    }
    const sourcePageInteractionDocument = pageInteractionDocument?.markdown
      ? pageInteractionDocument
      : advancedUxReport.pageInteractionDocument?.markdown
        ? advancedUxReport.pageInteractionDocument
        : null
    return attachAdvancedUxLowFiArtifactsToInteractionPages(
      ensureAdvancedUxInteractionLofiCanvas(flowWithArtifacts, sourcePageInteractionDocument),
      lowFiWireframeArtifacts
    )
  }
  const ensureAdvancedUxInteractionLofiCanvas = (totalDesignFlow = {}, pageInteractionDocument = null) => {
    const existingNodes = totalDesignFlow?.stageCanvases?.['interaction-lofi']?.nodes
    if (Array.isArray(existingNodes) && existingNodes.length) return totalDesignFlow
    const canvas = advancedUxInteractionLofiCanvasFromPageInteractionDocument(pageInteractionDocument)
    if (!canvas?.nodes?.length) return totalDesignFlow
    return {
      ...totalDesignFlow,
      stageCanvases: {
        ...(totalDesignFlow.stageCanvases || {}),
        'interaction-lofi': canvas
      }
    }
  }
  const attachAdvancedUxLowFiArtifactsToInteractionPages = (totalDesignFlow = {}, lowFiWireframeArtifacts = []) => {
    const artifacts = Array.isArray(lowFiWireframeArtifacts)
      ? lowFiWireframeArtifacts.filter((artifact) => artifact?.pageId && (artifact?.imageDataUrl || artifact?.imageUrl))
      : []
    const canvas = totalDesignFlow?.stageCanvases?.['interaction-lofi']
    if (!artifacts.length || !Array.isArray(canvas?.nodes) || !canvas.nodes.length) return totalDesignFlow
    const artifactByPageId = new Map(artifacts.map((artifact) => [String(artifact.pageId || '').trim(), artifact]))
    const nodes = canvas.nodes.map((node) => {
      const pageId = String(node?.pageLayoutArtifact?.pageId || node?.sourceArtifact?.pageId || node?.lowFiWireframeArtifact?.pageId || '').trim()
      const artifact = artifactByPageId.get(pageId)
      if (!artifact) return node
      return {
        ...node,
        lowFiWireframeArtifact: artifact,
        pageLayoutArtifact: {
          ...(node.pageLayoutArtifact || {}),
          lowFiWireframeArtifact: artifact
        }
      }
    })
    return {
      ...totalDesignFlow,
      stageCanvases: {
        ...(totalDesignFlow.stageCanvases || {}),
        'interaction-lofi': {
          ...canvas,
          nodes
        }
      }
    }
  }
  const advancedUxMarkdownStatus = (hooks = {}, status = '', label = '', extra = {}) => {
    if (typeof hooks.onStatus !== 'function') return
    hooks.onStatus({
      status,
      label,
      phase: 'advanced-ux-markdown',
      ...extra
    })
  }
  const advancedUxRepairState = ({ status = '', attempt = 0, maxAttempts = 2, issues = [], previousIssueCount = 0 } = {}) => ({
    status,
    attempt,
    maxAttempts,
    previousIssueCount,
    remainingIssueCount: Array.isArray(issues) ? issues.length : 0,
    issues: Array.isArray(issues) ? issues : []
  })
  const normalizeAdvancedUxMarkdownOutput = (markdown = '') =>
    normalizeAdvancedUxTopLabels(splitAdvancedUxUserStoryTables(markdown))
  const generateAdvancedUxMarkdownReport = async (payload = {}, hooks = {}) => {
    const provider = resolveAgentProvider()
    if (!provider || provider.name === 'deterministic' || typeof provider.generate !== 'function') {
      throw advancedUxMarkdownFailure('未配置可用模型，无法生成高级 UX Markdown。')
    }
    const [frameworkMarkdown, outputStandardMarkdown, referenceExampleMarkdown] = await Promise.all([
      readAdvancedUxFrameworkMarkdown(),
      readUxDocOutputStandardMarkdown(),
      readOptionalMarkdownFile(advancedUxReferenceExamplePath())
    ])
    const webSearchEnabled = payload.webSearchEnabled !== false
    const evidencePack = await buildAdvancedUxWebEvidencePack({ ...payload, webSearchEnabled }, {
      fetchImpl: options.fetchImpl || globalThis.fetch
    })
    const timeoutMs = advancedUxNoTimeoutMs()
    try {
      advancedUxMarkdownStatus(hooks, 'generating', '正在按高级 UX 框架生成 Markdown')
      const modelResult = await withTimeout(
        provider.generate({
          ...advancedUxDirectMarkdownPrompt(payload, frameworkMarkdown, outputStandardMarkdown, referenceExampleMarkdown, evidencePack),
          model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model),
          timeoutMs
        }),
        timeoutMs,
        '高级 UX 分析 Markdown 生成超时'
      )
      let markdown = extractMarkdownReplyText(modelResult?.content || modelResult?.markdown || modelResult?.text || '')
      if (!markdown) throw advancedUxMarkdownFailure('模型没有返回可用的高级 UX Markdown。')
      advancedUxMarkdownStatus(hooks, 'checking', '正在检查高级 UX Markdown 输出规范')
      const completionResult = await withTimeout(
        provider.generate({
          ...advancedUxMarkdownCompletenessPrompt(payload, markdown, [], evidencePack),
          model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model),
          timeoutMs
        }),
        timeoutMs,
        '高级 UX Markdown 完整性自检超时'
      )
      const completedMarkdown = extractMarkdownReplyText(completionResult?.content || completionResult?.markdown || completionResult?.text || '')
      if (completedMarkdown) markdown = completedMarkdown
      markdown = normalizeAdvancedUxMarkdownOutput(markdown)
      let qualityIssues = advancedUxMarkdownQualityIssues(markdown, evidencePack)
      let repairState = advancedUxRepairState({ status: qualityIssues.length ? 'pending' : 'passed', issues: qualityIssues })
      if (qualityIssues.length) {
        const maxRepairAttempts = 2
        for (let attempt = 1; attempt <= maxRepairAttempts && qualityIssues.length; attempt += 1) {
          const currentIssues = qualityIssues
          const repairStatus = attempt === 1 ? 'repairing' : 'retrying'
          const repairLabel = attempt === 1
            ? `发现 ${currentIssues.length} 项缺失，第 1 次补齐中...`
            : `仍有 ${currentIssues.length} 项缺失，第 2 次补齐中...`
          repairState = advancedUxRepairState({
            status: repairStatus,
            attempt,
            maxAttempts: maxRepairAttempts,
            issues: currentIssues,
            previousIssueCount: currentIssues.length
          })
          advancedUxMarkdownStatus(hooks, repairStatus, repairLabel, { repairState })
          const repairResult = await withTimeout(
            provider.generate({
              ...advancedUxMarkdownCompletenessPrompt(payload, markdown, currentIssues, evidencePack),
              model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model),
              timeoutMs
            }),
            timeoutMs,
            attempt === 1 ? '高级 UX Markdown 规范补齐超时' : '高级 UX Markdown 第二次补齐超时'
          )
          const repairedMarkdown = extractMarkdownReplyText(repairResult?.content || repairResult?.markdown || repairResult?.text || '')
          if (repairedMarkdown) {
            markdown = normalizeAdvancedUxMarkdownOutput(repairedMarkdown)
          }
          repairState = advancedUxRepairState({
            status: 'rechecking',
            attempt,
            maxAttempts: maxRepairAttempts,
            issues: currentIssues,
            previousIssueCount: currentIssues.length
          })
          advancedUxMarkdownStatus(hooks, 'rechecking', '正在重新校验补齐结果', { repairState })
          qualityIssues = advancedUxMarkdownQualityIssues(markdown, evidencePack)
          repairState = advancedUxRepairState({
            status: qualityIssues.length ? 'failed' : 'passed',
            attempt,
            maxAttempts: maxRepairAttempts,
            issues: qualityIssues,
            previousIssueCount: currentIssues.length
          })
        }
      }
      if (qualityIssues.length) {
        const importError = `高级 UX Markdown 未符合输出规范：${qualityIssues.slice(0, 6).join('；')}`
        return {
          status: 'quality_failed',
          artifactType: 'requirements-markdown',
          fileName: advancedUxReportFileName(),
          markdown,
          qualityIssues,
          importError,
          repairState,
          evidencePack,
          frameworkPath: advancedUxFrameworkPath(),
          outputStandardPath: uxDocOutputStandardPath(),
          referenceExamplePath: referenceExampleMarkdown ? advancedUxReferenceExamplePath() : '',
          generatedAt: new Date().toISOString()
        }
      }
      return {
        status: 'generated',
        artifactType: 'requirements-markdown',
        fileName: advancedUxReportFileName(),
        markdown,
        repairState,
        evidencePack,
        frameworkPath: advancedUxFrameworkPath(),
        outputStandardPath: uxDocOutputStandardPath(),
        referenceExamplePath: referenceExampleMarkdown ? advancedUxReferenceExamplePath() : '',
        generatedAt: new Date().toISOString()
      }
    } catch (error) {
      if (error.code === 'ADVANCED_UX_MARKDOWN_FAILED') throw error
      throw advancedUxMarkdownFailure(error.message || '高级 UX Markdown 生成失败')
    }
  }
  const advancedUxAgentSessionReportFromRun = (run = {}) => {
    const sourceRun = run || {}
    const messages = Object.values(sourceRun.agentSessions || {}).flatMap((session) => Array.isArray(session) ? session : [])
    const message = messages
      .filter((item) => item?.meta?.action === 'advanced-ux-markdown-report' && String(item?.meta?.markdown || '').trim())
      .at(-1)
    if (!message) return null
    return {
      status: 'imported',
      artifactType: message.meta?.artifactType || 'requirements-markdown',
      fileName: message.meta?.fileName || '高级UX需求分析.md',
      markdown: message.meta.markdown,
      generatedAt: message.createdAt || message.meta?.generatedAt || ''
    }
  }
  const advancedUxReportPreviousMarkdown = (report = {}) =>
    Array.isArray(report?.previousReports)
      ? [...report.previousReports].reverse().find((item) => String(item?.markdown || '').trim())
      : null
  const mergeAdvancedUxReports = (...reports) => {
    const merged = {}
    reports.filter(Boolean).forEach((report) => {
      const normalized = { ...report }
      if (!String(normalized.markdown || '').trim()) delete normalized.markdown
      Object.assign(merged, normalized)
      if (String(report.markdown || '').trim()) merged.markdown = report.markdown
      if (report.pageInteractionDocument?.markdown) merged.pageInteractionDocument = report.pageInteractionDocument
      if (report.pageInteractionDocumentArtifact?.markdown) merged.pageInteractionDocumentArtifact = report.pageInteractionDocumentArtifact
      if (Array.isArray(report.drawioArtifacts) && report.drawioArtifacts.length) merged.drawioArtifacts = report.drawioArtifacts
      if (Array.isArray(report.lowFiWireframeArtifacts) && report.lowFiWireframeArtifacts.length) merged.lowFiWireframeArtifacts = report.lowFiWireframeArtifacts
    })
    const previousMarkdown = !String(merged.markdown || '').trim()
      ? reports.map(advancedUxReportPreviousMarkdown).find((item) => item?.markdown)
      : null
    if (previousMarkdown?.markdown) {
      merged.markdown = previousMarkdown.markdown
      merged.fileName = merged.fileName || previousMarkdown.fileName
    }
    return Object.keys(merged).length ? merged : null
  }
  const advancedUxReportFromRun = (run = {}) => {
    const sourceRun = run || {}
    return mergeAdvancedUxReports(
      sourceRun.projectBlueprint?.advancedUxReport,
      sourceRun.documentAnalysis?.totalDesignFlow?.advancedUxReport,
      sourceRun.documentAnalysis?.advancedUxReport,
      advancedUxAgentSessionReportFromRun(sourceRun)
    )
  }
  const advancedUxRepairPayloadFromRun = (run = {}, payload = {}) => ({
    ...payload,
    analysisRunId: run.id || payload.runId || payload.analysisRunId || '',
    requestId: payload.requestId || run.clientRequestId || run.id || '',
    skillSelectionMode: 'manual',
    skillId: 'advanced-ux-requirement-analysis',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    demandScope: run.demandScope || payload.demandScope || 'non-project',
    projectId: run.projectId || payload.projectId || '',
    input: payload.input || run.input || run.documentAnalysis?.input || '',
    documents: Array.isArray(payload.documents) && payload.documents.length
      ? payload.documents
      : Array.isArray(run.referenceFiles?.[ADVANCED_UX_AGENT_SCOPE_ID])
        ? run.referenceFiles[ADVANCED_UX_AGENT_SCOPE_ID]
        : Array.isArray(run.documentAnalysis?.documents)
          ? run.documentAnalysis.documents
          : []
  })
  const generateAdvancedUxMarkdownRepairReport = async (payload = {}, oldReport = {}) => {
    const provider = resolveAgentProvider()
    if (!provider || typeof provider.generate !== 'function' || provider.name === 'deterministic') {
      throw advancedUxMarkdownFailure('未配置可用模型，无法修复历史高级 UX Markdown。')
    }
    const oldMarkdown = String(oldReport.markdown || '').trim()
    if (!oldMarkdown) throw advancedUxMarkdownFailure('历史高级 UX Markdown 为空，无法修复。')
    const [frameworkMarkdown, outputStandardMarkdown] = await Promise.all([
      readAdvancedUxFrameworkMarkdown(),
      readUxDocOutputStandardMarkdown()
    ])
    const prompt = advancedUxMarkdownCompletenessPrompt(
      payload,
      oldMarkdown,
      advancedUxMarkdownQualityIssues(oldMarkdown)
    )
    const modelResult = await withTimeout(
      provider.generate({
        ...prompt,
        systemPrompt: [
          prompt.systemPrompt,
          '',
          '固定高级 UX 需求分析总框架：',
          frameworkMarkdown,
          '',
          '固定 UX 分析文档输出规范：',
          outputStandardMarkdown
        ].join('\n'),
        model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model),
        timeoutMs: advancedUxNoTimeoutMs()
      }),
      advancedUxNoTimeoutMs(),
      '高级 UX 历史 Markdown 修复超时'
    )
    let markdown = extractMarkdownReplyText(modelResult?.content || modelResult?.markdown || modelResult?.text || '')
    markdown = normalizeAdvancedUxTopLabels(splitAdvancedUxUserStoryTables(markdown))
    const qualityIssues = advancedUxMarkdownQualityIssues(markdown)
    if (qualityIssues.length) {
      throw advancedUxMarkdownFailure(`高级 UX Markdown 未符合输出规范：${qualityIssues.slice(0, 6).join('；')}`)
    }
    const previousReports = [
      ...(Array.isArray(oldReport.previousReports) ? oldReport.previousReports : []),
      {
        fileName: oldReport.fileName || '历史高级UX需求分析.md',
        markdown: oldMarkdown,
        status: oldReport.status || '',
        generatedAt: oldReport.generatedAt || '',
        preservedAt: new Date().toISOString()
      }
    ]
    return {
      ...oldReport,
      status: 'generated',
      artifactType: 'requirements-markdown',
      fileName: advancedUxReportFileName(new Date(), '-规范修正版'),
      markdown,
      sections: [],
      previousReports,
      frameworkPath: advancedUxFrameworkPath(),
      outputStandardPath: uxDocOutputStandardPath(),
      repairedFromFileName: oldReport.fileName || '',
      repairedAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      provider: modelResult?.provider || provider.name || '',
      model: modelResult?.model || payload.model || ''
    }
  }
  const repairAdvancedUxWorkflowRun = async (payload = {}) => {
    if (!options.store) {
      const error = new Error('当前环境未启用工作区存储，无法修复历史高级 UX 记录。')
      error.code = 'WORKSPACE_STORE_REQUIRED'
      throw error
    }
    const runId = String(payload.runId || payload.analysisRunId || payload.id || '').trim()
    if (!runId) {
      const error = new Error('缺少 runId，无法修复历史高级 UX 记录。')
      error.code = 'WORKFLOW_RUN_ID_REQUIRED'
      throw error
    }
    const existingRun = existingWorkflowRun(runId)
    const oldReport = advancedUxReportFromRun(existingRun)
    if (!oldReport?.markdown) throw advancedUxMarkdownFailure('该记录没有可修复的高级 UX Markdown。')
    const repairPayload = advancedUxRepairPayloadFromRun(existingRun, payload)
    const progressResult = advancedUxProgressResult(repairPayload)
    const repairedReport = await generateAdvancedUxMarkdownRepairReport(repairPayload, oldReport)
    const baseTotalDesignFlow = existingRun.documentAnalysis?.totalDesignFlow || progressResult.totalDesignFlow || {}
    const importedTotalDesignFlow = importAdvancedUxMarkdownReportToTotalFlow(baseTotalDesignFlow, repairedReport)
    const importedReport = importedTotalDesignFlow.advancedUxReport || repairedReport
    const analysis = advancedUxMarkdownAnalysisResult(repairPayload, importedReport, importedTotalDesignFlow)
    const updatedRun = await persistAdvancedUxWorkflowRun(repairPayload, analysis, 'analyzed')
    return {
      status: 'repaired',
      run: updatedRun,
      report: importedReport,
      analysis
    }
  }
  const advancedUxMarkdownAnalysisResult = (payload = {}, report = {}, totalDesignFlow = null) => {
    const reportStatus = String(report.status || '').trim()
    const isFailedReport = ['failed', 'quality_failed', 'import_failed'].includes(reportStatus)
    return {
    status: 'analyzed',
    requestedSkillId: 'advanced-ux-requirement-analysis',
    resolvedSkillId: 'advanced-ux-requirement-analysis',
    skillId: 'advanced-ux-requirement-analysis',
    displaySkillName: '高级 UX 需求分析',
    input: payload.input || '',
    documents: Array.isArray(payload.documents) ? payload.documents : payload.files || [],
    routing: {
      requestedSkillId: 'advanced-ux-requirement-analysis',
      resolvedSkillId: 'advanced-ux-requirement-analysis',
      displaySkillName: '高级 UX 需求分析',
      detectedIntent: 'requirement-analysis',
      routingReason: '用户手动选择高级 UX 需求分析，后端按固定框架文档直接生成 Markdown。'
    },
    advancedUxReport: report,
    ...(totalDesignFlow ? { totalDesignFlow } : {}),
    generation: {
      status: isFailedReport ? 'failed' : 'generated',
      content: report.markdown || '',
      rawContent: report.markdown || '',
      ...(isFailedReport ? { message: report.importError || '高级 UX Markdown 未通过质量门禁' } : {}),
      provider: 'model',
      model: payload.model || ''
    },
    canvas: totalDesignFlow?.stageCanvases?.['requirement-dissection']
      ? {
          ...(totalDesignFlow.stageCanvases['requirement-dissection'] || {}),
          title: isFailedReport ? '高级 UX Markdown 未通过质量门禁' : '高级 UX 需求分析',
          summary: isFailedReport
            ? 'Markdown 文件已生成，但未通过质量门禁，暂未导入画布。'
            : '高级 UX Markdown 已生成并导入 10 个画布节点。',
          canvasType: 'advanced-ux-requirement-canvas'
        }
      : {
          title: '高级 UX Markdown',
          summary: '高级 UX 需求分析 Markdown 已生成。',
          canvasType: 'document-artifact',
          nodes: [
            {
              id: 'advanced-ux-markdown-report',
              title: report.fileName || '高级 UX 需求分析.md',
              summary: 'Markdown 文件已生成，可在 Agent 对话中查看。',
              content: ['高级 UX 需求分析 Markdown 已生成。'],
              x: 120,
              y: 140,
              width: 420,
              height: 220,
              loading: false,
              artifactStatus: 'generated',
              artifactType: 'requirements-markdown'
            }
          ],
          edges: [],
          orderedTabs: [{ key: 'advanced-ux-markdown-report', label: 'Markdown 文件' }]
        },
    qualityGate: {
      score: 100,
      checks: [
        {
          id: 'advanced-ux-markdown',
          label: '高级 UX Markdown',
          passed: true,
          severity: 'info',
          detail: '模型已按高级 UX 框架生成 Markdown 主产物。'
        }
      ]
    }
    }
  }
  const advancedUxMarkdownPrompt = (payload = {}, result = {}) => ({
    systemPrompt: [
      '你是高级 UX 需求分析专家。',
      '请基于高级 UX 需求分析 Markdown 框架、用户需求、已解析文档和当前结构化分析，直接输出一份 Markdown 报告。',
      '必须只输出 Markdown，不要输出 JSON、代码块或解释前后缀。',
      `必须包含且仅用以下 10 个二级标题：${ADVANCED_UX_CURRENT_SECTION_LIST}。`,
      '不得使用旧二级标题：## 需求理解、## 需求拆解、## 风险假设、## 流程与信息架构、## 机会与方案、## 优先级与分期、## 交付与验收。',
      '每个二级标题下必须使用固定三级标题协议，便于后端导入画布详情块。',
      '原始需求分析必须包含：### 1. 原始需求复述、### 2. 需求理解清单、### 3. 需求清晰度评分、### 4. GWT 功能行为（Given / When / Then）、### 5. 5 Whys 根因追溯、### 6. 完整性深度检查（5维度）、### 7. 完整性缺口清单、### 8. 待确认事项、### 9. 下一步判断。',
      '需求理解清单必须放在原始需求复述/原始诉求识别之后、需求清晰度评分之前，并使用 Markdown 表格覆盖需求要素、理解转译、置信度、依据，至少 6 行。',
      '设计问题定义必须包含：### 1. 功能点总览、### 2. 功能点详情、### 3. HMW 问题、### 4. 设计目标、### 5. 成功判断标准；功能点总览表格不要使用“用户故事”单列，必须拆成 As a、I want to、so that 三个字段；功能点详情用 #### 功能点 N：名称，并包含类型、As a、I want to、so that、功能描述、体验验收标准、补充体验要求、依赖关系、优先级判断、置信度。',
      '功能点详情字段必须拆细：补充体验要求下面必须有“边界条件”“信息表达”；依赖关系下面必须有“前置依赖”“被依赖”；优先级判断下面必须有“用户价值”“实现复杂度”“建议优先级”。',
      '用户与场景必须包含：### 1. 目标用户、### 2. 使用场景、### 3. 标准 Journey Map、### 4. 用户任务链路、### 5. 情绪与痛点、### 6. 假设清单、### 7. 体验风险清单；Journey Map 表头必须覆盖阶段、触点、用户行为、情绪、痛点、机会点、证据/置信度。',
      '假设与验证必须包含：### 1. 假设分类总表、### 2. 高风险假设聚焦、### 3. 假设回检点；假设分类总表表头必须覆盖假设内容、分类、来源追溯、不成立的影响、验证方式、置信度、当前状态；高风险假设聚焦表头必须覆盖高风险假设、置信度、降级策略、触发验证的时间节点。',
      '设计机会必须包含：### 1. 设计机会总表、### 2. 优先 Top 3-5 机会、### 3. 机会→步骤映射；设计机会总表表头必须覆盖机会描述、类型、上游依据、可承接步骤、预期价值、优先级；Top 机会表头必须覆盖排序、机会编号、机会描述、优先理由、设计方向提示；映射表头必须覆盖机会编号、承接步骤、承接方式。',
      '整体交互链路必须包含：### 1. 用户流程图、### 2. 业务流程图、### 3. 页面三件套、### 4. 弹窗与抽屉定义表、### 5. 信息架构、### 6. 状态机表格、### 7. 状态迁移图、### 8. 迁移规则表、### 9. 低保真线框图、### 10. 关键断点与优化节点；流程图和线框图必须用 text 代码块表示。',
      '用户流程图和业务流程图不能只输出一行箭头串，必须分别放入 ```text 代码块，使用多行 ASCII 流程图表达；用户流程图至少包含主路径、关键决策/分支、异常回退、用户心理/意图；业务流程图至少包含用户动作、系统处理、外部依赖或后台处理、状态变化、失败/重试路径。所有节点名称都必须来自当前项目，不得套用固定行业示例。',
      '信息架构表格必须包含“信息实体、核心属性、关系/依赖、状态/流转、设计提示”五列；全量小程序/App/网站需求默认输出 10-14 个信息实体，除非当前输入明确只是单点功能优化。',
      '信息架构不能写死任何行业模板；必须基于当前需求动态推导，并用抽象覆盖面自检是否遗漏：用户/身份、核心业务对象、配置/规格、任务或交易容器、状态对象、结算或确认记录、凭证/码/证书/确认材料、权益/激励、通知/消息、评价/反馈/支持、运营配置/审核、位置/服务资源。不适用的覆盖面可以跳过，但要让已输出实体能支撑功能点、流程、风险和验收。',
      '关键断点与优化节点表格必须包含“节点、可能断点、用户影响、优化建议、置信度”五列；节点必须写成“当前项目阶段-具体动作/场景”，不能只写单点页面名、模块名或入口名；全量小程序/App/网站默认输出 8-12 个断点节点，并覆盖当前项目的主路径阶段、关键对象生命周期、异常路径、回流路径；不适用的路径类型要跳过。',
      '页面三件套必须分别输出页面总览表、页面流转表、页面框架表；弹窗与抽屉定义表必须覆盖编号、名称、触发动作、关闭行为、提交/取消去向、关联页面。',
      '状态迁移图必须用 ```text 代码块输出 ST0→ST1→ST2 形式；低保真线框图必须至少输出 1 个关键页面 ASCII 线框，不能只写“待生成”。',
      '三套设计方案必须包含：### 1. 机会总览、### 2. 方案一、### 3. 方案二、### 4. 方案三、### 5. 方案对比矩阵、### 6. 三方案对比说明、### 7. 关键节点低保真对比、### 8. 关键交互流程（Top 3 优先机会）、### 9. 优先方案收敛（Top 3）。关键节点低保真对比禁止把方案A/方案B/方案C挤在同一个 ASCII 代码块；每个方案单独一个 ```text 代码块，并在后面追加差异表。',
      '关键交互流程（Top 3 优先机会）必须包含 3 个四级标题：#### Top 1：当前项目方案名、#### Top 2：当前项目方案名、#### Top 3：当前项目方案名；每个 Top 下用表格表达状态流转、界面/触点跳转、关键反馈、异常/回退路径、低保真描述。字段名称可以根据项目调整，但这 5 类语义必须出现。',
      '优先方案收敛表格必须包含“Top、方案、理由、用户行为依据、建议落点、置信度”；Top 字段必须写成“Top 1：方案名称 / Top 2：方案名称 / Top 3：方案名称”，不要只写 1、2、3。',
      '异常流补充必须包含：### 1. 异常流总览、### 2. 失败路径、### 3. 空态/权限/网络/未保存返回、### 4. 恢复动作、### 5. 待确认风险。',
      '推荐方案建议必须包含：### 1. Problem-Solution Fit 验证、### 2. 六顶思考帽评审、### 3. 推荐方案、### 4. 决策依据、### 5. 假设回检、### 6. 交付物清单、### 7. 验收标准、### 8. 开发对接Checklist、### 9. 数据埋点方案、### 10. 上线后验证计划、### 11. 页面交互文档产物规划。',
      '设计优先级与分阶段计划必须包含：### 1. 优先级排序总览、### 2. 分期交付计划、### 3. 待确认决策；优先级排序总览表头必须覆盖功能/机会、用户价值、业务价值、实施成本、综合优先级、分期建议；分期交付计划表头必须覆盖阶段、范围、核心目标、交付物、验证标准、预计周期；待确认决策表头必须覆盖决策事项、影响范围、需要谁确认、确认时限、不确认的影响。',
      '页面交互文档产物规划必须明确下一产物文件名为“[产品名]-页面交互框架与说明.md”，逐页文档包含页面定位、页面框架、交互规则、异常状态；每页交互规则不少于 5 条，且写清系统反馈；异常状态覆盖加载中、空状态、错误态、无权限和业务异常。',
      '必须包含页面交互规则表格（用户操作、系统反馈、备注）、异常状态表格（状态、表现、处理方式）、全局交互规范 7 类（加载状态、Toast、空状态、网络异常、弹窗规范、表单规范、返回/导航），每类按规则 / 示例 / 例外表达。',
      '低保真线框图规划必须包含核心页面每页 1 张、单张生成、不一次生成多张；灰度色值 #F5F5F5、#CCCCCC、#E0E0E0、#D0D0D0、#666666、#999999；禁止使用任何品牌色、禁止出现真实文案、禁止出现真实图片、禁止使用装饰性元素、禁止混合不同设备比例；验收包含“区域数量与框架表格中的区域一致”。',
      'Draw.io 只写真实产物状态和触发条件：流程 >8 步或分支 >3 层时才需要 Draw.io 流程图；状态 >5 个或分支复杂时才需要 Draw.io 状态图；未实际生成 .drawio/.xml 不得写“已生成”。',
      '表格必须使用标准 Markdown 表格；列表必须用短句；流程和低保真线框必须放入 ```text 代码块。',
      '证据不足时明确写低置信度和待确认，不要编造真实数据、竞品、价格或合规结论。'
    ].join('\n'),
    userPrompt: [
      `用户需求：${payload.input || result.input || '暂无输入'}`,
      '',
      `已解析文档摘要：${(Array.isArray(payload.documents) ? payload.documents : payload.files || []).map((doc) => `【${doc.name || '文档'}】${doc.text || doc.content || doc.summary || ''}`).join('\n\n') || '无'}`,
      '',
      `当前结构化分析：${JSON.stringify({
        routing: result.routing || null,
        requirementSlices: result.totalDesignFlow?.requirementSlices || [],
        pages: result.totalDesignFlow?.pages || [],
        projectFunctionMap: result.totalDesignFlow?.projectFunctionMap || null
      }).slice(0, 12000)}`
    ].join('\n'),
    maxOutputTokens: 12000
  })
  const buildAdvancedUxMarkdownReportWithModel = async (payload = {}, result = {}) => {
    const fallbackReport = buildAdvancedUxMarkdownReport({
      ...result,
      input: payload.input || result.input || result.summary || ''
    })
    const provider = resolveAgentProvider()
    if (!provider || provider.name === 'deterministic' || typeof provider.generate !== 'function') return fallbackReport
    const advancedUxMarkdownTimeoutMs = advancedUxNoTimeoutMs()
    try {
      const modelResult = await withTimeout(
        provider.generate({
          ...advancedUxMarkdownPrompt(payload, result),
          model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model),
          timeoutMs: advancedUxMarkdownTimeoutMs
        }),
        advancedUxMarkdownTimeoutMs,
        '高级 UX 分析 Markdown 生成超时'
      )
      const markdown = extractMarkdownReplyText(modelResult?.content || modelResult?.markdown || modelResult?.text || '')
      if (!markdown) return fallbackReport
      return {
        ...fallbackReport,
        status: 'generated',
        markdown,
        sections: []
      }
    } catch {
      return fallbackReport
    }
  }
  const withAdvancedUxMarkdownImport = async (payload = {}, result = {}) => {
    if (!isAdvancedUxPayload(payload, result) || !result.totalDesignFlow) return result
    const report = await buildAdvancedUxMarkdownReportWithModel(payload, result)
    return {
      ...result,
      totalDesignFlow: importAdvancedUxMarkdownReportToTotalFlow(result.totalDesignFlow, report)
    }
  }
  const fastMarkdownReplyPrompt = (payload = {}) => ({
    systemPrompt: [
      '你是大厂级产品方案助手。',
      '不要调用工具，不要读取文件，不要输出 JSON。',
      '用中文 Markdown 直接回复用户，必须包含大标题和小标题。',
      '先给完整可读方案，不要提“我正在生成”。',
      '结构建议：产品定位、核心场景、信息架构、关键流程、页面与组件、前后端分工、下一步建议。'
    ].join('\n'),
    userPrompt: [
      `用户需求：${payload.input || '暂无输入'}`,
      '',
      '请直接输出 Markdown 正文。'
    ].join('\n'),
    maxOutputTokens: 1800
  })
  const extractMarkdownReplyText = (value = '') => {
    const text = String(value || '').trim()
    if (!text) return ''
    if ((/会话级规则|启动技能|基础技能|检查仓库|读取文件|调用工具|加载必要|可解析 JSON|直接给出|使用适用|组织信息架构/.test(text) || /^我(?:会|将|先|来|可以)/.test(text)) && !/^#/.test(text)) return ''
    if (/^\s*\{[\s\S]*\}\s*$/.test(text)) {
      try {
        const parsed = JSON.parse(text)
        const extracted = parsed?.markdown || parsed?.content || parsed?.text || parsed?.reply || ''
        return extractMarkdownReplyText(extracted)
      } catch {
        return text
      }
    }
    return text
  }
  const withTimeout = async (promise, timeoutMs = 0, message = '模型调用超时') => {
    const duration = Number(timeoutMs || 0)
    if (!duration) return await promise
    let timer = null
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error(`${message}：${duration}ms`)
            error.code = 'MODEL_CALL_TIMEOUT'
            error.timeoutMs = duration
            reject(error)
          }, duration)
        })
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  const emitFastMarkdownStreamReply = async (provider, push, payload = {}, modelPayload = {}) => {
    let text = ''
    for await (const event of provider.stream(modelPayload)) {
      if (event?.type === 'status' && event.label) {
        push('status', { status: 'model', label: event.label })
      }
      if (event?.type === 'delta' && event.content) {
        const deltaText = extractMarkdownReplyText(event.content)
        if (!deltaText) continue
        text += deltaText
        payload.onAssistantMarkdownDelta?.(event.content, text)
        push('artifact', {
          type: 'workflow-model-delta',
          nodeId: 'model-generating',
          delta: deltaText,
          text,
          phase: 'assistant-markdown'
        })
      }
      if (event?.type === 'final' && event.content && !text.trim()) {
        text = extractMarkdownReplyText(event.content)
        if (text) {
          payload.onAssistantMarkdownDelta?.(text, text)
          push('artifact', {
            type: 'workflow-model-delta',
            nodeId: 'model-generating',
            delta: text,
            text,
            phase: 'assistant-markdown'
          })
        }
      }
    }
    return text.trim()
  }
  const emitFastMarkdownReply = async (push, payload = {}) => {
    const provider = resolveAgentProvider()
    const canStream = typeof provider?.stream === 'function'
    const canGenerate = typeof provider?.generate === 'function'
    if (!provider || (!canStream && !canGenerate) || provider.name === 'deterministic') return ''
    const modelPayload = {
      ...payload,
      ...fastMarkdownReplyPrompt(payload),
      responseFormat: 'markdown',
      model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model),
      timeoutMs: payload.timeoutMs ?? options.timeoutMs ?? 0
    }
    try {
      push('status', { status: 'model', label: '正在生成主对话回复' })
      if (canStream) {
        try {
          const streamedText = await emitFastMarkdownStreamReply(provider, push, payload, modelPayload)
          if (streamedText) return streamedText
        } catch (error) {
          if (!canGenerate) throw error
        }
      }
      if (!canGenerate) return ''
      const reply = await provider.generate(modelPayload)
      const text = extractMarkdownReplyText(reply?.content || '')
      if (!text) return ''
      push('artifact', {
        type: 'workflow-model-delta',
        nodeId: 'model-generating',
        delta: text,
        text,
        phase: 'assistant-markdown'
      })
      return text
    } catch (error) {
      push('status', { status: 'model', label: '主对话回复暂未返回，继续生成画布' })
      return ''
    }
  }
  const totalFlowMeta = (totalDesignFlow = null) => {
    if (!totalDesignFlow) return null
    const {
      stageCanvases,
      stageStatuses,
      ...rest
    } = totalDesignFlow
    void stageCanvases
    void stageStatuses
    return {
      ...rest,
      stageCanvases: {},
      stageStatuses: stageStatuses || {}
    }
  }
  const stagePayload = (totalDesignFlow = null, stageId = '') =>
    totalDesignFlow?.stageCanvases?.[stageId] || { nodes: [], edges: [], orderedTabs: [] }
  const advancedUxProgressResult = (payload = {}) => analyzeRequirementDocuments({
    ...payload,
    totalDesignFlowMode: 'waiting-model',
    documents: Array.isArray(payload.documents) ? payload.documents : payload.files || []
  }, {
    ...options,
    skillOrchestration: resolveSkillOrchestration()
  })
  const pushAdvancedUxGeneratingCanvas = (push, progressResult = {}) => {
    const totalDesignFlow = progressResult.totalDesignFlow || null
    const stageId = 'requirement-dissection'
    const stageCanvas = stagePayload(totalDesignFlow, stageId)
    push('artifact', {
      type: 'workflow-stage-canvas',
      stageId,
      stage: { id: stageId, name: '需求分析' },
      status: 'generating',
      stageCanvas,
      totalFlowMeta: totalFlowMeta(totalDesignFlow),
      totalDesignFlow,
      advancedUxReport: totalDesignFlow?.advancedUxReport || null
    })
  }
  const existingWorkflowRun = (runId = '') => {
    if (!options.store || !runId) return null
    try {
      return getWorkflowRun(options.store, runId)
    } catch {
      return null
    }
  }
  const workflowRunIdFromStagePayload = (payload = {}) =>
    String(payload.analysisRunId || payload.runId || payload.id || payload.currentTotalDesignFlow?.analysisRunId || '').trim()
  const advancedUxTotalDesignFlowFromStagePayload = (payload = {}) => {
    const currentTotalDesignFlow = payload.currentTotalDesignFlow || {}
    const run = existingWorkflowRun(workflowRunIdFromStagePayload(payload))
    const storedTotalDesignFlow = run?.documentAnalysis?.totalDesignFlow || {}
    const report = mergeAdvancedUxReports(
      advancedUxReportFromRun(run),
      storedTotalDesignFlow.advancedUxReport,
      currentTotalDesignFlow.advancedUxReport,
      payload.advancedUxReport
    )
    return {
      ...storedTotalDesignFlow,
      ...currentTotalDesignFlow,
      stages: currentTotalDesignFlow.stages || storedTotalDesignFlow.stages,
      stageCanvases: {
        ...(storedTotalDesignFlow.stageCanvases || {}),
        ...(currentTotalDesignFlow.stageCanvases || {})
      },
      ...(report ? { advancedUxReport: report } : {})
    }
  }
  const advancedUxPageInteractionDocumentFromStagePayload = (payload = {}) => {
    const totalDesignFlow = advancedUxTotalDesignFlowFromStagePayload(payload)
    return {
      totalDesignFlow,
      pageInteractionDocument: advancedUxPageInteractionDocumentFromFlow(totalDesignFlow, { onlyUsable: true })
    }
  }
  const mergeAdvancedUxAgentMessages = (existing = [], additions = []) => {
    const merged = Array.isArray(existing) ? [...existing] : []
    additions.filter(Boolean).forEach((message) => {
      const key = message?.meta?.clientMessageId || message?.id || ''
      const index = key
        ? merged.findIndex((item) => (item?.meta?.clientMessageId || item?.id || '') === key)
        : -1
      if (index >= 0) {
        merged[index] = {
          ...merged[index],
          ...message,
          id: merged[index].id || message.id,
          createdAt: merged[index].createdAt || message.createdAt,
          content: message.content || merged[index].content,
          meta: {
            ...(merged[index].meta || {}),
            ...(message.meta || {})
          }
        }
        return
      }
      merged.push(message)
    })
    return merged
  }
  const advancedUxUserMessage = (payload = {}) => ({
    id: `${payload.analysisRunId || payload.requestId || 'advanced-ux'}-entry-user`,
    role: 'user',
    content: payload.input || '高级 UX 需求分析',
    createdAt: new Date().toISOString(),
    meta: {
      action: 'workflow-analysis-input',
      source: 'user',
      clientMessageId: `${payload.analysisRunId || payload.requestId || 'advanced-ux'}-entry-user`
    }
  })
  const advancedUxGeneratingAssistantMessage = (payload = {}) => ({
    id: `${payload.analysisRunId || payload.requestId || 'advanced-ux'}-advanced-ux-markdown-report`,
    role: 'assistant',
    content: '正在生成高级 UX 分析 Markdown',
    createdAt: new Date().toISOString(),
    meta: {
      action: 'advanced-ux-markdown-report',
      source: 'model',
      transient: true,
      status: 'generating',
      statusLabel: '生成 Markdown',
      clientMessageId: `${payload.analysisRunId || payload.requestId || 'advanced-ux'}-advanced-ux-markdown-report`,
      artifactType: 'requirements-markdown'
    }
  })
  const advancedUxMarkdownAssistantMessage = (payload = {}, report = {}) => {
    const markdown = String(report.markdown || '').trim()
    if (!markdown) return null
    const pageInteractionDocument = report.pageInteractionDocument?.markdown ? report.pageInteractionDocument : null
    const text = advancedUxMarkdownReportDisplayText(report)
    const reportStatus = String(report.status || '').trim()
    const isFailedReport = ['failed', 'quality_failed', 'import_failed'].includes(reportStatus)
    const drawioArtifacts = Array.isArray(report.drawioArtifacts)
      ? report.drawioArtifacts.filter((artifact) => artifact?.content)
      : []
    const lowFiWireframeArtifacts = Array.isArray(report.lowFiWireframeArtifacts)
      ? report.lowFiWireframeArtifacts.filter((artifact) => artifact?.imageDataUrl || artifact?.imageUrl)
      : []
    return {
      id: `${payload.analysisRunId || payload.requestId || 'advanced-ux'}-advanced-ux-markdown-report`,
      role: 'assistant',
      content: text,
      createdAt: report.generatedAt || new Date().toISOString(),
      meta: {
        action: 'advanced-ux-markdown-report',
        hideStatus: true,
        source: 'model',
        transient: false,
        status: isFailedReport ? 'failed' : 'success',
        statusLabel: isFailedReport ? '未通过门禁' : '生成完成',
        typewriterDone: true,
        fileName: report.fileName || '',
        artifactType: report.artifactType || 'requirements-markdown',
        markdown,
        reportStatus,
        importError: report.importError || '',
        qualityIssues: Array.isArray(report.qualityIssues) ? report.qualityIssues : [],
        ...(report.repairState ? { repairState: report.repairState } : {}),
        ...(report.evidencePack ? { evidencePack: report.evidencePack } : {}),
        ...(pageInteractionDocument ? { pageInteractionDocument } : {}),
        ...(drawioArtifacts.length ? { drawioArtifacts } : {}),
        ...(lowFiWireframeArtifacts.length ? { lowFiWireframeArtifacts } : {}),
        clientMessageId: `${payload.analysisRunId || payload.requestId || 'advanced-ux'}-advanced-ux-markdown-report`
      }
    }
  }
  function advancedUxMarkdownReportDisplayText(report = {}) {
    const fileName = report.fileName || '高级 UX 需求分析.md'
    const status = String(report.status || '').trim()
    const issueText = String(report.importError || '').trim()
    const failed = ['failed', 'quality_failed', 'import_failed'].includes(status)
    const drawioArtifacts = Array.isArray(report.drawioArtifacts)
      ? report.drawioArtifacts.filter((artifact) => artifact?.content)
      : []
    const lowFiWireframeArtifacts = Array.isArray(report.lowFiWireframeArtifacts)
      ? report.lowFiWireframeArtifacts.filter((artifact) => artifact?.imageDataUrl || artifact?.imageUrl)
      : []
    return [
      failed
        ? `高级 UX Markdown 文件已生成，但未通过质量门禁：${fileName}`
        : `高级 UX Markdown 文件已生成：${fileName}`,
      failed && issueText ? `门禁原因：${issueText}` : '',
      failed ? '暂未导入需求分析画布，请修复或重新生成后再导入。' : '',
      !failed && drawioArtifacts.length
        ? `Draw.io 文件已生成：${drawioArtifacts.map((artifact) => artifact.fileName || artifact.label || 'Draw.io 文件').join('、')}`
        : '',
      !failed && lowFiWireframeArtifacts.length
        ? `低保真线框图已生成：${lowFiWireframeArtifacts.map((artifact) => artifact.fileName || artifact.pageName || '低保真线框图').join('、')}`
        : '',
      !failed ? '已自动导入需求分析画布，可从文件产物或节点详情查看。' : ''
    ].filter(Boolean).join('\n\n')
  }
  const advancedUxFailureAssistantMessage = (payload = {}, analysis = {}) => {
    const message = String(analysis?.generation?.message || analysis?.advancedUxReport?.importError || '').trim()
    if (!message) return null
    return {
      id: `${payload.analysisRunId || payload.requestId || 'advanced-ux'}-advanced-ux-markdown-report`,
      role: 'assistant',
      content: message,
      createdAt: new Date().toISOString(),
      meta: {
        action: 'advanced-ux-markdown-report',
        source: 'model',
        transient: false,
        status: 'failed',
        statusLabel: '生成失败',
        artifactType: 'requirements-markdown',
        clientMessageId: `${payload.analysisRunId || payload.requestId || 'advanced-ux'}-advanced-ux-markdown-report`
      }
    }
  }
  const advancedUxPageInteractionDocumentAssistantMessage = (payload = {}, document = {}) => {
    const markdown = String(document.markdown || '').trim()
    const status = String(document.status || '').trim()
    const importError = String(document.importError || document.failureReason || '').trim()
    const failed = ['failed', 'quality_failed', 'import_failed'].includes(status) || !!importError
    if (!markdown && !failed) return null
    const fileName = document.fileName || pageInteractionDocumentFileName(markdown, payload)
    const content = failed
      ? [
          `页面交互框架与说明 Markdown 生成失败：${fileName}`,
          importError ? `失败原因：${importError}` : ''
        ].filter(Boolean).join('\n\n')
      : [
          `页面交互框架与说明 Markdown 已生成：${fileName}`,
          '已自动导入交互低保画布，可从文件产物或页面节点详情查看。'
        ].join('\n\n')
    return {
      id: `${payload.analysisRunId || payload.requestId || 'advanced-ux'}-page-interaction-document`,
      role: 'assistant',
      content,
      createdAt: document.generatedAt || new Date().toISOString(),
      meta: {
        action: 'advanced-ux-page-interaction-document',
        hideStatus: true,
        source: 'model',
        transient: false,
        status: failed ? 'failed' : 'success',
        statusLabel: failed ? '生成失败' : '生成完成',
        typewriterDone: true,
        fileName,
        artifactType: document.artifactType || 'page-interaction-markdown',
        markdown,
        importError,
        clientMessageId: `${payload.analysisRunId || payload.requestId || 'advanced-ux'}-page-interaction-document`
      }
    }
  }
  const ensureAdvancedUxBackendAgentSessions = ({ payload = {}, analysis = null, sessions = {}, status = 'analyzing' } = {}) => {
    const report = analysis?.advancedUxReport || analysis?.totalDesignFlow?.advancedUxReport || {}
    const existingSession = Array.isArray(sessions?.[ADVANCED_UX_AGENT_SCOPE_ID])
      ? sessions[ADVANCED_UX_AGENT_SCOPE_ID]
      : []
    const assistantMessage = report.markdown
      ? advancedUxMarkdownAssistantMessage(payload, report)
      : status === 'failed'
        ? advancedUxFailureAssistantMessage(payload, analysis)
        : advancedUxGeneratingAssistantMessage(payload)
    return {
      ...(sessions || {}),
      [ADVANCED_UX_AGENT_SCOPE_ID]: mergeAdvancedUxAgentMessages(existingSession, [
        advancedUxUserMessage(payload),
        assistantMessage
      ])
    }
  }
  const advancedUxReferenceFiles = (payload = {}, referenceFiles = {}) => {
    const documents = Array.isArray(payload.documents) ? payload.documents : payload.files || []
    if (Array.isArray(referenceFiles?.[ADVANCED_UX_AGENT_SCOPE_ID]) && referenceFiles[ADVANCED_UX_AGENT_SCOPE_ID].length) {
      return referenceFiles
    }
    return {
      ...(referenceFiles || {}),
      [ADVANCED_UX_AGENT_SCOPE_ID]: documents
    }
  }
  const persistAdvancedUxStageWorkflowRun = async (payload = {}, totalDesignFlow = null, status = 'analyzed') => {
    const runId = workflowRunIdFromStagePayload(payload)
    if (!options.store || !runId || !totalDesignFlow) return null
    const existingRun = existingWorkflowRun(runId)
    if (!existingRun) return null
    const report = mergeAdvancedUxReports(
      advancedUxReportFromRun(existingRun),
      existingRun.documentAnalysis?.advancedUxReport,
      existingRun.documentAnalysis?.totalDesignFlow?.advancedUxReport,
      totalDesignFlow.advancedUxReport
    )
    const runPayload = {
      ...existingRun,
      id: runId,
      input: payload.input || existingRun.input || existingRun.documentAnalysis?.input || '高级 UX 需求分析',
      workflowId: 'advanced-ux-requirement-analysis',
      workflowName: '高级 UX 需求分析',
      assetType: '高级 UX 需求分析',
      requestedSkillId: 'advanced-ux-requirement-analysis',
      resolvedSkillId: 'advanced-ux-requirement-analysis',
      skillId: 'advanced-ux-requirement-analysis',
      displaySkillName: '高级 UX 需求分析',
      status,
      documentAnalysis: {
        ...(existingRun.documentAnalysis || {}),
        status,
        input: payload.input || existingRun.documentAnalysis?.input || existingRun.input || '',
        requestedSkillId: 'advanced-ux-requirement-analysis',
        resolvedSkillId: 'advanced-ux-requirement-analysis',
        skillId: 'advanced-ux-requirement-analysis',
        displaySkillName: '高级 UX 需求分析',
        ...(report ? { advancedUxReport: report } : {}),
        totalDesignFlow,
        canvas: totalDesignFlow.stageCanvases?.['requirement-dissection'] || existingRun.documentAnalysis?.canvas || null,
        generation: {
          ...(existingRun.documentAnalysis?.generation || {}),
          status: status === 'analyzing' ? 'generating' : 'generated'
        }
      },
      agentSessions: (() => {
        const sessions = { ...(existingRun.agentSessions || {}) }
        const stagePayload = {
          ...payload,
          analysisRunId: runId
        }
        if (report?.markdown) {
          sessions[ADVANCED_UX_AGENT_SCOPE_ID] = mergeAdvancedUxAgentMessages(
            sessions[ADVANCED_UX_AGENT_SCOPE_ID] || [],
            [advancedUxMarkdownAssistantMessage(stagePayload, report)]
          )
        }
        const pageInteractionDocument = report?.pageInteractionDocument?.markdown || report?.pageInteractionDocument?.status || report?.pageInteractionDocument?.importError
          ? report.pageInteractionDocument
          : totalDesignFlow?.pageInteractionDocumentArtifact?.markdown || totalDesignFlow?.pageInteractionDocumentArtifact?.status || totalDesignFlow?.pageInteractionDocumentArtifact?.importError
            ? totalDesignFlow.pageInteractionDocumentArtifact
            : null
        if (pageInteractionDocument) {
          sessions['interaction-lofi'] = mergeAdvancedUxAgentMessages(
            sessions['interaction-lofi'] || [],
            [advancedUxPageInteractionDocumentAssistantMessage(stagePayload, pageInteractionDocument)]
          )
        }
        return sessions
      })(),
      referenceFiles: advancedUxReferenceFiles(payload, existingRun.referenceFiles || {}),
      updatedAt: new Date().toISOString()
    }
    return await upsertWorkflowRun(options.store, runPayload)
  }
  const persistAdvancedUxStageGeneratingWorkflowRun = async (payload = {}, totalDesignFlow = null, stageId = '') => {
    if (!isAdvancedUxPayload(payload) || !totalDesignFlow || !stageId) return null
    const now = new Date().toISOString()
    const generatingCanvas = advancedUxStageGeneratingCanvas(stageId)
    const advancedUxReport = {
      ...(totalDesignFlow.advancedUxReport || {})
    }
    if (stageId === 'interaction-lofi') {
      advancedUxReport.pageInteractionDocument = {
        status: 'generating',
        artifactType: 'page-interaction-markdown',
        fileName: pageInteractionDocumentFileName('', payload),
        markdown: '',
        sections: [],
        qualityIssues: [],
        importError: '',
        generatedAt: now
      }
    }
    let nextFlow = {
      ...totalDesignFlow,
      currentStage: stageId,
      advancedUxReport,
      ...(stageId === 'interaction-lofi'
        ? { pageInteractionDocumentArtifact: advancedUxReport.pageInteractionDocument }
        : {}),
      stageCanvases: {
        ...(totalDesignFlow.stageCanvases || {}),
        [stageId]: generatingCanvas
      }
    }
    nextFlow = totalDesignFlowWithCurrentStageStatus(nextFlow, 'generating', { stageId })
    nextFlow = withWorkflowStageRuntime(withDownstreamStageArtifactContext(nextFlow))
    await persistAdvancedUxStageWorkflowRun(payload, nextFlow, 'analyzing')
    return nextFlow
  }
  const persistAdvancedUxWorkflowRun = async (payload = {}, analysis = null, status = 'analyzing') => {
    if (!options.store || !payload.analysisRunId || !analysis?.canvas) return null
    const existingRun = existingWorkflowRun(payload.analysisRunId)
    const agentSessions = ensureAdvancedUxBackendAgentSessions({
      payload,
      analysis,
      sessions: existingRun?.agentSessions || {},
      status
    })
    const referenceFiles = advancedUxReferenceFiles(payload, existingRun?.referenceFiles || {})
    const runPayload = {
      id: payload.analysisRunId,
      clientRequestId: payload.requestId || payload.analysisRunId,
      workflowId: 'advanced-ux-requirement-analysis',
      workflowName: '高级 UX 需求分析',
      assetType: '高级 UX 需求分析',
      input: payload.input || '高级 UX 需求分析',
      projectId: payload.projectId || '',
      demandScope: payload.demandScope || 'non-project',
      requestedSkillId: 'advanced-ux-requirement-analysis',
      resolvedSkillId: 'advanced-ux-requirement-analysis',
      skillId: 'advanced-ux-requirement-analysis',
      displaySkillName: '高级 UX 需求分析',
      routingReason: analysis.routing?.routingReason || '用户手动选择高级 UX 需求分析，后端按固定框架文档直接生成 Markdown。',
      detectedIntent: analysis.routing?.detectedIntent || 'requirement-analysis',
      projectBlueprint: analysis.blueprint || null,
      documentAnalysis: analysis,
      status,
      model: payload.model || (options.store ? getModelSettingsRaw(options.store)?.defaultModel : options.model) || '',
      agentSessions,
      referenceFiles,
      updatedAt: new Date().toISOString()
    }
    return await upsertWorkflowRun(options.store, runPayload)
  }
  const withAdvancedUxHeartbeat = async (promise, push, startedAt = Date.now(), heartbeat = {}) => {
    const heartbeatMs = Number(options.advancedUxHeartbeatMs ?? 15000)
    const timer = heartbeatMs > 0
      ? setInterval(() => {
          push('status', {
            status: 'generating',
            label: heartbeat.label || '后台仍在生成高级 UX 分析 Markdown',
            phase: heartbeat.phase || 'advanced-ux-markdown',
            elapsedMs: Date.now() - startedAt
          })
        }, heartbeatMs)
      : null
    try {
      return await promise
    } finally {
      if (timer) clearInterval(timer)
    }
  }
  const advancedUxPageInteractionDocumentFromFlow = (totalDesignFlow = null, options = {}) => {
    const onlyUsable = options.onlyUsable === true
    const candidates = [
      totalDesignFlow?.advancedUxReport?.pageInteractionDocument,
      totalDesignFlow?.pageInteractionDocumentArtifact,
      totalDesignFlow?.advancedUxReport?.pageInteractionDocumentArtifact
    ]
    return candidates.find((candidate) => {
      if (!candidate?.markdown) return false
      if (!onlyUsable) return true
      const status = String(candidate.status || '').trim()
      return !status || ['generated', 'imported'].includes(status)
    }) || null
  }
  const pageInteractionRowsAsObjects = (table = null) => {
    const headers = Array.isArray(table?.headers) ? table.headers.map(cleanMarkdownCell) : []
    return advancedUxTableFilledRows(table).map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, cleanMarkdownCell(row[index] || '')]))
    )
  }
  const pageInteractionDocumentPages = (markdown = '') => {
    const overviewPages = pageInteractionOverviewPages(markdown)
    const headingPages = pageInteractionHeadingBlocks(markdown)
    const headingMap = new Map(headingPages.map((page) => [page.id, page]))
    const pages = overviewPages.length
      ? overviewPages.map((page) => ({
          ...page,
          title: headingMap.get(page.pageId)?.title || `${page.pageId} ${page.pageName}`.trim(),
          body: headingMap.get(page.pageId)?.body || ''
        }))
      : headingPages.map((page) => ({
          pageId: page.id,
          pageName: cleanMarkdownCell(page.title.replace(/^P\d{2}\s*/, '')),
          type: '',
          module: '',
          responsibility: '',
          title: page.title,
          body: page.body || ''
        }))
    return pages.filter((page) => page.pageId && page.body)
  }
  const pageInteractionDocumentPageArtifacts = (page = {}) => {
    const tables = parseAdvancedUxMarkdownTables(page.body || '')
    const frameTable = pageInteractionFrameTable(tables)
    const interactionTable = advancedUxFirstTableWithColumns(tables, ['用户操作', '系统反馈', '备注'])
    const exceptionTable = advancedUxFirstTableWithColumns(tables, ['状态', '表现', '处理方式'])
    const frameRows = pageInteractionFrameRowsAsObjects(frameTable)
    const interactionSourceRows = pageInteractionRowsAsObjects(interactionTable)
    const exceptionRows = pageInteractionRowsAsObjects(exceptionTable)
    const interactionRows = interactionSourceRows.map((row, index) => {
      const userAction = row['用户操作'] || ''
      const systemFeedback = row['系统反馈'] || ''
      const remark = row['备注'] || ''
      return {
        id: `${page.pageId}-interaction-${index + 1}`,
        target: userAction,
        gesture: userAction,
        feedback: systemFeedback,
        result: systemFeedback,
        notes: remark,
        userAction,
        systemFeedback,
        remark
      }
    })
    const stateMatrix = exceptionRows.map((row, index) => ({
      id: `${page.pageId}-state-${index + 1}`,
      state: row['状态'] || '',
      display: row['表现'] || '',
      handling: row['处理方式'] || '',
      promptCopy: row['表现'] || '',
      recovery: row['处理方式'] || ''
    }))
    return {
      frameTable,
      interactionTable,
      exceptionTable,
      frameRows,
      interactionRows,
      stateMatrix
    }
  }
  const pageInteractionFrameRowsAsObjects = (table = null) => {
    const rows = pageInteractionRowsAsObjects(table)
    return rows.map((row) => {
      if (row['区域'] || row['内容'] || row['说明']) return row
      const regionId = row['区域编号'] || row.region_id || ''
      const regionName = row['区域名称'] || row.region_name || ''
      const regionType = row['区域类型'] || row.region_type || ''
      const position = row['位置'] || row.position || ''
      const layout = row['布局'] || row.layout || ''
      const contentSummary = row['内容摘要'] || row.content_summary || ''
      const keyElements = row['关键元素'] || row.key_elements || ''
      const interaction = row['交互'] || row.interaction || ''
      const responsive = row['响应式'] || row.responsive || ''
      const priority = row['优先级'] || row.priority || ''
      const stateVariants = row['状态变体'] || row.state_variants || ''
      return {
        ...row,
        '区域': [regionId, regionName].filter(Boolean).join(' '),
        '内容': [contentSummary, keyElements].filter(Boolean).join('；'),
        '说明': [regionType, position, layout, interaction, responsive, priority, stateVariants].filter(Boolean).join('；')
      }
    })
  }
  const pageInteractionAsciiWireframe = (page = {}, frameRows = []) => {
    const title = `${page.pageId || ''} ${page.pageName || page.title || '页面'}`.trim()
    const lines = [
      '┌────────────────────────────┐',
      `│ ${title} │`,
      '├────────────────────────────┤'
    ]
    frameRows.forEach((row, index) => {
      const area = cleanMarkdownCell(row['区域'] || `区域 ${index + 1}`)
      const content = cleanMarkdownCell(row['内容'] || '')
      const description = cleanMarkdownCell(row['说明'] || '')
      lines.push(`│ ${area}：${content || description} │`)
      if (index < frameRows.length - 1) lines.push('├────────────────────────────┤')
    })
    lines.push('└────────────────────────────┘')
    return lines.join('\n')
  }
  const pageInteractionAsciiLayoutFromBody = (body = '') => {
    const text = String(body || '')
    const afterLayoutHeading = text.match(/(?:文本布局图|文本布局示意图|ASCII)[\s\S]*?```(?:text)?\s*([\s\S]*?[┌┐└┘│][\s\S]*?)```/i)
    if (afterLayoutHeading?.[1]) return afterLayoutHeading[1].trim()
    const anyBoxCode = [...text.matchAll(/```(?:text)?\s*([\s\S]*?[┌┐└┘│][\s\S]*?)```/gi)]
      .map((match) => String(match[1] || '').trim())
      .find(Boolean)
    return anyBoxCode || ''
  }
  const pageInteractionGestureNotes = (page = {}, artifacts = {}) => {
    const source = [
      page.body,
      ...artifacts.interactionRows.map((row) => [row.userAction, row.systemFeedback, row.remark].join(' ')),
      ...artifacts.frameRows.map((row) => [row['区域'], row['内容'], row['说明']].join(' '))
    ].join(' ')
    return [
      /滚动|固定|吸底|顶部|底部/.test(source) ? '内容区域纵向滚动 → 顶部/底部固定区不跟随滚动' : '',
      /下拉|刷新/.test(source) ? '下拉手势 → 触发接口刷新页面数据' : ''
    ].filter(Boolean)
  }
  const advancedUxInteractionLofiCanvasFromPageInteractionDocument = (pageInteractionDocument = null) => {
    return buildAdvancedUxInteractionLofiCanvasFromPageInteractionDocument(pageInteractionDocument)
  }
  const totalDesignFlowWithAdvancedUxInteractionLofiCanvas = (totalDesignFlow = null, stageCanvas = null, stageId = 'interaction-lofi') => {
    if (!totalDesignFlow || !stageCanvas?.nodes?.length) return totalDesignFlow
    const nextFlow = {
      ...totalDesignFlow,
      currentStage: stageId,
      stageCanvases: {
        ...(totalDesignFlow.stageCanvases || {}),
        [stageId]: stageCanvas
      }
    }
    return withWorkflowStageRuntime(withDownstreamStageArtifactContext(nextFlow))
  }
  const advancedUxStageGeneratingCanvas = (stageId = '') => {
    const stageName = TOTAL_DESIGN_FLOW_STAGES.find((stage) => stage.id === stageId)?.name || '当前阶段'
    const labels = {
      'interaction-lofi': '正在生成页面交互框架与说明 Markdown',
      'ui-visual': '正在生成 Draw.io 和低保真线框图产物'
    }
    const title = stageName || '阶段生成'
    return {
      title,
      summary: labels[stageId] || `正在生成「${title}」阶段产物`,
      canvasType: 'advanced-ux-stage-generating',
      layoutRule: 'single-loading',
      nodes: [
        {
          id: `advanced-ux-${stageId || 'stage'}-generating`,
          stageId,
          title,
          summary: labels[stageId] || `正在生成「${title}」阶段产物`,
          content: [
            labels[stageId] || `正在生成「${title}」阶段产物`,
            '完成后会自动替换为该阶段的真实产物。'
          ],
          x: 120,
          y: 140,
          width: 360,
          height: 220,
          loading: true,
          artifactStatus: 'generating',
          quickActions: []
        }
      ],
      edges: [],
      orderedTabs: [{ key: `advanced-ux-${stageId || 'stage'}-generating`, label: title }]
    }
  }
  const advancedUxStageFailedCanvas = (stageId = '', errorData = {}) => {
    const stageName = TOTAL_DESIGN_FLOW_STAGES.find((stage) => stage.id === stageId)?.name || '当前阶段'
    const message = String(errorData.message || '阶段生成失败').trim()
    const title = stageName || '阶段生成'
    return {
      title,
      summary: `${title}生成失败`,
      canvasType: 'advanced-ux-stage-failed',
      layoutRule: 'single-failed',
      status: 'failed',
      nodes: [
        {
          id: `advanced-ux-${stageId || 'stage'}-failed`,
          stageId,
          title,
          summary: `${title}生成失败`,
          content: [
            `${title}生成失败`,
            message
          ],
          x: 120,
          y: 140,
          width: 360,
          height: 220,
          loading: false,
          artifactStatus: 'failed',
          failureReason: message,
          importError: message,
          quickActions: ['重新生成该阶段']
        }
      ],
      edges: [],
      orderedTabs: [{ key: `advanced-ux-${stageId || 'stage'}-failed`, label: title }]
    }
  }
  const advancedUxDeliveryArtifactCanvas = (_drawioArtifacts = [], lowFiWireframeArtifacts = []) => {
    const artifactNodes = [
      ...lowFiWireframeArtifacts.map((artifact, index) => ({
        id: artifact.id || `advanced-ux-lowfi-${index + 1}`,
        stageId: 'ui-visual',
        title: artifact.fileName || artifact.pageName || `低保真线框图 ${index + 1}`,
        summary: artifact.pageName ? `${artifact.pageName} 低保真线框图已生成。` : '低保真线框图已生成。',
        content: [
          artifact.pageId ? `页面编号：${artifact.pageId}` : '',
          artifact.pageName ? `页面名称：${artifact.pageName}` : '',
          artifact.fileName ? `文件：${artifact.fileName}` : ''
        ].filter(Boolean),
        x: 120 + (index % 2) * 380,
        y: 140 + Math.floor(index / 2) * 260,
        width: 340,
        height: 220,
        loading: false,
        artifactStatus: 'generated',
        artifactType: 'low-fi-wireframe-image',
        imageDataUrl: artifact.imageDataUrl || '',
        imageUrl: artifact.imageUrl || '',
        sourceArtifact: { type: 'advanced-ux-lowfi-wireframe', fileName: artifact.fileName || '', pageId: artifact.pageId || '' }
      }))
    ]
    return {
      title: '低保真线框图产物',
      summary: '由页面交互框架与说明 Markdown 生成的低保真图片；Draw.io 主流程图和状态图作为全局文件产物在 Agent 文件卡展示。',
      canvasType: 'advanced-ux-delivery-artifact-canvas',
      layoutRule: 'artifact-grid',
      nodes: artifactNodes,
      edges: [],
      orderedTabs: artifactNodes.map((node) => ({ key: node.id, label: node.title }))
    }
  }
  const previousStageIdForTargetStage = (totalDesignFlow = null, stageId = '') => {
    const stages = Array.isArray(totalDesignFlow?.stages) && totalDesignFlow.stages.length
      ? totalDesignFlow.stages
      : TOTAL_DESIGN_FLOW_STAGES
    const index = stages.findIndex((stage) => stage?.id === stageId)
    return index > 0 ? stages[index - 1]?.id || '' : ''
  }
  const stageConfirmationForTargetStage = (totalDesignFlow = null, stageId = '') => {
    const previousStageId = previousStageIdForTargetStage(totalDesignFlow, stageId)
    if (!previousStageId) return null
    return totalDesignFlow?.stageConfirmations?.[previousStageId] || null
  }
  const stageConfirmationSummaryText = (confirmation = null) =>
    String(confirmation?.summary || confirmation?.action || '').trim()
  const stageConfirmationSummaryItems = (summary = '') => {
    const compact = String(summary || '')
      .replace(/\r\n/g, '\n')
      .split(/\n+/)
      .map((line) => line.replace(/^#{1,6}\s*/, '').replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
    return (compact.length ? compact : String(summary || '').split(/[。；;]/))
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 8)
  }
  const stageArtifactTargetScore = (node = {}, artifact = {}) => {
    const nodeText = [
      node?.id,
      node?.nodeId,
      node?.pageId,
      node?.sourcePageId,
      node?.title,
      node?.page,
      node?.summary,
      node?.route
    ].filter(Boolean).join(' ')
    const artifactText = [
      artifact.modelDecision,
      artifact.asciiWireframe,
      artifact.interactionDetails,
      artifact.rawText
    ].filter(Boolean).join(' ')
    let score = 0
    if (/首页|Home|Video Podcast/i.test(nodeText)) score += 30
    if (/Video Podcast|AI Video Podcast/i.test(nodeText) && /Video Podcast|AI Video Podcast/i.test(artifactText)) score += 30
    if (/快捷提示词|Topic\/input composer|Generate podcast|换一批/i.test(artifactText)) score += 30
    if (/登录|注册|Auth|弹窗|Modal|Studio|Pricing|设置|账号/i.test(nodeText)) score -= 40
    return score
  }
  const documentsWithStageConfirmation = (payload = {}, stageId = '') => {
    const documents = Array.isArray(payload.documents) ? payload.documents : payload.files || []
    const confirmation = stageConfirmationForTargetStage(payload.currentTotalDesignFlow, stageId)
    const summary = stageConfirmationSummaryText(confirmation)
    if (!summary) return documents
    if (documents.some((doc) => doc?.sourceType === 'workflow-stage-confirmation' && doc?.stageId === confirmation.stageId)) return documents
    return [
      ...documents,
      {
        id: `stage-confirmation-${confirmation.stageId || previousStageIdForTargetStage(payload.currentTotalDesignFlow, stageId)}`,
        name: `上一阶段确认总结：${confirmation.stageName || confirmation.stageId || '已确认阶段'}`,
        sourceType: 'workflow-stage-confirmation',
        stageId: confirmation.stageId || previousStageIdForTargetStage(payload.currentTotalDesignFlow, stageId),
        text: summary,
        summary
      }
    ]
  }
  const enrichStageCanvasWithConfirmationSummary = (stageCanvas = null, totalDesignFlow = null, stageId = '') => {
    const confirmation = stageConfirmationForTargetStage(totalDesignFlow, stageId)
    const summary = stageConfirmationSummaryText(confirmation)
    const items = stageConfirmationSummaryItems(summary)
    const artifact = parsePageLayoutArtifactFromText(summary)
    if (!summary || !items.length || !Array.isArray(stageCanvas?.nodes) || !stageCanvas.nodes.length) {
      return stageCanvas || { nodes: [], edges: [], orderedTabs: [] }
    }
    let artifactTargetIndex = -1
    let artifactTargetScore = 0
    if (artifact?.rawText) {
      stageCanvas.nodes.forEach((node, index) => {
        const score = stageArtifactTargetScore(node, artifact)
        if (score > artifactTargetScore) {
          artifactTargetScore = score
          artifactTargetIndex = index
        }
      })
    }
    return {
      ...stageCanvas,
      nodes: stageCanvas.nodes.map((node = {}, index) => {
        const detailSections = Array.isArray(node.detailSections) ? node.detailSections : []
        const hasConfirmationSection = detailSections.some((section) => /上一阶段确认总结|阶段确认总结/.test(String(section?.title || '')))
        const content = Array.isArray(node.content) ? node.content : []
        const confirmationContent = `上一阶段确认：${items[0]}`
        const nextNode = {
          ...node,
          stageContextSummary: summary,
          content: content.some((item) => String(item || '').includes('上一阶段确认'))
            ? content
            : [confirmationContent, ...content].slice(0, 8),
          detailSections: hasConfirmationSection
            ? detailSections
            : [
                {
                  title: '上一阶段确认总结',
                  items,
                  sourceStageId: confirmation.stageId || previousStageIdForTargetStage(totalDesignFlow, stageId),
                  source: 'workflow-stage-confirmation'
                },
                ...detailSections
              ]
        }
        if (artifact?.rawText && index === artifactTargetIndex && artifactTargetScore >= 30) {
          const pageLayoutArtifact = {
            ...(nextNode.pageLayoutArtifact || {}),
            ...artifact,
            importedFromStageConfirmation: {
              source: 'workflow-stage-confirmation',
              stageId: confirmation.stageId || previousStageIdForTargetStage(totalDesignFlow, stageId)
            }
          }
          return {
            ...nextNode,
            pageLayoutArtifact,
            interactionSpecArtifact: buildInteractionSpecArtifactFromPageLayoutArtifact(pageLayoutArtifact, {
              pageName: nextNode.title || artifact.title || '页面'
            })
          }
        }
        return nextNode
      })
    }
  }
  const stagePayloadWithGenerationContext = (totalDesignFlow = null, stageId = '') =>
    enrichStageCanvasWithConfirmationSummary(stagePayload(totalDesignFlow, stageId), totalDesignFlow, stageId)
  const totalDesignFlowWithStageGenerationContext = (generatedTotalFlow = null, currentTotalFlow = null, stageId = '') => {
    if (!generatedTotalFlow && !currentTotalFlow) return generatedTotalFlow
    const hasCurrentConfirmation = Boolean(stageConfirmationForTargetStage(currentTotalFlow, stageId))
    const currentStageCanvas = currentTotalFlow?.stageCanvases?.[stageId]
    const shouldPreserveCurrentStageCanvas = hasCurrentConfirmation &&
      Array.isArray(currentStageCanvas?.nodes) &&
      currentStageCanvas.nodes.length > 0
    const mergedFlow = {
      ...(currentTotalFlow || {}),
      ...(generatedTotalFlow || {}),
      currentStage: stageId || generatedTotalFlow?.currentStage || currentTotalFlow?.currentStage || '',
      stageConfirmations: {
        ...(currentTotalFlow?.stageConfirmations || {}),
        ...(generatedTotalFlow?.stageConfirmations || {})
      },
      stageCanvases: {
        ...(currentTotalFlow?.stageCanvases || {}),
        ...(generatedTotalFlow?.stageCanvases || {})
      }
    }
    if (stageId) {
      const targetStageCanvas = shouldPreserveCurrentStageCanvas
        ? currentStageCanvas
        : mergedFlow.stageCanvases?.[stageId]
      mergedFlow.stageCanvases = {
        ...mergedFlow.stageCanvases,
        [stageId]: enrichStageCanvasWithConfirmationSummary(
          targetStageCanvas,
          mergedFlow,
          stageId
        )
      }
    }
    return withWorkflowStageRuntime(withDownstreamStageArtifactContext(mergedFlow))
  }
  const stageStatusSnapshot = (stages = [], activeIndex = 0, activeStatus = 'generating') =>
    Object.fromEntries(stages.map((stage, index) => [
      stage.id,
      {
        status: index === activeIndex ? activeStatus : index < activeIndex ? 'completed' : 'waiting',
        updatedAt: new Date().toISOString()
      }
    ]))
  const totalDesignFlowWithCurrentStageStatus = (totalDesignFlow = null, activeStatus = 'generating', options = {}) => {
    if (!totalDesignFlow) return totalDesignFlow
    const stages = Array.isArray(totalDesignFlow.stages) && totalDesignFlow.stages.length
      ? totalDesignFlow.stages
      : TOTAL_DESIGN_FLOW_STAGES
    const requestedStageId = String(options.stageId || totalDesignFlow.currentStage || stages[0]?.id || '').trim()
    const activeIndex = Math.max(0, stages.findIndex((stage) => stage.id === requestedStageId))
    const activeStage = stages[activeIndex] || stages[0]
    return {
      ...totalDesignFlow,
      currentStage: activeStage?.id || requestedStageId,
      stageStatuses: stageStatusSnapshot(stages, activeIndex, activeStatus)
    }
  }
  const emitTotalDesignFlowStages = (push, totalDesignFlow = null, status = 'generating', options = {}) => {
    const stages = Array.isArray(totalDesignFlow?.stages) && totalDesignFlow.stages.length
      ? totalDesignFlow.stages
      : TOTAL_DESIGN_FLOW_STAGES
    stages.forEach((stage, index) => {
      const stageId = stage.id
      push('artifact', {
        type: 'workflow-stage-canvas',
        stageId,
        status,
        index,
        total: stages.length,
        stage,
        stageCanvas: stagePayload(totalDesignFlow, stageId),
        totalFlowMeta: totalFlowMeta(totalDesignFlow),
        totalDesignFlow: options.includeFullFlow ? totalDesignFlow || null : null,
        regenerate: Boolean(options.regenerate),
        regeneratedAt: options.regeneratedAt || ''
      })
    })
  }
  const emitSequentialTotalDesignFlowStages = (push, totalDesignFlow = null, status = 'generating', options = {}) => {
    const stages = Array.isArray(totalDesignFlow?.stages) && totalDesignFlow.stages.length
      ? totalDesignFlow.stages
      : TOTAL_DESIGN_FLOW_STAGES
    const requestedStageId = String(options.stageId || totalDesignFlow?.currentStage || stages[0]?.id || '').trim()
    const activeIndex = Math.max(0, stages.findIndex((stage) => stage.id === requestedStageId))
    const activeStage = stages[activeIndex] || stages[0]
    const stageId = activeStage?.id || requestedStageId
    if (!stageId) return
    push('artifact', {
      type: 'workflow-stage-canvas',
      stageId,
      status,
      index: activeIndex,
      total: stages.length,
      stage: activeStage,
      stageCanvas: stagePayload(totalDesignFlow, stageId),
      totalFlowMeta: {
        ...(totalFlowMeta(totalDesignFlow) || {}),
        currentStage: stageId,
        stageStatuses: stageStatusSnapshot(stages, activeIndex, status)
      },
      totalDesignFlow: options.includeFullFlow ? totalDesignFlow || null : null,
      regenerate: Boolean(options.regenerate),
      regeneratedAt: options.regeneratedAt || ''
    })
  }
  const noneSkillLoadingCanvas = () => ({
    title: '自由画布生成中',
    summary: '模型正在根据输入和上传文档生成画布节点。',
    canvasType: 'mixed-board',
    layoutRule: 'top-down',
    nodes: [
      {
        id: 'model-generating',
        title: '模型分析中',
        summary: '后端正在连接模型并生成自由画布，会先展示阶段进度，再展示模型输出片段。',
        content: [
          '正在解析输入和上传文档...',
          '正在连接后端模型服务...',
          '不会套固定 Skill 模板',
          '模型返回多少节点就展示多少节点'
        ],
        x: 80,
        y: 140,
        width: 340,
        height: 220,
        loading: true,
        quickActions: []
      }
    ],
    edges: [],
    orderedTabs: [{ key: 'model-generating', label: '模型分析中' }]
  })
  const analyzeDocumentsStream = async (payload = {}, req = null, routeContext = {}) => {
    const events = []
    const push = (event, data = {}) => {
      const chunk = sseEvent(event, data)
      events.push(chunk)
      try {
        routeContext.writeEvent?.(chunk)
      } catch {
        // The browser may refresh or close the SSE connection while the model is still running.
        // Keep the backend generation alive so the workflow run can be persisted and restored.
      }
    }
    push('status', { status: 'parsing', label: '解析上传文档' })
    if (isAdvancedUxPayload(payload)) {
      const progressResult = advancedUxProgressResult(payload)
      pushAdvancedUxGeneratingCanvas(push, progressResult)
      const progressAnalysis = advancedUxMarkdownAnalysisResult(
        payload,
        progressResult.totalDesignFlow?.advancedUxReport || {},
        progressResult.totalDesignFlow || null
      )
      await persistAdvancedUxWorkflowRun(payload, progressAnalysis, 'analyzing')
      try {
        push('status', { status: 'generating', label: '正在按高级 UX 框架生成 Markdown' })
        const report = await withAdvancedUxHeartbeat(
          generateAdvancedUxMarkdownReport(payload, {
            onStatus: (statusEvent) => push('status', statusEvent)
          }),
          push,
          Date.now()
        )
        push('artifact', {
          type: 'advanced-ux-markdown-report',
          ...report
        })
        if (report.status === 'quality_failed') {
          const failedTotalDesignFlowBase = failAdvancedUxMarkdownGenerationInTotalFlow({
            ...(progressResult.totalDesignFlow || {}),
            advancedUxReport: {
              ...(progressResult.totalDesignFlow?.advancedUxReport || {}),
              ...report
            }
          }, report.importError)
          const failedReport = {
            ...(failedTotalDesignFlowBase.advancedUxReport || {}),
            ...report,
            status: 'quality_failed'
          }
          const failedTotalDesignFlow = {
            ...failedTotalDesignFlowBase,
            advancedUxReport: failedReport
          }
          const analysis = {
            ...advancedUxMarkdownAnalysisResult(payload, failedReport, failedTotalDesignFlow),
            status: 'failed',
            generation: {
              status: 'failed',
              content: report.markdown || '',
              rawContent: report.markdown || '',
              message: report.importError || '高级 UX Markdown 未通过质量门禁',
              provider: 'model',
              model: payload.model || ''
            }
          }
          await persistAdvancedUxWorkflowRun(payload, analysis, 'failed')
          push('artifact', {
            type: 'workflow-analysis',
            blueprint: progressResult.blueprint || null,
            canvas: analysis.canvas,
            aiSummary: null,
            generation: analysis.generation,
            advancedUxReport: failedReport,
            totalDesignFlow: failedTotalDesignFlow,
            routing: analysis.routing
          })
          push('done', analysis)
          return {
            contentType: 'text/event-stream; charset=utf-8',
            body: events.join('')
          }
        }
        let importedTotalDesignFlow = importAdvancedUxMarkdownReportToTotalFlow(progressResult.totalDesignFlow || {}, report)
        let importedReport = importedTotalDesignFlow.advancedUxReport || report
        const analysis = advancedUxMarkdownAnalysisResult(payload, importedReport, importedTotalDesignFlow)
        await persistAdvancedUxWorkflowRun(payload, analysis, 'analyzed')
        push('artifact', {
          type: 'workflow-analysis',
          blueprint: progressResult.blueprint || null,
          canvas: analysis.canvas,
          aiSummary: null,
          generation: analysis.generation,
          advancedUxReport: importedReport,
          totalDesignFlow: importedTotalDesignFlow,
          routing: analysis.routing
        })
        push('done', analysis)
      } catch (error) {
        const errorData = {
          message: error.message || '高级 UX Markdown 生成失败',
          code: error.code || 'ADVANCED_UX_MARKDOWN_FAILED',
          recoveryActions: error.recoveryActions || ['检查模型配置', '重新分析文档']
        }
        push('error', errorData)
        const failedAnalysis = {
          status: 'failed',
          requestedSkillId: 'advanced-ux-requirement-analysis',
          resolvedSkillId: 'advanced-ux-requirement-analysis',
          skillId: 'advanced-ux-requirement-analysis',
          displaySkillName: '高级 UX 需求分析',
          input: payload.input || '',
          documents: Array.isArray(payload.documents) ? payload.documents : payload.files || [],
          advancedUxReport: {
            status: 'failed',
            artifactType: 'requirements-markdown',
            fileName: advancedUxReportFileName(),
            markdown: '',
            frameworkPath: advancedUxFrameworkPath(),
            outputStandardPath: uxDocOutputStandardPath(),
            importError: errorData.message,
            generatedAt: new Date().toISOString()
          },
          generation: {
            status: 'failed',
            message: errorData.message
          },
          canvas: {
            title: '高级 UX Markdown 生成失败',
            summary: errorData.message,
            canvasType: 'document-artifact',
            nodes: [
              {
                id: 'advanced-ux-markdown-report',
                title: '高级 UX Markdown 生成失败',
                summary: errorData.message,
                content: [
                  errorData.message,
                  ...errorData.recoveryActions.map((action) => `恢复动作：${action}`)
                ],
                x: 120,
                y: 140,
                width: 420,
                height: 220,
                loading: false,
                artifactStatus: 'failed',
                artifactType: 'requirements-markdown',
                quickActions: errorData.recoveryActions
              }
            ],
            edges: [],
            orderedTabs: [{ key: 'advanced-ux-markdown-report', label: 'Markdown 失败' }]
          }
        }
        await persistAdvancedUxWorkflowRun(payload, failedAnalysis, 'failed')
        push('done', failedAnalysis)
      }
      return {
        contentType: 'text/event-stream; charset=utf-8',
        body: events.join('')
      }
    }
    try {
      const progressResult = analyzeRequirementDocuments({
        ...payload,
        totalDesignFlowMode: 'waiting-model',
        documents: Array.isArray(payload.documents) ? payload.documents : payload.files || []
      }, {
        ...options,
        skillOrchestration: resolveSkillOrchestration()
      })
      const progressCanvas = isNoSkillPayload(payload)
        ? noneSkillLoadingCanvas()
        : progressResult.canvas || {}
      const progressNodes = Array.isArray(progressCanvas.nodes) ? progressCanvas.nodes : []
      push('artifact', {
        type: 'workflow-canvas-meta',
        canvas: {
          ...progressCanvas,
          nodes: [],
          edges: Array.isArray(progressCanvas.edges) ? progressCanvas.edges : [],
          orderedTabs: Array.isArray(progressCanvas.orderedTabs) ? progressCanvas.orderedTabs : []
        },
        totalFlowMeta: totalFlowMeta(progressResult.totalDesignFlow || null),
        totalDesignFlow: null,
        total: progressNodes.length
      })
      if (!isNoSkillPayload(payload) && isTotalDesignFlowPayload(payload)) {
        emitSequentialTotalDesignFlowStages(push, progressResult.totalDesignFlow || null, 'generating')
      }
      progressNodes.forEach((node, index) => {
        push('artifact', {
          type: 'workflow-node',
          node: {
            ...node,
            loading: node.loading === true
          },
          index,
          total: progressNodes.length
        })
      })
      push('artifact', {
        type: 'workflow-analysis-progress',
        blueprint: isNoSkillPayload(payload) ? null : progressResult.blueprint || null,
        canvas: progressCanvas,
        totalFlowMeta: totalFlowMeta(progressResult.totalDesignFlow || null),
        totalDesignFlow: null,
        routing: progressResult.routing || null
      })
      push('status', { status: 'generating', label: isNoSkillPayload(payload) ? '正在请求模型分析文档并生成自由画布' : '正在用模型增强分析结果' })
      let heartbeatTimer = null
      let heartbeatStep = 0
      const stopHeartbeat = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
      if (isNoSkillPayload(payload)) {
        const heartbeatTexts = [
          '已连接后端模型服务，正在把需求和文档上下文发送给模型。',
          '模型正在组织自由画布 JSON，会先判断大标题、小标题和节点关系。',
          '正在等待模型首段输出；完成后会自动转成画布节点。',
          '模型仍在生成中，当前不会使用固定模板或历史缓存结果。'
        ]
        push('artifact', {
          type: 'workflow-model-delta',
          nodeId: 'model-generating',
          delta: heartbeatTexts[0],
          text: heartbeatTexts[0]
        })
        heartbeatTimer = setInterval(() => {
          heartbeatStep += 1
          const text = heartbeatTexts[Math.min(heartbeatStep, heartbeatTexts.length - 1)]
          push('artifact', {
            type: 'workflow-model-delta',
            nodeId: 'model-generating',
            delta: `\n${text}`,
            text: heartbeatTexts.slice(0, heartbeatStep + 1).join('\n')
          })
        }, 8000)
      }
      let modelText = ''
      let result = null
      let hasFastReplyText = false
      const shouldEmitAssistantMarkdown = isNoSkillPayload(payload) || isTotalDesignFlowPayload(payload)
      const shouldForwardModelDelta = isNoSkillPayload(payload)
      const shouldForwardModelStatus = shouldEmitAssistantMarkdown
      const fastReplyPromise = shouldEmitAssistantMarkdown
        ? emitFastMarkdownReply(push, {
            ...payload,
            onAssistantMarkdownDelta: () => {
              hasFastReplyText = true
              stopHeartbeat()
            }
          })
        : Promise.resolve('')
      try {
        const analysisPromise = analyzeDocuments({
          ...payload,
          onModelEvent: shouldForwardModelStatus
            ? (modelEvent) => {
                if (modelEvent?.type === 'status' && modelEvent.label) {
                  push('status', { status: 'model', label: modelEvent.label })
                }
              }
            : null,
          onModelDelta: shouldForwardModelDelta
            ? (delta) => {
                if (hasFastReplyText) return
                if (!modelText) stopHeartbeat()
                modelText += delta
                push('artifact', {
                  type: 'workflow-model-delta',
                  nodeId: 'model-generating',
                  delta,
                  text: modelText
                })
              }
            : null
        })
        const [fastReplyText, analysisResult] = await Promise.all([fastReplyPromise, analysisPromise])
        if (fastReplyText) {
          stopHeartbeat()
          modelText = fastReplyText
        }
        result = analysisResult
      } finally {
        stopHeartbeat()
      }
      if (isNoSkillPayload(payload) && result.generation?.status === 'failed') {
        throw Object.assign(new Error(result.generation.fallbackReason || '模型未返回自由画布'), {
          code: 'NONE_SKILL_MODEL_REQUIRED',
          recoveryActions: ['检查模型配置', '重新分析文档']
        })
      }
      result = await withAdvancedUxMarkdownImport(payload, result)
      const canvas = result.canvas || {}
      const nodes = Array.isArray(canvas.nodes) ? canvas.nodes : []
      if (result.generation?.fallbackUsed) {
        push('status', {
          status: 'fallback',
          label: '模型未及时返回，已使用可编辑基础画布'
        })
      }
      if (!isNoSkillPayload(payload) && isTotalDesignFlowPayload(payload)) {
        result = {
          ...result,
          totalDesignFlow: totalDesignFlowWithCurrentStageStatus(result.totalDesignFlow || null, 'completed')
        }
        emitSequentialTotalDesignFlowStages(push, result.totalDesignFlow || null, 'completed')
      }
      nodes.forEach((node, index) => {
        push('artifact', {
          type: 'workflow-node',
          node: {
            ...node,
            loading: false
          },
          index,
          total: nodes.length
        })
      })
      push('artifact', {
        type: 'workflow-analysis',
        blueprint: result.blueprint || null,
        canvas,
        aiSummary: result.aiSummary || null,
        generation: result.generation || null,
        totalDesignFlow: result.totalDesignFlow || null,
        routing: result.routing || null
      })
      push('done', result)
    } catch (error) {
      const errorData = {
        message: error.message || '文档分析失败',
        code: error.code || 'DOCUMENT_ANALYSIS_STREAM_FAILED',
        recoveryActions: error.recoveryActions || ['重新分析文档', '检查模型配置']
      }
      if (isNoSkillPayload(payload)) {
        push('artifact', {
          type: 'workflow-node',
          node: {
            id: 'model-generating',
            title: '模型调用失败',
            summary: errorData.message,
            content: [
              errorData.message,
              ...errorData.recoveryActions.map((action) => `恢复动作：${action}`)
            ],
            x: 80,
            y: 140,
            width: 420,
            height: 260,
            loading: false,
            quickActions: errorData.recoveryActions,
            detailSections: [
              { title: '失败原因', items: [errorData.message] },
              { title: '恢复动作', items: errorData.recoveryActions }
            ]
          },
          index: 0,
          total: 1
        })
      }
      push('error', errorData)
      push('done', { error: errorData })
    }
    return {
      contentType: 'text/event-stream; charset=utf-8',
      body: events.join('')
    }
  }
  const analyzeStageStream = async (payload = {}, req = null, routeContext = {}) => {
    const stageId = String(payload.stageId || payload.regenerateStageId || '').trim()
    const stages = TOTAL_DESIGN_FLOW_STAGES
    const targetStageId = stageId || stages[0]?.id || ''
    const events = []
    const push = (event, data = {}) => {
      const chunk = sseEvent(event, data)
      events.push(chunk)
      routeContext.writeEvent?.(chunk)
    }
    push('status', { status: 'generating', label: '正在重新生成阶段画布' })
    push('artifact', {
      type: 'workflow-stage-canvas',
      stageId: targetStageId,
      status: 'generating',
      index: Math.max(0, stages.findIndex((stage) => stage.id === targetStageId)),
      total: stages.length,
        stage: stages.find((stage) => stage.id === targetStageId) || { id: targetStageId, name: '阶段' },
      stageCanvas: isAdvancedUxPayload(payload) && ['interaction-lofi', 'ui-visual'].includes(targetStageId)
        ? advancedUxStageGeneratingCanvas(targetStageId)
        : stagePayloadWithGenerationContext(payload.currentTotalDesignFlow, targetStageId),
      totalFlowMeta: totalFlowMeta(payload.currentTotalDesignFlow || null),
      totalDesignFlow: null,
      regenerate: true
    })
    try {
      if (targetStageId === 'interaction-lofi') {
        const recoveredStagePayload = isAdvancedUxPayload(payload)
          ? advancedUxPageInteractionDocumentFromStagePayload(payload)
          : {
              totalDesignFlow: payload.currentTotalDesignFlow || {},
              pageInteractionDocument: advancedUxPageInteractionDocumentFromFlow(payload.currentTotalDesignFlow)
            }
        let pageInteractionDocument = recoveredStagePayload.pageInteractionDocument
        let totalDesignFlowBase = recoveredStagePayload.totalDesignFlow || payload.currentTotalDesignFlow || {}
        if (!pageInteractionDocument?.markdown && isAdvancedUxPayload(payload)) {
          const report = totalDesignFlowBase.advancedUxReport || {}
          if (!String(report.markdown || '').trim()) {
            throw advancedUxMarkdownFailure('缺少高级 UX 需求分析 Markdown，无法生成页面交互框架与说明。请先重新生成第一阶段 Markdown。')
          }
          push('status', { status: 'generating', label: '正在生成页面交互框架与说明 Markdown' })
          totalDesignFlowBase = await persistAdvancedUxStageGeneratingWorkflowRun(
            payload,
            totalDesignFlowBase,
            targetStageId
          ) || totalDesignFlowBase
          pageInteractionDocument = await withAdvancedUxHeartbeat(
            generateAdvancedUxPageInteractionDocument(payload, report),
            push,
            Date.now(),
            {
              label: '后台仍在生成页面交互框架与说明 Markdown',
              phase: 'advanced-ux-page-interaction-document'
            }
          )
          push('artifact', {
            type: 'advanced-ux-page-interaction-document',
            ...pageInteractionDocument
          })
          totalDesignFlowBase = attachAdvancedUxDeliveryArtifactsToFlow(totalDesignFlowBase, {
            pageInteractionDocument
          })
        }
        const advancedUxStageCanvas = advancedUxInteractionLofiCanvasFromPageInteractionDocument(pageInteractionDocument)
        if (advancedUxStageCanvas?.nodes?.length) {
          let totalDesignFlow = totalDesignFlowWithAdvancedUxInteractionLofiCanvas(
            totalDesignFlowBase,
            advancedUxStageCanvas,
            targetStageId
          )
          totalDesignFlow = totalDesignFlowWithCurrentStageStatus(totalDesignFlow, 'completed', { stageId: targetStageId })
          await persistAdvancedUxStageWorkflowRun(payload, totalDesignFlow, 'analyzed')
          push('artifact', {
            type: 'workflow-stage-canvas',
            stageId: targetStageId,
            status: 'completed',
            index: Math.max(0, stages.findIndex((stage) => stage.id === targetStageId)),
            total: stages.length,
            stage: totalDesignFlow?.stages?.find((stage) => stage.id === targetStageId) || stages.find((stage) => stage.id === targetStageId) || { id: targetStageId, name: '阶段' },
            stageCanvas: stagePayloadWithGenerationContext(totalDesignFlow, targetStageId),
            totalFlowMeta: totalFlowMeta(totalDesignFlow),
            totalDesignFlow: null,
            regenerate: true,
            regeneratedAt: new Date().toISOString()
          })
          push('done', {
            status: 'analyzed',
            stageId: targetStageId,
            generation: {
              status: 'generated',
              source: 'advanced-ux-page-interaction-document'
            },
            totalDesignFlow
          })
          return {
            contentType: 'text/event-stream; charset=utf-8',
            body: events.join('')
          }
        }
      }
      if (targetStageId === 'ui-visual' && isAdvancedUxPayload(payload)) {
        const {
          totalDesignFlow: recoveredTotalDesignFlow,
          pageInteractionDocument
        } = advancedUxPageInteractionDocumentFromStagePayload(payload)
        if (!pageInteractionDocument?.markdown) {
          throw advancedUxMarkdownFailure('缺少页面交互框架与说明 Markdown，无法生成 Draw.io 和低保真线框图。请先完成第二阶段。')
        }
        if (pageInteractionDocument?.markdown) {
          push('status', { status: 'generating', label: '正在生成 Draw.io 主流程图和状态图' })
          const drawioArtifacts = await withAdvancedUxHeartbeat(
            generateAdvancedUxDrawioArtifacts(payload, pageInteractionDocument),
            push,
            Date.now(),
            {
              label: '后台仍在生成 Draw.io 主流程图和状态图',
              phase: 'advanced-ux-drawio'
            }
          )
          push('artifact', {
            type: 'advanced-ux-drawio-artifacts',
            artifacts: drawioArtifacts
          })
          push('status', { status: 'generating', label: '正在生成低保真线框图图片' })
          const lowFiWireframeArtifacts = await withAdvancedUxHeartbeat(
            generateAdvancedUxLowFiWireframeArtifacts(payload, pageInteractionDocument),
            push,
            Date.now(),
            {
              label: '后台仍在生成低保真线框图图片',
              phase: 'advanced-ux-lowfi-wireframes'
            }
          )
          push('artifact', {
            type: 'advanced-ux-lowfi-wireframe-artifacts',
            artifacts: lowFiWireframeArtifacts
          })
          const deliveryCanvas = advancedUxDeliveryArtifactCanvas(drawioArtifacts, lowFiWireframeArtifacts)
          let totalDesignFlow = attachAdvancedUxDeliveryArtifactsToFlow(recoveredTotalDesignFlow || payload.currentTotalDesignFlow || {}, {
            pageInteractionDocument,
            drawioArtifacts,
            lowFiWireframeArtifacts
          })
          totalDesignFlow = {
            ...totalDesignFlow,
            currentStage: targetStageId,
            stageCanvases: {
              ...(totalDesignFlow.stageCanvases || {}),
              [targetStageId]: deliveryCanvas
            }
          }
          totalDesignFlow = totalDesignFlowWithCurrentStageStatus(
            withWorkflowStageRuntime(withDownstreamStageArtifactContext(totalDesignFlow)),
            'completed',
            { stageId: targetStageId }
          )
          await persistAdvancedUxStageWorkflowRun(payload, totalDesignFlow, 'analyzed')
          push('artifact', {
            type: 'workflow-stage-canvas',
            stageId: targetStageId,
            status: 'completed',
            index: Math.max(0, stages.findIndex((stage) => stage.id === targetStageId)),
            total: stages.length,
            stage: totalDesignFlow?.stages?.find((stage) => stage.id === targetStageId) || stages.find((stage) => stage.id === targetStageId) || { id: targetStageId, name: '阶段' },
            stageCanvas: stagePayloadWithGenerationContext(totalDesignFlow, targetStageId),
            totalFlowMeta: totalFlowMeta(totalDesignFlow),
            totalDesignFlow: null,
            regenerate: true,
            regeneratedAt: new Date().toISOString()
          })
          push('done', {
            status: 'analyzed',
            stageId: targetStageId,
            generation: {
              status: 'generated',
              source: 'advanced-ux-delivery-artifacts'
            },
            totalDesignFlow,
            advancedUxReport: totalDesignFlow.advancedUxReport || null
          })
          return {
            contentType: 'text/event-stream; charset=utf-8',
            body: events.join('')
          }
        }
      }
      const result = await analyzeDocuments({
        ...payload,
        skillSelectionMode: payload.skillSelectionMode || 'auto',
        skillId: payload.skillId || 'auto',
        regenerateStageId: targetStageId,
        documents: documentsWithStageConfirmation(payload, targetStageId)
      })
      const totalDesignFlow = totalDesignFlowWithStageGenerationContext(
        result.totalDesignFlow || null,
        payload.currentTotalDesignFlow || null,
        targetStageId
      )
      push('artifact', {
        type: 'workflow-stage-canvas',
        stageId: targetStageId,
        status: 'completed',
        index: Math.max(0, stages.findIndex((stage) => stage.id === targetStageId)),
        total: stages.length,
        stage: totalDesignFlow?.stages?.find((stage) => stage.id === targetStageId) || stages.find((stage) => stage.id === targetStageId) || { id: targetStageId, name: '阶段' },
        stageCanvas: stagePayloadWithGenerationContext(totalDesignFlow, targetStageId),
        totalFlowMeta: totalFlowMeta(totalDesignFlow),
        totalDesignFlow: null,
        regenerate: true,
        regeneratedAt: new Date().toISOString()
      })
      push('done', result)
    } catch (error) {
      const errorData = {
        message: error.message || '阶段重新生成失败',
        code: error.code || 'WORKFLOW_STAGE_REGENERATE_FAILED',
        stageId: targetStageId,
        recoveryActions: error.recoveryActions || ['重新生成该阶段', '检查模型配置']
      }
      const failedStageCanvas = isAdvancedUxPayload(payload)
        ? advancedUxStageFailedCanvas(targetStageId, errorData)
        : stagePayloadWithGenerationContext(payload.currentTotalDesignFlow, targetStageId)
      let failedTotalDesignFlow = null
      if (isAdvancedUxPayload(payload)) {
        const currentTotalDesignFlow = payload.currentTotalDesignFlow || {}
        const failedReport = {
          ...(currentTotalDesignFlow.advancedUxReport || {}),
          ...(targetStageId === 'interaction-lofi'
            ? {
                pageInteractionDocument: {
                  status: 'failed',
                  artifactType: error.artifactType || 'page-interaction-markdown',
                  fileName: error.fileName || pageInteractionDocumentFileName(error.markdown || '', payload),
                  markdown: error.markdown || '',
                  qualityIssues: Array.isArray(error.qualityIssues) ? error.qualityIssues : [],
                  importError: errorData.message,
                  generatedAt: new Date().toISOString()
                }
              }
            : {})
        }
        failedTotalDesignFlow = {
          ...currentTotalDesignFlow,
          currentStage: targetStageId,
          advancedUxReport: failedReport,
          ...(targetStageId === 'interaction-lofi'
            ? {
                pageInteractionDocumentArtifact: failedReport.pageInteractionDocument
              }
            : {}),
          stageCanvases: {
            ...(currentTotalDesignFlow.stageCanvases || {}),
            [targetStageId]: failedStageCanvas
          }
        }
        failedTotalDesignFlow = totalDesignFlowWithCurrentStageStatus(
          withWorkflowStageRuntime(withDownstreamStageArtifactContext(failedTotalDesignFlow)),
          'failed',
          { stageId: targetStageId }
        )
        await persistAdvancedUxStageWorkflowRun(payload, failedTotalDesignFlow, 'analyzed')
      }
      push('artifact', {
        type: 'workflow-stage-canvas',
        stageId: targetStageId,
        status: 'failed',
        index: Math.max(0, stages.findIndex((stage) => stage.id === targetStageId)),
        total: stages.length,
        stage: stages.find((stage) => stage.id === targetStageId) || { id: targetStageId, name: '阶段' },
        stageCanvas: failedStageCanvas,
        totalFlowMeta: totalFlowMeta(failedTotalDesignFlow || payload.currentTotalDesignFlow || null),
        totalDesignFlow: null,
        regenerate: true
      })
      push('error', errorData)
      push('done', { error: errorData })
    }
    return {
      contentType: 'text/event-stream; charset=utf-8',
      body: events.join('')
    }
  }

  return {
    'POST /api/uploads/documents': async (payload = {}) => {
      return parseUploadedDocuments({
        ...payload,
        documents: Array.isArray(payload.documents) ? payload.documents : payload.files || []
      })
    },
    'POST /api/uploads/documents/analyze': analyzeDocuments,
    'POST /api/uploads/documents/analyze/stream': analyzeDocumentsStream,
    'POST /api/uploads/documents/analyze/advanced-ux/repair': repairAdvancedUxWorkflowRun,
    'POST /api/uploads/documents/analyze/stage/stream': analyzeStageStream
  }
}
