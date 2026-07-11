import { buildPageLayoutArtifactFromSpec } from './page-layout-artifact-renderer.js'
import { buildRequirementDissectionGuidanceArtifact } from './requirement-dissection-guidance.js'
import { buildWorkflowStageRuntime } from './stage-runtime.js'

export const TOTAL_DESIGN_FLOW_STAGES = [
  { id: 'requirement-dissection', name: '需求分析' },
  { id: 'interaction-lofi', name: '交互低保' },
  { id: 'ui-visual', name: 'UI视觉' },
  { id: 'html-output', name: 'HTML' },
  { id: 'vue-output', name: 'Vue' },
  { id: 'acceptance-deposit', name: '验收沉淀' }
]

const REQUIREMENT_ANALYSIS_PIPELINE_VERSION = 'product-analysis-pipeline/v1'

const REQUIREMENT_ANALYSIS_PIPELINE_TABS = [
  {
    id: 'requirement-understanding',
    title: '需求理解',
    sourceRefs: ['productDefinition', 'userScenarios', 'evidenceAndAssumptions', 'riskAssessment']
  },
  {
    id: 'gap-confirmation',
    title: '缺口确认',
    sourceRefs: ['gapConfirmation', 'openQuestions']
  },
  {
    id: 'user-journey-analysis',
    title: '用户旅程分析',
    sourceRefs: ['personaScenarioMatrix', 'userJourneyMap']
  },
  {
    id: 'feature-page-decomposition',
    title: '功能与页面拆解',
    sourceRefs: ['functionModuleMatrix', 'designRequirementMap', 'pageHierarchyTree', 'pageCoverageMatrix', 'pageFrameContracts']
  },
  {
    id: 'business-rules-stateflow',
    title: '业务规则与状态流',
    sourceRefs: ['businessRuleMatrix', 'permissionMatrix', 'boundaryConditionMatrix', 'stateMachineMap']
  },
  {
    id: 'flow-architecture',
    title: '流程与架构',
    sourceRefs: ['navigationStructure', 'dataFlowGraph', 'featureJumpGraph', 'exceptionRecoveryMatrix']
  },
  {
    id: 'design-opportunity',
    title: '设计机会',
    sourceRefs: ['designOpportunityMatrix', 'competitiveAnalysis']
  },
  {
    id: 'priority-roadmap',
    title: '优先级与排期',
    sourceRefs: ['priorityRoadmap', 'scopeBoundary']
  },
  {
    id: 'acceptance-standards',
    title: '验收标准',
    sourceRefs: ['acceptanceBasis']
  }
]

const ADVANCED_UX_REQUIREMENT_ANALYSIS_SKILL_ID = 'advanced-ux-requirement-analysis'

const ADVANCED_UX_ANALYSIS_PIPELINE_TABS = [
  {
    id: 'ux-original-requirement-analysis',
    title: '原始需求分析',
    sourceRefs: ['productDefinition', 'userScenarios', 'evidenceAndAssumptions']
  },
  {
    id: 'ux-design-problem-definition',
    title: '设计问题定义',
    sourceRefs: ['functionModuleMatrix', 'designRequirementMap', 'acceptanceBasis']
  },
  {
    id: 'ux-user-scenario',
    title: '用户与场景',
    sourceRefs: ['riskAssessment', 'gapConfirmation', 'boundaryConditionMatrix']
  },
  {
    id: 'ux-interaction-chain',
    title: '整体交互链路',
    sourceRefs: ['navigationStructure', 'pageHierarchyTree', 'userJourneyMap', 'dataFlowGraph', 'featureJumpGraph', 'exceptionRecoveryMatrix', 'stateMachineMap']
  },
  {
    id: 'ux-three-design-solutions',
    title: '三套设计方案',
    sourceRefs: ['designOpportunityMatrix', 'competitiveAnalysis']
  },
  {
    id: 'ux-exception-flow',
    title: '异常流补充',
    sourceRefs: ['priorityRoadmap', 'scopeBoundary']
  },
  {
    id: 'ux-recommendation-decision',
    title: '推荐方案建议',
    sourceRefs: ['acceptanceBasis']
  }
]

const ADVANCED_UX_LEGACY_TAB_ID_ALIASES = {
  'ux-requirement-understanding': 'ux-original-requirement-analysis',
  'ux-requirement-decomposition': 'ux-design-problem-definition',
  'ux-risk-assumption': 'ux-user-scenario',
  'ux-flow-info-architecture': 'ux-interaction-chain',
  'ux-opportunity-solution': 'ux-three-design-solutions',
  'ux-priority-roadmap': 'ux-exception-flow',
  'ux-delivery-acceptance': 'ux-recommendation-decision',
  'ux-requirement-completeness': 'ux-user-scenario',
  'ux-flow-architecture': 'ux-interaction-chain',
  'ux-design-opportunity': 'ux-three-design-solutions',
  'ux-design-priority': 'ux-exception-flow'
}

const ADVANCED_UX_LEGACY_TITLE_ALIASES = {
  '需求理解': 'ux-original-requirement-analysis',
  '需求拆解': 'ux-design-problem-definition',
  '风险假设': 'ux-user-scenario',
  '流程与信息架构': 'ux-interaction-chain',
  '机会与方案': 'ux-three-design-solutions',
  '优先级与分期': 'ux-exception-flow',
  '交付与验收': 'ux-recommendation-decision'
}

const ADVANCED_UX_MARKDOWN_FILE_PREFIX = '高级UX需求分析'

const REQUIREMENT_SOURCE_REF_BLOCK_META = {
  productDefinition: { title: '产品定位与核心产出', type: 'summary' },
  riskAssessment: { title: '风险评估', type: 'risk-matrix' },
  evidenceAndAssumptions: { title: '依据与假设', type: 'list' },
  userScenarios: { title: '目标用户与场景', type: 'list' },
  gapConfirmation: { title: '缺口确认', type: 'question-list' },
  personaScenarioMatrix: { title: '角色场景矩阵', type: 'table' },
  functionModuleMatrix: { title: '功能模块划分', type: 'table' },
  designRequirementMap: { title: '页面需求清单', type: 'table' },
  pageCoverageMatrix: { title: '页面覆盖矩阵', type: 'table' },
  pageHierarchyTree: { title: '页面层级', type: 'tree' },
  userJourneyMap: { title: '用户旅程', type: 'timeline' },
  businessRuleMatrix: { title: '业务规则矩阵', type: 'rule-list' },
  decisionPointMatrix: { title: '关键决策点', type: 'table' },
  exceptionRecoveryMatrix: { title: '异常与恢复', type: 'risk-matrix' },
  permissionMatrix: { title: '权限矩阵', type: 'permission-matrix' },
  boundaryConditionMatrix: { title: '边界条件', type: 'risk-matrix' },
  navigationStructure: { title: '顶层导航', type: 'tree' },
  dataFlowGraph: { title: '数据流', type: 'graph' },
  stateMachineMap: { title: '状态机', type: 'state-machine' },
  featureJumpGraph: { title: '跨功能关联', type: 'relation-table' },
  designOpportunityMatrix: { title: '设计机会矩阵', type: 'opportunity-matrix' },
  competitiveAnalysis: { title: '竞品与设计机会', type: 'summary' },
  priorityRoadmap: { title: '优先级排期', type: 'priority-table' },
  acceptanceBasis: { title: '验收依据', type: 'acceptance-basis' },
  pageFrameContracts: { title: '页面框架合同', type: 'table' },
  scopeBoundary: { title: '优先级边界', type: 'priority-table' },
  dataSharingMechanism: { title: '数据共享机制', type: 'table' },
  downstreamHints: { title: '下游生成依据', type: 'list' },
  openQuestions: { title: '待确认问题', type: 'question-list' }
}

function analysisText(analysis = {}) {
  return [
    analysis.input || '',
    ...(analysis.documents || []).map((doc) =>
      [doc.name, doc.text || doc.content || doc.summary || doc.reason || ''].filter(Boolean).join('\n')
    )
  ].join('\n\n')
}

function cleanText(value = '') {
  return String(value || '').trim()
}

function uniqueTexts(items = [], limit = 20) {
  const seen = new Set()
  return (Array.isArray(items) ? items : [])
    .map((item) => cleanText(item))
    .filter((item) => {
      if (!item || seen.has(item)) return false
      seen.add(item)
      return true
    })
    .slice(0, limit)
}

function hasTeaContext(text = '') {
  return /(茶饮|奶茶|点单|取餐|菜单|购物车|会员优惠)/i.test(text)
}

function hasPodcastorContext(text = '') {
  return /(podcastor|播客|AI播客|Podcast)/i.test(text)
}

function hasJoggContext(text = '') {
  return /\bjogg\b|Jogg|高级编辑器|b-?roll|Media 模块|My Media|AI Generate/i.test(text)
}

function selectedKnowledgeScopeDocuments(analysis = {}) {
  return (analysis.documents || []).filter((doc) =>
    doc?.sourceType === 'selected-knowledge-scope' ||
    /^框选功能/.test(String(doc?.name || '')) ||
    doc?.selectedKnowledgeScope
  )
}

function hasSelectedKnowledgeScope(analysis = {}) {
  return selectedKnowledgeScopeDocuments(analysis).length > 0
}

function isHomePromptShortcutRequest(analysis = {}) {
  const text = analysisText(analysis)
  if (hasStrongLocalFeatureOptimizationContext(text)) return false
  return (hasSelectedKnowledgeScope(analysis) || hasJoggContext(text) || hasPodcastorContext(text)) &&
    /首页/.test(text) &&
    /(快捷|提示词|prompt|chip|输入)/i.test(text)
}

const TEA_ORDERING_PAGE_TITLES = [
  '首页与选店',
  '取餐方式',
  '菜单与商品',
  '商品定制',
  '购物车与结算',
  '支付与订单生成',
  '制作与取餐通知',
  '会员与优惠',
  '前后端与验收'
]

const TEA_MODEL_COMPLETION_PAGES = [
  { title: '首页与选店', aliases: ['首页', '选店', '门店选择'], modules: ['门店定位', '附近门店', 'Banner轮播', '快捷入口', '开始点单按钮'] },
  { title: '取餐方式', aliases: ['自提', '外卖', '堂食', '取餐方式'], modules: ['自提/外卖切换', '地址选择', '预计取餐时间', '确认方式按钮'] },
  { title: '购物车与结算', aliases: ['购物车', '结算'], modules: ['商品清单', '优惠券入口', '金额明细', '备注与餐具', '去支付按钮'] },
  { title: '支付与订单生成', aliases: ['支付', '下单', '订单生成'], modules: ['订单摘要', '支付方式', '支付倒计时', '支付状态反馈'] },
  { title: '制作与取餐通知', aliases: ['取餐通知', '取餐码', '制作', '订单详情'], modules: ['订单状态时间线', '取餐码', '预计完成时间', '通知订阅'] },
  { title: '会员与优惠', aliases: ['会员', '优惠', '优惠券', '积分'], modules: ['会员等级', '优惠券列表', '积分余额', '权益入口'] },
  { title: '我的', aliases: ['我的', '个人中心'], modules: ['会员资产', '营销入口', '工具入口', '服务入口'] },
  { title: '地址与门店管理', aliases: ['地址', '门店管理'], modules: ['地址列表', '新增地址', '门店收藏', '配送范围提示'] }
]

function sourceExcerpt(text = '', keywords = []) {
  const lines = String(text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const matched = lines.find((line) =>
    keywords.some((keyword) => line.toLowerCase().includes(String(keyword).toLowerCase()))
  )
  return (matched || lines[0] || '用户输入').slice(0, 180)
}

function requirementSlice(id, title, goal, text, keywords = [], priority = 'P0') {
  return {
    id,
    title,
    goal,
    sourceExcerpt: sourceExcerpt(text, keywords),
    users: [],
    businessObjects: keywords,
    pageCount: 0,
    priority,
    stageStatus: 'ready',
    pendingQuestionCount: 0,
    blocked: false
  }
}

function podcastorSlices(text = '') {
  return [
    requirementSlice('podcastor-home-entry', '首页与创作入口', '让创作者从首页快速选择脚本、音频或视频播客创作入口。', text, ['首页', '创作入口', 'Generate Script']),
    requirementSlice('podcastor-script-generation', '脚本生成流程', '支持提示词、URL、PDF/PPT 等输入生成可编辑播客脚本。', text, ['脚本', 'URL', 'PDF', 'PPT']),
    requirementSlice('podcastor-audio-generation', '音频播客生成流程', '把脚本和音色配置转成多语言音频播客。', text, ['音频播客', 'TTS', '声音库']),
    requirementSlice('podcastor-video-production', '视频播客制作流程', '用真人、卡通或宠物主持人生成视频播客并支持编辑。', text, ['视频播客', '主持人', '卡通', '宠物']),
    requirementSlice('podcastor-asset-library', '主持人/音色/背景资产库', '沉淀脚本、音色、主持人、背景和常用组合。', text, ['资产', '音色', '主播', '背景']),
    requirementSlice('podcastor-work-storage', '作品生成与存储', '管理作品生成、存储、历史调用和复用。', text, ['作品生成', '存储', '调用']),
    requirementSlice('podcastor-short-clips-distribution', '短视频切片与分发', '把长播客切成短视频并分发到外部平台。', text, ['TikTok', 'YouTube', 'Instagram', '分发']),
    requirementSlice('podcastor-auth-commercialization', '登录注册与商业化', '承接账号登录、注册、订阅或支付商业化能力。', text, ['注册', '登录', '商业化', 'Stripe', 'PayPal'], 'P1'),
    requirementSlice('podcastor-admin-platform', '管理端与平台分发', '支持管理端、Spotify、Apple Podcast 等后续平台能力。', text, ['管理端', 'Spotify', 'Apple Podcast'], 'P2')
  ]
}

function scopedHomePromptShortcutSlices(text = '') {
  return [
    requirementSlice('home-prompt-shortcuts', '首页快捷提示词展示', '在当前框选首页创作入口的输入区提供快捷提示词，降低首次创作输入成本。', text, ['首页', '快捷提示词', '输入区', 'Generate Script']),
    requirementSlice('prompt-shortcut-data-contract', '提示词数据契约与兜底', '定义提示词来源、排序、语言、启停、本地兜底和曝光/点击埋点。', text, ['提示词', '数据契约', '兜底', '埋点'], 'P1'),
    requirementSlice('auth-submit-integration', '登录/提交链路兼容', '快捷提示词只影响输入内容，不改变 Next 登录检查、创建任务和进入 Studio 的原路径。', text, ['Next', 'LoginDialog', 'createPodcastVideoTask', 'Studio'])
  ]
}

function localFeatureOptimizationSlices(text = '') {
  return [
    requirementSlice('local-ratio-controls', '造人比例参数', '围绕现有造人入口增强画面比例选择、默认值和结果归位，不扩展成 Podcastor 全量产品框架。', text, ['画面比例', '当前tab', 'selectedAspectRatio', 'targetAspectRatio']),
    requirementSlice('local-reference-materials', '参考图/背景多比例素材', '在 Generate From Reference 入口支持同一背景图配置不同画面比例素材。', text, ['Generate From Reference', '背景图', '多比例素材']),
    requirementSlice('local-host-generation-entries', '照片/AI主播生成入口', '在 Use your Photo 与 AI generate host 入口补充生成比例参数和生成中状态归位。', text, ['Use your Photo', 'AI generate host', '16:9', '9:16']),
    requirementSlice('local-upload-crop-routing', '上传图片框选与结果归位', '上传图片后用目标比例虚线画框替代右上角裁剪，并用 cropBox 与 actualAspectRatio 做结果归位。', text, ['Photo to Host', '虚线画框', 'cropBox', 'actualAspectRatio'])
  ]
}

function teaSlices(text = '') {
  return [
    requirementSlice('tea-ordering-main-flow', '茶饮点单主流程', '从选店、点单、定制、结算到取餐通知完成茶饮小程序主路径。', text, ['茶饮', '点单', '取餐', '购物车', '会员优惠'])
  ]
}

function hasWorkflowAnalysisCoverageContext(analysis = {}) {
  const text = analysisText(analysis)
  const signals = [
    /选择项目/,
    /输入需求/,
    /分析需求|需求分析/,
    /第一阶段|进入阶段/,
    /agent|Agent|智能体/i,
    /项目知识库|知识库/,
    /回复/,
    /参与的所有页面|全流程页面交互|一个不漏|所有页面/
  ]
  const signalCount = signals.filter((pattern) => pattern.test(text)).length
  return signalCount >= 5 && /流程通|交互低保|页面详情|需求分析 Agent|项目知识库/.test(text)
}

function workflowAnalysisCoverageSlices(text = '') {
  return [
    requirementSlice(
      'workflow-analysis-page-coverage',
      '需求分析回复全流程覆盖',
      '从项目选择、需求输入、分析执行、Agent 取项目知识库回复，到交互低保和页面详情全屏形成完整页面交互链路。',
      text,
      ['选择项目', '输入需求', '分析需求', 'Agent', '项目知识库', '全流程页面交互']
    )
  ]
}

function workflowAnalysisCoverageDefinitions(analysis = {}) {
  const text = analysisText(analysis)
  const excerpt = sourceExcerpt(text, ['页面包括', '选择项目', '项目知识库', '全流程页面交互'])
  const knowledgeEvidence = analysis.demandScope === 'project' ? selectedKnowledgeScopeDocuments(analysis)[0] : null
  const evidence = knowledgeEvidence?.name ? `${knowledgeEvidence.name}：${excerpt}` : excerpt
  const rows = [
    {
      id: 'workflow-project-selection',
      pageName: '项目选择页',
      pageType: '入口页面',
      participationReason: '用户先选择本次需求所属项目，决定后续知识库和历史资料的取数范围。',
      entryFrom: '工作台 / 项目列表',
      exitTo: '需求输入页',
      primaryActions: ['选择目标项目', '确认项目上下文', '进入需求输入'],
      stateCoverage: ['未选择项目', '项目加载中', '选择成功', '项目无权限/不可用'],
      modules: ['项目列表', '项目信息摘要', '知识库范围提示', '确认按钮'],
      dataDependencies: ['projectId', 'projectName', 'knowledgeScope', 'projectPermission'],
      acceptanceCriteria: ['必须选中项目后才能进入项目需求分析', '无权限项目给出原因和返回入口', '选中项目写入当前分析 run']
    },
    {
      id: 'workflow-requirement-input',
      pageName: '需求输入页',
      pageType: '表单页面',
      participationReason: '承接用户原始需求、附件和本次分析目标，是 Agent 识别问题的输入源。',
      entryFrom: '项目选择页',
      exitTo: '分析进度页',
      primaryActions: ['输入需求文本', '选择或上传资料', '点击分析需求'],
      stateCoverage: ['空输入', '草稿中', '资料读取中', '提交中', '校验失败'],
      modules: ['需求输入框', '资料/附件入口', '项目知识库提示', '分析需求按钮'],
      dataDependencies: ['input', 'documents', 'selectedKnowledgeScope', 'demandScope'],
      acceptanceCriteria: ['提交前校验需求非空', '项目需求必须携带项目范围', '提交后保留输入内容用于追溯']
    },
    {
      id: 'workflow-analysis-progress',
      pageName: '分析进度页',
      pageType: '过程状态页',
      participationReason: '展示需求补全、结构化拆解、取知识库、生成回复等步骤，避免用户误以为无响应。',
      entryFrom: '需求输入页',
      exitTo: '需求分析 Agent 回复区',
      primaryActions: ['查看分析步骤', '等待 Agent 处理', '失败后重试或返回编辑'],
      stateCoverage: ['排队中', '分析中', '取知识库中', '生成回复中', '失败可重试'],
      modules: ['步骤进度条', '当前步骤说明', '知识库读取状态', '失败恢复入口'],
      dataDependencies: ['analysisRunId', 'stageStatus', 'knowledgeFetchStatus', 'errorCode'],
      acceptanceCriteria: ['每个后台步骤都有可见状态', '失败时可重试或回到输入页', '不会清空已提交需求']
    },
    {
      id: 'workflow-agent-reply',
      pageName: '需求分析 Agent 回复区',
      pageType: 'Agent 回复区',
      participationReason: 'Agent 识别输入需求并结合项目知识库回复，是用户要求“回复这一步”的核心页面。',
      entryFrom: '分析进度页',
      exitTo: '页面覆盖矩阵',
      primaryActions: ['阅读 Agent 回复', '查看知识库证据', '展开页面交互说明', '进入下一阶段'],
      stateCoverage: ['流式生成中', '生成完成', '知识库不足', '回复失败', '可继续下一步'],
      modules: ['Agent 消息', '项目知识库证据', '结构化卡片', '下一步按钮'],
      dataDependencies: ['assistantMessage', 'rawContent', 'knowledgeEvidence', 'totalDesignFlow'],
      acceptanceCriteria: ['回复必须明确事实/推断/待确认', '项目知识库证据可追溯', '不把页面清单截断成少量摘要']
    },
    {
      id: 'workflow-page-coverage-matrix',
      pageName: '页面覆盖矩阵',
      pageType: '结构化分析页',
      participationReason: '把本次问题涉及的所有参与页面逐项列出，防止只回复局部页面或产物节点。',
      entryFrom: '需求分析 Agent 回复区',
      exitTo: '交互低保画布',
      primaryActions: ['查看参与页面', '核对入口/出口', '检查状态覆盖', '定位缺失页面'],
      stateCoverage: ['已覆盖', '待确认', '缺少证据', '需补充页面'],
      modules: ['页面名称', '参与原因', '入口/出口', '主操作', '状态覆盖'],
      dataDependencies: ['pageCoverageMatrix', 'projectFunctionMap', 'requirementDissectionArtifact'],
      acceptanceCriteria: ['页面名称与全流程页面一致', '每页都有入口、出口和状态覆盖', '不会用产物节点替代真实页面']
    },
    {
      id: 'workflow-interaction-lofi-canvas',
      pageName: '交互低保画布',
      pageType: '画布页面',
      participationReason: '把需求分析页覆盖矩阵转成页面级低保真交互节点和连线。',
      entryFrom: '页面覆盖矩阵',
      exitTo: '页面详情全屏',
      primaryActions: ['查看页面节点', '选择页面', '查看交互路径', '进入详情'],
      stateCoverage: ['节点生成中', '节点可选', '连线缺失', '详情可打开'],
      modules: ['阶段画布', '页面节点', '流程连线', '右侧详情入口'],
      dataDependencies: ['stageCanvases.interaction-lofi', 'stagePages', 'pages', 'flows'],
      acceptanceCriteria: ['所有覆盖页面进入画布节点', '节点顺序继承主路径', '每个节点有页面框架和交互说明']
    },
    {
      id: 'workflow-page-detail-fullscreen',
      pageName: '页面详情全屏',
      pageType: '详情页面',
      participationReason: '用户检查单页页面结构、交互热区、状态和接口依赖时需要全屏查看。',
      entryFrom: '交互低保画布',
      exitTo: '交互低保画布 / 阶段切换/下一步',
      primaryActions: ['打开页面详情', '切换页面', '查看交互说明', '关闭返回画布'],
      stateCoverage: ['详情打开', '页面切换', '内容加载失败', '关闭保持画布状态'],
      modules: ['页面框架图', '交互热区表', '状态矩阵', '接口/验收信息'],
      dataDependencies: ['pageLayoutArtifact', 'interactionSpecArtifact', 'requirementRow'],
      acceptanceCriteria: ['详情内容来自后端页面制品', '关闭后保留当前画布和选中状态', '每页详情字段完整']
    },
    {
      id: 'workflow-stage-next',
      pageName: '阶段切换/下一步',
      pageType: '阶段操作区',
      participationReason: '需求分析回复完成后，用户需要明确如何进入交互低保或后续阶段。',
      entryFrom: '需求分析 Agent 回复区 / 页面详情全屏',
      exitTo: '交互低保画布 / UI视觉阶段',
      primaryActions: ['确认当前阶段', '点击下一步', '进入后续阶段', '返回修改需求'],
      stateCoverage: ['可进入下一步', '当前阶段未完成', '后续阶段生成中', '切换失败'],
      modules: ['阶段导航', '下一步按钮', '阶段状态提示', '返回修改入口'],
      dataDependencies: ['currentStage', 'stageStatus', 'activeSliceId', 'contentStatus'],
      acceptanceCriteria: ['下一步只在必需制品完成后可用', '切换失败有提示和恢复入口', '返回不会丢失分析结果']
    }
  ]
  return rows.map((row, index) => ({
    ...row,
    sourceEvidence: evidence,
    confidence: index < 7 ? 'high' : 'medium',
    openQuestions: index === 7 ? ['下一阶段的可用条件和权限规则需按阶段状态接口确认。'] : []
  }))
}

function workflowAnalysisCoveragePagesForAnalysis(analysis = {}, activeSliceId = '') {
  return workflowAnalysisCoverageDefinitions(analysis).map((row, index, rows) => ({
    id: row.id,
    sliceId: activeSliceId,
    title: row.pageName,
    summary: row.participationReason,
    nodeId: row.id,
    route: row.exitTo,
    statusCount: row.stateCoverage.length,
    pendingQuestionCount: row.openQuestions.length,
    modules: row.modules,
    interactions: row.primaryActions,
    routeTargets: [row.exitTo],
    states: row.stateCoverage,
    dataDependencies: row.dataDependencies,
    acceptanceCriteria: row.acceptanceCriteria,
    businessObjects: ['项目', '需求', '分析 run', '项目知识库', '阶段制品'],
    detailSections: [
      { title: '页面目标', items: [row.participationReason] },
      { title: '核心模块', items: row.modules },
      { title: '用户点击动作', items: row.primaryActions },
      { title: '跳转到哪个页面', items: [`从「${row.entryFrom}」进入，完成后到「${row.exitTo}」。`] },
      { title: '加载 / 空 / 失败 / 权限状态', items: row.stateCoverage },
      { title: '接口或数据依赖', items: row.dataDependencies },
      { title: '验收点', items: row.acceptanceCriteria },
      { title: '覆盖依据', items: [row.sourceEvidence, index === 0 ? `完整主路径：${rows.map((item) => item.pageName).join(' -> ')}` : ''] .filter(Boolean) }
    ]
  }))
}

function modelTotalDesignFlow(analysis = {}) {
  return analysis.generation?.output?.totalDesignFlow || analysis.generation?.output?.totalFlow || null
}

function normalizeModelRequirementSlice(raw = {}, index = 0, text = '') {
  if (!raw || typeof raw !== 'object') return null
  const title = String(raw.title || raw.name || raw.sliceName || raw.requirementName || '').trim()
  const idSeed = String(raw.id || raw.sliceId || raw.key || title || `model-slice-${index + 1}`).trim()
  if (!title && !idSeed) return null
  const sourceExcerptValue = raw.sourceExcerpt || raw.source || raw.evidence || raw.quote || ''
  return {
    id: idSeed || `model-slice-${index + 1}`,
    title: title || idSeed || `小需求 ${index + 1}`,
    goal: raw.goal || raw.summary || raw.description || '模型已识别该小需求，目标待补充。',
    sourceExcerpt: String(sourceExcerptValue || sourceExcerpt(text, [title, idSeed])).slice(0, 180),
    users: Array.isArray(raw.users) ? raw.users : [],
    businessObjects: Array.isArray(raw.businessObjects)
      ? raw.businessObjects
      : Array.isArray(raw.objects) ? raw.objects : [],
    pageCount: Number(raw.pageCount || raw.pages?.length || 0),
    priority: raw.priority || 'P0',
    stageStatus: raw.stageStatus || raw.status || 'ready',
    pendingQuestionCount: Number(raw.pendingQuestionCount || raw.pendingQuestions?.length || 0),
    blocked: Boolean(raw.blocked)
  }
}

function modelRequirementSlicesForAnalysis(analysis = {}) {
  const totalFlow = modelTotalDesignFlow(analysis)
  const text = analysisText(analysis)
  const rawSlices = Array.isArray(totalFlow?.requirementSlices)
    ? totalFlow.requirementSlices
    : Array.isArray(totalFlow?.slices)
      ? totalFlow.slices
      : []
  const slices = rawSlices
    .map((slice, index) => normalizeModelRequirementSlice(slice, index, text))
    .filter(Boolean)
  return slices.length ? slices : null
}

function fallbackSlices(analysis = {}, text = '') {
  const title = analysis.blueprint?.profile?.productName || analysis.blueprint?.title || '需求主流程'
  return [
    requirementSlice('main-requirement-flow', title, '围绕当前输入生成主要需求流程。', text, [title])
  ]
}

function requirementSlicesForAnalysis(analysis = {}) {
  const text = analysisText(analysis)
  if (hasStrongLocalFeatureOptimizationContext(text)) return localFeatureOptimizationSlices(text)
  if (hasWorkflowAnalysisCoverageContext(analysis)) return workflowAnalysisCoverageSlices(text)
  const modelSlices = modelRequirementSlicesForAnalysis(analysis)
  if (modelSlices?.length) return modelSlices
  if (isHomePromptShortcutRequest(analysis)) return scopedHomePromptShortcutSlices(text)
  if (hasPodcastorContext(text)) return podcastorSlices(text)
  if (hasTeaContext(text)) return teaSlices(text)
  return fallbackSlices(analysis, text)
}

function normalizeModelDetailSections(raw = {}) {
  const rawSections = Array.isArray(raw.detailSections)
    ? raw.detailSections
    : Array.isArray(raw.sections)
      ? raw.sections
      : []
  return rawSections.map((section) => ({
    title: section.title || section.name || '模型详情',
    meta: section.meta || '',
    items: Array.isArray(section.items)
      ? section.items
      : [section.content || section.summary || section.description || ''].filter(Boolean)
  })).filter((section) => section.title || section.items.length)
}

function normalizeModelPage(raw = {}, index = 0, activeSliceId = '') {
  if (!raw || typeof raw !== 'object') return null
  const title = String(raw.title || raw.name || raw.pageTitle || raw.page || '').trim()
  const idSeed = String(raw.id || raw.pageId || raw.nodeId || raw.key || title || `model-page-${index + 1}`).trim()
  if (!title && !idSeed) return null
  const detailSections = normalizeModelDetailSections(raw)
  return {
    id: idSeed || `model-page-${index + 1}`,
    sliceId: raw.sliceId || raw.requirementSliceId || activeSliceId,
    title: title || idSeed || `页面 ${index + 1}`,
    summary: raw.summary || raw.description || '',
    nodeId: raw.nodeId || idSeed || `model-page-${index + 1}`,
    route: raw.route || raw.nextPage || raw.targetPage || '',
    statusCount: Number(raw.statusCount || detailSections.filter((section) => /状态|异常|权限|加载|失败|空/.test(section.title || '')).length),
    pendingQuestionCount: Number(raw.pendingQuestionCount || raw.pendingQuestions?.length || 0),
    detailSections,
    wireframeTree: Array.isArray(raw.wireframeTree) ? raw.wireframeTree : raw.pageArchitecture?.wireframeTree,
    interactionSpec: Array.isArray(raw.interactionSpec) ? raw.interactionSpec : raw.interactionDetails?.spec,
    pageArchitecture: raw.pageArchitecture,
    interactionDetails: raw.interactionDetails,
    modules: raw.modules || raw.layoutModules || raw.sections,
    sections: raw.sections,
    interactions: raw.interactions || raw.gestures || raw.behaviors,
    primaryActions: raw.primaryActions || raw.actions,
    states: raw.states || raw.stateCoverage,
    dataDependencies: raw.dataDependencies || raw.apiDependencies,
    acceptanceCriteria: raw.acceptanceCriteria || raw.testPoints,
    interactionHotspots: raw.interactionHotspots || raw.controls || raw.hotspots,
    pageLayoutSpec: raw.pageLayoutSpec || raw.page_layout_spec || raw.layoutPlan || raw.structuredLayoutPlan
  }
}

function normalizedPageTitleForClassification(value = '') {
  return cleanText(value)
    .replace(/\s*(UI视觉|HTML|页面骨架|低保真|页面低保|框架图)\s*$/i, '')
}

function isBusinessBlockTitle(value = '') {
  const title = normalizedPageTitleForClassification(value)
  if (!title) return false
  return /MVP|框架|商业化|探索|成本|风控|验证|策略|业务目标|需求目标|技术方案|范围边界|下游生成|功能层级|风险/.test(title)
}

function isFrontendUserPageTitle(value = '') {
  const title = normalizedPageTitleForClassification(value)
  if (!title) return false
  return /首页|主页|Home|工作台|创作入口|创作页|生成工作台|结果|详情|作品库|作品|模板中心|模板|任务队列|队列|历史|素材库|素材|我的|个人中心|账号|设置|订阅|额度|登录|注册|Studio|Dashboard|Workbench/i.test(title) &&
    !isBusinessBlockTitle(title)
}

function shouldNormalizeBusinessBlocksToFrontendPages(pages = []) {
  if (!Array.isArray(pages) || !pages.length) return false
  const businessBlockCount = pages.filter((page) => isBusinessBlockTitle(page?.title)).length
  if (!businessBlockCount) return false
  const frontendPageCount = pages.filter((page) => isFrontendUserPageTitle(page?.title)).length
  return businessBlockCount >= frontendPageCount
}

function frontendPageProfilesForAnalysis(analysis = {}) {
  const text = analysisText(analysis)
  if (/AI|生成|图片|视频|影像|创作|素材|模板|作品|额度|订阅/i.test(text)) {
    return [
      { id: 'home', title: '首页', summary: '用户理解产品能力并从首页发起创作。', modules: ['首屏价值与能力入口', '快捷开始/提示词', '登录/额度状态', '最近任务入口'] },
      { id: 'generation-workbench', title: '生成工作台', summary: '承接主要创作功能，用户输入 Prompt、上传素材、配置参数并发起生成。', modules: ['Prompt 输入区', '素材上传', '生成类型切换', '参数配置', '生成按钮'] },
      { id: 'result-detail', title: '结果详情', summary: '展示生成结果，支持预览、下载、复用、重生成和保存。', modules: ['结果预览', '生成参数回显', '下载/保存/复用', '失败重试'] },
      { id: 'works-library', title: '作品库', summary: '管理用户历史作品、草稿和可复用生成结果。', modules: ['作品列表', '筛选/搜索', '批量管理', '复用入口'] },
      { id: 'template-center', title: '模板中心', summary: '提供模板、示例和灵感入口，帮助用户快速套用。', modules: ['模板分类', '模板卡片', '预览', '一键使用'] },
      { id: 'task-queue', title: '任务队列', summary: '展示生成中、排队、失败和已完成任务状态。', modules: ['任务列表', '进度状态', '取消/重试', '系统提示'] },
      { id: 'my-account', title: '我的', summary: '承接账号、额度、订阅、设置和个人资产状态。', modules: ['账号信息', '额度/订阅', '使用记录', '基础设置'] }
    ]
  }
  return [
    { id: 'home', title: '首页', summary: '用户进入产品后的主入口。', modules: ['核心入口', '推荐内容', '状态提示'] },
    { id: 'main-feature', title: '主要功能', summary: '用户完成核心任务的主要操作页面。', modules: ['主输入/操作区', '内容区', '提交按钮'] },
    { id: 'result-detail', title: '结果详情', summary: '展示核心任务的结果和后续操作。', modules: ['结果内容', '操作按钮', '状态提示'] },
    { id: 'history', title: '历史记录', summary: '查看和复用历史任务或内容。', modules: ['列表', '筛选/搜索', '详情入口'] },
    { id: 'my-account', title: '我的', summary: '管理账号、设置和个人状态。', modules: ['账号信息', '设置', '权限/订阅'] }
  ]
}

function requirementCoverageSections(requirementSlices = []) {
  const summaries = (Array.isArray(requirementSlices) ? requirementSlices : [])
    .map((slice) => `${slice.title || slice.id}：${slice.goal || slice.summary || slice.sourceExcerpt || '作为当前页面设计约束。'}`)
    .filter(Boolean)
  return summaries.length ? [stageDetailSection('需求覆盖依据', summaries)] : []
}

function frontendPageFromProfile(profile = {}, index = 0, activeSliceId = '', requirementSlices = []) {
  const sliceIds = (Array.isArray(requirementSlices) ? requirementSlices : [])
    .map((slice) => String(slice?.id || '').trim())
    .filter(Boolean)
  return {
    id: `frontend-${profile.id || index + 1}`,
    sliceId: activeSliceId,
    title: profile.title || `页面 ${index + 1}`,
    summary: profile.summary || `${profile.title || `页面 ${index + 1}`} 的前端用户页面。`,
    nodeId: `frontend-${profile.id || index + 1}`,
    statusCount: 4,
    pendingQuestionCount: 0,
    relatedSliceIds: sliceIds,
    relatedRequirementRules: (Array.isArray(requirementSlices) ? requirementSlices : [])
      .map((slice) => `${slice.title || slice.id}：${slice.goal || slice.summary || slice.sourceExcerpt || '作为当前页面设计约束。'}`)
      .filter(Boolean),
    modules: profile.modules || [],
    detailSections: [
      { title: '页面目标', items: [profile.summary || `明确「${profile.title || `页面 ${index + 1}`}」在前端用户流程中的职责。`] },
      { title: '核心模块', items: profile.modules || ['核心内容区', '主操作区', '状态反馈'] },
      { title: '用户点击动作', items: ['点击主操作进入下一步', '查看/编辑当前内容', '异常时重试或返回'] },
      { title: '加载 / 空 / 失败 / 权限状态', items: ['加载中', '空状态', '失败重试', '权限/额度不足'] },
      ...requirementCoverageSections(requirementSlices)
    ]
  }
}

function normalizeFrontendUserPagesForAnalysis(analysis = {}, pages = [], activeSliceId = '', requirementSlices = []) {
  if (!shouldNormalizeBusinessBlocksToFrontendPages(pages)) return pages
  const validModelPages = pages.filter((page) => isFrontendUserPageTitle(page?.title))
  const validTitles = new Set(validModelPages.map((page) => normalizedPageTitleForClassification(page.title)))
  const generatedPages = frontendPageProfilesForAnalysis(analysis)
    .filter((profile) => !validTitles.has(profile.title))
    .map((profile, index) => frontendPageFromProfile(profile, index, activeSliceId, requirementSlices))
  return [...validModelPages, ...generatedPages]
}

const PAGE_DERIVED_STAGE_IDS = new Set(['interaction-lofi', 'ui-visual', 'html-output'])

function pageTitleComparisonKey(value = '') {
  return normalizedPageTitleForClassification(value)
    .replace(/\s+/g, '')
    .toLowerCase()
}

function shouldPreferLocalPageCanvas(stageId = '', nodes = [], pages = []) {
  if (!PAGE_DERIVED_STAGE_IDS.has(stageId)) return false
  if (!Array.isArray(nodes) || !nodes.length || !Array.isArray(pages) || !pages.length) return false
  const pageTitleKeys = new Set(pages.map((page) => pageTitleComparisonKey(page?.title)).filter(Boolean))
  const nodeTitles = nodes.map((node) => node?.title).filter(Boolean)
  if (!nodeTitles.length) return false
  const matchedPageCount = nodeTitles.filter((title) => pageTitleKeys.has(pageTitleComparisonKey(title))).length
  if (matchedPageCount >= Math.ceil(nodeTitles.length / 2)) return false
  const businessBlockCount = nodeTitles.filter(isBusinessBlockTitle).length
  const frontendPageCount = nodeTitles.filter(isFrontendUserPageTitle).length
  return businessBlockCount > 0 && businessBlockCount >= frontendPageCount
}

function modelPagesForAnalysis(analysis = {}, activeSliceId = '') {
  const totalFlow = modelTotalDesignFlow(analysis)
  const rawPages = Array.isArray(totalFlow?.pages)
    ? totalFlow.pages
    : Array.isArray(totalFlow?.pageNodes)
      ? totalFlow.pageNodes
      : []
  const pages = rawPages
    .map((page, index) => normalizeModelPage(page, index, activeSliceId))
    .filter(Boolean)
  const normalizedPages = collapseHomePromptShortcutAliasPages(pages, analysis)
  return normalizedPages.length ? normalizedPages : null
}

function isHomePromptShortcutHomepage(page = {}) {
  const title = String(page.title || '')
  const text = [
    page.id,
    page.nodeId,
    page.title,
    page.summary,
    page.route,
    ...(Array.isArray(page.modules) ? page.modules : []),
    ...(Array.isArray(page.interactions) ? page.interactions : [])
  ].filter(Boolean).join(' ')
  return /首页|Home/i.test(title || text) &&
    !/Studio|登录|注册|Auth|弹窗|Modal|Pricing|设置|账号/i.test(title)
}

function mergeDetailSections(primary = [], extra = []) {
  const byTitle = new Map()
  ;[...primary, ...extra].forEach((section) => {
    if (!section) return
    const title = section.title || section.name || '模型详情'
    const current = byTitle.get(title) || { ...section, title, items: [] }
    const items = uniqueTexts([
      ...(Array.isArray(current.items) ? current.items : [current.content || current.summary].filter(Boolean)),
      ...(Array.isArray(section.items) ? section.items : [section.content || section.summary].filter(Boolean))
    ], 12)
    byTitle.set(title, { ...current, ...section, title, items })
  })
  return [...byTitle.values()]
}

function mergeHomePromptShortcutAliasPage(primary = {}, alias = {}) {
  return {
    ...primary,
    summary: uniqueTexts([primary.summary, alias.summary], 2).join('；'),
    routeAliases: uniqueTexts([
      ...(Array.isArray(primary.routeAliases) ? primary.routeAliases : []),
      primary.route,
      alias.route,
      alias.title
    ], 6),
    detailSections: mergeDetailSections(primary.detailSections, alias.detailSections),
    modules: uniqueTexts([
      ...valuesAsList(primary.modules),
      ...valuesAsList(alias.modules)
    ], 12),
    interactions: uniqueTexts([
      ...valuesAsList(primary.interactions),
      ...valuesAsList(alias.interactions)
    ], 12),
    states: uniqueTexts([
      ...valuesAsList(primary.states),
      ...valuesAsList(alias.states)
    ], 12),
    dataDependencies: uniqueTexts([
      ...valuesAsList(primary.dataDependencies),
      ...valuesAsList(alias.dataDependencies)
    ], 12),
    acceptanceCriteria: uniqueTexts([
      ...valuesAsList(primary.acceptanceCriteria),
      ...valuesAsList(alias.acceptanceCriteria)
    ], 12),
    interactionHotspots: [
      ...rawValuesAsList(primary.interactionHotspots),
      ...rawValuesAsList(alias.interactionHotspots)
    ],
    duplicatePageAliases: uniqueTexts([
      ...(Array.isArray(primary.duplicatePageAliases) ? primary.duplicatePageAliases : []),
      alias.id,
      alias.title
    ], 8)
  }
}

function hasHomePromptShortcutAliasContext(analysis = {}) {
  if (isHomePromptShortcutRequest(analysis)) return true
  const modelText = JSON.stringify(modelTotalDesignFlow(analysis) || {})
  const text = `${analysisText(analysis)} ${modelText}`
  return /首页|Home/i.test(text) &&
    /(快捷|提示词|prompt|chip|输入)/i.test(text) &&
    /PodcastStep1|Generate Script|Upload Script|Upload Audio|Video Podcast/i.test(text)
}

function collapseHomePromptShortcutAliasPages(pages = [], analysis = {}) {
  if (!hasHomePromptShortcutAliasContext(analysis) || pages.length < 2) return pages
  const collapsed = []
  let homeIndex = -1
  pages.forEach((page) => {
    if (!isHomePromptShortcutHomepage(page)) {
      collapsed.push(page)
      return
    }
    if (homeIndex < 0) {
      homeIndex = collapsed.length
      collapsed.push(page)
      return
    }
    collapsed[homeIndex] = mergeHomePromptShortcutAliasPage(collapsed[homeIndex], page)
  })
  return collapsed
}

function normalizeFunctionMapPage(raw = {}, index = 0) {
  if (!raw || typeof raw !== 'object') return null
  const pageName = cleanText(raw.pageName || raw.title || raw.name || raw.page || `页面 ${index + 1}`)
  if (!pageName) return null
  return {
    pageId: cleanText(raw.pageId || raw.id || raw.nodeId || raw.key || `page-${index + 1}`),
    pageName,
    belongsTo: uniqueTexts(Array.isArray(raw.belongsTo) ? raw.belongsTo : [raw.belongsTo || raw.module || raw.parent]),
    entry: cleanText(raw.entry || raw.route || raw.navigation || raw.from || ''),
    role: cleanText(raw.role || raw.userRole || '目标用户'),
    priority: cleanText(raw.priority || 'P0')
  }
}

function normalizeFunctionMapModule(raw = {}, index = 0) {
  if (!raw || typeof raw !== 'object') return null
  const name = cleanText(raw.name || raw.title || raw.moduleName || `功能模块 ${index + 1}`)
  if (!name) return null
  return {
    id: cleanText(raw.id || raw.moduleId || raw.key || `module-${index + 1}`),
    name,
    level: Number(raw.level || 1),
    summary: cleanText(raw.summary || raw.goal || raw.description || ''),
    pages: (Array.isArray(raw.pages) ? raw.pages : [])
      .map((page, pageIndex) => typeof page === 'string'
        ? { pageId: `module-${index + 1}-page-${pageIndex + 1}`, pageName: page }
        : normalizeFunctionMapPage(page, pageIndex)
      )
      .filter(Boolean),
    children: (Array.isArray(raw.children) ? raw.children : [])
      .map((child, childIndex) => normalizeFunctionMapModule(child, childIndex))
      .filter(Boolean)
  }
}

function normalizeProjectFunctionMap(raw = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rootModules = (Array.isArray(raw.rootModules) ? raw.rootModules : Array.isArray(raw.modules) ? raw.modules : [])
    .map((module, index) => normalizeFunctionMapModule(module, index))
    .filter(Boolean)
  const pageMap = (Array.isArray(raw.pageMap) ? raw.pageMap : Array.isArray(raw.pages) ? raw.pages : [])
    .map((page, index) => normalizeFunctionMapPage(page, index))
    .filter(Boolean)
  if (!rootModules.length && !pageMap.length) return null
  return {
    version: cleanText(raw.version || 'project-function-map/v1'),
    scopeType: cleanText(raw.scopeType || raw.type || 'new-project'),
    productName: cleanText(raw.productName || raw.name || raw.title || ''),
    summary: cleanText(raw.summary || raw.description || ''),
    rootModules,
    pageMap,
    navigationMap: (Array.isArray(raw.navigationMap) ? raw.navigationMap : Array.isArray(raw.navigation) ? raw.navigation : [])
      .map((item, index) => ({
        id: cleanText(item?.id || `nav-${index + 1}`),
        from: cleanText(item?.from || item?.source || ''),
        action: cleanText(item?.action || item?.trigger || '进入'),
        to: cleanText(item?.to || item?.target || ''),
        note: cleanText(item?.note || item?.summary || '')
      }))
      .filter((item) => item.from || item.to),
    rolePermissionMap: Array.isArray(raw.rolePermissionMap) ? raw.rolePermissionMap : [],
    userPath: Array.isArray(raw.userPath) ? raw.userPath.map(cleanText).filter(Boolean) : [],
    affectedScope: Array.isArray(raw.affectedScope) ? raw.affectedScope.map(cleanText).filter(Boolean) : []
  }
}

function modelProjectFunctionMapForAnalysis(analysis = {}) {
  const totalFlow = modelTotalDesignFlow(analysis)
  return normalizeProjectFunctionMap(totalFlow?.projectFunctionMap || totalFlow?.functionMap || totalFlow?.informationArchitecture)
}

function fallbackProjectFunctionMapForAnalysis(analysis = {}, requirementSlices = [], pages = []) {
  const blueprint = analysis.blueprint || {}
  const productName = cleanText(blueprint.profile?.productName || blueprint.title || '当前需求')
  const text = analysisText(analysis)
  const scopeType = pages.length > 3 || /(做一个|开发一个|新项目|小程序|App|APP|Web|网站|平台)/.test(text)
    ? 'new-project'
    : 'feature-slice'
  const fallbackModule = requirementSlices[0] || { id: 'main-requirement-flow', title: productName, goal: '围绕当前需求完成主要功能。' }
  const modules = (requirementSlices.length ? requirementSlices : [fallbackModule]).map((slice, index) => {
    const modulePages = pages.filter((page) => !page.sliceId || page.sliceId === slice.id || (index === 0 && !requirementSlices.some((item) => item.id === page.sliceId)))
    return {
      id: cleanText(slice.id || `module-${index + 1}`),
      name: cleanText(slice.title || slice.name || `功能模块 ${index + 1}`),
      level: 1,
      summary: cleanText(slice.goal || slice.summary || ''),
      pages: modulePages.map((page, pageIndex) => ({
        pageId: cleanText(page.id || page.nodeId || `page-${pageIndex + 1}`),
        pageName: cleanText(page.title || `页面 ${pageIndex + 1}`),
        priority: pageIndex < 3 ? 'P0' : 'P1'
      })),
      children: []
    }
  }).filter((module) => module.pages.length || module.summary)
  const pageMap = pages.map((page, index) => {
    const owner = modules.find((module) => module.pages.some((item) => item.pageId === page.id || item.pageName === page.title))
    return {
      pageId: cleanText(page.id || page.nodeId || `page-${index + 1}`),
      pageName: cleanText(page.title || `页面 ${index + 1}`),
      belongsTo: [owner?.name || modules[0]?.name || productName].filter(Boolean),
      entry: index === 0 ? '启动入口 / 首页' : pages[index - 1]?.title || '上一页面',
      role: '目标用户',
      priority: index < 3 ? 'P0' : 'P1'
    }
  })
  const navigationMap = pages.slice(0, -1).map((page, index) => ({
    id: `nav-${index + 1}`,
    from: page.title,
    action: index === 0 ? '开始主流程' : '完成当前页面主操作',
    to: pages[index + 1]?.title || '',
    note: '交互低保按该页面顺序生成页面级框架。'
  }))
  return {
    version: 'project-function-map/v1',
    scopeType,
    productName,
    summary: scopeType === 'new-project'
      ? '新项目需要先确认完整功能层级，再进入页面级交互低保。'
      : '小需求只标记影响范围和涉及页面，避免误扩展为完整项目。',
    rootModules: modules,
    pageMap,
    navigationMap,
    rolePermissionMap: [{ role: '目标用户', access: modules.map((module) => module.name).filter(Boolean) }],
    userPath: pages.map((page) => page.title).filter(Boolean),
    affectedScope: requirementSlices.map((slice) => slice.title).filter(Boolean)
  }
}

function projectFunctionMapForAnalysis(analysis = {}, requirementSlices = [], pages = []) {
  return modelProjectFunctionMapForAnalysis(analysis) || fallbackProjectFunctionMapForAnalysis(analysis, requirementSlices, pages)
}

function modelRequirementDissectionArtifactForAnalysis(analysis = {}) {
  const totalFlow = modelTotalDesignFlow(analysis)
  const artifact = totalFlow?.requirementDissectionArtifact || totalFlow?.requirementAnalysisArtifact || totalFlow?.productRequirementBrief
  return artifact && typeof artifact === 'object' && !Array.isArray(artifact)
    ? normalizeLooseRequirementDissectionArtifact(artifact)
    : null
}

function splitLooseFlowText(value = '') {
  return cleanText(value)
    .split(/\s*(?:->|→|=>|，|,|\n)\s*/g)
    .map(cleanText)
    .filter(Boolean)
}

function normalizeLooseNavigationStructure(value) {
  if (!Array.isArray(value) && !(typeof value === 'string')) return value
  const items = (Array.isArray(value) ? value : splitLooseFlowText(value))
    .map((item, index) => {
      if (item && typeof item === 'object') {
        const label = cleanText(item.label || item.title || item.name || item.pageName || item.targetPageName)
        return {
          ...item,
          id: cleanText(item.id || item.pageId || `nav-${index + 1}`),
          label: label || `导航项 ${index + 1}`,
          targetPageId: cleanText(item.targetPageId || item.pageId || item.id || label || `page-${index + 1}`),
          activeState: cleanText(item.activeState || '模型返回：当前页高亮'),
          visibilityRule: cleanText(item.visibilityRule || '模型返回：可访问时显示')
        }
      }
      const label = cleanText(item)
      return {
        id: `nav-${index + 1}`,
        label,
        targetPageId: label || `page-${index + 1}`,
        activeState: '模型返回：当前页高亮',
        visibilityRule: '模型返回：可访问时显示'
      }
    })
    .filter((item) => cleanText(item.label))
  return {
    globalEntries: items.map((item) => item.label),
    navigationItems: items
  }
}

function normalizeLoosePageHierarchyTree(value) {
  if (!Array.isArray(value) && !(typeof value === 'string')) return value
  const rawItems = Array.isArray(value)
    ? value
    : cleanText(value).split(/\n+/).map((line) => {
      const raw = cleanText(line)
      const label = raw.replace(/^[\s│├└─\-•*]+/g, '').trim()
      const indent = (line.match(/^[\s│]*/) || [''])[0].length
      return label ? { label, level: Math.max(1, Math.floor(indent / 2) + 1) } : null
    }).filter(Boolean)
  const nodes = rawItems.map((item, index) => {
    if (item && typeof item === 'object') {
      const label = cleanText(item.label || item.title || item.pageName || item.name || item.id)
      return {
        ...item,
        id: cleanText(item.id || item.pageId || `hierarchy-${index + 1}`),
        label: label || `页面节点 ${index + 1}`,
        pageId: cleanText(item.pageId || item.id || label || `page-${index + 1}`),
        parentId: cleanText(item.parentId || 'requirement-root'),
        level: Number.isFinite(Number(item.level)) ? Number(item.level) : 1,
        pageType: cleanText(item.pageType || item.type || '页面')
      }
    }
    const label = cleanText(item)
    return {
      id: `hierarchy-${index + 1}`,
      label,
      pageId: label || `page-${index + 1}`,
      parentId: 'requirement-root',
      level: 1,
      pageType: '页面'
    }
  }).filter((item) => cleanText(item.label))
  return {
    root: nodes[0]?.label || '',
    nodes,
    leafPageCount: nodes.length
  }
}

function normalizeLooseUserJourneyMap(value) {
  if (!Array.isArray(value) && !(typeof value === 'string')) return value
  const steps = Array.isArray(value)
    ? value
    : splitLooseFlowText(value).map((step) => ({ step }))
  return {
    firstTimePath: steps.filter(Boolean)
  }
}

function normalizeLooseDataFlowGraph(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  const edges = []
  if (typeof value === 'string') {
    const parts = splitLooseFlowText(value)
    parts.slice(0, -1).forEach((from, index) => {
      edges.push({
        id: `data-edge-${index + 1}`,
        from,
        to: parts[index + 1],
        label: '模型返回数据流'
      })
    })
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item && typeof item === 'object') {
        edges.push({
          ...item,
          id: cleanText(item.id || `data-edge-${index + 1}`),
          from: cleanText(item.from || item.source || item.sourcePageName || item.pageName),
          to: cleanText(item.to || item.target || item.targetPageName || item.downstream),
          label: cleanText(item.label || item.data || item.summary || item.action || '模型返回数据流')
        })
      } else {
        const parts = splitLooseFlowText(item)
        if (parts.length >= 2) {
          edges.push({ id: `data-edge-${index + 1}`, from: parts[0], to: parts[1], label: '模型返回数据流' })
        }
      }
    })
  }
  return { edges: edges.filter((edge) => edge.from || edge.to) }
}

function normalizeLooseStateMachineMap(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  const globalStates = []
  const pageStates = []
  ;(Array.isArray(value) ? value : splitLooseFlowText(value)).forEach((item, index) => {
    if (item && typeof item === 'object') {
      const states = Array.isArray(item.states) ? item.states : []
      if (states.length) {
        states.forEach((state, stateIndex) => {
          const stateText = cleanText(typeof state === 'object' ? state.state || state.label || state.name : state)
          if (stateText) {
            globalStates.push({
              id: cleanText(item.id || `${item.entity || item.pageName || 'state'}-${stateIndex + 1}`),
              state: stateText,
              trigger: cleanText(item.entity || item.pageName || item.title || '模型返回状态流'),
              display: stateText,
              recovery: cleanText(item.recovery || item.recoverAction || '')
            })
          }
        })
      }
      if (item.pageId || item.pageName) {
        pageStates.push({
          pageId: cleanText(item.pageId || item.id || `page-${index + 1}`),
          pageName: cleanText(item.pageName || item.title || item.entity || `页面 ${index + 1}`),
          states: states.map((state) => cleanText(typeof state === 'object' ? state.state || state.label || state.name : state)).filter(Boolean),
          transitions: Array.isArray(item.transitions) ? item.transitions : []
        })
      }
      return
    }
    const stateText = cleanText(item)
    if (stateText) {
      globalStates.push({
        id: `state-${index + 1}`,
        state: stateText,
        trigger: '模型返回状态流',
        display: stateText,
        recovery: ''
      })
    }
  })
  return { globalStates, pageStates }
}

function normalizeLooseFeatureJumpGraph(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  const edges = []
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item && typeof item === 'object') {
        edges.push({
          ...item,
          id: cleanText(item.id || `feature-jump-${index + 1}`),
          from: cleanText(item.from || item.sourcePageName || item.source),
          to: cleanText(item.to || item.targetPageName || item.target),
          action: cleanText(item.action || item.trigger || item.triggerCondition || '模型返回跳转'),
          condition: cleanText(item.condition || item.triggerCondition || item.trigger || '')
        })
      }
    })
  } else if (typeof value === 'string') {
    const parts = splitLooseFlowText(value)
    parts.slice(0, -1).forEach((from, index) => {
      edges.push({ id: `feature-jump-${index + 1}`, from, to: parts[index + 1], action: '模型返回跳转', condition: '' })
    })
  }
  return { edges: edges.filter((edge) => edge.from || edge.to) }
}

function normalizeLooseDesignOpportunityMatrix(value) {
  if (!Array.isArray(value) && !(typeof value === 'string')) return value
  const opportunities = (Array.isArray(value) ? value : [value]).map((item, index) => {
    if (item && typeof item === 'object') {
      return {
        ...item,
        id: cleanText(item.id || `opportunity-${index + 1}`),
        title: cleanText(item.title || item.opportunity || item.name || `设计机会 ${index + 1}`),
        expectedValue: cleanText(item.expectedValue || item.value || item.impact || ''),
        priority: cleanText(item.priority || '')
      }
    }
    return { id: `opportunity-${index + 1}`, title: cleanText(item), expectedValue: '', priority: '' }
  }).filter((item) => cleanText(item.title))
  return { opportunities }
}

function normalizeLoosePriorityRoadmap(value) {
  if (!Array.isArray(value) && !(typeof value === 'string')) return value
  const milestones = (Array.isArray(value) ? value : [value]).map((item, index) => {
    if (item && typeof item === 'object') {
      return {
        ...item,
        id: cleanText(item.id || `milestone-${index + 1}`),
        title: cleanText(item.title || item.phase || item.name || `里程碑 ${index + 1}`),
        deliverables: Array.isArray(item.deliverables) ? item.deliverables : rawValuesAsList(item.items || item.focus || item.summary)
      }
    }
    return { id: `milestone-${index + 1}`, title: cleanText(item), deliverables: [] }
  }).filter((item) => cleanText(item.title))
  return { milestones }
}

function normalizeLooseAcceptanceBasis(value) {
  if (!Array.isArray(value) && !(typeof value === 'string')) return value
  return {
    functional: valuesAsList(value)
  }
}

function normalizeLooseBusinessRuleMatrix(value) {
  if (!Array.isArray(value) && !(typeof value === 'string')) return value
  return {
    rules: (Array.isArray(value) ? value : [value]).map((item, index) => {
      if (item && typeof item === 'object') return { id: cleanText(item.id || `rule-${index + 1}`), ...item }
      return { id: `rule-${index + 1}`, rule: cleanText(item) }
    }).filter((item) => requirementItemText(item))
  }
}

function normalizeLooseFunctionModuleMatrix(value) {
  if (!Array.isArray(value)) return value
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') return item
    return {
      ...item,
      moduleName: cleanText(item.moduleName || item.module || item.title || item.name || `模块 ${index + 1}`)
    }
  })
}

function normalizeLooseDesignRequirementMap(value) {
  if (!Array.isArray(value)) return value
  return { pages: value }
}

function normalizeLooseBoundaryConditionMatrix(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  if (typeof value !== 'object') {
    const text = cleanText(value)
    return text ? [{ scenario: text }] : []
  }
  const directRows = value.conditions || value.items || value.rows || value.scenarios || value.boundaryConditions
  if (Array.isArray(directRows)) return directRows
  if (value.scenario || value.triggerCondition || value.expectedBehavior || value.recoveryPath) return [value]
  return Object.entries(value)
    .map(([key, item]) => {
      if (!item) return null
      if (typeof item === 'object' && !Array.isArray(item)) {
        return {
          scenario: cleanText(item.scenario || item.title || item.name || key),
          triggerCondition: cleanText(item.triggerCondition || item.trigger || item.condition || ''),
          expectedBehavior: cleanText(item.expectedBehavior || item.behavior || item.expected || ''),
          recoveryPath: cleanText(item.recoveryPath || item.recovery || item.solution || '')
        }
      }
      return { scenario: cleanText(key), expectedBehavior: cleanText(item) }
    })
    .filter((item) => item?.scenario || item?.triggerCondition || item?.expectedBehavior || item?.recoveryPath)
}

function normalizeLooseRequirementDissectionArtifact(artifact = {}) {
  const next = JSON.parse(JSON.stringify(artifact))
  const normalizeIfReturned = (key, normalize) => {
    if (Object.prototype.hasOwnProperty.call(next, key)) next[key] = normalize(next[key])
  }
  normalizeIfReturned('navigationStructure', normalizeLooseNavigationStructure)
  normalizeIfReturned('pageHierarchyTree', normalizeLoosePageHierarchyTree)
  normalizeIfReturned('userJourneyMap', normalizeLooseUserJourneyMap)
  normalizeIfReturned('dataFlowGraph', normalizeLooseDataFlowGraph)
  normalizeIfReturned('stateMachineMap', normalizeLooseStateMachineMap)
  normalizeIfReturned('featureJumpGraph', normalizeLooseFeatureJumpGraph)
  normalizeIfReturned('designOpportunityMatrix', normalizeLooseDesignOpportunityMatrix)
  normalizeIfReturned('priorityRoadmap', normalizeLoosePriorityRoadmap)
  normalizeIfReturned('acceptanceBasis', normalizeLooseAcceptanceBasis)
  normalizeIfReturned('businessRuleMatrix', normalizeLooseBusinessRuleMatrix)
  normalizeIfReturned('functionModuleMatrix', normalizeLooseFunctionModuleMatrix)
  normalizeIfReturned('designRequirementMap', normalizeLooseDesignRequirementMap)
  normalizeIfReturned('boundaryConditionMatrix', normalizeLooseBoundaryConditionMatrix)
  return next
}

function mergeObjectWithFallback(primary = {}, fallback = {}) {
  const result = { ...(fallback || {}) }
  Object.entries(primary || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value.length ? value : fallback?.[key]
      return
    }
    if (value && typeof value === 'object') {
      result[key] = mergeObjectWithFallback(value, fallback?.[key] || {})
      return
    }
    result[key] = value || fallback?.[key]
  })
  return result
}

function requirementItemText(item = '') {
  if (typeof item === 'string') return cleanText(item)
  if (!item || typeof item !== 'object') return ''
  const title = item.title || item.name || item.pageName || item.goal || item.question || item.summary || item.reason || ''
  const detail = item.description || item.impact || item.primaryAction || item.priority || ''
  if (title && detail && cleanText(title) !== cleanText(detail)) return `${cleanText(title)}：${cleanText(detail)}`
  if (title) return cleanText(title)
  return Object.entries(item)
    .filter(([key, value]) => !/^(id|key|nodeId|pageId|version)$/.test(key) && value !== null && value !== undefined && value !== '')
    .slice(0, 4)
    .map(([key, value]) => `${key}：${Array.isArray(value) ? value.map(requirementItemText).filter(Boolean).join('、') : cleanText(value)}`)
    .join('；')
}

function mergeScenarioTextList(primary = [], fallback = [], limit = 8) {
  return uniqueTexts([
    ...(Array.isArray(primary) ? primary : [primary]),
    ...(Array.isArray(fallback) ? fallback : [fallback])
  ].map(requirementItemText).filter(Boolean), limit)
}

function pageRequirementRowKey(page = {}, index = 0) {
  return cleanText(page.pageId || page.id || page.nodeId || page.pageName || page.title || `page-${index + 1}`)
}

function fallbackPageRequirementForRow(row = {}, fallbackRows = [], index = 0) {
  const key = pageRequirementRowKey(row, index)
  return fallbackRows.find((item, itemIndex) => pageRequirementRowKey(item, itemIndex) === key) ||
    fallbackRows.find((item) => cleanText(item.pageName || item.title) && cleanText(item.pageName || item.title) === cleanText(row.pageName || row.title)) ||
    fallbackRows[index] ||
    {}
}

function completePageRequirementRows(primary = [], fallback = []) {
  const primaryRows = Array.isArray(primary) ? primary : []
  const fallbackRows = Array.isArray(fallback) ? fallback : []
  const rows = primaryRows.length ? primaryRows : fallbackRows
  const completed = rows.map((row, index) => {
    const fallbackRow = fallbackPageRequirementForRow(row, fallbackRows, index)
    const pageName = cleanText(row.pageName || row.title || fallbackRow.pageName || fallbackRow.title || `页面 ${index + 1}`)
    const pageForHotspots = { ...fallbackRow, ...row, title: pageName, pageName }
    const interactionHotspots = mergePageInteractionHotspots(
      row.interactionHotspots || row.controls || row.hotspots || row.interactionControls,
      fallbackRow.interactionHotspots || fallbackRow.controls || pageInteractionHotspots(pageForHotspots, index, fallbackRows),
      pageForHotspots,
      index,
      fallbackRows,
      10
    )
    return {
      ...fallbackRow,
      ...row,
      pageId: cleanText(row.pageId || row.id || fallbackRow.pageId || fallbackRow.id || `page-${index + 1}`),
      pageName,
      goal: cleanText(row.goal || row.summary || fallbackRow.goal || `${pageName} 需要承接主流程中的明确任务。`),
      mustCarry: mergeScenarioTextList(row.mustCarry || row.modules || row.sections, fallbackRow.mustCarry, 8),
      primaryAction: cleanText(row.primaryAction || row.mainAction || fallbackRow.primaryAction || '完成当前页面主操作并进入下一步'),
      interactionHotspots,
      states: mergeScenarioTextList(row.states || row.stateCoverage, fallbackRow.states || ['默认', '加载', '空状态', '失败重试', '禁用/不可用'], 8),
      dataDependencies: mergeScenarioTextList(row.dataDependencies || row.data || row.apiDependencies, fallbackRow.dataDependencies || ['页面基础数据', '当前业务状态', '用户选择结果'], 8),
      acceptanceCriteria: mergeScenarioTextList(row.acceptanceCriteria || row.acceptance || row.testPoints, fallbackRow.acceptanceCriteria || ['页面目标可识别', '主操作可完成', '异常状态可恢复'], 6)
    }
  })
  const completedKeys = new Set(completed.map((row, index) => pageRequirementRowKey(row, index)))
  fallbackRows.forEach((row, index) => {
    const key = pageRequirementRowKey(row, index)
    if (!completedKeys.has(key)) completed.push(row)
  })
  return completed
}

function completePageCoverageMatrixRows(primary = [], fallback = []) {
  const primaryRows = Array.isArray(primary) ? primary : []
  const fallbackRows = Array.isArray(fallback) ? fallback : []
  const rows = primaryRows.length ? primaryRows : fallbackRows
  const completed = rows.map((row, index) => {
    const fallbackRow = fallbackPageRequirementForRow(row, fallbackRows, index)
    const pageName = cleanText(row.pageName || row.title || fallbackRow.pageName || fallbackRow.title || `页面 ${index + 1}`)
    return {
      ...fallbackRow,
      ...row,
      id: cleanText(row.id || row.pageId || fallbackRow.id || fallbackRow.pageId || `page-coverage-${index + 1}`),
      pageName,
      pageType: cleanText(row.pageType || row.type || fallbackRow.pageType || fallbackRow.type || '业务页面'),
      participationReason: cleanText(row.participationReason || row.reason || row.summary || fallbackRow.participationReason || `${pageName} 参与当前主流程。`),
      sourceEvidence: cleanText(row.sourceEvidence || row.evidence || fallbackRow.sourceEvidence || '用户输入或项目资料'),
      entryFrom: cleanText(row.entryFrom || row.from || fallbackRow.entryFrom || (index === 0 ? '启动入口 / 上游入口' : '上一页面')),
      exitTo: cleanText(row.exitTo || row.to || fallbackRow.exitTo || '流程完成 / 下一阶段'),
      primaryActions: mergeScenarioTextList(row.primaryActions || row.actions, fallbackRow.primaryActions || ['完成当前页面主操作'], 6),
      stateCoverage: mergeScenarioTextList(row.stateCoverage || row.states, fallbackRow.stateCoverage || ['默认', '加载', '失败重试'], 6),
      confidence: cleanText(row.confidence || fallbackRow.confidence || 'medium'),
      openQuestions: mergeScenarioTextList(row.openQuestions || row.questions, fallbackRow.openQuestions || [], 5)
    }
  })
  const completedNames = new Set(completed.map((row) => row.pageName))
  fallbackRows.forEach((row) => {
    if (!completedNames.has(cleanText(row.pageName || row.title))) completed.push(row)
  })
  return completed
}

function completeRequirementDissectionArtifact(modelArtifact = {}, fallbackArtifact = {}) {
  const merged = mergeObjectWithFallback(modelArtifact, fallbackArtifact)
  const pageCoverageMatrix = completePageCoverageMatrixRows(
    merged.pageCoverageMatrix || merged.designRequirementMap?.pageCoverageMatrix,
    fallbackArtifact.pageCoverageMatrix || fallbackArtifact.designRequirementMap?.pageCoverageMatrix
  )
  merged.pageCoverageMatrix = pageCoverageMatrix
  merged.userScenarios = {
    ...(fallbackArtifact.userScenarios || {}),
    ...(merged.userScenarios || {}),
    primaryUsers: mergeScenarioTextList(merged.userScenarios?.primaryUsers, fallbackArtifact.userScenarios?.primaryUsers, 6),
    coreScenarios: mergeScenarioTextList(merged.userScenarios?.coreScenarios, fallbackArtifact.userScenarios?.coreScenarios, 8),
    jobsToBeDone: mergeScenarioTextList(merged.userScenarios?.jobsToBeDone, fallbackArtifact.userScenarios?.jobsToBeDone, 8),
    designImplications: mergeScenarioTextList(merged.userScenarios?.designImplications, fallbackArtifact.userScenarios?.designImplications, 8)
  }
  merged.designRequirementMap = {
    ...(fallbackArtifact.designRequirementMap || {}),
    ...(merged.designRequirementMap || {}),
    pages: completePageRequirementRows(merged.designRequirementMap?.pages, fallbackArtifact.designRequirementMap?.pages),
    globalStates: mergeScenarioTextList(merged.designRequirementMap?.globalStates, fallbackArtifact.designRequirementMap?.globalStates, 10),
    interactionFocus: mergeScenarioTextList(merged.designRequirementMap?.interactionFocus, fallbackArtifact.designRequirementMap?.interactionFocus, 10),
    acceptanceChecklist: mergeScenarioTextList(merged.designRequirementMap?.acceptanceChecklist, fallbackArtifact.designRequirementMap?.acceptanceChecklist, 10)
  }
  delete merged.designRequirementMap.pageCoverageMatrix
  merged.businessRuleMatrix = normalizeBusinessRuleMatrix(
    merged.businessRuleMatrix || merged.businessRules,
    fallbackArtifact.businessRuleMatrix || fallbackArtifact.businessRules
  )
  delete merged.businessRules
  ;[
    'analysisGuidance',
    'knowledgeLoadingContext',
    'evidenceAndAssumptions',
    'riskAssessment',
    'gapConfirmation',
    'personaScenarioMatrix',
    'navigationStructure',
    'functionModuleMatrix',
    'pageHierarchyTree',
    'decisionPointMatrix',
    'decisionFlowGraph',
    'exceptionRecoveryMatrix',
    'permissionMatrix',
    'boundaryConditionMatrix',
    'dataFlowGraph',
    'stateMachineMap',
    'featureJumpGraph',
    'dataSharingMechanism',
    'designOpportunityMatrix',
    'priorityRoadmap',
    'acceptanceBasis',
    'pageFrameContracts'
  ].forEach((key) => {
    if (!merged[key] || (Array.isArray(merged[key]) && !merged[key].length)) merged[key] = fallbackArtifact[key]
  })
  merged.productAnalysisPipeline = completeProductAnalysisPipeline(merged.productAnalysisPipeline, merged)
  delete merged.projectFunctionMap
  return merged
}

function listFromValues(items = [], fallback = [], limit = 8) {
  return uniqueTexts((Array.isArray(items) ? items : [items]).filter(Boolean), limit).length
    ? uniqueTexts((Array.isArray(items) ? items : [items]).filter(Boolean), limit)
    : uniqueTexts(fallback, limit)
}

function valuesAsList(value = []) {
  if (Array.isArray(value)) return value.flatMap(valuesAsList)
  if (!value) return []
  if (typeof value === 'object') return [requirementItemText(value)].filter(Boolean)
  return [cleanText(value)].filter(Boolean)
}

function rawValuesAsList(value = []) {
  if (Array.isArray(value)) return value.flatMap(rawValuesAsList)
  return value ? [value] : []
}

function pageTitle(page = {}, index = 0) {
  return cleanText(page.title || page.pageName || page.page || page.name || `页面 ${index + 1}`)
}

function pageStableId(page = {}, index = 0) {
  return cleanText(page.pageId || page.id || page.nodeId || page.key || `page-${index + 1}`)
}

function pageInteractionSourceLists(page = {}, index = 0, pages = []) {
  const title = pageTitle(page, index)
  const layoutSpec = pageLayoutSpecForPage(page, {})
  const layoutPage = Array.isArray(layoutSpec?.pages) && layoutSpec.pages.length ? layoutSpec.pages[0] : {}
  const moduleItems = uniqueTexts([
    ...valuesAsList(page.modules),
    ...valuesAsList(page.sections),
    ...pageSectionItems(page, '核心模块'),
    ...pageSectionItems(page, '页面核心模块'),
    ...valuesAsList(layoutPage.topFixed),
    ...valuesAsList(layoutPage.scrollModules),
    ...valuesAsList(layoutPage.bottomFixed),
    ...valuesAsList(layoutPage.overlays)
  ], 12)
  const actionItems = uniqueTexts([
    ...valuesAsList(page.interactions),
    ...valuesAsList(page.primaryActions),
    ...valuesAsList(page.clickActions),
    ...pageSectionItems(page, '用户点击动作'),
    ...valuesAsList(layoutPage.interactions)
  ], 12)
  const routeTargets = uniqueTexts([
    ...valuesAsList(page.routeTargets),
    ...valuesAsList(page.routes),
    ...pageSectionItems(page, '跳转'),
    `进入「${nextPageTitle(pages, index)}」或停留在「${title}」展示反馈。`
  ], 8)
  const stateItems = uniqueTexts([
    ...valuesAsList(page.states),
    ...valuesAsList(page.stateCoverage),
    ...valuesAsList(page.pageArchitecture?.states),
    ...pageSectionItems(page, '状态')
  ], 8)
  const dataItems = uniqueTexts([
    ...valuesAsList(page.dataDependencies),
    ...valuesAsList(page.data),
    ...valuesAsList(page.apiDependencies),
    ...valuesAsList(page.interactionDetails?.dataDependencies),
    ...pageSectionItems(page, '接口'),
    ...pageSectionItems(page, '数据')
  ], 8)
  const acceptanceItems = uniqueTexts([
    ...valuesAsList(page.acceptanceCriteria),
    ...valuesAsList(page.acceptance),
    ...valuesAsList(page.testPoints),
    ...valuesAsList(page.interactionDetails?.acceptanceCriteria),
    ...pageSectionItems(page, '验收点')
  ], 8)
  return { title, moduleItems, actionItems, routeTargets, stateItems, dataItems, acceptanceItems }
}

function rawPageHotspots(page = {}) {
  return [
    ...rawValuesAsList(page.interactionHotspots),
    ...rawValuesAsList(page.controls),
    ...rawValuesAsList(page.controlHotspots),
    ...rawValuesAsList(page.hotspots),
    ...rawValuesAsList(page.interactionControls),
    ...rawValuesAsList(page.requirementRow?.interactionHotspots)
  ]
}

function targetFromInteractionText(text = '', fallback = '') {
  const normalized = cleanText(text)
  if (!normalized) return fallback
  const colonPrefix = normalized.match(/^([^：:]{1,28})[：:]/)?.[1]
  if (colonPrefix) return cleanText(colonPrefix)
  return cleanText(
    normalized
      .replace(/^(点击|单击|轻点|选择|切换|提交|输入|搜索|打开|关闭|返回|下拉|滑动|长按)/, '')
      .replace(/后.*$/, '')
      .replace(/触发.*$/, '')
      .replace(/[。；;，,]$/, '')
  ) || fallback
}

function inferControlType(target = '', operation = '') {
  const text = `${target} ${operation}`
  if (/输入|搜索|备注|表单|地址/.test(text)) return 'input'
  if (/切换|选择|筛选|分类|标签|规格|优惠|方式/.test(text)) return 'selector'
  if (/弹窗|浮层|抽屉|说明|提示/.test(text)) return 'overlay'
  if (/返回|关闭/.test(text)) return 'navigation'
  if (/按钮|提交|支付|结算|加入|确认|生成|下载|放大|应用|保存|完成/.test(text)) return 'button'
  if (/列表|卡片|商品|订单|内容|详情|明细|Banner|轮播/.test(text)) return 'content'
  return 'hotspot'
}

function gestureForControl(target = '', operation = '') {
  const text = `${target} ${operation}`
  if (/下拉|刷新/.test(text)) return '下拉'
  if (/横滑|左右|轮播/.test(text)) return '横向滑动'
  if (/滑|拖|滚动/.test(text)) return '滑动/拖拽'
  if (/长按/.test(text)) return '长按'
  if (/输入|搜索|备注/.test(text)) return '输入'
  return '单击'
}

function operationForControl(target = '', action = '', type = '') {
  const actionText = cleanText(action).replace(/^[^：:]{1,28}[：:]\s*/, '')
  if (actionText && actionText !== target && !/^(信息展示|状态反馈)$/.test(actionText)) return actionText
  if (type === 'input') return `在「${target}」输入或搜索后触发校验与结果刷新。`
  if (type === 'selector') return `切换「${target}」选项并刷新当前页面相关内容。`
  if (type === 'overlay') return `打开或关闭「${target}」，保持底层页面状态。`
  if (type === 'content') return `点击「${target}」进入详情、展开内容或完成选中。`
  if (type === 'navigation') return `点击「${target}」返回或关闭当前层级，并保留关键状态。`
  return `点击「${target}」后执行当前页面对应操作。`
}

function rowStatesForControl(target = '', operation = '', type = '', index = 0) {
  const text = `${target} ${operation}`
  if (type === 'input') return ['未填写', '输入中', '校验失败']
  if (type === 'selector') return ['未选中', '已选中', '不可选']
  if (type === 'overlay') return ['关闭', '打开', '关闭后保持']
  if (type === 'navigation') return ['可返回', '返回保持']
  if (type === 'content') return ['默认', '选中/展开', '无数据']
  if (/支付|结算|提交|下单|保存|生成|完成|加入/.test(text)) return ['可提交', '提交中', '提交失败']
  return index % 2 === 0 ? ['默认', '处理中', '失败'] : ['默认', '已触发', '不可用']
}

function promptCopyForControl(target = '', operation = '', type = '') {
  const text = `${target} ${operation}`
  if (/失败|错误|异常|超时/.test(text)) return '操作失败，请重试'
  if (/支付|结算|提交|下单|保存|生成|完成|加入/.test(text)) return '正在提交，请稍候'
  if (type === 'input') return '已更新输入内容'
  if (type === 'selector') return '已更新选择'
  if (type === 'overlay') return '已打开详情'
  if (type === 'navigation') return '已保留当前状态'
  return '操作已更新'
}

function normalizeInteractionHotspot(raw = '', controlIndex = 0, page = {}, pageIndex = 0, pages = []) {
  const sourceLists = pageInteractionSourceLists(page, pageIndex, pages)
  const rawObject = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const text = typeof raw === 'string' ? raw : requirementItemText(rawObject)
  const target = cleanText(
    rawObject.target ||
    rawObject.name ||
    rawObject.control ||
    rawObject.component ||
    rawObject.module ||
    rawObject.title ||
    rawObject.label ||
    rawObject.element ||
    rawObject.area ||
    targetFromInteractionText(text, sourceLists.moduleItems[controlIndex] || `交互对象 ${controlIndex + 1}`)
  )
  if (!target) return null
  const type = cleanText(rawObject.type || rawObject.controlType || inferControlType(target, text))
  const operation = cleanText(rawObject.operation || rawObject.action || rawObject.behavior || operationForControl(target, text, type))
  const routeTarget = sourceLists.routeTargets[controlIndex] || sourceLists.routeTargets[0] || `进入「${nextPageTitle(pages, pageIndex)}」或停留当前页展示反馈。`
  const fallbackResult = type === 'navigation'
    ? '返回上一级或关闭当前层级，并保留已输入/已选择状态。'
    : type === 'overlay'
      ? `停留当前页并打开/关闭「${target}」。`
      : routeTarget
  const states = listFromValues(rawObject.states || rawObject.stateCoverage, rowStatesForControl(target, operation, type, controlIndex), 3)
  const dataDependencies = listFromValues(rawObject.dataDependencies || rawObject.data || rawObject.apiDependencies, sourceLists.dataItems.length ? sourceLists.dataItems : ['页面基础数据', '当前业务状态', '用户选择结果'], 4)
  const testPoints = listFromValues(rawObject.testPoints || rawObject.acceptanceCriteria || rawObject.acceptance, [
    `${target}可被触发且反馈明确。`,
    `${target}在禁用、失败或权限不足时有恢复方式。`
  ], 3)
  return {
    id: cleanText(rawObject.id || rawObject.key || `hotspot-${controlIndex + 1}`),
    target,
    type,
    gesture: cleanText(rawObject.gesture || rawObject.trigger || gestureForControl(target, operation)),
    operation,
    feedback: cleanText(rawObject.feedback || rawObject.response || `${target}触发后给出即时状态反馈。`),
    result: cleanText(rawObject.result || rawObject.route || rawObject.to || fallbackResult),
    enableCondition: cleanText(rawObject.enableCondition || rawObject.enabledCondition || '页面核心数据加载完成，控件处于可操作状态。'),
    disableCondition: cleanText(rawObject.disableCondition || rawObject.disabledCondition || '请求处理中、必填条件缺失、权限不足或业务状态不允许时禁用。'),
    displayCondition: cleanText(rawObject.displayCondition || rawObject.visibleCondition || '进入当前页面且该控件与当前用户任务相关时显示。'),
    hideCondition: cleanText(rawObject.hideCondition || rawObject.hiddenCondition || '无数据、无权限、业务开关关闭或上游流程不需要时隐藏。'),
    statePromptCopy: cleanText(rawObject.statePromptCopy || rawObject.promptCopy || rawObject.toastCopy || promptCopyForControl(target, operation, type)),
    motion: cleanText(rawObject.motion || rawObject.animation || (/弹窗|浮层|抽屉/.test(`${target}${operation}`) ? '浮层进入使用 200ms ease-out，关闭使用 160ms ease-in。' : '基础点击反馈 120ms 内完成；页面跳转使用系统默认转场。')),
    states,
    dataDependencies,
    testPoints
  }
}

function mergePageInteractionHotspots(primary = [], fallback = [], page = {}, pageIndex = 0, pages = [], limit = 10) {
  const seen = new Set()
  return [
    ...(Array.isArray(primary) ? primary : [primary]).filter(Boolean),
    ...(Array.isArray(fallback) ? fallback : [fallback]).filter(Boolean)
  ]
    .map((item, index) => normalizeInteractionHotspot(item, index, page, pageIndex, pages))
    .filter((item) => {
      if (!item) return false
      const key = `${item.target}|${item.operation}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

function requirementRowForPage(page = {}, index = 0, requirementRows = []) {
  const pageKey = pageRequirementRowKey(page, index)
  const pageName = cleanText(page.title || page.pageName)
  return requirementRows.find((row, rowIndex) => pageRequirementRowKey(row, rowIndex) === pageKey) ||
    requirementRows.find((row) => cleanText(row.pageName || row.title) && cleanText(row.pageName || row.title) === pageName) ||
    requirementRows[index] ||
    null
}

function pageNameMatches(value = '', page = {}) {
  const text = cleanText(value)
  const title = cleanText(page.title || page.pageName)
  if (!text || !title) return false
  return text === title || text.includes(title) || title.includes(text)
}

function rowsRelatedToPage(rows = [], page = {}) {
  const title = cleanText(page.title || page.pageName)
  if (!title) return []
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row || typeof row !== 'object') return false
    const directPageRefs = [row.pageName, row.page, row.from, row.to, row.source, row.target]
    if (directPageRefs.some((item) => pageNameMatches(item, page))) return true
    const affected = [
      ...(Array.isArray(row.affectedPages) ? row.affectedPages : []),
      ...(Array.isArray(row.pages) ? row.pages : []),
      ...(Array.isArray(row.downstream) ? row.downstream : [])
    ]
    return affected.some((item) => pageNameMatches(item, page))
  })
}

function attachRequirementRowsToPages(pages = [], requirementArtifact = {}) {
  const rows = Array.isArray(requirementArtifact?.designRequirementMap?.pages)
    ? requirementArtifact.designRequirementMap.pages
    : []
  const pageDataRows = Array.isArray(requirementArtifact?.dataFlowGraph?.pageData)
    ? requirementArtifact.dataFlowGraph.pageData
    : []
  const pageStateRows = Array.isArray(requirementArtifact?.stateMachineMap?.pageStates)
    ? requirementArtifact.stateMachineMap.pageStates
    : []
  return pages.map((page, index) => {
    const requirementRow = requirementRowForPage(page, index, rows)
    const relatedDecisionPoints = rowsRelatedToPage(requirementArtifact?.decisionPointMatrix, page)
    const relatedExceptions = rowsRelatedToPage(requirementArtifact?.exceptionRecoveryMatrix, page)
    const relatedJumpEdges = rowsRelatedToPage(requirementArtifact?.featureJumpGraph?.edges, page)
    const relatedDataFlow = pageDataRows.find((row) => pageNameMatches(row?.pageName, page)) || null
    const relatedStateMachine = pageStateRows.find((row) => pageNameMatches(row?.pageName, page)) || null
    if (!requirementRow) {
      return {
        ...page,
        relatedDecisionPoints,
        relatedExceptions,
        relatedDataFlow,
        relatedStateMachine,
        relatedJumpEdges
      }
    }
    return {
      ...page,
      requirementRow,
      relatedDecisionPoints,
      relatedExceptions,
      relatedDataFlow,
      relatedStateMachine,
      relatedJumpEdges,
      interactionHotspots: mergePageInteractionHotspots(
        page.interactionHotspots || page.controls || page.hotspots,
        requirementRow.interactionHotspots || requirementRow.controls || requirementRow.hotspots,
        { ...page, requirementRow },
        index,
        pages,
        10
      ),
      dataDependencies: listFromValues(page.dataDependencies, requirementRow.dataDependencies, 8),
      acceptanceCriteria: listFromValues(page.acceptanceCriteria, requirementRow.acceptanceCriteria, 8),
      states: listFromValues(page.states, requirementRow.states, 8)
    }
  })
}

function pageInteractionHotspots(page = {}, index = 0, pages = []) {
  const sourceLists = pageInteractionSourceLists(page, index, pages)
  const rawHotspots = rawPageHotspots(page)
  const actionHotspots = sourceLists.actionItems.map((action, actionIndex) => ({
    target: targetFromInteractionText(action, sourceLists.moduleItems[actionIndex] || `主操作 ${actionIndex + 1}`),
    operation: action,
    result: sourceLists.routeTargets[actionIndex] || sourceLists.routeTargets[0]
  }))
  const moduleHotspots = sourceLists.moduleItems
    .filter((item) => !/^(信息展示|状态反馈|页面标题区)$/.test(item))
    .map((item) => ({ target: item }))
  const fallbackHotspots = [
    ...moduleHotspots,
    ...actionHotspots,
    { target: '返回/关闭入口', type: 'navigation', operation: '返回上一页或关闭浮层，并保留已输入/已选择状态。', result: '返回上一级或停留当前页。' }
  ]
  return mergePageInteractionHotspots(rawHotspots, fallbackHotspots, page, index, pages, 10)
}

function productTypeForAnalysis(text = '') {
  if (/小程序/.test(text)) return '微信小程序'
  if (/\bApp\b|APP|移动应用/.test(text)) return 'App'
  if (/后台|管理端|SaaS|CRM|ERP/.test(text)) return 'SaaS / 管理后台'
  if (/网站|Web|官网|落地页/.test(text)) return 'Web'
  return '数字产品'
}

function competitorSearchDirections(text = '', productType = '数字产品') {
  if (hasPodcastorContext(text) || /播客|podcast/i.test(text)) {
    return [
      'AI podcast generator homepage onboarding patterns',
      'AI 播客生成工具 首页 创作入口 快捷提示词',
      'podcast creation tool homepage prompt examples'
    ]
  }
  if (/首页/.test(text) && /(快捷|提示词|prompt|输入)/i.test(text)) {
    return [
      'AI product homepage prompt shortcut chips',
      'SaaS homepage quick start prompt examples',
      'AI 工具首页 快捷提示词 输入入口 设计模式'
    ]
  }
  if (/后台|管理端|SaaS|CRM|ERP/.test(text)) {
    return [
      'SaaS dashboard homepage onboarding patterns',
      'workflow management dashboard empty state quick actions',
      '管理后台 首页 工作台 快捷入口 状态反馈'
    ]
  }
  return [
    `${productType} 首页 首屏入口 主任务路径 状态反馈`,
    `${productType} onboarding quick actions UX patterns`,
    `${productType} empty state recovery competitor reference`
  ]
}

function pageRequirementRows(pages = []) {
  return pages.map((page, index) => {
    const hotspots = pageInteractionHotspots(page, index, pages)
    return {
      pageId: cleanText(page.id || page.nodeId || `page-${index + 1}`),
      pageName: pageTitle(page, index),
      goal: cleanText(page.summary || page.goal || `${pageTitle(page, index)} 需要承接主流程中的明确任务。`),
      mustCarry: listFromValues(
        page.modules || page.sections || [],
        ['页面目标', '核心信息', '主操作入口', '状态反馈'],
        6
      ),
      primaryAction: cleanText(page.primaryAction || page.interactions?.[0] || hotspots[0]?.operation || '完成当前页面主操作并进入下一步'),
      interactionHotspots: hotspots,
      states: listFromValues(page.states || page.pageArchitecture?.states || [], ['默认', '加载', '空状态', '失败重试', '禁用/不可用'], 6),
      dataDependencies: listFromValues(page.dataDependencies || page.interactionDetails?.dataDependencies || hotspots.flatMap((item) => item.dataDependencies || []), ['页面基础数据', '当前业务状态', '用户选择结果'], 6),
      acceptanceCriteria: listFromValues(page.acceptanceCriteria || page.testPoints || hotspots.flatMap((item) => item.testPoints || []), ['页面目标可识别', '主操作可完成', '加载/空/失败/权限状态可验证'], 6)
    }
  })
}

function pageCoverageFallbackEvidence(analysis = {}) {
  return analysis.demandScope === 'project'
    ? '用户输入或项目资料'
    : '用户输入、附件、对话确认或模型假设'
}

function pageCoverageMatrixForAnalysis(analysis = {}, pages = []) {
  if (hasWorkflowAnalysisCoverageContext(analysis)) {
    return workflowAnalysisCoverageDefinitions(analysis)
  }
  return pages.map((page, index) => {
    const title = pageTitle(page, index)
    const hotspots = pageInteractionHotspots(page, index, pages)
    return {
      id: cleanText(page.id || page.nodeId || `page-coverage-${index + 1}`),
      pageName: title,
      pageType: cleanText(page.pageType || page.type || '业务页面'),
      participationReason: cleanText(page.summary || page.goal || `${title} 参与当前主流程并承接页面级任务。`),
      sourceEvidence: sourceExcerpt(analysisText(analysis), [title]) || pageCoverageFallbackEvidence(analysis),
      entryFrom: index === 0 ? '启动入口 / 上游入口' : pages[index - 1]?.title || '上一页面',
      exitTo: pages[index + 1]?.title || page.route || '流程完成 / 下一阶段',
      primaryActions: listFromValues(page.primaryActions || page.interactions || hotspots.map((item) => item.operation), ['完成当前页面主操作'], 5),
      stateCoverage: listFromValues(page.states || page.stateCoverage, ['默认', '加载', '空状态', '失败重试', '权限不足'], 6),
      confidence: 'medium',
      openQuestions: []
    }
  })
}

function evidenceAndAssumptionsForAnalysis(analysis = {}, pages = []) {
  const text = analysisText(analysis)
  const isProjectDemand = analysis.demandScope === 'project'
  const selectedDocuments = isProjectDemand ? selectedKnowledgeScopeDocuments(analysis) : []
  const attachedDocuments = (analysis.documents || []).filter((doc) => !selectedDocuments.includes(doc))
  return {
    demandScope: isProjectDemand ? 'project' : 'non-project',
    confirmedFacts: uniqueTexts([
      analysis.input ? `用户输入：${sourceExcerpt(text, [analysis.input.slice(0, 20)])}` : '',
      pages.length ? `已识别 ${pages.length} 个候选参与页面。` : '',
      isProjectDemand ? '本次需求绑定项目，可使用当前项目知识作为证据。' : '本次为非项目需求，不使用当前项目知识库。'
    ], 8),
    evidenceSources: uniqueTexts([
      '用户输入',
      attachedDocuments.length ? `上传/附加材料 ${attachedDocuments.length} 份` : '',
      selectedDocuments.length ? `项目知识库 ${selectedDocuments.length} 份` : ''
    ], 8),
    assumptions: uniqueTexts([
      pages.length ? '页面清单按当前输入推导，缺少明确证据的页面需要用户确认。' : '',
      isProjectDemand ? '项目知识只用于当前 run 绑定项目，不能用工作台壳名称替代业务项目。' : '非项目结论属于可验证推导，不能自动沉淀为项目知识。',
      '未确认的权限、支付、审核、后台和第三方集成先进入待确认项。'
    ], 8),
    knowledgePolicy: isProjectDemand
      ? '允许引用当前项目知识库，并在证据包中展示来源。'
      : '禁止继承 URL 项目、当前项目或项目知识库；只使用用户输入、附件、对话确认和模型假设。',
    openEvidenceQuestions: pendingQuestions(analysis).slice(0, 5)
  }
}

function navigationStructureForAnalysis(projectFunctionMap = null, pages = []) {
  const pageTitles = pages.map((page) => page.title).filter(Boolean)
  const modules = projectFunctionMap?.rootModules || []
  const navigationItems = pages.map((page, index) => {
    const pageName = pageTitle(page, index)
    const pageId = pageStableId(page, index)
    const ownerModule = modules.find((module) =>
      (module.pages || []).some((modulePage) => cleanText(modulePage.pageId || modulePage.id) === pageId || cleanText(modulePage.pageName || modulePage.title) === pageName)
    )
    return {
      id: `nav-item-${pageId}`,
      label: pageName,
      targetPageId: pageId,
      targetPageName: pageName,
      parentModuleId: cleanText(ownerModule?.id || ownerModule?.name || 'main-flow'),
      activeState: '当前页面或子流程命中时高亮',
      visibilityRule: '用户具备页面访问权限且该页面属于当前需求范围时显示',
      permissionRule: '继承页面权限、登录态和 run 绑定项目规则',
      order: index + 1
    }
  })
  return {
    globalEntries: uniqueTexts([
      pageTitles[0] ? `${pageTitles[0]}：主流程入口` : '',
      '顶部阶段导航：需求分析、交互低保、UI视觉、HTML、Vue、验收沉淀',
      'Agent 入口：解释当前节点、补充分析、写回当前阶段'
    ], 8),
    moduleEntries: modules.map((module) => ({
      moduleName: module.name,
      summary: module.summary,
      pages: (module.pages || []).map((page) => page.pageName).filter(Boolean),
      navigationItems: navigationItems.filter((item) => item.parentModuleId === cleanText(module.id || module.name))
    })),
    auxiliaryEntries: ['历史记录', '上传附件', '错误重试', '返回编辑', '下一步阶段推进'],
    navigationItems,
    navigationTree: [
      {
        label: '流程画布',
        id: 'workflow-canvas',
        type: 'root',
        children: [
          { id: 'nav-requirement-dissection', label: '需求分析', type: 'stage', children: navigationItems.slice(0, 8).map((item) => ({ id: item.id, label: item.label, targetPageId: item.targetPageId, activeState: item.activeState, visibilityRule: item.visibilityRule })) },
          { id: 'nav-interaction-lofi', label: '交互低保', type: 'stage', children: navigationItems.slice(0, 8).map((item) => ({ id: `${item.id}-lofi`, label: `${item.label} 页面交互`, targetPageId: item.targetPageId, activeState: '页面节点选中时高亮', visibilityRule: item.visibilityRule })) },
          { id: 'nav-downstream', label: '后续生成', type: 'stage-group', children: ['UI视觉', 'HTML', 'Vue', '验收沉淀'].map((label, index) => ({ id: `nav-downstream-${index + 1}`, label, activeState: '当前阶段高亮', visibilityRule: '上一阶段确认后显示' })) }
        ]
      }
    ]
  }
}

function functionModuleMatrixForAnalysis(projectFunctionMap = null, pages = []) {
  const modules = projectFunctionMap?.rootModules?.length ? projectFunctionMap.rootModules : [{
    name: '核心流程',
    summary: '承接当前需求主路径。',
    pages: pages.map((page, index) => ({ pageName: page.title, priority: index < 3 ? 'P0' : 'P1' }))
  }]
  return modules.flatMap((module, moduleIndex) => {
    const modulePages = Array.isArray(module.pages) && module.pages.length ? module.pages : [{ pageName: module.name, priority: 'P0' }]
    return modulePages.map((page, pageIndex) => ({
      id: `module-row-${moduleIndex + 1}-${pageIndex + 1}`,
      level: moduleIndex === 0 ? 'L1-核心流程' : 'L2-支撑功能',
      moduleName: module.name,
      pageName: page.pageName || page.title || module.name,
      entry: page.entry || (pageIndex === 0 ? '主入口' : modulePages[pageIndex - 1]?.pageName || '上一页面'),
      targetUser: page.role || '目标用户',
      priority: page.priority || (moduleIndex === 0 ? 'P0' : 'P1')
    }))
  })
}

function pageHierarchyTreeForAnalysis(projectFunctionMap = null, pages = []) {
  const pageLookup = new Map(pages.map((page, index) => [pageStableId(page, index), { page, index }]))
  const pageNameLookup = new Map(pages.map((page, index) => [pageTitle(page, index), { page, index }]))
  const moduleChildren = (projectFunctionMap?.rootModules || []).map((module, moduleIndex) => {
    const moduleId = cleanText(module.id || module.name || `module-${moduleIndex + 1}`)
    return {
      id: moduleId,
      label: module.name,
      type: 'module',
      parentId: 'requirement-root',
      level: 1,
      summary: module.summary || '',
      children: (module.pages || []).map((page) => ({
        id: cleanText(page.pageId || page.id || page.pageName),
        label: page.pageName || page.title,
        type: 'page',
        pageId: cleanText(page.pageId || page.id || page.pageName),
        parentId: moduleId,
        level: 2,
        pageType: cleanText(page.pageType || page.type || pageLookup.get(cleanText(page.pageId || page.id))?.page?.pageType || pageNameLookup.get(cleanText(page.pageName || page.title))?.page?.pageType || '业务页面'),
        priority: page.priority || ''
      }))
    }
  }).filter((module) => module.label)
  return {
    root: '当前需求页面层级',
    nodes: moduleChildren.length ? moduleChildren : [{
      id: 'main-flow',
      label: '核心流程',
      type: 'module',
      parentId: 'requirement-root',
      level: 1,
      children: pages.map((page, index) => ({
        id: pageStableId(page, index),
        label: pageTitle(page, index),
        type: 'page',
        pageId: pageStableId(page, index),
        parentId: 'main-flow',
        level: 2,
        pageType: cleanText(page.pageType || page.type || '业务页面'),
        priority: index < 3 ? 'P0' : 'P1'
      }))
    }],
    leafPageCount: pages.length
  }
}

function decisionPointMatrixForAnalysis(analysis = {}, pages = []) {
  const text = analysisText(analysis)
  const pageTitles = pages.map((page) => page.title).filter(Boolean)
  const rows = [
    {
      decisionPoint: '起步范围',
      pageName: pageTitles[0] || '需求输入页',
      options: analysis.demandScope === 'project' ? ['项目需求', '继续按项目知识补全'] : ['非项目需求', '按当前输入推导'],
      impact: '决定是否允许引用项目知识库，以及页面结论的证据口径。',
      recommendation: analysis.demandScope === 'project' ? '项目需求可引用绑定项目知识。' : '非项目需求只展示输入、附件和假设。',
      affectedPages: pageTitles.slice(0, 3)
    },
    {
      decisionPoint: '完整页面范围',
      pageName: '页面覆盖矩阵',
      options: ['只做主路径', '补齐异常/权限/结果/历史页面'],
      impact: '影响页面是否一个不漏。',
      recommendation: /一个不漏|所有页面|全流程/.test(text) ? '优先补齐全流程页面，并标注待确认项。' : '先产出主路径，再追问扩展页面。',
      affectedPages: pageTitles
    },
    {
      decisionPoint: '阶段推进',
      pageName: '阶段切换/下一步',
      options: ['继续验证需求分析', '进入交互低保'],
      impact: '决定是否把当前结构转成页面级交互低保。',
      recommendation: '当页面覆盖、决策点和异常路径无 P0 缺口后进入下一阶段。',
      affectedPages: pageTitles.slice(0, 6)
    }
  ]
  if (/登录|权限|管理员|审核|付费|支付|套餐|额度/.test(text)) {
    rows.push({
      decisionPoint: '权限与商业规则',
      pageName: pageTitles.find((title) => /登录|权限|我的|支付|会员|设置|审核/.test(title)) || '待确认页面',
      options: ['游客/普通用户', '付费用户', '管理员/审核员'],
      impact: '会新增登录、权限、升级、审核、后台或错误恢复页面。',
      recommendation: '先确认角色和权限边界，再生成交互低保。',
      affectedPages: pageTitles.filter((title) => /登录|权限|我的|支付|会员|设置|审核|后台/.test(title))
    })
  }
  return rows.map((row, index) => ({ id: `decision-${index + 1}`, ...row }))
}

function decisionFlowGraphForAnalysis(artifactLike = {}, pages = []) {
  const decisions = artifactLike.decisionPointMatrix || []
  return {
    root: '需求分析决策流程',
    branches: decisions.map((row, index) => ({
      id: row.id || `decision-flow-${index + 1}`,
      question: row.decisionPoint,
      from: row.pageName || pages[0]?.title || '需求输入',
      options: Array.isArray(row.options) ? row.options : [],
      recommendation: row.recommendation || ''
    }))
  }
}

function exceptionRecoveryMatrixForAnalysis(analysis = {}, pages = []) {
  const pageTitles = pages.map((page) => page.title).filter(Boolean)
  const rows = [
    {
      scenario: '输入为空或证据不足',
      triggerCondition: '用户提交需求时缺少必要说明、附件或确认信息。',
      systemFeedback: '提示需要补充目标、角色、页面范围或附件，不清空已输入内容。',
      recoveryPath: '返回需求输入或由 Agent 追问补齐。',
      affectedPages: [pageTitles[0] || '需求输入页', '需求分析 Agent 回复区']
    },
    {
      scenario: '分析生成失败',
      triggerCondition: '模型、网络或后端生成异常。',
      systemFeedback: '显示失败原因、保留 run 和输入，提供重试入口。',
      recoveryPath: '重试分析或回到输入页编辑。',
      affectedPages: ['分析进度页', '需求分析 Agent 回复区']
    },
    {
      scenario: '页面覆盖不确定',
      triggerCondition: '页面没有明确证据或入口/出口不完整。',
      systemFeedback: '在页面覆盖矩阵中标为待确认。',
      recoveryPath: '通过 Agent 补充事实或删除不成立页面。',
      affectedPages: ['页面覆盖矩阵', ...pageTitles.slice(0, 4)]
    }
  ]
  if (analysis.demandScope !== 'project') {
    rows.push({
      scenario: '非项目误用项目知识',
      triggerCondition: '当前 run 为非项目需求，但存在 URL 项目或当前工作台项目。',
      systemFeedback: '跳过项目知识检索，只展示用户输入、附件和模型假设。',
      recoveryPath: '用户确认后可转为项目需求或沉淀为项目知识。',
      affectedPages: ['需求输入页', '需求分析 Agent 回复区']
    })
  }
  return rows.map((row, index) => ({ id: `exception-${index + 1}`, ...row }))
}

function dataFlowGraphForAnalysis(analysis = {}, pages = []) {
  const pageData = pages.map((page, index) => ({
    pageId: pageStableId(page, index),
    pageName: pageTitle(page, index),
    reads: listFromValues(page.dataDependencies, ['页面基础数据', '当前业务状态'], 4),
    writes: listFromValues(page.writeData || page.outputs, ['用户操作结果', '页面状态变更'], 4),
    downstream: pages[index + 1]?.title ? [pageStableId(pages[index + 1], index + 1)] : ['downstream-stage'],
    downstreamLabels: pages[index + 1]?.title ? [pageTitle(pages[index + 1], index + 1)] : ['后续阶段']
  }))
  const pageNodes = pages.map((page, index) => ({
    id: `data-page-${pageStableId(page, index)}`,
    label: pageTitle(page, index),
    nodeType: 'page',
    pageId: pageStableId(page, index)
  }))
  return {
    nodes: [
      { id: 'data-user-input', label: '用户输入/附件', nodeType: 'source' },
      { id: 'data-requirement-artifact', label: '需求分析结构', nodeType: 'artifact' },
      { id: 'data-page-coverage', label: '页面覆盖矩阵', nodeType: 'artifact' },
      ...pageNodes,
      { id: 'data-interaction-lofi', label: '交互低保页面', nodeType: 'stage' },
      { id: 'data-ui-visual', label: 'UI视觉', nodeType: 'stage' },
      { id: 'data-html-vue', label: 'HTML/Vue', nodeType: 'stage' },
      { id: 'data-acceptance', label: '验收沉淀', nodeType: 'stage' }
    ],
    edges: [
      { id: 'data-edge-input-artifact', from: '用户输入/附件', fromNodeId: 'data-user-input', to: '需求分析结构', toNodeId: 'data-requirement-artifact', label: '识别需求' },
      { id: 'data-edge-artifact-coverage', from: '需求分析结构', fromNodeId: 'data-requirement-artifact', to: '页面覆盖矩阵', toNodeId: 'data-page-coverage', label: '拆页面' },
      ...pageData.map((row) => ({ id: `data-edge-coverage-${row.pageId}`, from: '页面覆盖矩阵', fromNodeId: 'data-page-coverage', to: row.pageName, toNodeId: `data-page-${row.pageId}`, label: '绑定页面数据' })),
      { id: 'data-edge-coverage-lofi', from: '页面覆盖矩阵', fromNodeId: 'data-page-coverage', to: '交互低保页面', toNodeId: 'data-interaction-lofi', label: '生成页面级交互' },
      { id: 'data-edge-lofi-ui', from: '交互低保页面', fromNodeId: 'data-interaction-lofi', to: 'UI视觉', toNodeId: 'data-ui-visual', label: '继承框架和状态' },
      { id: 'data-edge-ui-code', from: 'UI视觉', fromNodeId: 'data-ui-visual', to: 'HTML/Vue', toNodeId: 'data-html-vue', label: '生成代码' },
      { id: 'data-edge-code-acceptance', from: 'HTML/Vue', fromNodeId: 'data-html-vue', to: '验收沉淀', toNodeId: 'data-acceptance', label: '沉淀规则' }
    ],
    pageData,
    scopePolicy: analysis.demandScope === 'project' ? '项目知识可作为输入证据。' : '非项目不读取项目知识。'
  }
}

function stateMachineMapForAnalysis(analysis = {}, pages = []) {
  const globalStates = [
    { state: '未输入', trigger: '进入需求入口', display: '等待输入需求', recovery: '输入需求或上传附件' },
    { state: '分析中', trigger: '点击分析需求', display: '展示分析进度', recovery: '失败可重试' },
    { state: '已生成需求分析', trigger: '后端返回 totalDesignFlow', display: '展示需求分析画布', recovery: '可继续 Agent 验证' },
    { state: '待确认', trigger: '存在页面/规则缺口', display: '显示待确认问题', recovery: '通过 Agent 补齐或标记后续处理' },
    { state: '已进入交互低保', trigger: '点击下一步', display: '展示页面级低保真', recovery: '可返回需求分析修改' }
  ]
  const pageStates = pages.map((page, index) => ({
    pageId: pageStableId(page, index),
    pageName: pageTitle(page, index),
    states: listFromValues(page.states, ['默认', '加载', '空状态', '失败重试', '权限不足'], 6),
    transitions: [
      { from: '默认', event: '触发主操作', to: pages[index + 1]?.title || '流程完成', toPageId: pages[index + 1] ? pageStableId(pages[index + 1], index + 1) : 'flow-complete' },
      { from: '失败', event: '点击重试', to: '加载' }
    ]
  }))
  return { globalStates, pageStates }
}

function featureJumpGraphForAnalysis(projectFunctionMap = null, pages = []) {
  const pageByName = new Map(pages.map((page, index) => [pageTitle(page, index), { page, index }]))
  const navigationEdges = (projectFunctionMap?.navigationMap || []).map((edge, index) => ({
    id: edge.id || `jump-${index + 1}`,
    from: edge.from,
    action: edge.action || '进入',
    to: edge.to,
    fromPageId: pageByName.has(cleanText(edge.from)) ? pageStableId(pageByName.get(cleanText(edge.from)).page, pageByName.get(cleanText(edge.from)).index) : cleanText(edge.from || `source-${index + 1}`),
    toPageId: pageByName.has(cleanText(edge.to)) ? pageStableId(pageByName.get(cleanText(edge.to)).page, pageByName.get(cleanText(edge.to)).index) : cleanText(edge.to || `target-${index + 1}`),
    condition: cleanText(edge.condition || edge.note || '完成当前触发动作'),
    preserveState: !/支付|提交|删除|清空/.test(cleanText(edge.action || '')),
    note: edge.note || ''
  }))
  const fallbackEdges = pages.slice(0, -1).map((page, index) => ({
    id: `jump-${index + 1}`,
    from: pageTitle(page, index),
    action: '完成当前页主操作',
    to: pageTitle(pages[index + 1], index + 1),
    fromPageId: pageStableId(page, index),
    toPageId: pageStableId(pages[index + 1], index + 1),
    condition: '当前页面主操作完成且校验通过',
    preserveState: true,
    note: '主路径跳转'
  }))
  return {
    hub: pages[0]?.title || projectFunctionMap?.productName || '主入口',
    edges: navigationEdges.length ? navigationEdges : fallbackEdges,
    crossFunctionRisks: ['跨功能跳转必须有返回路径', '跳转后不能丢失已输入内容', '无权限时要说明原因和恢复入口']
  }
}

function dataSharingMechanismForAnalysis(analysis = {}, pages = []) {
  return {
    resources: [
      { resourceType: '需求输入', createdBy: '需求输入页', storedIn: 'workflow run', consumedBy: ['需求分析', 'Agent 回复'], sharingMode: '当前 run 内复用' },
      { resourceType: '需求分析结构', createdBy: '需求分析阶段', storedIn: 'requirementDissectionArtifact', consumedBy: ['画布详情', '交互低保', 'Agent'], sharingMode: '阶段间传递' },
      { resourceType: '页面覆盖矩阵', createdBy: '需求分析阶段', storedIn: 'pageCoverageMatrix', consumedBy: ['交互低保', 'UI视觉', 'HTML/Vue'], sharingMode: '页面级继承' },
      { resourceType: '页面交互说明', createdBy: '交互低保阶段', storedIn: 'interactionSpecArtifact', consumedBy: ['UI视觉', 'HTML/Vue', '验收沉淀'], sharingMode: '页面级继承' }
    ],
    policy: analysis.demandScope === 'project'
      ? '项目需求可在用户确认后沉淀回当前项目知识库。'
      : '非项目需求需先转项目或用户确认沉淀，不能自动进入项目知识库。'
  }
}

function knowledgeLoadingContextForAnalysis(analysis = {}) {
  if (analysis.demandScope !== 'project') {
    return {
      mode: 'non-project',
      summary: '',
      sources: []
    }
  }
  const documents = selectedKnowledgeScopeDocuments(analysis)
  const sources = documents.slice(0, 6).map((doc, index) => ({
    id: cleanText(doc.id || doc.knowledgeMaterialId || `knowledge-source-${index + 1}`),
    title: cleanText(doc.name || doc.title || doc.sourceTitle || `项目知识 ${index + 1}`),
    sourceType: cleanText(doc.sourceType || 'project-knowledge'),
    path: cleanText(doc.path || doc.url || doc.materialPath || ''),
    summary: cleanText(doc.summary || doc.snippet || sourceExcerpt(doc.text || doc.content || '', []))
  }))
  return {
    mode: 'project',
    summary: sources.length ? `已引用 ${sources.length} 条项目知识用于需求分析。` : '项目需求已允许知识库增强，但当前未命中可引用知识。',
    sources
  }
}

function gapConfirmationForAnalysis(analysis = {}, requirementSlices = [], pages = []) {
  const questions = pendingQuestions(analysis)
  const sliceQuestions = (Array.isArray(requirementSlices) ? requirementSlices : [])
    .filter((slice) => Number(slice.pendingQuestionCount || 0) > 0 || slice.blocked)
    .map((slice) => `${slice.title || '需求切片'}：${slice.pendingQuestionCount || 1} 个问题待确认`)
  const pageNames = pages.map((page, index) => pageTitle(page, index)).filter(Boolean)
  const normalizedQuestions = uniqueTexts([...questions, ...sliceQuestions], 8)
  return {
    confirmedFacts: uniqueTexts([
      pageNames.length ? `已识别 ${pageNames.length} 个候选页面：${pageNames.slice(0, 5).join('、')}${pageNames.length > 5 ? ' 等' : ''}` : '',
      requirementSlices.length ? `已拆出 ${requirementSlices.length} 个需求切片。` : '',
      analysis.demandScope === 'project' ? '当前为项目需求，可使用绑定项目知识作为证据。' : '当前为非项目需求，不继承项目知识。'
    ], 8),
    questions: normalizedQuestions.length
      ? normalizedQuestions.map((question, index) => ({
        id: `gap-question-${index + 1}`,
        question,
        impact: index < 3 ? '影响页面范围、业务规则或验收口径，需要优先确认。' : '可作为后续补充问题继续跟踪。',
        priority: index < 3 ? 'P0' : 'P1',
        suggestedAction: index < 3 ? '先追问用户确认' : '写入后续风险'
      }))
      : [{
        id: 'gap-question-1',
        question: '当前输入未暴露强阻塞缺口，后续仍需在交互低保阶段校验页面状态与异常路径。',
        impact: '影响低保真页面完整性。',
        priority: 'P1',
        suggestedAction: '进入下一阶段时继续继承状态和异常矩阵。'
      }],
    blockers: sliceQuestions.map((question, index) => ({ id: `gap-blocker-${index + 1}`, title: question, impact: '影响切片是否可独立交付。' })),
    affectedPages: pageNames.slice(0, 10),
    nextSteps: ['确认会改变页面数量的问题', '确认权限/支付/审核等强业务规则', '将可后补问题写入风险和验收依据']
  }
}

function personaScenarioMatrixForAnalysis(userScenarios = {}, pages = []) {
  const users = listFromValues(userScenarios.primaryUsers, ['目标用户'], 6)
  const scenarios = listFromValues(userScenarios.coreScenarios, pages.map((page, index) => pageTitle(page, index)), 8)
  const jtbd = listFromValues(userScenarios.jobsToBeDone, ['完成核心任务'], 8)
  return users.map((user, index) => ({
    id: `persona-scenario-${index + 1}`,
    persona: user,
    scenario: scenarios[index] || scenarios[0] || '进入产品完成核心任务',
    jobToBeDone: jtbd[index] || jtbd[0] || '快速理解入口并完成主操作',
    entryPage: pages[index] ? pageTitle(pages[index], index) : pages[0] ? pageTitle(pages[0], 0) : '主入口',
    successSignal: '能找到入口、完成主操作，并在失败时获得恢复路径。'
  }))
}

function normalizeBusinessRuleMatrix(primary = {}, fallback = {}) {
  const primaryRules = Array.isArray(primary?.rules) ? primary.rules : []
  const fallbackRules = Array.isArray(fallback?.rules) ? fallback.rules : []
  const oldDataObjects = listFromValues(primary?.dataObjects, fallback?.dataObjects, 10)
  const oldStatusRules = listFromValues(primary?.statusRules, fallback?.statusRules, 10)
  const oldPermissionRules = listFromValues(primary?.permissionRules, fallback?.permissionRules, 8)
  const rules = [
    ...primaryRules,
    ...fallbackRules,
    ...oldDataObjects.map((item, index) => ({ id: `business-data-${index + 1}`, category: '数据对象', rule: item, appliesTo: ['全局'], priority: 'P1', verification: '字段与页面数据依赖可追溯' })),
    ...oldStatusRules.map((item, index) => ({ id: `business-state-${index + 1}`, category: '状态规则', rule: item, appliesTo: ['全局'], priority: 'P0', verification: '状态变化、提示和恢复入口可验收' })),
    ...oldPermissionRules.map((item, index) => ({ id: `business-permission-${index + 1}`, category: '权限规则', rule: item, appliesTo: ['全局'], priority: 'P0', verification: '无权限场景有说明和下一步' }))
  ].filter((rule) => rule && typeof rule === 'object')
  const seen = new Set()
  return {
    rules: rules.map((rule, index) => ({
      id: cleanText(rule.id || `business-rule-${index + 1}`),
      category: cleanText(rule.category || rule.type || '业务规则'),
      rule: cleanText(rule.rule || rule.title || rule.summary || `业务规则 ${index + 1}`),
      appliesTo: listFromValues(rule.appliesTo || rule.pages || rule.affectedPages, ['全局'], 6),
      priority: cleanText(rule.priority || 'P1'),
      verification: cleanText(rule.verification || rule.acceptance || '可通过页面状态、接口返回和用户操作路径验证')
    })).filter((rule) => {
      const key = `${rule.category}:${rule.rule}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 24)
  }
}

function businessRuleMatrixForAnalysis(analysis = {}, pages = [], stateMachineMap = {}) {
  const dataObjects = listFromValues(pages.flatMap((page) => page.businessObjects || page.dataDependencies || []), ['用户', '页面内容', '业务状态', '操作结果'], 8)
  const stateRules = listFromValues((stateMachineMap.pageStates || []).flatMap((row) => row.states || []), ['默认', '加载', '失败重试', '权限不足'], 10)
  const rules = [
    ...dataObjects.map((item, index) => ({ id: `business-data-${index + 1}`, category: '数据对象', rule: `${item} 需要明确来源、更新时机和消费页面。`, appliesTo: pages.map((page, pageIndex) => pageTitle(page, pageIndex)).slice(0, 5), priority: index < 3 ? 'P0' : 'P1', verification: '数据字段在页面依赖和交互说明中可追溯' })),
    ...stateRules.map((item, index) => ({ id: `business-state-${index + 1}`, category: '状态规则', rule: `${item} 状态需要有可见反馈、触发条件和恢复路径。`, appliesTo: pages.map((page, pageIndex) => pageTitle(page, pageIndex)).slice(0, 5), priority: /失败|权限|禁用/.test(item) ? 'P0' : 'P1', verification: '页面状态机和验收点覆盖该状态' })),
    { id: 'business-scope-knowledge', category: '证据规则', rule: analysis.demandScope === 'project' ? '项目知识只能用于当前 run 绑定项目。' : '非项目需求不得继承项目知识。', appliesTo: ['需求分析', 'Agent 回复'], priority: 'P0', verification: '证据展示与请求 payload 均按 demandScope 隔离' }
  ]
  return normalizeBusinessRuleMatrix({ rules })
}

function permissionMatrixForAnalysis(analysis = {}, pages = []) {
  const text = analysisText(analysis)
  const roleHints = uniqueTexts([
    /管理员|运营|审核/.test(text) ? '管理员/运营' : '',
    /会员|付费|订阅/.test(text) ? '会员/付费用户' : '',
    '普通用户',
    analysis.demandScope === 'project' ? '项目成员' : ''
  ], 6)
  const roles = (roleHints.length ? roleHints : ['普通用户']).map((role, index) => ({
    id: `permission-role-${index + 1}`,
    role,
    description: `${role} 在当前需求中的可访问范围。`
  }))
  const operations = pages.slice(0, 10).map((page, index) => ({
    id: `permission-operation-${index + 1}`,
    pageId: pageStableId(page, index),
    pageName: pageTitle(page, index),
    operation: page.primaryAction || page.interactions?.[0] || '访问并完成主操作',
    allowedRoles: roles.map((role) => role.role),
    deniedBehavior: '展示无权限原因、返回入口或升级/登录引导'
  }))
  return { roles, operations }
}

function boundaryConditionMatrixForAnalysis(analysis = {}, pages = []) {
  const exceptions = exceptionRecoveryMatrixForAnalysis(analysis, pages)
  const text = analysisText(analysis)
  const extra = [
    /支付|订单|付费|订阅/.test(text) ? { scenario: '支付或订阅失败', triggerCondition: '支付渠道失败、余额不足或回调超时。', expectedBehavior: '保留订单/任务状态，支持重新支付或取消。', recoveryPath: '回到支付页或订单详情继续处理。' } : null,
    /上传|附件|图片|文件/.test(text) ? { scenario: '上传材料异常', triggerCondition: '文件过大、格式不支持或上传失败。', expectedBehavior: '提示原因，保留其他已填写内容。', recoveryPath: '重新上传或删除失败文件。' } : null
  ].filter(Boolean)
  return [...exceptions.map((item) => ({
    id: item.id,
    scenario: item.scenario,
    triggerCondition: item.triggerCondition,
    expectedBehavior: item.systemFeedback,
    recoveryPath: item.recoveryPath,
    affectedPages: item.affectedPages || []
  })), ...extra.map((item, index) => ({ id: `boundary-extra-${index + 1}`, ...item }))].slice(0, 12)
}

function designOpportunityMatrixForAnalysis(analysis = {}, pages = [], exceptionRecoveryMatrix = [], userJourneyMap = {}) {
  const journeySignals = [
    ...(Array.isArray(userJourneyMap.firstTimePath) ? userJourneyMap.firstTimePath : []),
    ...(Array.isArray(userJourneyMap.exceptionPath) ? userJourneyMap.exceptionPath : [])
  ]
  const opportunities = uniqueTexts([
    pages.length ? `围绕 ${pageTitle(pages[0], 0)} 强化首屏主入口和下一步提示。` : '',
    exceptionRecoveryMatrix.length ? '把异常恢复入口前置到用户最容易迷失的节点。' : '',
    journeySignals.length ? '用主路径进度和状态提示减少跨页面跳转的不确定性。' : '',
    '把待确认业务规则转成可验收的页面状态和提示文案。'
  ], 8).map((title, index) => ({
    id: `design-opportunity-${index + 1}`,
    title,
    evidence: index === 0 ? '页面覆盖矩阵和用户旅程' : '异常矩阵、状态机和待确认问题',
    affectedPages: pages.slice(index, index + 3).map((page, pageIndex) => pageTitle(page, index + pageIndex)),
    expectedValue: index < 2 ? '降低主路径阻塞' : '提高后续交付确定性',
    priority: index < 2 ? 'P0' : 'P1'
  }))
  const solutionOptions = [
    { id: 'solution-main-path', title: '主路径优先型', focus: '先保证入口、页面层级、主操作和成功态闭环。', tradeoff: '运营增强和个性化内容后置。' },
    { id: 'solution-state-safety', title: '状态安全型', focus: '优先补齐加载、失败、权限、空态和恢复路径。', tradeoff: '首版视觉表达可能更克制。' },
    { id: 'solution-growth-ready', title: '增长扩展型', focus: '保留会员、推荐、活动、复用入口等可扩展槽位。', tradeoff: '需要更多业务规则确认。' }
  ]
  return { opportunities, solutionOptions }
}

function priorityRoadmapForAnalysis(scopeBoundary = {}, designOpportunityMatrix = {}, requirementSlices = []) {
  const p0 = listFromValues(scopeBoundary.p0, requirementSlices.filter((slice) => slice.priority !== 'P2').map((slice) => slice.title), 8)
  const p1 = listFromValues(scopeBoundary.p1, requirementSlices.filter((slice) => slice.priority === 'P1').map((slice) => slice.title), 8)
  return {
    quadrants: [
      { id: 'priority-p0', title: 'P0 必须交付', items: p0.length ? p0 : ['主路径页面、状态和验收依据'], rule: '影响主路径闭环或上线验收' },
      { id: 'priority-p1', title: 'P1 建议交付', items: p1.length ? p1 : ['运营增强、体验优化、配置扩展'], rule: '提升体验但不阻塞主路径' },
      { id: 'priority-risk', title: '需确认后排期', items: listFromValues(scopeBoundary.dependencies, ['权限', '支付', '第三方集成'], 6), rule: '缺少业务或技术证据' },
      { id: 'priority-out', title: '暂不纳入', items: listFromValues(scopeBoundary.outOfScope, ['未确认扩展功能'], 6), rule: '超出当前输入和验收边界' }
    ],
    milestones: [
      { id: 'milestone-analysis', title: '需求分析确认', deliverables: ['7 个分析详情 tab', '页面覆盖矩阵', '业务规则与状态流'] },
      { id: 'milestone-lofi', title: '交互低保', deliverables: ['页面框架', '交互说明', '状态和异常路径'] },
      { id: 'milestone-output', title: 'UI/HTML/Vue 与验收', deliverables: ['视觉产物', '可预览代码', '验收沉淀'] }
    ]
  }
}

function acceptanceBasisForAnalysis(designRequirementMap = {}, businessRuleMatrix = {}, stateMachineMap = {}, permissionMatrix = {}, boundaryConditionMatrix = []) {
  return {
    functional: listFromValues(designRequirementMap.acceptanceChecklist, ['页面目标可识别', '主操作可完成', '跳转和状态反馈明确'], 10),
    businessRules: (businessRuleMatrix.rules || []).slice(0, 8).map((rule) => `${rule.category}：${rule.rule}`),
    stateCoverage: [
      ...listFromValues(stateMachineMap.globalStates?.map((state) => state.state || state.display), [], 8),
      ...listFromValues(stateMachineMap.pageStates?.flatMap((row) => row.states || []), [], 8)
    ].slice(0, 12),
    permissionCoverage: (permissionMatrix.operations || []).slice(0, 8).map((row) => `${row.pageName}：${row.operation} / ${row.deniedBehavior}`),
    exceptionCoverage: boundaryConditionMatrix.slice(0, 8).map((row) => `${row.scenario}：${row.recoveryPath}`),
    nonFunctional: ['响应时间和加载态可感知', '失败可重试且不丢输入', '页面结构支持移动端/桌面端基本适配', '关键状态不只依赖颜色表达']
  }
}

function pageFrameContractsForAnalysis(artifactLike = {}, pages = []) {
  const coverageRows = Array.isArray(artifactLike.pageCoverageMatrix) ? artifactLike.pageCoverageMatrix : []
  const hierarchyNodes = Array.isArray(artifactLike.pageHierarchyTree?.nodes) ? artifactLike.pageHierarchyTree.nodes : []
  const journeySteps = [
    ...(Array.isArray(artifactLike.userJourneyMap?.firstTimePath) ? artifactLike.userJourneyMap.firstTimePath : []),
    ...(Array.isArray(artifactLike.userJourneyMap?.returningPath) ? artifactLike.userJourneyMap.returningPath : []),
    ...(Array.isArray(artifactLike.userJourneyMap?.exceptionPath) ? artifactLike.userJourneyMap.exceptionPath : [])
  ]
  const decisions = Array.isArray(artifactLike.decisionPointMatrix) ? artifactLike.decisionPointMatrix : []
  const exceptions = Array.isArray(artifactLike.exceptionRecoveryMatrix) ? artifactLike.exceptionRecoveryMatrix : []
  const pageData = Array.isArray(artifactLike.dataFlowGraph?.pageData) ? artifactLike.dataFlowGraph.pageData : []
  const pageStates = Array.isArray(artifactLike.stateMachineMap?.pageStates) ? artifactLike.stateMachineMap.pageStates : []
  const jumpEdges = Array.isArray(artifactLike.featureJumpGraph?.edges) ? artifactLike.featureJumpGraph.edges : []
  const pageRequirements = Array.isArray(artifactLike.designRequirementMap?.pages) ? artifactLike.designRequirementMap.pages : []

  return pages.map((page, index) => {
    const pageName = pageTitle(page, index)
    const pageId = cleanText(page.id || page.nodeId || page.pageId || `page-${index + 1}`)
    const coverage = coverageRows.find((row) => cleanText(row.pageName || row.title) === pageName) || coverageRows[index] || {}
    const requirement = pageRequirements.find((row) => cleanText(row.pageName || row.title) === pageName) || pageRequirements[index] || {}
    const dataRow = pageData.find((row) => cleanText(row.pageName || row.title) === pageName) || pageData[index] || {}
    const stateRow = pageStates.find((row) => cleanText(row.pageName || row.title) === pageName) || pageStates[index] || {}
    const relatedDecisions = rowsRelatedToPage(decisions, { ...page, title: pageName })
    const relatedExceptions = rowsRelatedToPage(exceptions, { ...page, title: pageName })
    const relatedJumps = jumpEdges.filter((edge) =>
      cleanText(edge.from) === pageName ||
      cleanText(edge.to) === pageName ||
      rowsRelatedToPage([edge], { ...page, title: pageName }).length
    )
    const hierarchyNode = hierarchyNodes
      .flatMap((node) => [node, ...(Array.isArray(node.children) ? node.children : [])])
      .find((node) => cleanText(node.label || node.pageName || node.title) === pageName)
    const hotspots = Array.isArray(requirement.interactionHotspots) && requirement.interactionHotspots.length
      ? requirement.interactionHotspots
      : pageInteractionHotspots({ ...page, title: pageName }, index, pages)
    const states = listFromValues(stateRow.states || requirement.states || coverage.stateCoverage || page.states, ['默认', '加载', '空状态', '失败重试'], 6)
    const regions = [
      {
        id: `${pageId}-top-nav`,
        name: '顶层导航',
        role: 'top-navigation',
        priority: 'P0',
        visibleWhen: '页面打开',
        sticky: true,
        responsiveBehavior: '移动端顶部或底部导航，桌面端可转为侧栏/顶部栏'
      },
      {
        id: `${pageId}-content`,
        name: `${pageName}主体内容`,
        role: /表单|输入|支付|结算/.test(pageName) ? 'form' : 'content-list',
        priority: 'P0',
        visibleWhen: '默认/加载完成',
        sticky: false,
        responsiveBehavior: '随视口宽度调整为单列或多列'
      },
      {
        id: `${pageId}-bottom-action`,
        name: '底部主操作',
        role: 'bottom-action',
        priority: 'P0',
        visibleWhen: '存在可执行主操作',
        sticky: true,
        responsiveBehavior: '移动端吸底，桌面端靠近主内容右下'
      }
    ]
    return {
      pageId,
      pageName,
      pageType: cleanText(coverage.pageType || page.pageType || page.type || '业务页面'),
      sourceRefs: {
        coverageRowId: cleanText(coverage.id || coverage.pageId || pageId),
        hierarchyNodeId: cleanText(hierarchyNode?.id || pageId),
        journeyStepIds: journeySteps
          .map((step, stepIndex) => ({ step: cleanText(step), id: `journey-${stepIndex + 1}` }))
          .filter((item) => !item.step || item.step.includes(pageName) || pageName.includes(item.step))
          .map((item) => item.id)
          .slice(0, 4),
        decisionPointIds: relatedDecisions.map((row, rowIndex) => cleanText(row.id || `decision-${rowIndex + 1}`)).slice(0, 5),
        exceptionIds: relatedExceptions.map((row, rowIndex) => cleanText(row.id || `exception-${rowIndex + 1}`)).slice(0, 5),
        dataEntityIds: listFromValues(dataRow.reads || requirement.dataDependencies || page.dataDependencies, ['页面基础数据'], 5).map((_, itemIndex) => `${pageId}-data-${itemIndex + 1}`),
        stateMachineIds: states.map((_, stateIndex) => `${pageId}-state-${stateIndex + 1}`),
        jumpEdgeIds: relatedJumps.map((edge, edgeIndex) => cleanText(edge.id || `jump-${edgeIndex + 1}`)).slice(0, 5)
      },
      layoutFrame: {
        viewportType: /小程序|移动|App|手机/.test(cleanText(artifactLike.productDefinition?.productType)) ? 'mobile' : 'responsive',
        persistentZones: ['top-nav', 'content', 'bottom-action'],
        regions
      },
      navigationBindings: [
        {
          navItemId: `${pageId}-entry`,
          label: pageName,
          targetPageId: pageId,
          activeState: '当前页面高亮',
          visibilityRule: '用户有页面访问权限时显示',
          permissionRule: '按 run 绑定项目、登录态或页面权限判断'
        },
        ...(relatedJumps.length ? relatedJumps : [{ to: coverage.exitTo || pages[index + 1]?.title || '下一步', action: '进入' }]).slice(0, 3).map((edge, edgeIndex) => ({
          navItemId: `${pageId}-jump-${edgeIndex + 1}`,
          label: cleanText(edge.action || '进入'),
          targetPageId: cleanText(edge.to || pages[index + 1]?.id || 'next-page'),
          activeState: '触发后进入目标页面',
          visibilityRule: cleanText(edge.condition || '满足当前业务条件'),
          permissionRule: '继承目标页面权限'
        }))
      ],
      contentHierarchy: regions.map((region, regionIndex) => ({
        regionId: region.id,
        blockId: `${region.id}-block`,
        title: regionIndex === 0 ? '导航与返回' : regionIndex === 1 ? (requirement.goal || coverage.participationReason || page.summary || pageName) : (requirement.primaryAction || coverage.primaryActions?.[0] || '主操作'),
        contentType: region.role,
        dataEntity: listFromValues(dataRow.reads || requirement.dataDependencies || page.dataDependencies, ['页面基础数据'], 3)[regionIndex] || '页面基础数据',
        emptyState: '无数据时说明原因并提供恢复入口',
        loadingState: '展示骨架屏或 loading 文案',
        errorState: '展示错误原因、重试和返回入口'
      })),
      interactionHotspots: hotspots.slice(0, 8).map((hotspot, hotspotIndex) => ({
        target: cleanText(hotspot.target || `交互对象 ${hotspotIndex + 1}`),
        gesture: cleanText(hotspot.gesture || '点击'),
        triggerCondition: cleanText(hotspot.condition || hotspot.enableCondition || '对象可用且数据已加载'),
        systemFeedback: cleanText(hotspot.feedback || '展示操作反馈'),
        result: cleanText(hotspot.result || '进入下一状态或目标页面'),
        disabledWhen: cleanText(hotspot.disableCondition || hotspot.disabledWhen || '权限不足、数据缺失或请求中'),
        dataDependencies: listFromValues(hotspot.dataDependencies || requirement.dataDependencies || page.dataDependencies, ['页面基础数据'], 4),
        testPoints: listFromValues(hotspot.testPoints || requirement.acceptanceCriteria || page.acceptanceCriteria, ['可点击、可反馈、可恢复'], 4)
      })),
      stateVariants: states.map((state, stateIndex) => ({
        state,
        trigger: stateIndex === 0 ? '进入页面' : `触发${state}`,
        affectedRegions: regions.map((region) => region.id),
        userVisibleCopy: `${pageName} - ${state}`,
        recoverAction: /失败|空|权限/.test(state) ? '重试、返回或补充权限' : '继续主流程'
      })),
      transitionEdges: (relatedJumps.length ? relatedJumps : [{ from: pageName, action: coverage.primaryActions?.[0] || requirement.primaryAction || '完成主操作', to: coverage.exitTo || pages[index + 1]?.title || '流程完成' }])
        .slice(0, 5)
        .map((edge) => ({
          fromPageId: cleanText(edge.from || pageName),
          action: cleanText(edge.action || '进入'),
          toPageId: cleanText(edge.to || coverage.exitTo || '下一页面'),
          condition: cleanText(edge.condition || edge.note || '满足当前操作条件'),
          preserveState: !/支付|提交|删除|清空/.test(cleanText(edge.action || ''))
        }))
    }
  })
}

function sourceRefBlock(sourceRef = '', overrides = {}) {
  const meta = REQUIREMENT_SOURCE_REF_BLOCK_META[sourceRef] || {}
  return {
    id: overrides.id || sourceRef,
    title: overrides.title || meta.title || sourceRef,
    type: overrides.type || meta.type || 'list',
    sourceRef,
    summary: overrides.summary || ''
  }
}

function isAdvancedUxRequirementAnalysis(analysisOrArtifact = {}) {
  return [
    analysisOrArtifact.analysisFramework,
    analysisOrArtifact.skillId,
    analysisOrArtifact.resolvedSkillId,
    analysisOrArtifact.requestedSkillId,
    analysisOrArtifact.routing?.resolvedSkillId,
    analysisOrArtifact.routing?.requestedSkillId
  ].some((value) => value === ADVANCED_UX_REQUIREMENT_ANALYSIS_SKILL_ID)
}

function requirementPipelineTabsForArtifact(artifact = {}) {
  return isAdvancedUxRequirementAnalysis(artifact)
    ? ADVANCED_UX_ANALYSIS_PIPELINE_TABS
    : REQUIREMENT_ANALYSIS_PIPELINE_TABS
}

function requirementAnalysisPipelineForArtifact(artifact = {}) {
  const summaries = {
    'requirement-understanding': artifact.productDefinition?.oneLine || '明确产品定位、核心产出、目标用户和证据边界。',
    'gap-confirmation': `已整理 ${(artifact.gapConfirmation?.questions || []).length || 0} 个缺口问题与确认动作。`,
    'user-journey-analysis': `已建立 ${(artifact.personaScenarioMatrix || []).length || 0} 条角色场景映射和用户旅程。`,
    'feature-page-decomposition': `已拆出 ${(artifact.functionModuleMatrix || []).length || 0} 条功能模块与 ${(artifact.pageCoverageMatrix || []).length || 0} 个页面覆盖项。`,
    'business-rules-stateflow': `已归并 ${(artifact.businessRuleMatrix?.rules || []).length || 0} 条业务规则、权限和边界条件。`,
    'flow-architecture': '重点吸收顶层导航、信息架构、核心/异常流程、数据流和跨功能关联。',
    'design-opportunity': `已形成 ${(artifact.designOpportunityMatrix?.opportunities || []).length || 0} 个设计机会。`,
    'priority-roadmap': '按优先级矩阵、MVP/v1/v2 和依赖风险收束排期。',
    'acceptance-standards': '按功能、规则、状态、非功能和交付物清单沉淀验收依据。',
    'ux-original-requirement-analysis': '识别原始输入、真实诉求、显性/隐性需求、信息缺口和证据边界。',
    'ux-design-problem-definition': '把需求转译为可设计的问题定义、目标矩阵、HMW 问题和成功判断标准。',
    'ux-user-scenario': '定义目标用户、核心场景、任务链路、情绪触点、旅程痛点和验证假设。',
    'ux-interaction-chain': '串联主流程、页面三件套、状态机、信息架构、数据流和关键节点。',
    'ux-three-design-solutions': '围绕关键节点输出稳妥/效率/引导等三套完整设计方案并对比取舍。',
    'ux-exception-flow': '补齐失败、空态、权限、网络、返回、未保存等异常路径和恢复动作。',
    'ux-recommendation-decision': '给出推荐方案、决策依据、适用前提、优先级、交付物和验收标准。'
  }
  const blockOverrides = {
    'requirement-understanding': {
      productDefinition: { title: '产品定位与核心价值', type: 'summary' },
      userScenarios: { title: '目标用户与业务场景', type: 'list' },
      evidenceAndAssumptions: { title: '依据假设', type: 'list' },
      riskAssessment: { title: '风险', type: 'risk-matrix' }
    },
    'gap-confirmation': {
      gapConfirmation: { title: 'P0/P1/P2 缺口确认', type: 'question-list' },
      openQuestions: { title: '建议追问', type: 'question-list' }
    },
    'user-journey-analysis': {
      personaScenarioMatrix: { title: '角色场景矩阵', type: 'table' },
      userJourneyMap: { title: '旅程步骤、触点、情绪、痛点、机会', type: 'timeline' }
    },
    'feature-page-decomposition': {
      functionModuleMatrix: { title: '功能模块树', type: 'table' },
      designRequirementMap: { title: '页面清单', type: 'table' },
      pageHierarchyTree: { title: '页面层级', type: 'tree' },
      pageCoverageMatrix: { title: '页面覆盖', type: 'table' },
      pageFrameContracts: { title: '共享组件与页面框架合同', type: 'table' }
    },
    'flow-architecture': {
      navigationStructure: { title: '顶层导航', type: 'tree' },
      dataFlowGraph: { title: '数据流', type: 'graph' },
      featureJumpGraph: { title: '跨功能关联', type: 'relation-table' },
      exceptionRecoveryMatrix: { title: '异常流程', type: 'risk-matrix' }
    },
    'business-rules-stateflow': {
      businessRuleMatrix: { title: '数据/流程/计算/显示规则', type: 'rule-list' },
      permissionMatrix: { title: '权限矩阵', type: 'permission-matrix' },
      boundaryConditionMatrix: { title: '边界条件', type: 'risk-matrix' },
      stateMachineMap: { title: '状态转换', type: 'state-machine' }
    },
    'design-opportunity': {
      designOpportunityMatrix: { title: '设计机会矩阵', type: 'opportunity-matrix' },
      competitiveAnalysis: { title: '竞品参考', type: 'summary' }
    },
    'priority-roadmap': {
      priorityRoadmap: { title: '优先级排期', type: 'priority-table' },
      scopeBoundary: { title: 'MVP/v1/v2 与依赖风险', type: 'priority-table' }
    },
    'acceptance-standards': {
      acceptanceBasis: { title: '验收依据', type: 'acceptance-basis' }
    },
    'ux-design-problem-definition': {
      functionModuleMatrix: { title: '设计目标与问题拆解', type: 'table' },
      designRequirementMap: { title: 'HMW 与设计约束', type: 'table' },
      acceptanceBasis: { title: '成功判断标准', type: 'acceptance-basis' }
    },
    'ux-user-scenario': {
      riskAssessment: { title: '用户假设与场景风险', type: 'risk-matrix' },
      gapConfirmation: { title: '待验证用户问题', type: 'question-list' },
      boundaryConditionMatrix: { title: '场景边界与限制', type: 'risk-matrix' }
    },
    'ux-interaction-chain': {
      navigationStructure: { title: '信息架构', type: 'tree' },
      pageHierarchyTree: { title: '页面层级', type: 'tree' },
      userJourneyMap: { title: '用户流程', type: 'timeline' },
      dataFlowGraph: { title: '业务流程与数据流', type: 'graph' },
      featureJumpGraph: { title: '关键断点与跨功能关联', type: 'relation-table' },
      exceptionRecoveryMatrix: { title: '异常路径', type: 'risk-matrix' },
      stateMachineMap: { title: '状态流转', type: 'state-machine' }
    },
    'ux-three-design-solutions': {
      designOpportunityMatrix: { title: '三套设计方案与机会树', type: 'opportunity-matrix' },
      competitiveAnalysis: { title: '竞品参考与证据边界', type: 'summary' }
    },
    'ux-exception-flow': {
      priorityRoadmap: { title: '异常优先级与修复顺序', type: 'priority-table' },
      scopeBoundary: { title: '异常覆盖范围与边界', type: 'priority-table' }
    },
    'ux-recommendation-decision': {
      acceptanceBasis: { title: '推荐方案、交付物与验收', type: 'acceptance-basis' }
    }
  }
  return {
    version: REQUIREMENT_ANALYSIS_PIPELINE_VERSION,
    tabs: requirementPipelineTabsForArtifact(artifact).map((tab) => ({
      id: tab.id,
      title: tab.title,
      summary: summaries[tab.id] || '',
      confidence: 'medium',
      evidenceRefs: [],
      detailBlocks: tab.sourceRefs.map((sourceRef) => sourceRefBlock(sourceRef, blockOverrides[tab.id]?.[sourceRef]))
    }))
  }
}

function completeProductAnalysisPipeline(modelPipeline = null, artifact = {}) {
  const fallbackPipeline = requirementAnalysisPipelineForArtifact(artifact)
  const modelTabs = Array.isArray(modelPipeline?.tabs) ? modelPipeline.tabs : []
  const modelTabById = new Map(modelTabs.map((tab) => [advancedUxCanonicalTabId(cleanText(tab.id)), tab]).filter(([id]) => id))
  return {
    version: REQUIREMENT_ANALYSIS_PIPELINE_VERSION,
    tabs: fallbackPipeline.tabs.map((fallbackTab) => {
      const modelTab = modelTabById.get(fallbackTab.id) || {}
      const modelBlocks = Array.isArray(modelTab.detailBlocks) ? modelTab.detailBlocks : []
      const fallbackBlockRefs = new Set(fallbackTab.detailBlocks.map((block) => block.sourceRef).filter(Boolean))
      const safeModelBlocks = modelBlocks
        .filter((block) => block && typeof block === 'object')
        .map((block, index) => ({
          id: cleanText(block.id || block.sourceRef || `${fallbackTab.id}-block-${index + 1}`),
          title: cleanText(block.title || REQUIREMENT_SOURCE_REF_BLOCK_META[block.sourceRef]?.title || `分析区块 ${index + 1}`),
          type: cleanText(block.type || REQUIREMENT_SOURCE_REF_BLOCK_META[block.sourceRef]?.type || 'list'),
          ...(block.sourceRef ? { sourceRef: cleanText(block.sourceRef) } : {}),
          ...(block.summary ? { summary: cleanText(block.summary) } : {}),
          ...(Array.isArray(block.columns) ? { columns: block.columns } : {}),
          ...(Array.isArray(block.rows) && !block.sourceRef ? { rows: block.rows } : {}),
          ...(Array.isArray(block.items) && !block.sourceRef ? { items: block.items } : {}),
          ...(Array.isArray(block.nodes) && !block.sourceRef ? { nodes: block.nodes } : {}),
          ...(Array.isArray(block.edges) && !block.sourceRef ? { edges: block.edges } : {})
        }))
      const mergedBlocks = [
        ...fallbackTab.detailBlocks,
        ...safeModelBlocks.filter((block) => !block.sourceRef || !fallbackBlockRefs.has(block.sourceRef))
      ]
      return {
        ...fallbackTab,
        ...modelTab,
        id: fallbackTab.id,
        title: fallbackTab.title,
        summary: cleanText(modelTab.summary || fallbackTab.summary),
        confidence: cleanText(modelTab.confidence || fallbackTab.confidence || 'medium'),
        evidenceRefs: Array.isArray(modelTab.evidenceRefs) ? modelTab.evidenceRefs : fallbackTab.evidenceRefs,
        detailBlocks: mergedBlocks
      }
    })
  }
}

function fallbackCompetitiveAnalysis(analysis = {}, pages = []) {
  const text = analysisText(analysis)
  const hasExplicitCompetitor = /竞品|参考|对标|类似|像/.test(text)
  const productType = productTypeForAnalysis(text)
  const evidenceStatus = hasExplicitCompetitor ? 'user-mentioned-evidence-pending' : 'needs-user-or-search-evidence'
  const evidenceNotice = hasExplicitCompetitor
    ? '输入中出现竞品/参考/对标信号，但仍需要补充具体名称、链接、截图或知识库材料后才能形成真实竞品研究。'
    : '未识别到明确竞品名称、链接或截图。以下内容基于项目类型和行业模式推断，不等同于真实竞品研究。'
  return {
    referenceMode: hasExplicitCompetitor ? 'user-mentioned-reference' : 'industry-assumption',
    evidenceStatus,
    evidenceNotice,
    referenceProducts: hasExplicitCompetitor
      ? [{ name: '用户提到的参考对象', reason: '输入中出现竞品/参考/对标信号，需要在后续补充具体名称或截图链接。', targetScenario: '与本项目主场景相近', borrowablePatterns: ['主流程组织方式', '页面信息密度', '关键 CTA 位置'], avoidPatterns: ['未验证的品牌表达', '与本项目范围无关的复杂功能'] }]
      : [{ name: `同类${productType}`, reason: '用户未提供具体竞品，先按行业常识形成可推翻参考。', targetScenario: '同类产品的核心任务闭环', borrowablePatterns: ['行业标配入口', '主路径步骤', '常见状态反馈'], avoidPatterns: ['把行业通用能力误当成本期必做', '照搬未验证的运营模块'] }],
    industryBaseline: ['清晰入口', '主任务路径', '状态反馈', '异常恢复', '基础账号/数据规则'],
    comparisonDimensions: ['首屏入口', '主任务路径', '快捷开始/模板入口', '状态反馈', '异常恢复', '账号与数据规则'],
    nextActions: ['让 Agent 找 3 个竞品', '上传竞品截图/链接', '从知识库选择参考'],
    researchSearchDirections: competitorSearchDirections(text, productType),
    featureComparison: pages.slice(0, 6).map((page) => `${page.title}：对齐同类产品的页面职责和主操作。`),
    flowComparison: ['尽量缩短从入口到核心任务完成的步骤', '把高风险分支放到待确认，不阻塞第一版主路径'],
    pagePatternInsights: pages.slice(0, 5).map((page) => `${page.title} 需要明确首屏重点、主按钮和返回路径。`),
    visualDensityInsights: ['新项目先控制信息密度，优先保证主路径可读；运营内容作为 P1 或配置项承接。'],
    implicationsForThisProject: {
      p0MustHave: pages.slice(0, 4).map((page) => page.title).filter(Boolean),
      p1Optional: ['会员/运营增强', '个性化推荐', '精细化配置'],
      avoidScope: ['未确认的复杂三方集成', '未验证的完整运营后台', '无法验收的抽象品牌表达'],
      pageHints: pages.slice(0, 5).map((page) => `${page.title}：保留行业标配主操作和状态反馈。`),
      interactionHints: ['主路径动作要有明确反馈', '失败状态必须可重试或返回', '滚动/固定操作区在低保真阶段继续细化'],
      visualHints: ['按产品类型选择信息密度', '首屏优先表达当前任务', 'CTA 不被运营内容压过']
    }
  }
}

function fallbackRequirementDissectionArtifact(analysis = {}, requirementSlices = [], pages = [], projectFunctionMap = null) {
  const blueprint = analysis.blueprint || {}
  const text = analysisText(analysis)
  const productName = cleanText(blueprint.profile?.productName || blueprint.title || analysis.input || '当前需求')
  const productType = productTypeForAnalysis(text)
  const pageNames = pages.map((page) => page.title).filter(Boolean)
  const roleNames = uniqueTexts([
    ...(Array.isArray(blueprint.users) ? blueprint.users : []),
    ...(Array.isArray(blueprint.profile?.targetUsers) ? blueprint.profile.targetUsers : []),
    ...(projectFunctionMap?.pageMap || []).map((page) => page.role),
    ...(projectFunctionMap?.rolePermissionMap || []).map((role) => role.role)
  ], 6)
  const targetUserFallback = [
    roleNames.length ? `${roleNames[0]}：完成${productName}的核心任务闭环。` : '',
    pageNames.length ? `首次使用用户：需要从${pageNames.slice(0, 3).join('、')}快速理解入口、价值和主路径。` : '',
    pageNames.length > 3 ? `复用用户：需要快速回到${pageNames.slice(-3).join('、')}等高频入口，并保留上次选择或草稿状态。` : '',
    `决策/付费相关用户：需要在关键节点看清成本、权益、结果预期和失败恢复方式。`,
    '运营/管理相关角色：需要查看关键状态、处理异常并维护基础规则。'
  ].filter(Boolean)
  const scenarioFallback = [
    ...requirementSlices.map((slice) => slice.goal).filter(Boolean),
    pageNames.length ? `从${pageNames[0]}进入，经过${pageNames.slice(1, 4).join('、') || '核心页面'}完成主任务。` : '',
    pageNames.length > 4 ? `围绕${pageNames.slice(4, 8).join('、')}补齐支付、订单、会员或管理类状态。` : '',
    '失败、空状态、权限不足时需要明确恢复入口，不能清空用户已输入或已选择内容。'
  ].filter(Boolean)
  const jtbdFallback = [
    productType === '微信小程序' ? '在微信内快速理解入口、选择内容并完成提交/支付等主操作。' : '快速理解能做什么并进入核心任务。',
    pageNames.length ? `围绕${pageNames.slice(0, 4).join('、')}完成连续操作，不被页面跳转打断。` : '完成核心业务动作。',
    '在加载失败、状态异常或信息不足时获得可执行的恢复入口。',
    '返回时保留关键选择、输入内容和当前业务状态。'
  ]
  const designImplications = [
    pageNames.length ? `首屏要先露出${pageNames[0]}的核心任务、主 CTA 和下一步路径。` : '首屏要先露出当前任务和主 CTA。',
    '每个主操作都需要 loading、成功、失败、权限不足和返回保持规则。',
    '详情页要同时写清信息层级、用户可点控件、跳转目标和接口/字段依赖。',
    '不确定的商业规则进入待确认，不阻塞主路径框架生成。'
  ]
  const scopeBoundary = {
    p0: listFromValues(requirementSlices.filter((slice) => slice.priority !== 'P2').map((slice) => slice.title), pages.slice(0, 4).map((page) => page.title), 8),
    p1: listFromValues(requirementSlices.filter((slice) => slice.priority === 'P1').map((slice) => slice.title), ['运营增强', '数据看板', '个性化推荐'], 6),
    outOfScope: ['未确认的复杂第三方集成', '无法从输入验证的完整后台能力', '未定义验收标准的扩展功能'],
    dependencies: ['账号/身份规则', '核心业务数据', '异常状态规则', '验收标准']
  }
  const pageRows = pageRequirementRows(pages)
  const pageCoverageMatrix = pageCoverageMatrixForAnalysis(analysis, pages)
  const competitiveAnalysis = fallbackCompetitiveAnalysis(analysis, pages)
  const evidenceAndAssumptions = evidenceAndAssumptionsForAnalysis(analysis, pages)
  const navigationStructure = navigationStructureForAnalysis(projectFunctionMap, pages)
  const functionModuleMatrix = functionModuleMatrixForAnalysis(projectFunctionMap, pages)
  const pageHierarchyTree = pageHierarchyTreeForAnalysis(projectFunctionMap, pages)
  const decisionPointMatrix = decisionPointMatrixForAnalysis(analysis, pages)
  const decisionFlowGraph = decisionFlowGraphForAnalysis({ decisionPointMatrix }, pages)
  const exceptionRecoveryMatrix = exceptionRecoveryMatrixForAnalysis(analysis, pages)
  const dataFlowGraph = dataFlowGraphForAnalysis(analysis, pages)
  const stateMachineMap = stateMachineMapForAnalysis(analysis, pages)
  const featureJumpGraph = featureJumpGraphForAnalysis(projectFunctionMap, pages)
  const dataSharingMechanism = dataSharingMechanismForAnalysis(analysis, pages)
  const knowledgeLoadingContext = knowledgeLoadingContextForAnalysis(analysis)
  const analysisGuidance = buildRequirementDissectionGuidanceArtifact()
  const productDefinition = {
    oneLine: `${productName} 是一个面向核心任务闭环的${productType}需求。`,
    productName,
    productType,
    documentCount: `${analysis.summary?.parsed || 0}/${analysis.summary?.total || 0}`,
    sourceSummary: cleanText(blueprint.profile?.sourceSummary || analysis.input || productName),
    surfaceAsk: cleanText(analysis.input || blueprint.profile?.sourceSummary || productName),
    bottomIntent: cleanText(blueprint.profile?.primaryGoal || '先把产品目标、用户路径、页面结构和交付边界拆清楚，再进入页面级设计。'),
    successSignals: ['用户能完成核心任务', '页面职责清晰', '异常状态可恢复', '后续阶段可直接继承结构']
  }
  const userScenarios = {
    primaryUsers: listFromValues(targetUserFallback, roleNames, 6),
    coreScenarios: listFromValues(requirementSlices.map((slice) => slice.goal), scenarioFallback, 8),
    jobsToBeDone: jtbdFallback,
    designImplications
  }
  const userJourneyMap = {
    firstTimePath: listFromValues(projectFunctionMap?.userPath || pages.map((page) => page.title), pages.map((page) => page.title), 10),
    returningPath: ['进入最近任务或常用入口', '复用上次选择', '完成核心操作', '查看状态或结果'],
    exceptionPath: ['加载失败提示', '重试或返回', '保留已输入内容', '必要时联系客服/查看帮助']
  }
  const gapConfirmation = gapConfirmationForAnalysis(analysis, requirementSlices, pages)
  const personaScenarioMatrix = personaScenarioMatrixForAnalysis(userScenarios, pages)
  const designRequirementMap = {
    pages: pageRows,
    globalStates: ['默认', '加载', '空状态', '失败', '权限不足', '禁用', '成功反馈'],
    interactionFocus: ['点击主操作', '输入/选择校验', '弹窗确认', '下拉刷新', '内容滚动与固定操作区', '页面跳转与返回保持'],
    acceptanceChecklist: ['用户第一眼能看懂当前页面目标', '主操作和次操作优先级清晰', '点击后跳转/反馈明确', '返回保留关键状态', '加载/空/失败/权限状态都有恢复方式']
  }
  const businessRuleMatrix = businessRuleMatrixForAnalysis(analysis, pages, stateMachineMap)
  const permissionMatrix = permissionMatrixForAnalysis(analysis, pages)
  const boundaryConditionMatrix = boundaryConditionMatrixForAnalysis(analysis, pages)
  const designOpportunityMatrix = designOpportunityMatrixForAnalysis(analysis, pages, exceptionRecoveryMatrix, userJourneyMap)
  const priorityRoadmap = priorityRoadmapForAnalysis(scopeBoundary, designOpportunityMatrix, requirementSlices)
  const acceptanceBasis = acceptanceBasisForAnalysis(designRequirementMap, businessRuleMatrix, stateMachineMap, permissionMatrix, boundaryConditionMatrix)
  const downstreamHints = {
    interactionLofi: ['按页面需求清单生成页面框架', '继承功能层级地图和用户主路径', '把状态与异常转成页面级交互说明'],
    uiVisual: ['参考竞品/行业信息密度', '突出每页主任务和 CTA', '保留关键状态截图需求'],
    frontendBackend: ['按页面数据依赖拆接口', '按业务规则拆状态和错误码', '按验收信号写测试点']
  }
  const risks = pendingQuestions(analysis).map((question) => ({ question, impact: '不确认会影响页面优先级、交互状态或验收口径。' }))
  const riskAssessment = {
    risks: risks.length
      ? risks.map((risk, index) => ({
        id: `risk-${index + 1}`,
        priority: index < 2 ? 'P0' : 'P1',
        risk: risk.question,
        triggerPath: '需求分析 / 缺口确认',
        userImpact: risk.impact,
        mitigation: '在交互低保前确认，或在页面框架中保留可恢复状态。',
        confidence: 'medium'
      }))
      : [{
        id: 'risk-1',
        priority: 'P1',
        risk: '需求信息仍可能缺少目标用户、业务场景或验收口径。',
        triggerPath: '需求分析',
        userImpact: '可能影响页面范围、状态设计和验收标准。',
        mitigation: '通过缺口确认和页面覆盖矩阵继续收口。',
        confidence: 'medium'
      }],
    assumptions: evidenceAndAssumptions.assumptions || [],
    validationMethods: ['用户确认', '附件/知识库补证据', '交互低保阶段验证主路径与异常路径']
  }
  const openQuestions = pendingQuestions(analysis).map((question, index) => ({ id: `question-${index + 1}`, question, priority: index < 3 ? 'must-confirm' : 'can-follow-up' }))
  const preliminaryArtifact = {
    analysisFramework: isAdvancedUxRequirementAnalysis(analysis) ? ADVANCED_UX_REQUIREMENT_ANALYSIS_SKILL_ID : 'total-design-flow',
    productDefinition,
    userScenarios,
    scopeBoundary,
    knowledgeLoadingContext,
    evidenceAndAssumptions,
    riskAssessment,
    gapConfirmation,
    personaScenarioMatrix,
    navigationStructure,
    functionModuleMatrix,
    pageHierarchyTree,
    decisionPointMatrix,
    decisionFlowGraph,
    exceptionRecoveryMatrix,
    permissionMatrix,
    boundaryConditionMatrix,
    dataFlowGraph,
    stateMachineMap,
    featureJumpGraph,
    dataSharingMechanism,
    pageCoverageMatrix,
    userJourneyMap,
    designRequirementMap,
    businessRuleMatrix,
    designOpportunityMatrix,
    competitiveAnalysis,
    priorityRoadmap,
    acceptanceBasis,
    risks,
    openQuestions,
    downstreamHints
  }
  const pageFrameContracts = pageFrameContractsForAnalysis(preliminaryArtifact, pages)
  const productAnalysisPipeline = requirementAnalysisPipelineForArtifact({ ...preliminaryArtifact, pageFrameContracts })
  return {
    version: 'requirement-dissection/v2',
    analysisFramework: preliminaryArtifact.analysisFramework,
    analysisGuidance,
    productAnalysisPipeline,
    productDefinition,
    userScenarios,
    scopeBoundary,
    knowledgeLoadingContext,
    evidenceAndAssumptions,
    riskAssessment,
    gapConfirmation,
    personaScenarioMatrix,
    navigationStructure,
    functionModuleMatrix,
    pageHierarchyTree,
    decisionPointMatrix,
    decisionFlowGraph,
    exceptionRecoveryMatrix,
    permissionMatrix,
    boundaryConditionMatrix,
    dataFlowGraph,
    stateMachineMap,
    featureJumpGraph,
    dataSharingMechanism,
    pageCoverageMatrix,
    userJourneyMap,
    pageFrameContracts,
    designRequirementMap,
    businessRuleMatrix,
    designOpportunityMatrix,
    competitiveAnalysis,
    priorityRoadmap,
    acceptanceBasis,
    risks,
    openQuestions,
    downstreamHints
  }
}

function requirementDissectionArtifactForAnalysis(analysis = {}, requirementSlices = [], pages = [], projectFunctionMap = null) {
  const fallbackArtifact = fallbackRequirementDissectionArtifact(analysis, requirementSlices, pages, projectFunctionMap)
  const modelArtifact = modelRequirementDissectionArtifactForAnalysis(analysis)
  return modelArtifact
    ? completeRequirementDissectionArtifact(modelArtifact, fallbackArtifact)
    : fallbackArtifact
}

function hasOwnModelField(source = {}, key = '') {
  return Boolean(source && typeof source === 'object' && Object.prototype.hasOwnProperty.call(source, key))
}

function modelOnlyRequirementSourceRefs(artifact = {}, sourceRefs = []) {
  return sourceRefs.filter((sourceRef) => hasOwnModelField(artifact, sourceRef))
}

function modelOnlyProductAnalysisPipeline(modelArtifact = {}) {
  const modelPipeline = modelArtifact?.productAnalysisPipeline || {}
  const modelTabs = Array.isArray(modelPipeline?.tabs) ? modelPipeline.tabs : []
  const modelTabById = new Map(modelTabs.map((tab) => [advancedUxCanonicalTabId(cleanText(tab.id)), tab]).filter(([id]) => id))
  return {
    version: REQUIREMENT_ANALYSIS_PIPELINE_VERSION,
    tabs: requirementPipelineTabsForArtifact(modelArtifact).map((tab) => {
      const modelTab = modelTabById.get(tab.id) || {}
      const modelBlocks = Array.isArray(modelTab.detailBlocks) ? modelTab.detailBlocks : []
      const modelSourceRefs = new Set(modelOnlyRequirementSourceRefs(modelArtifact, tab.sourceRefs))
      const fallbackBlocks = tab.sourceRefs
        .filter((sourceRef) => modelSourceRefs.has(sourceRef))
        .map((sourceRef) => sourceRefBlock(sourceRef))
      const mergedBlocks = [
        ...fallbackBlocks,
        ...modelBlocks.filter((block) => !block?.sourceRef || !modelSourceRefs.has(cleanText(block.sourceRef)))
      ]
      return {
        id: tab.id,
        title: tab.title,
        summary: cleanText(modelTab.summary || ''),
        confidence: cleanText(modelTab.confidence || ''),
        evidenceRefs: Array.isArray(modelTab.evidenceRefs) ? modelTab.evidenceRefs : [],
        detailBlocks: mergedBlocks
      }
    })
  }
}

function modelOnlyRequirementDissectionArtifactForAnalysis(analysis = {}) {
  const modelArtifact = modelRequirementDissectionArtifactForAnalysis(analysis)
  if (!modelArtifact) {
    if (resolveContentStatus(analysis) !== 'model-generated') return null
    return {
      __modelOnly: true,
      __modelMissing: true,
      version: 'requirement-dissection/model-only-v1',
      productAnalysisPipeline: {
        version: REQUIREMENT_ANALYSIS_PIPELINE_VERSION,
        tabs: requirementPipelineTabsForArtifact(analysis).map((tab) => ({
          id: tab.id,
          title: tab.title,
          summary: '',
          confidence: '',
          evidenceRefs: [],
          detailBlocks: []
        }))
      }
    }
  }
  const clone = JSON.parse(JSON.stringify(modelArtifact))
  clone.__modelOnly = true
  if (isAdvancedUxRequirementAnalysis(analysis)) clone.analysisFramework = ADVANCED_UX_REQUIREMENT_ANALYSIS_SKILL_ID
  clone.competitiveAnalysis = mergeObjectWithFallback(clone.competitiveAnalysis || {}, fallbackCompetitiveAnalysis(analysis))
  clone.version = clone.version || 'requirement-dissection/model-only-v1'
  clone.productAnalysisPipeline = modelOnlyProductAnalysisPipeline(clone)
  delete clone.analysisGuidance
  delete clone.projectFunctionMap
  return clone
}

function artifactList(value = [], limit = 8) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item
      if (!item || typeof item !== 'object') return ''
      return item.title || item.name || item.pageName || item.goal || item.question || item.summary || item.reason || ''
    }).map(cleanText).filter(Boolean).slice(0, limit)
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, item]) => `${key}：${Array.isArray(item) ? item.join('、') : cleanText(item)}`).slice(0, limit)
  }
  return cleanText(value) ? [cleanText(value)] : []
}

function requirementTabContent(tab = {}, artifact = {}) {
  if (artifact.__modelMissing) return ['模型未返回需求分析结构']
  if (artifact.__modelOnly) return modelOnlyRequirementTabContent(tab, artifact)
  const pages = artifact.designRequirementMap?.pages || []
  const evidence = artifact.evidenceAndAssumptions || {}
  const competitive = artifact.competitiveAnalysis || {}
  const scope = artifact.scopeBoundary || {}
  const downstream = artifact.downstreamHints || {}
  const contentByTab = {
    'requirement-understanding': [
      artifact.productDefinition?.oneLine,
      artifact.productDefinition?.documentCount ? `文档数量：${artifact.productDefinition.documentCount}` : '',
      artifact.productDefinition?.sourceSummary ? `来源摘要：${artifact.productDefinition.sourceSummary}` : '',
      `产品类型：${artifact.productDefinition?.productType || '待确认'}`,
      `核心用户：${artifactList(artifact.userScenarios?.primaryUsers, 3).join('、') || '待确认'}`,
      `核心场景：${artifactList(artifact.userScenarios?.coreScenarios, 3).join('、') || '待确认'}`,
      `当前模式：${evidence.demandScope === 'project' ? '项目需求' : '非项目需求'}`
    ],
    'gap-confirmation': [
      `已确认事实：${(artifact.gapConfirmation?.confirmedFacts || []).length} 条`,
      `待确认问题：${(artifact.gapConfirmation?.questions || []).length} 项`,
      `影响页面：${artifactList(artifact.gapConfirmation?.affectedPages, 4).join('、') || '待确认'}`
    ],
    'user-journey-analysis': [
      `角色场景：${(artifact.personaScenarioMatrix || []).length} 条`,
      `首次路径：${artifactList(artifact.userJourneyMap?.firstTimePath, 4).join(' -> ') || '待确认'}`,
      `异常路径：${artifactList(artifact.userJourneyMap?.exceptionPath, 3).join(' -> ') || '待确认'}`
    ],
    'feature-page-decomposition': [
      `功能模块：${artifactList((artifact.functionModuleMatrix || []).map((row) => row.moduleName), 4).join('、') || '待确认'}`,
      `页面覆盖：${(artifact.pageCoverageMatrix || []).length} 个`,
      `页面层级：${artifact.pageHierarchyTree?.leafPageCount || pages.length || 0} 个叶子页面`
    ],
    'business-rules-stateflow': [
      `业务规则：${(artifact.businessRuleMatrix?.rules || []).length} 条`,
      `权限操作：${(artifact.permissionMatrix?.operations || []).length} 项`,
      `边界条件：${(artifact.boundaryConditionMatrix || []).length} 条`
    ],
    'flow-architecture': [
      '吸收顶层导航、信息架构、核心流程、异常流程、数据流和跨功能关联。',
      `导航入口：${artifactList(artifact.navigationStructure?.globalEntries, 3).join('、') || '待确认'}`,
      `数据流：${(artifact.dataFlowGraph?.edges || []).length} 条`,
      `跨功能跳转：${(artifact.featureJumpGraph?.edges || []).length} 条`,
      `异常路径：${(artifact.exceptionRecoveryMatrix || []).length} 条`
    ],
    'design-opportunity': [
      `证据状态：${competitive.evidenceNotice || '竞品证据待补充'}`,
      `设计机会：${artifactList((artifact.designOpportunityMatrix?.opportunities || []).map((item) => item.title), 3).join('；') || '从异常、断点和跳转复杂度继续提炼'}`
    ],
    'priority-roadmap': [
      `P0：${artifactList(scope.p0, 3).join('、') || '待确认'}`,
      `优先级排期：${artifactList(artifact.priorityRoadmap?.milestones?.map((item) => item.title || item.name), 3).join('、') || '待确认'}`
    ],
    'acceptance-standards': [
      `验收依据：${artifactList(artifact.acceptanceBasis?.functional, 2).join('；') || '待确认'}`
    ],
    'ux-original-requirement-analysis': [
      artifact.productDefinition?.oneLine,
      `原始用户：${artifactList(artifact.userScenarios?.primaryUsers, 3).join('、') || '待确认'}`,
      `原始场景：${artifactList(artifact.userScenarios?.coreScenarios, 3).join('、') || '待确认'}`
    ],
    'ux-design-problem-definition': [
      `设计问题：${artifactList((artifact.functionModuleMatrix || []).map((row) => row.moduleName), 4).join('、') || '待确认'}`,
      `成功标准：${artifactList(artifact.acceptanceBasis?.functional, 2).join('；') || '待确认'}`
    ],
    'ux-user-scenario': [
      `核心用户：${artifactList(artifact.userScenarios?.primaryUsers, 3).join('、') || '待确认'}`,
      `场景假设：${artifactList(artifact.userScenarios?.coreScenarios, 3).join('、') || '待确认'}`,
      `待验证问题：${(artifact.gapConfirmation?.questions || []).length} 项`
    ],
    'ux-interaction-chain': [
      `导航入口：${artifactList(artifact.navigationStructure?.globalEntries, 3).join('、') || '待确认'}`,
      `页面层级：${artifact.pageHierarchyTree?.leafPageCount || pages.length || 0} 个叶子页面`,
      `数据流：${(artifact.dataFlowGraph?.edges || []).length} 条`
    ],
    'ux-three-design-solutions': [
      `设计机会：${artifactList((artifact.designOpportunityMatrix?.opportunities || []).map((item) => item.title), 3).join('；') || '待确认'}`,
      `竞品证据：${competitive.evidenceStatus || '待补充'}`
    ],
    'ux-exception-flow': [
      `异常路径：${(artifact.exceptionRecoveryMatrix || []).length} 条`,
      `边界条件：${(artifact.boundaryConditionMatrix || []).length} 条`,
      `优先修复：${artifactList(scope.p0, 3).join('、') || '待确认'}`
    ],
    'ux-recommendation-decision': [
      `推荐依据：${artifactList(artifact.priorityRoadmap?.milestones?.map((item) => item.title || item.name), 3).join('、') || '待确认'}`,
      `交付物：${artifactList(artifact.downstreamHints?.handoffItems, 3).join('、') || '待模型补充'}`
    ]
  }
  return artifactList(contentByTab[tab.id] || [tab.summary], 5)
}

function modelOnlyRequirementTabContent(tab = {}, artifact = {}) {
  const content = []
  const push = (label = '', value = '') => {
    const text = cleanText(value)
    if (text) content.push(label ? `${label}：${text}` : text)
  }
  const pushList = (label = '', value = [], limit = 4) => {
    const items = artifactList(value, limit)
    if (items.length) content.push(`${label}：${items.join('、')}`)
  }
  const sourceRefs = Array.isArray(tab.detailBlocks)
    ? tab.detailBlocks.map((block) => block.sourceRef).filter(Boolean)
    : []
  sourceRefs.forEach((sourceRef) => {
    const source = artifact[sourceRef]
    if (!hasOwnModelField(artifact, sourceRef)) return
    switch (sourceRef) {
      case 'productDefinition':
        push('', source?.oneLine)
        push('产品类型', source?.productType)
        push('来源摘要', source?.sourceSummary)
        break
      case 'userScenarios':
        pushList('核心用户', source?.primaryUsers, 3)
        pushList('核心场景', source?.coreScenarios, 3)
        pushList('设计转译', source?.designImplications, 3)
        break
      case 'evidenceAndAssumptions':
        pushList('证据来源', source?.evidenceSources, 3)
        pushList('模型假设', source?.assumptions, 3)
        break
      case 'riskAssessment':
        if (Array.isArray(source?.risks)) push('风险', `${source.risks.length} 条`)
        pushList('验证方式', source?.validationMethods, 3)
        break
      case 'gapConfirmation':
        if (hasOwnModelField(source, 'confirmedFacts')) push('已确认事实', `${(source.confirmedFacts || []).length} 条`)
        if (hasOwnModelField(source, 'questions')) push('待确认问题', `${(source.questions || []).length} 项`)
        pushList('影响页面', source?.affectedPages, 3)
        break
      case 'personaScenarioMatrix':
        if (Array.isArray(source)) push('角色场景', `${source.length} 条`)
        break
      case 'userJourneyMap':
        pushList('首次路径', source?.firstTimePath, 4)
        pushList('异常路径', source?.exceptionPath, 3)
        break
      case 'functionModuleMatrix':
        if (Array.isArray(source)) pushList('功能模块', source.map((row) => row.moduleName || row.title || row.name), 4)
        break
      case 'designRequirementMap':
        pushList('页面需求', source?.pages?.map((row) => row.pageName || row.title), 4)
        break
      case 'pageHierarchyTree':
        push('页面层级', source?.leafPageCount ? `${source.leafPageCount} 个叶子页面` : '')
        break
      case 'pageCoverageMatrix':
        if (Array.isArray(source)) push('页面覆盖', `${source.length} 个`)
        break
      case 'pageFrameContracts':
        if (Array.isArray(source)) push('页面框架合同', `${source.length} 个`)
        break
      case 'businessRuleMatrix':
        if (Array.isArray(source?.rules)) push('业务规则', `${source.rules.length} 条`)
        break
      case 'stateMachineMap':
        if (Array.isArray(source?.globalStates)) push('状态机', `${source.globalStates.length} 个全局状态`)
        if (Array.isArray(source?.pageStates)) push('页面状态', `${source.pageStates.length} 组`)
        break
      case 'permissionMatrix':
        if (Array.isArray(source?.operations)) push('权限操作', `${source.operations.length} 项`)
        break
      case 'boundaryConditionMatrix':
        if (Array.isArray(source)) push('边界条件', `${source.length} 条`)
        break
      case 'navigationStructure':
        pushList('导航入口', source?.globalEntries, 3)
        break
      case 'dataFlowGraph':
        if (Array.isArray(source?.edges)) push('数据流', `${source.edges.length} 条`)
        break
      case 'featureJumpGraph':
        if (Array.isArray(source?.edges)) push('跨功能跳转', `${source.edges.length} 条`)
        break
      case 'exceptionRecoveryMatrix':
        if (Array.isArray(source)) push('异常路径', `${source.length} 条`)
        break
      case 'designOpportunityMatrix':
        pushList('设计机会', source?.opportunities?.map((row) => row.title || row.name), 3)
        break
      case 'competitiveAnalysis':
        push('证据状态', source?.evidenceNotice)
        push('参考模式', source?.referenceMode)
        break
      case 'priorityRoadmap':
        pushList('优先级', source?.milestones?.map((row) => row.title || row.name), 3)
        break
      case 'scopeBoundary':
        pushList('P0', source?.p0, 3)
        pushList('范围外', source?.outOfScope, 3)
        break
      case 'acceptanceBasis':
        pushList('验收依据', source?.functional, 3)
        break
      default:
        pushList(REQUIREMENT_SOURCE_REF_BLOCK_META[sourceRef]?.title || sourceRef, source, 3)
        break
    }
  })
  return content.length ? content.slice(0, 5) : ['模型未返回该字段']
}

function requirementDissectionCards(artifact = {}) {
  const pipeline = artifact.__modelOnly
    ? artifact.productAnalysisPipeline || modelOnlyProductAnalysisPipeline(artifact)
    : completeProductAnalysisPipeline(artifact.productAnalysisPipeline, artifact)
  return pipeline.tabs.map((tab) => ({
    id: tab.id,
    requirementPipelineTabId: tab.id,
    title: tab.title,
    summary: artifact.__modelMissing ? '模型未返回需求分析结构' : tab.summary || (artifact.__modelOnly ? `模型返回字段：${(tab.detailBlocks || []).map((block) => block.title).filter(Boolean).join('、') || '无'}` : ''),
    content: requirementTabContent(tab, artifact),
    detailBlocks: tab.detailBlocks || [],
    sections: [],
    quickActions: ['design-opportunity', 'ux-three-design-solutions'].includes(tab.id) ? (artifact.competitiveAnalysis?.nextActions || []) : []
  }))
}

function advancedUxCanonicalTabId(id = '') {
  const normalized = cleanText(id)
  return ADVANCED_UX_LEGACY_TAB_ID_ALIASES[normalized] || normalized
}

function advancedUxReportFileName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('')
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}`
  return `${ADVANCED_UX_MARKDOWN_FILE_PREFIX}-${stamp}-${time}.md`
}

function advancedUxReportPlaceholder(markdown = '', overrides = {}) {
  return {
    status: overrides.status || (markdown ? 'generated' : 'generating'),
    fileName: overrides.fileName || advancedUxReportFileName(),
    markdown,
    sections: Array.isArray(overrides.sections) ? overrides.sections : [],
    ...(overrides.importError ? { importError: cleanText(overrides.importError) } : {}),
    frameworkVersion: 'advanced-ux/v2'
  }
}

function advancedUxMarkdownSectionTemplate(tab = {}, analysis = {}) {
  const demand = cleanText(analysis.input || analysis.summary || analysis.title || '当前需求')
  const title = tab.title
  const base = [
    `## ${title}`,
    '',
    `### 本节点结论`,
    '',
    `围绕「${demand}」完成${title}分析。当前内容由高级 UX 需求分析框架生成，后续画布节点从本章节自动导入。`,
    '',
    `### 关键产出`,
    '',
    `- 事实：用户输入为「${demand}」。`,
    '- 推断：信息不足时按行业常见模式推进，所有未确认判断保持低置信度。',
    '- 建议：优先补齐 P0 阻塞问题，再进入下一阶段设计。',
    '',
    `### 待确认`,
    '',
    '- 目标用户、核心场景、业务目标、技术/时间/人力约束需要继续确认。'
  ]
  return base.join('\n')
}

export function buildAdvancedUxMarkdownReport(analysis = {}, options = {}) {
  const markdown = ADVANCED_UX_ANALYSIS_PIPELINE_TABS
    .map((tab) => advancedUxMarkdownSectionTemplate(tab, analysis))
    .join('\n\n')
  const report = advancedUxReportPlaceholder(markdown, {
    status: 'generated',
    fileName: options.fileName || advancedUxReportFileName(options.date || new Date())
  })
  report.sections = parseAdvancedUxMarkdownSections(markdown).sections
  return report
}

function parseAdvancedUxMarkdownSections(markdown = '') {
  const text = String(markdown || '').replace(/\r\n/g, '\n')
  const headingMatches = [...text.matchAll(/^##\s+(.+?)\s*$/gm)]
  const sectionsById = new Map()
  headingMatches.forEach((match, index) => {
    const tab = advancedUxTabForMarkdownHeading(match[1])
    if (!tab) return
    const start = match.index || 0
    const end = headingMatches[index + 1]?.index ?? text.length
    const markdownSection = text.slice(start, end).trim()
    sectionsById.set(tab.id, {
      id: tab.id,
      title: tab.title,
      markdown: markdownSection,
      summary: firstMeaningfulMarkdownLine(markdownSection) || `${tab.title}已生成。`
    })
  })
  const missing = ADVANCED_UX_ANALYSIS_PIPELINE_TABS
    .filter((tab) => !sectionsById.has(tab.id))
    .map((tab) => tab.title)
  return {
    sections: ADVANCED_UX_ANALYSIS_PIPELINE_TABS.map((tab) => sectionsById.get(tab.id)).filter(Boolean),
    missing
  }
}

function normalizeAdvancedUxHeadingTitle(title = '') {
  return cleanText(title)
    .replace(/^节点\s*\d+\s*[：:]\s*/, '')
    .replace(/^\d+\s*[.、\s]\s*/, '')
    .replace(/[：:].*$/, '')
    .trim()
}

function advancedUxTabForMarkdownHeading(title = '') {
  const normalized = normalizeAdvancedUxHeadingTitle(title)
  const aliasedTabId = ADVANCED_UX_LEGACY_TITLE_ALIASES[normalized]
  if (aliasedTabId) return ADVANCED_UX_ANALYSIS_PIPELINE_TABS.find((tab) => tab.id === aliasedTabId) || null
  return ADVANCED_UX_ANALYSIS_PIPELINE_TABS.find((tab) =>
    normalized === tab.title ||
    normalized.startsWith(tab.title) ||
    cleanText(title).includes(tab.title)
  ) || null
}

function advancedUxMarkdownSubsections(markdown = '') {
  const text = String(markdown || '').replace(/\r\n/g, '\n')
  const matches = [...text.matchAll(/^###\s+(.+?)\s*$/gm)]
  return matches.map((match, index) => {
    const start = match.index || 0
    const bodyStart = start + match[0].length
    const end = matches[index + 1]?.index ?? text.length
    return {
      title: cleanText(match[1]).replace(/^\d+[.、]\s*/, ''),
      markdown: text.slice(bodyStart, end).trim()
    }
  })
}

function parseMarkdownTable(markdown = '') {
  const lines = String(markdown || '').split('\n').map((line) => line.trim())
  const tableStart = lines.findIndex((line, index) =>
    line.startsWith('|') &&
    lines[index + 1]?.startsWith('|') &&
    /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1])
  )
  if (tableStart < 0) return null
  const tableLines = []
  for (let index = tableStart; index < lines.length; index += 1) {
    if (!lines[index].startsWith('|')) break
    tableLines.push(lines[index])
  }
  if (tableLines.length < 3) return null
  const splitRow = (line = '') => line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cleanText(cell.replace(/\*\*/g, '')))
  const columns = splitRow(tableLines[0])
  const rows = tableLines.slice(2)
    .map((line, index) => ({ key: `row-${index + 1}`, cells: splitRow(line) }))
    .filter((row) => row.cells.some(Boolean))
  return columns.length && rows.length ? { columns, rows } : null
}

function splitAdvancedUxUserStoryParts(story = '') {
  const text = cleanText(String(story || '').replace(/\*\*/g, ''))
  const english = text.match(/^As\s+a\s+(.+?),?\s+I\s+want\s+to\s+(.+?)(?:,?\s+so\s+that\s+(.+))?$/i)
  if (english) return [cleanText(english[1]), cleanText(english[2]), cleanText(english[3] || '')]
  const chinese = text.match(/^作为\s*(.+?)[，,]\s*我想(?:要)?\s*(.+?)[，,]\s*以便\s*(.+)$/)
  if (chinese) return [cleanText(chinese[1]), cleanText(chinese[2]), cleanText(chinese[3])]
  return ['', text, '']
}

function splitAdvancedUxUserStoryTables(markdown = '') {
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
    const columns = parseRow(line)
    const storyIndex = columns.findIndex((column) => /^用户故事$/.test(cleanText(column)))
    const alreadySplit = columns.some((column) => /^As a$/i.test(cleanText(column))) &&
      columns.some((column) => /^I want to$/i.test(cleanText(column))) &&
      columns.some((column) => /^so that$/i.test(cleanText(column)))
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
      next.push(formatRow([
        ...cells.slice(0, storyIndex),
        ...splitAdvancedUxUserStoryParts(cells[storyIndex] || ''),
        ...cells.slice(storyIndex + 1)
      ]))
    }
  }
  return next.join('\n')
}

function normalizeAdvancedUxTopLabels(markdown = '') {
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
    const columns = parseRow(line).map((column) => cleanText(column))
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
      const topValue = cleanText(cells[topIndex] || '')
      const solutionValue = cleanText(cells[solutionIndex] || '')
      const numericTop = topValue.match(/^(?:Top\s*)?(\d+)$/i)
      if (numericTop && solutionValue) {
        cells[topIndex] = `Top ${numericTop[1]}：${solutionValue}`
      }
      next.push(formatRow(cells))
    }
  }
  return next.join('\n')
}

function parseMarkdownCodeBlock(markdown = '') {
  const match = String(markdown || '').match(/```(?:\w+)?\n([\s\S]*?)```/)
  return cleanText(match?.[1] || '')
}

function advancedUxBlockTypeForSubsection(title = '', table = null, code = '') {
  const normalized = cleanText(title)
  if (code) return 'flow-wireframe'
  if (/清晰度评分|评分/.test(normalized)) return 'score-card'
  if (/缺口|风险|假设|断点/.test(normalized)) return 'risk-matrix'
  if (/追问|待确认|决策/.test(normalized)) return 'question-list'
  if (/功能点详情/.test(normalized)) return 'feature-list'
  if (/Checklist|检查清单|开发对接/i.test(normalized)) return 'checklist'
  if (/埋点|验证计划|指标|数据/.test(normalized)) return 'metric-table'
  if (/信息架构/.test(normalized)) return 'entity-table'
  if (/功能点总览|全局排序|分阶段|交付物|验收标准/.test(normalized)) return 'priority-table'
  if (/机会/.test(normalized)) return 'opportunity-matrix'
  if (table) return 'table'
  return 'markdown'
}

function parseAdvancedUxFeatureItems(markdown = '') {
  const text = String(markdown || '').replace(/\r\n/g, '\n')
  const matches = [...text.matchAll(/^####\s+(.+?)\s*$/gm)]
  return matches.map((match, index) => {
    const bodyStart = (match.index || 0) + match[0].length
    const end = matches[index + 1]?.index ?? text.length
    const body = text.slice(bodyStart, end).trim()
    const field = (label) => {
      const safeLabel = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const fieldMatch = body.match(new RegExp(`^-\\s+\\*\\*${safeLabel}\\*\\*[：:](.+)$`, 'm'))
      return cleanText(fieldMatch?.[1] || '')
    }
    const nestedField = (heading, label) => {
      const safeHeading = String(heading).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const headingMatch = body.match(new RegExp(`^-\\s+\\*\\*${safeHeading}\\*\\*[：:]?\\s*$`, 'm'))
      if (!headingMatch) return ''
      const start = (headingMatch.index || 0) + headingMatch[0].length
      const rest = body.slice(start)
      const nextHeading = rest.search(/\n-\s+\*\*.+?\*\*[：:]?/)
      const section = nextHeading >= 0 ? rest.slice(0, nextHeading) : rest
      const safeLabel = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = section.match(new RegExp(`^\\s*-\\s+${safeLabel}[：:](.+)$`, 'm'))
      return cleanText(match?.[1] || '')
    }
    const acceptance = []
    let collectingAcceptance = false
    body.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (/^- \*\*体验验收标准\*\*：?/.test(trimmed)) {
        collectingAcceptance = true
        return
      }
      if (collectingAcceptance && /^- \*\*/.test(trimmed)) collectingAcceptance = false
      if (collectingAcceptance && /^\s*-\s+/.test(line)) acceptance.push(cleanText(line.replace(/^\s*-\s+/, '')))
    })
    const storyParts = splitAdvancedUxUserStoryParts(field('用户故事'))
    const asA = field('As a') || storyParts[0]
    const iWantTo = field('I want to') || storyParts[1]
    const soThat = field('so that') || storyParts[2]
    return {
      key: `feature-${index + 1}`,
      title: cleanText(match[1]),
      type: field('类型'),
      userStory: field('用户故事'),
      asA,
      iWantTo,
      soThat,
      description: field('功能描述'),
      boundaryCondition: field('边界条件') || nestedField('补充体验要求', '边界条件'),
      informationExpression: field('信息表达') || nestedField('补充体验要求', '信息表达'),
      prerequisiteDependencies: field('前置依赖') || nestedField('依赖关系', '前置依赖'),
      dependentDependencies: field('被依赖') || nestedField('依赖关系', '被依赖'),
      userValue: field('用户价值') || nestedField('优先级判断', '用户价值'),
      implementationComplexity: field('实现复杂度') || nestedField('优先级判断', '实现复杂度'),
      suggestedPriority: field('建议优先级') || nestedField('优先级判断', '建议优先级'),
      confidence: field('置信度'),
      acceptance
    }
  }).filter((item) => item.title)
}

function parseAdvancedUxSectionBlocks(section = {}) {
  const supportedTypes = ['score-card', 'table', 'risk-matrix', 'question-list', 'feature-list', 'flow-wireframe', 'checklist', 'metric-table']
  void supportedTypes
  const subsections = advancedUxMarkdownSubsections(section.markdown)
  return subsections.flatMap((subsection, index) => {
    const table = parseMarkdownTable(subsection.markdown)
    const code = parseMarkdownCodeBlock(subsection.markdown)
    const type = advancedUxBlockTypeForSubsection(subsection.title, table, code)
    const base = {
      id: `${section.id}-block-${index + 1}`,
      title: subsection.title,
      type,
      summary: firstMeaningfulMarkdownLine(subsection.markdown)
    }
    if (type === 'feature-list') {
      return [{
        ...base,
        items: parseAdvancedUxFeatureItems(subsection.markdown),
        content: subsection.markdown
      }]
    }
    if (code) return [{ ...base, content: code }]
    if (table) return [{ ...base, columns: table.columns, rows: table.rows }]
    if (subsection.markdown) return [{ ...base, type: 'markdown', markdown: subsection.markdown }]
    return []
  })
}

function firstMeaningfulMarkdownLine(markdown = '') {
  return String(markdown || '')
    .split('\n')
    .map((line) => cleanText(line.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '')))
    .find((line) => line && !/^本节点结论|关键产出|待确认$/.test(line)) || ''
}

function advancedUxMarkdownArtifactFromSections(sections = []) {
  return Object.fromEntries(sections.map((section) => [section.id, {
    title: section.title,
    markdown: section.markdown,
    summary: section.summary,
    blocks: Array.isArray(section.blocks) ? section.blocks : []
  }]))
}

function advancedUxTabsFromSections(sections = []) {
  const byId = new Map(sections.map((section) => [section.id, section]))
  return ADVANCED_UX_ANALYSIS_PIPELINE_TABS.map((tab) => {
    const section = byId.get(tab.id) || {}
    return {
      id: tab.id,
      title: tab.title,
      summary: cleanText(section.summary || `${tab.title}已生成。`),
      confidence: 'low',
      evidenceRefs: [],
      detailBlocks: Array.isArray(section.blocks) && section.blocks.length
        ? section.blocks
        : [{
            id: `${tab.id}-markdown`,
            title: `${tab.title} Markdown`,
            type: 'markdown',
            sourceRef: `advancedUxMarkdownSections.${tab.id}`,
            summary: cleanText(section.summary || '')
          }]
    }
  })
}

function advancedUxNodesFromSections(sections = [], status = 'generated', importError = '') {
  const byId = new Map(sections.map((section) => [section.id, section]))
  const failedSummary = '未生成可导入内容'
  const failedDetailSections = importError
    ? [
        { title: '当前状态', items: ['高级 UX Markdown 未通过门禁，暂未导入该节点内容。'] },
        { title: '失败原因', items: [importError] }
      ]
    : []
  return ADVANCED_UX_ANALYSIS_PIPELINE_TABS.map((tab, index) => {
    const section = byId.get(tab.id) || {}
    const hasSectionData = Boolean(cleanText(section.markdown || section.summary || section.title || ''))
    const sectionDetailBlocks = Array.isArray(section.blocks) && section.blocks.length
      ? section.blocks
      : hasSectionData
        ? [{
            id: `${tab.id}-markdown`,
            title: `${tab.title} Markdown`,
            type: 'markdown',
            sourceRef: `advancedUxMarkdownSections.${tab.id}`,
            summary: cleanText(section.summary || '')
          }]
        : []
    return {
      id: tab.id,
      requirementPipelineTabId: tab.id,
      title: tab.title,
      summary: status === 'generated'
        ? cleanText(section.summary || `${tab.title}已生成。`)
        : status === 'failed'
          ? (hasSectionData ? cleanText(section.summary || `${tab.title}已返回，但未通过门禁。`) : failedSummary)
          : '正在生成高级 UX 分析...',
      content: status === 'generated'
        ? [cleanText(section.summary || section.title || tab.title)]
        : status === 'failed'
          ? [hasSectionData
              ? cleanText(section.summary || section.title || `${tab.title}已返回，但未通过门禁。`)
              : '该节点暂无可展示章节内容，请查看 Agent 文件卡中的门禁失败原因。']
          : ['正在生成高级 UX 分析 Markdown'],
      detailSections: status === 'failed' ? failedDetailSections : [],
      sections: [],
      detailBlocks: status === 'generated'
        ? sectionDetailBlocks
        : status === 'failed'
          ? sectionDetailBlocks
          : [],
      markdown: cleanText(section.markdown || ''),
      artifactStatus: status,
      status: status === 'failed' ? '导入失败' : status === 'generated' ? '已生成' : '生成中',
      position: { x: 80 + index * 320, y: 80 },
      quickActions: status === 'failed' ? ['重新导入画布'] : []
    }
  })
}

function advancedUxGeneratingNodes(importError = '') {
  const status = importError ? 'failed' : 'generating'
  return advancedUxNodesFromSections([], status, importError).map((node) => ({
    ...node,
    artifactStatus: status,
    generationPlaceholderStatus: status
  }))
}

function withAdvancedUxGeneratingState(totalFlow = {}, analysis = {}) {
  if (!isAdvancedUxRequirementAnalysis(analysis)) return totalFlow
  const next = {
    ...totalFlow,
    advancedUxReport: analysis.advancedUxReport || advancedUxReportPlaceholder('', { status: 'generating' })
  }
  const requirementCanvas = next.stageCanvases?.['requirement-dissection']
  if (requirementCanvas) {
    next.stageCanvases = {
      ...next.stageCanvases,
      'requirement-dissection': {
        ...requirementCanvas,
        nodes: advancedUxGeneratingNodes(),
        agentNode: {
          ...(requirementCanvas.agentNode || {}),
          summary: '正在生成高级 UX 分析 Markdown',
          artifactStatus: 'generating'
        }
      }
    }
  }
  return next
}

export function importAdvancedUxMarkdownReportToTotalFlow(totalFlow = {}, report = {}) {
  const markdown = normalizeAdvancedUxTopLabels(splitAdvancedUxUserStoryTables(String(report.markdown || '').trim()))
  const parsed = parseAdvancedUxMarkdownSections(markdown)
  const parsedSections = parsed.sections.map((section) => ({
    ...section,
    blocks: parseAdvancedUxSectionBlocks(section)
  }))
  const baseReport = advancedUxReportPlaceholder(markdown, {
    status: 'generated',
    fileName: report.fileName || advancedUxReportFileName(),
    sections: parsedSections
  })
  const reportMetadata = {
    ...(report.artifactType ? { artifactType: report.artifactType } : {}),
    ...(Array.isArray(report.previousReports) ? { previousReports: report.previousReports } : {}),
    ...(report.frameworkPath ? { frameworkPath: report.frameworkPath } : {}),
    ...(report.outputStandardPath ? { outputStandardPath: report.outputStandardPath } : {}),
    ...(report.referenceExamplePath ? { referenceExamplePath: report.referenceExamplePath } : {}),
    ...(report.evidencePack ? { evidencePack: report.evidencePack } : {}),
    ...(report.repairedFromFileName ? { repairedFromFileName: report.repairedFromFileName } : {}),
    ...(report.repairedAt ? { repairedAt: report.repairedAt } : {}),
    ...(report.generatedAt ? { generatedAt: report.generatedAt } : {}),
    ...(report.provider ? { provider: report.provider } : {}),
    ...(report.model ? { model: report.model } : {}),
    ...(report.pageInteractionDocument ? { pageInteractionDocument: report.pageInteractionDocument } : {}),
    ...(Array.isArray(report.drawioArtifacts) ? { drawioArtifacts: report.drawioArtifacts } : {})
  }
  const requirementCanvas = totalFlow.stageCanvases?.['requirement-dissection'] || {}
  if (!markdown || parsed.missing.length) {
    const failedReport = {
      ...baseReport,
      ...reportMetadata,
      status: 'import_failed',
      importError: `缺少章节：${parsed.missing.join('、') || 'Markdown 内容为空'}`
    }
    const requirementDissectionArtifact = parsedSections.length
      ? {
          ...(totalFlow.requirementDissectionArtifact || {}),
          analysisFramework: ADVANCED_UX_REQUIREMENT_ANALYSIS_SKILL_ID,
          advancedUxMarkdownSections: advancedUxMarkdownArtifactFromSections(parsedSections),
          productAnalysisPipeline: {
            version: 'advanced-ux-pipeline/v2',
            tabs: advancedUxTabsFromSections(parsedSections)
          }
        }
      : totalFlow.requirementDissectionArtifact
    const failedFlow = {
      ...totalFlow,
      advancedUxReport: failedReport,
      ...(requirementDissectionArtifact ? { requirementDissectionArtifact } : {}),
      stageCanvases: {
        ...(totalFlow.stageCanvases || {}),
        'requirement-dissection': {
          ...requirementCanvas,
          nodes: parsedSections.length
            ? advancedUxNodesFromSections(parsedSections, 'failed', failedReport.importError)
            : advancedUxGeneratingNodes(failedReport.importError),
          agentNode: {
            ...(requirementCanvas.agentNode || {}),
            ...(requirementDissectionArtifact ? { requirementDissectionArtifact } : {}),
            summary: failedReport.importError,
            artifactStatus: 'failed'
          }
        }
      }
    }
    return {
      ...failedFlow,
      stageRuntime: buildWorkflowStageRuntime(failedFlow)
    }
  }
  const markdownSections = advancedUxMarkdownArtifactFromSections(parsedSections)
  const requirementDissectionArtifact = {
    ...(totalFlow.requirementDissectionArtifact || {}),
    analysisFramework: ADVANCED_UX_REQUIREMENT_ANALYSIS_SKILL_ID,
    advancedUxMarkdownSections: markdownSections,
    productAnalysisPipeline: {
      version: 'advanced-ux-pipeline/v2',
      tabs: advancedUxTabsFromSections(parsedSections)
    }
  }
  const importedReport = {
    ...baseReport,
    ...reportMetadata,
    status: 'imported',
    sections: parsedSections
  }
  const importedFlow = {
    ...totalFlow,
    advancedUxReport: importedReport,
    requirementDissectionArtifact,
    stageCanvases: {
      ...(totalFlow.stageCanvases || {}),
      'requirement-dissection': {
        ...requirementCanvas,
        nodes: advancedUxNodesFromSections(parsedSections, 'generated'),
        agentNode: {
          ...(requirementCanvas.agentNode || {}),
          requirementDissectionArtifact,
          summary: '高级 UX 分析 Markdown 已生成并导入画布。',
          artifactStatus: 'generated'
        }
      }
    }
  }
  return {
    ...importedFlow,
    stageRuntime: buildWorkflowStageRuntime(importedFlow)
  }
}

export function failAdvancedUxMarkdownGenerationInTotalFlow(totalFlow = {}, message = '高级 UX 分析 Markdown 生成失败，请重新分析。') {
  const requirementCanvas = totalFlow.stageCanvases?.['requirement-dissection'] || {}
  const markdown = normalizeAdvancedUxTopLabels(splitAdvancedUxUserStoryTables(String(totalFlow.advancedUxReport?.markdown || '').trim()))
  const parsed = parseAdvancedUxMarkdownSections(markdown)
  const parsedSections = parsed.sections.map((section) => ({
    ...section,
    blocks: parseAdvancedUxSectionBlocks(section)
  }))
  const failedReport = {
    ...advancedUxReportPlaceholder(markdown, {
      status: 'failed',
      fileName: totalFlow.advancedUxReport?.fileName || advancedUxReportFileName(),
      sections: parsedSections.length
        ? parsedSections
        : Array.isArray(totalFlow.advancedUxReport?.sections) ? totalFlow.advancedUxReport.sections : [],
      importError: message
    }),
    markdown
  }
  const requirementDissectionArtifact = parsedSections.length
    ? {
        ...(totalFlow.requirementDissectionArtifact || {}),
        analysisFramework: ADVANCED_UX_REQUIREMENT_ANALYSIS_SKILL_ID,
        advancedUxMarkdownSections: advancedUxMarkdownArtifactFromSections(parsedSections),
        productAnalysisPipeline: {
          version: 'advanced-ux-pipeline/v2',
          tabs: advancedUxTabsFromSections(parsedSections)
        }
      }
    : totalFlow.requirementDissectionArtifact
  const failedFlow = {
    ...totalFlow,
    advancedUxReport: failedReport,
    ...(requirementDissectionArtifact ? { requirementDissectionArtifact } : {}),
    stageCanvases: {
      ...(totalFlow.stageCanvases || {}),
      'requirement-dissection': {
        ...requirementCanvas,
        nodes: (parsedSections.length
          ? advancedUxNodesFromSections(parsedSections, 'failed', message)
          : advancedUxGeneratingNodes(message)
        ).map((node) => ({
            ...node,
            quickActions: ['重新分析']
          })),
        agentNode: {
          ...(requirementCanvas.agentNode || {}),
          ...(requirementDissectionArtifact ? { requirementDissectionArtifact } : {}),
          summary: message,
          artifactStatus: 'failed'
        }
      }
    }
  }
  return {
    ...failedFlow,
    stageRuntime: buildWorkflowStageRuntime(failedFlow)
  }
}

function hasAnyTitleMatch(titles = [], terms = []) {
  return terms.some((term) => {
    const pattern = new RegExp(term)
    return titles.some((title) => pattern.test(String(title || '')))
  })
}

function shouldEnrichTeaModelPages(analysis = {}, pages = [], requirementSlices = []) {
  if (!pages.length) return false
  if (!hasTeaContext(analysisText(analysis))) return false
  const titles = pages.map((page) => page.title || '')
  const hasMenu = hasAnyTitleMatch(titles, ['点单', '点餐', '菜单'])
  const hasDetail = hasAnyTitleMatch(titles, ['商品详情', '商品定制', '规格'])
  const hasOrder = hasAnyTitleMatch(titles, ['订单', '支付', '取餐'])
  const hasEntry = hasAnyTitleMatch(titles, ['首页', '选店', '门店'])
  const hasPickupMode = hasAnyTitleMatch(titles, ['取餐方式', '自提', '外卖', '堂食'])
  const hasCheckout = hasAnyTitleMatch(titles, ['购物车', '结算'])
  const hasMember = hasAnyTitleMatch(titles, ['会员', '我的', '优惠'])
  const missingCoreCoverage = !hasEntry || !hasPickupMode || !hasCheckout || !hasMember
  return pages.length < 8 && hasMenu && hasDetail && hasOrder && missingCoreCoverage
}

function teaPrimarySliceIdForCompletion(pages = [], activeSliceId = '') {
  const scoreBySlice = new Map()
  pages.forEach((page) => {
    const sliceId = page.sliceId || activeSliceId
    const title = String(page.title || '')
    const current = scoreBySlice.get(sliceId) || 0
    const score = (/点单|点餐|菜单/.test(title) ? 2 : 0) +
      (/商品详情|商品定制|规格/.test(title) ? 2 : 0) +
      (/订单确认|订单详情|支付|取餐/.test(title) ? 1 : 0) -
      (/商家|运营|订单台/.test(title) ? 3 : 0)
    scoreBySlice.set(sliceId, current + score)
  })
  const ranked = [...scoreBySlice.entries()].sort((a, b) => b[1] - a[1])
  return ranked[0]?.[1] > 0 ? ranked[0][0] : activeSliceId
}

function pageHasCompletionProfile(page = {}, profile = {}) {
  const title = String(page.title || '')
  return [profile.title, ...(profile.aliases || [])].some((alias) => alias && title.includes(alias))
}

function teaCompletionPage(profile = {}, index = 0, activeSliceId = '') {
  return {
    id: `tea-suggested-page-${index + 1}`,
    sliceId: activeSliceId,
    title: profile.title,
    summary: `${profile.title} 是系统根据茶饮小程序完整主流程补充的建议页面。`,
    nodeId: `tea-suggested-page-${index + 1}`,
    statusCount: 1,
    pendingQuestionCount: 0,
    detailSections: [
      { title: '页面目标', items: [`补齐「${profile.title}」在茶饮点单主流程中的必要职责。`] },
      { title: '核心模块', items: profile.modules || ['信息展示', '主操作', '状态反馈'] },
      { title: '用户点击动作', items: ['点击主按钮', '切换选项', '返回上一步', '处理异常提示'] },
      { title: '跳转到哪个页面', items: ['按主路径进入下一页面，异常时停留当前页并给出恢复入口。'] },
      { title: '加载 / 空 / 失败 / 权限状态', items: ['加载中', '空状态', '失败重试', '权限提示'] },
      { title: '接口或数据依赖', items: ['后端提供当前页面所需接口数据、业务状态、价格/库存/会员权益和错误码。'] },
      { title: '验收点', items: ['页面目标清晰', '主操作可达', '异常状态可恢复'] }
    ]
  }
}

function enrichTeaModelPagesIfNeeded(analysis = {}, pages = [], activeSliceId = '', requirementSlices = []) {
  if (!shouldEnrichTeaModelPages(analysis, pages, requirementSlices)) return pages
  const completionSliceId = teaPrimarySliceIdForCompletion(pages, activeSliceId)
  const missing = TEA_MODEL_COMPLETION_PAGES
    .filter((profile) => !pages.some((page) => pageHasCompletionProfile(page, profile)))
    .map((profile, index) => teaCompletionPage(profile, index, completionSliceId))
  return [...pages, ...missing]
}

function scopedHomePromptShortcutPages(analysis = {}, activeSliceId = '') {
  const text = analysisText(analysis)
  const hasPodcastStep = /PodcastStep1|Generate Script|Upload Script|Upload Audio|Studio|Video Podcast/i.test(text)
  const topFixed = hasPodcastStep
    ? ['左侧 AppNavRail 保持 Home 激活', '右侧账号/登录/升级入口保持原逻辑']
    : ['产品导航', '账号入口', '状态/消息入口']
  const scrollModules = hasPodcastStep
    ? [
        'Hero 标题 Turn Your Ideas Into Podcasts',
        '输入类型 Tabs：Generate Script / Upload Script / Upload Audio',
        '主输入框',
        '快捷提示词 Chips',
        'Try Sample 入口',
        '参数栏：host / storytelling / 时长 / language',
        'Next 主按钮'
      ]
    : ['首屏主任务区', '主输入框', '快捷提示词按钮组', '参数栏', 'Next 主按钮']
  const interactions = hasPodcastStep
    ? [
        '点击快捷提示词写入或追加到主输入框',
        '切换 Generate Script / Upload Script / Upload Audio 时控制提示词显示',
        '用户已输入时不静默覆盖',
        '点击 Next 沿用 checkOpenGuestLoginDialog 与 createPodcastVideoTask，成功后进入 Studio'
      ]
    : ['点击快捷提示词填充输入框', '继续编辑输入内容', '点击 Next 进入原主流程']
  return [{
    id: 'home-prompt-shortcuts-page',
    sliceId: activeSliceId || 'home-prompt-shortcuts',
    title: '首页',
    summary: hasPodcastStep
      ? '在现有 PodcastStep1 主输入区附近增加快捷提示词 Chips。'
      : '在首页主输入区附近增加快捷提示词按钮组。',
    nodeId: 'home-prompt-shortcuts-page',
    statusCount: 5,
    pendingQuestionCount: 0,
    pageLayoutSpec: {
      projectName: '当前项目',
      pages: [{
        page: '首页',
        pageType: '现有首页局部增强',
        layoutType: hasPodcastStep
          ? '左侧全局导航 + 首屏 Hero + PodcastStep1 输入面板 + 快捷提示词 Chips'
          : '顶部固定区 + 主体输入区 + 快捷提示词 Chips',
        topFixed,
        scrollModules,
        bottomFixed: [],
        overlays: ['LoginDialog', 'Pricing Drawer/credits 拦截', '提示词更多弹层（可选）'],
        interactions,
        frontendTasks: [
          '在现有输入区渲染快捷提示词 Chips',
          '维护已选中、追加/替换、手动编辑后的状态',
          '移动端横向滚动或换行展示，不能遮挡主按钮'
        ],
        backendTasks: [
          '提供首页快捷提示词列表',
          '按语言、输入模式、用户状态返回推荐',
          '接口失败时允许前端使用本地兜底',
          '保留原创建任务接口不变'
        ],
        reasons: ['框选功能资料表明这是现有首页输入区的小范围增强。']
      }]
    },
    detailSections: [
      { title: '页面目标', items: ['让新用户不用从空白输入框开始，可以一键选择创作方向。'] },
      { title: '核心模块', items: scrollModules },
      { title: '用户点击动作', items: interactions },
      { title: '跳转到哪个页面', items: hasPodcastStep ? ['Next 成功后进入 Studio，并携带 project_id。'] : ['Next 成功后进入原主流程。'] },
      { title: '加载 / 空 / 失败 / 权限状态', items: ['默认推荐', '已选中', '加载中', '无推荐', '接口失败兜底', '未登录提交弹 LoginDialog'] },
      { title: '接口或数据依赖', items: ['GET /api/prompt-shortcuts?scene=home&mode=generate-script', 'POST /api/analytics/prompt-shortcut-click', '沿用原创建任务接口'] },
      { title: '验收点', items: ['不出现无关行业模板词', '不覆盖用户已输入内容', '未登录仍可试填但提交弹登录', '移动端不遮挡 Next'] }
    ],
    interactionHotspots: [
      { target: '快捷提示词 Chips', type: 'selector', gesture: '单击', operation: '将提示词写入或追加到主输入框。', result: '停留首页并更新主输入框内容。', states: ['未选中', '已选中', '不可用'] },
      { target: '主输入框', type: 'input', gesture: '输入', operation: '用户可继续编辑由快捷提示词生成的内容。', result: '更新本地输入状态并影响 Next 可用性。', states: ['未填写', '输入中', '校验失败'] },
      { target: 'Next 主按钮', type: 'button', gesture: '单击', operation: '沿用原登录检查和创建任务流程。', result: hasPodcastStep ? '登录通过后创建任务并进入 Studio。' : '登录通过后进入原主流程。', states: ['可提交', '提交中', '提交失败'] }
    ]
  }]
}

function hasLocalFeatureOptimizationContext(text = '') {
  const source = String(text || '')
  return /(优化|增强|增加|新增|替换|改成|默认|不匹配|切到|切换|上传|框选|裁剪|配置|参数|生成中)/.test(source) &&
    /(tab|Tab|比例|参数|选项|上传|图片|照片|画框|虚线|裁剪|素材配置|多比例|actualAspectRatio|targetAspectRatio|cropBox|不匹配)/i.test(source)
}

function hasStrongLocalFeatureOptimizationContext(text = '') {
  return /(画面比例|selectedAspectRatio|targetAspectRatio|actualAspectRatio|cropBox|虚线画框|Photo to Host|Generate From Reference|Use your Photo|AI generate host|多比例素材|比例不匹配)/i.test(String(text || ''))
}

function extractAspectRatioOptions(text = '') {
  const ratios = String(text || '').match(/\b\d{1,2}\s*:\s*\d{1,2}\b/g) || []
  const cleaned = ratios
    .map((item) => item.replace(/\s+/g, ''))
    .filter((item) => {
      const [left, right] = item.split(':').map((part) => Number(part))
      if (!Number.isFinite(left) || !Number.isFinite(right)) return false
      if (left <= 0 || right <= 0) return false
      return left <= 32 && right <= 32
    })
  return uniqueTexts(cleaned.length ? cleaned : /比例|画面/.test(text) ? ['16:9', '9:16'] : [], 6)
}

function extractEntryOptions(text = '') {
  const source = String(text || '')
  const known = [
    'Speaker Focus',
    'Cartoon',
    'Pet',
    'Generate From Reference',
    'Use your Photo',
    'AI generate host',
    'Photo to Host',
    'Split Screen',
    'Solo'
  ].filter((item) => new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(source))
  const hyphenEntries = (source.match(/\b[A-Za-z][A-Za-z ]{2,40}\s+-\s+[A-Za-z][A-Za-z ]{2,50}\b/g) || [])
    .flatMap((item) => item.split(/\s*-\s*/))
    .filter((item) => /^[A-Z][A-Za-z ]{1,50}$/.test(item))
  return uniqueTexts([...known, ...hyphenEntries], 12)
}

function localFeaturePageKind(page = {}) {
  const text = `${page.title || ''} ${page.summary || ''} ${JSON.stringify(page.detailSections || [])}`
  if (/裁剪|框选|Photo to Host|上传图片|虚线|画框/i.test(text)) return 'upload-crop'
  if (/参考图|Reference|背景图|素材配置/i.test(text)) return 'reference-generation'
  if (/照片生成|Use your Photo/i.test(text)) return 'photo-generation'
  if (/AI\s*生成|AI generate host|主播入口|Host/i.test(text)) return 'ai-host-generation'
  if (/比例切换|顶部比例|tab|Tab|按钮样式/i.test(text)) return 'ratio-tabs'
  if (/生成中|结果|不匹配|actualAspectRatio/i.test(text)) return 'result-routing'
  return 'local-feature'
}

function evidenceKeywordPatternForLocalFeatureKind(kind = '') {
  const patterns = {
    'ratio-tabs': /画面比例|比例|当前\s*tab|当前tab|不匹配|actualAspectRatio|selectedAspectRatio|targetAspectRatio|按钮样式/i,
    'reference-generation': /Generate From Reference|参考图|背景图|素材配置|多比例|assetRatioVariants|Speaker Focus|Cartoon|Pet/i,
    'photo-generation': /Use your Photo|照片|数字人|avatar|host|画面比例|targetAspectRatio/i,
    'ai-host-generation': /AI generate host|AI\s*Host|Split Screen|Solo|主播|数字人|画面比例|16:9|9:16/i,
    'upload-crop': /Photo to Host|上传|虚线|框选|画框|裁剪|cropBox|targetAspectRatio/i,
    'result-routing': /生成中|任务状态|generationTaskId|actualAspectRatio|不匹配|失败|重试/i,
    'local-feature': /优化|增强|增加|参数|上传|生成|状态|默认/i
  }
  return patterns[kind] || patterns['local-feature']
}

function firstEvidenceImageUrl(doc = {}) {
  const direct = cleanText(doc.screenshotUrl || doc.imageUrl || doc.previewUrl || doc.coverUrl || '')
  if (direct) return direct
  const text = cleanText(doc.content || doc.text || doc.summary || '')
  const match = text.match(/(?:截图|图片|image|screenshot)[：:\\s]+(\/api\/workspace\/material-previews\/[^\s；;，,）)]+)/i) ||
    text.match(/(\/api\/workspace\/material-previews\/[^\s；;，,）)]+)/i)
  return cleanText(match?.[1] || '')
}

function firstEvidencePageUrl(doc = {}) {
  const direct = cleanText(doc.pageUrl || doc.url || doc.route || doc.path || '')
  if (direct) return direct
  const text = cleanText(doc.content || doc.text || doc.summary || '')
  const match = text.match(/(?:页面 URL|页面URL|路径|route|url)[：:\s]+([^\s；;，,）)]+)/i)
  return cleanText(match?.[1] || '')
}

function localFeatureEvidenceRefsForPage(kind = '', analysis = {}) {
  const matcher = evidenceKeywordPatternForLocalFeatureKind(kind)
  const documents = Array.isArray(analysis.documents) ? analysis.documents : []
  const refs = documents
    .map((doc, index) => {
      const title = cleanText(doc.title || doc.name || `证据 ${index + 1}`)
      const body = cleanText(doc.content || doc.text || doc.summary || doc.reason || '')
      if (!title && !body) return null
      const haystack = `${title}\n${body}`
      const isRequirement = doc.type === 'requirements' || doc.sourceType === 'document' || /需求|优化|docx/i.test(title)
      const isKnowledge = doc.type === 'knowledge' || /knowledge|project-|blueprint|website|runtime|package/i.test(doc.sourceType || '')
      if (!isRequirement && !isKnowledge) return null
      if (!matcher.test(haystack) && !/Podcastor|Jogg|avatar|host|数字人|播客|Video Podcast/i.test(haystack)) return null
      const snippet = body.slice(0, 160).replace(/\n+/g, '；')
      const screenshotUrl = firstEvidenceImageUrl(doc)
      const pageUrl = firstEvidencePageUrl(doc)
      return {
        id: cleanText(doc.knowledgeMaterialId || doc.id || `local-feature-evidence-${index + 1}`),
        type: isKnowledge ? 'knowledge' : 'document',
        source: cleanText(doc.sourceType || (isKnowledge ? 'project knowledge' : 'requirement document')),
        title,
        summary: snippet || title,
        ...(screenshotUrl ? { screenshotUrl, imageUrl: screenshotUrl } : {}),
        ...(pageUrl ? { pageUrl } : {}),
        priority: isRequirement ? 1 : 2 + index,
        confidence: isRequirement ? 0.9 : 0.82
      }
    })
    .filter(Boolean)
  const seen = new Set()
  return refs.filter((ref) => {
    const key = `${ref.id}:${ref.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 5)
}

function localFeatureOptimizationEvidenceForPage(page = {}, analysis = {}) {
  const text = analysisText(analysis)
  if (!hasLocalFeatureOptimizationContext(text)) return null
  const title = page.title || page.pageName || page.name || '局部功能页面'
  const ratios = extractAspectRatioOptions(text)
  const ratioLabel = ratios.length ? ratios.join(' / ') : '目标参数选项'
  const entries = extractEntryOptions(text)
  const entryLabel = entries.length ? entries.join(' / ') : '当前功能入口'
  const kind = localFeaturePageKind(page)
  const evidenceRefs = localFeatureEvidenceRefsForPage(kind, analysis)
  const defaultRatioRule = /当前\s*tab|当前tab/i.test(text)
    ? '默认值读取当前tab的上下文参数，用户可在当前入口内修改。'
    : '默认值读取上游页面或当前入口的已选参数。'
  const mismatchRule = /(不匹配|切到|actualAspectRatio)/i.test(text)
    ? '当 actualAspectRatio 与当前 tab 不匹配时，自动切换到结果对应 tab 并保留生成中任务状态。'
    : '结果返回后校验实际参数与当前筛选/Tab 是否一致，不一致时给出归位提示。'

  const shared = {
    page: title,
    pageType: '现有功能局部优化',
    topFixed: ['返回/页面标题', `参数上下文：${ratioLabel}`, '当前入口状态'],
    overlays: ['参数不匹配提示', '生成失败提示', '确认放弃修改弹窗'],
    states: ['默认态', '已修改未提交', '生成中', '结果参数不匹配', '失败可重试'],
    dataDependencies: [
      'selectedAspectRatio：当前 tab 或当前入口选择值',
      'targetAspectRatio：本次提交给生成任务的目标参数',
      'actualAspectRatio：生成结果返回的实际参数',
      'generationTaskId：生成任务 id',
      'entryMode：当前入口或生成方式'
    ],
    frontendTasks: [
      '渲染参数选择、当前选中态和修改后状态',
      '提交前保持用户已选参数和上传/框选上下文',
      '结果返回后按 actualAspectRatio 归位到对应 Tab 或筛选状态'
    ],
    backendTasks: [
      '返回当前入口支持的参数选项和默认值',
      '创建生成任务时保存 targetAspectRatio、entryMode 和素材/上传上下文',
      '任务结果返回 actualAspectRatio，并支持前端按结果归位展示'
    ],
    reasons: [
      '这是现有功能的局部交互优化，低保应聚焦被改动控件、默认值、状态同步和异常归位，不能扩展成完整新项目框架。',
      defaultRatioRule,
      mismatchRule
    ]
  }

  const variants = {
    'ratio-tabs': {
      layoutType: '顶部参数 Tab + 入口内容区 + 状态归位提示',
      scrollModules: [
        `画面比例 Tab 按钮组：${ratioLabel}`,
        '当前入口内容区',
        '生成任务状态提示'
      ],
      bottomFixed: ['保存当前参数', '继续生成'],
      interactions: [
        `点击比例 Tab 切换 selectedAspectRatio：${ratioLabel}`,
        '切换后刷新当前入口的默认生成参数，不清空用户已上传或已编辑内容',
        mismatchRule
      ],
      interactionHotspots: [
        { target: '画面比例 Tab 按钮组', type: 'selector', operation: `切换 selectedAspectRatio，并刷新当前入口默认参数：${ratioLabel}。`, result: '停留当前页面并更新选中态、生成参数和可用素材。', states: ['未选中', '已选中', '不可用'] },
        { target: '生成中任务归位提示', type: 'content', operation: mismatchRule, result: '切换到结果对应 tab 并展示生成中或已完成任务。', states: ['隐藏', '显示', '已归位'] }
      ]
    },
    'reference-generation': {
      layoutType: '参考图生成入口 + 背景图预览 + 多比例素材配置',
      scrollModules: [
        '入口模式：Speaker Focus / Cartoon / Pet - Generate From Reference',
        `生成画面比例选择器：${ratioLabel}`,
        '背景图与多比例参考图素材区'
      ],
      bottomFixed: ['生成参考图', '保存素材配置'],
      interactions: [
        `选择生成画面比例：${ratioLabel}`,
        '为同一背景图配置不同参数素材并保存映射关系',
        mismatchRule
      ],
      interactionHotspots: [
        { target: '生成画面比例选择器', type: 'selector', operation: `选择 targetAspectRatio：${ratioLabel}。`, result: '刷新对应比例素材配置和生成按钮可用状态。', states: ['默认当前 tab', '已修改', '不可用'] },
        { target: '多比例素材配置列表', type: 'content', operation: '按背景图维护不同参数下的素材引用。', result: '保存 assetRatioVariants 映射。', states: ['未配置', '部分配置', '已配置'] }
      ],
      dataDependencies: ['assetRatioVariants：同一素材在不同参数下的资源映射']
    },
    'photo-generation': {
      layoutType: '照片上传/选择 + 生成参数选择 + 生成提交区',
      scrollModules: [
        '照片上传/已选照片预览',
        `生成数字人画面比例参数：${ratioLabel}`,
        '生成提交区',
        '生成中/失败重试状态'
      ],
      bottomFixed: ['生成数字人', '重新选择照片'],
      interactions: [
        '上传或选择照片后保留当前入口上下文',
        `${defaultRatioRule}`,
        mismatchRule
      ],
      interactionHotspots: [
        { target: '照片上传/已选照片预览', type: 'content', operation: '上传或替换照片并保留当前生成参数。', result: '展示照片预览和可生成状态。', states: ['未上传', '已上传', '上传失败'] },
        { target: '生成数字人画面比例参数', type: 'selector', operation: `选择 targetAspectRatio，默认读取当前 tab：${ratioLabel}。`, result: '更新生成任务参数。', states: ['默认当前 tab', '已修改', '不可用'] }
      ]
    },
    'ai-host-generation': {
      layoutType: 'AI 主播生成输入区 + 画面比例参数 + 生成状态区',
      scrollModules: [
        '入口模式：Split Screen / Solo - AI generate host',
        'AI 主播描述/风格输入区',
        `画面比例选择：${ratioLabel}`,
        '生成任务状态与结果归位'
      ],
      bottomFixed: ['生成主播', '保存草稿'],
      interactions: [
        `在 AI 生成入口选择画面比例：${ratioLabel}`,
        '提交生成后锁定 targetAspectRatio 并展示 generationTaskId 状态',
        mismatchRule
      ],
      interactionHotspots: [
        { target: '画面比例选择', type: 'selector', operation: `选择 16:9 / 9:16 等目标参数并写入生成任务。`, result: '更新 targetAspectRatio 和生成按钮状态。', states: ['默认当前 tab', '已修改', '不可用'] },
        { target: '生成任务状态卡片', type: 'content', operation: '展示排队、生成中、成功、失败和参数不匹配归位。', result: '用户可继续等待、重试或查看结果。', states: ['排队中', '生成中', '失败'] }
      ]
    },
    'upload-crop': {
      layoutType: '上传图片预览 + 固定比例虚线框选 + cropBox 提交',
      scrollModules: [
        '上传图片预览画布',
        `目标画面比例虚线画框：${ratioLabel}`,
        '拖拽/缩放框选区域',
        'cropBox 预览与提交区'
      ],
      bottomFixed: ['确认框选并生成', '重新上传'],
      interactions: [
        '图片上传后在预览画布内直接显示符合目标参数的虚线画框',
        '用户拖拽/缩放虚线框完成框选，替代右上角独立裁剪入口',
        '提交时携带 cropBox 与 targetAspectRatio',
        mismatchRule
      ],
      interactionHotspots: [
        { target: '目标画面比例虚线画框', type: 'selector', gesture: '拖拽/缩放', operation: '在上传图片预览画布内拖拽或缩放虚线框完成框选。', result: '更新 cropBox 并实时刷新预览。', states: ['未框选', '框选中', '已框选'] },
        { target: '确认框选并生成', type: 'button', operation: '提交 cropBox、targetAspectRatio 和上传图片资源创建生成任务。', result: '进入生成中状态并按 actualAspectRatio 归位展示。', states: ['可提交', '提交中', '提交失败'] }
      ],
      dataDependencies: ['cropBox：{ x, y, width, height } 框选坐标', 'uploadedImageId：上传图片资源 id']
    },
    'result-routing': {
      layoutType: '生成任务状态流 + 结果参数校验 + 自动归位',
      scrollModules: [
        '生成中任务列表',
        `目标参数与实际参数对照：targetAspectRatio / actualAspectRatio`,
        '参数不匹配自动切换提示',
        '结果预览区',
        '失败重试与返回编辑'
      ],
      bottomFixed: ['查看结果', '返回编辑'],
      interactions: [
        '轮询或订阅生成任务状态',
        mismatchRule,
        '失败时保留原参数、上传素材和 cropBox 供用户重试'
      ],
      interactionHotspots: [
        { target: '目标参数与实际参数对照', type: 'content', operation: '比较 targetAspectRatio 与 actualAspectRatio。', result: '一致则停留当前 tab，不一致则自动切换到结果对应 tab。', states: ['一致', '不一致', '缺失'] },
        { target: '失败重试与返回编辑', type: 'button', operation: '保留原参数和素材上下文后重试或返回编辑。', result: '恢复到可编辑状态。', states: ['可重试', '重试中', '失败'] }
      ]
    },
    'local-feature': {
      layoutType: '局部功能控件组 + 参数选择 + 状态反馈',
      scrollModules: [
        `入口范围：${entryLabel}`,
        `参数选择控件：${ratioLabel}`,
        '当前默认值说明',
        '主操作提交区',
        '状态反馈与异常恢复'
      ],
      bottomFixed: ['确认应用', '取消修改'],
      interactions: [
        defaultRatioRule,
        '用户修改参数后保留当前上下文并更新提交状态',
        mismatchRule
      ],
      interactionHotspots: [
        { target: '参数选择控件', type: 'selector', operation: `选择当前局部功能的目标参数：${ratioLabel}。`, result: '更新本地参数和可提交状态。', states: ['默认', '已修改', '不可用'] },
        { target: '确认应用', type: 'button', operation: '提交当前局部优化参数并展示反馈。', result: '进入处理状态或展示错误恢复。', states: ['可提交', '提交中', '提交失败'] }
      ]
    }
  }
  const selected = variants[kind] || variants['local-feature']
  return {
    ...shared,
    ...selected,
    dataDependencies: uniqueTexts([...(shared.dataDependencies || []), ...(selected.dataDependencies || [])], 12),
    pageLayoutSpec: {
      projectName: '当前项目',
      pages: [{
        page: title,
        pageType: shared.pageType,
        layoutType: selected.layoutType,
        topFixed: shared.topFixed,
        scrollModules: selected.scrollModules,
        bottomFixed: selected.bottomFixed,
        overlays: shared.overlays,
        interactions: selected.interactions,
        frontendTasks: shared.frontendTasks,
        backendTasks: uniqueTexts([...(shared.backendTasks || []), ...(selected.dataDependencies || [])], 12),
        reasons: shared.reasons,
        evidenceRefs: evidenceRefs.length ? evidenceRefs : [
          { id: 'local-feature-optimization-doc', type: 'document', source: 'requirement document', title: '局部功能优化需求', summary: '局部功能优化需求文档提供控件、参数、默认值和异常归位规则。', priority: 1, confidence: 0.86 }
        ]
      }]
    }
  }
}

function enrichLocalFeatureOptimizationPages(analysis = {}, pages = []) {
  const text = analysisText(analysis)
  if (!hasStrongLocalFeatureOptimizationContext(text)) return pages
  return pages.map((page) => {
    const evidence = localFeatureOptimizationEvidenceForPage(page, analysis)
    if (!evidence) return page
    const existingSpec = page.pageLayoutSpec || page.layoutPlan || page.structuredLayoutPlan || page.page_layout_spec
    return {
      ...page,
      pageType: page.pageType || evidence.pageType,
      modules: uniqueTexts([...valuesAsList(page.modules), ...(evidence.scrollModules || [])], 12),
      interactions: uniqueTexts([...valuesAsList(page.interactions), ...(evidence.interactions || [])], 12),
      states: uniqueTexts([...valuesAsList(page.states), ...(evidence.states || [])], 10),
      dataDependencies: uniqueTexts([...valuesAsList(page.dataDependencies), ...(evidence.dataDependencies || [])], 12),
      interactionHotspots: mergePageInteractionHotspots(
        page.interactionHotspots || page.controls || page.hotspots,
        evidence.interactionHotspots || [],
        page,
        0,
        pages,
        10
      ),
      pageLayoutSpec: existingSpec || evidence.pageLayoutSpec,
      detailSections: [
        ...(Array.isArray(page.detailSections) ? page.detailSections : []),
        stageDetailSection('局部优化控件', evidence.scrollModules || []),
        stageDetailSection('局部优化交互规则', evidence.interactions || []),
        stageDetailSection('局部优化数据字段', evidence.dataDependencies || [])
      ]
    }
  })
}

function localFeatureOptimizationPages(analysis = {}, activeSliceId = '', requirementSlices = []) {
  const text = analysisText(analysis)
  const ratios = extractAspectRatioOptions(text)
  const ratioLabel = ratios.length ? ratios.join(' / ') : '16:9 / 9:16'
  const sliceIdAt = (index = 0) => requirementSlices[index]?.id || activeSliceId
  const pages = [
    {
      id: 'local-ratio-tabs-page',
      sliceId: sliceIdAt(0),
      title: '造人顶部比例切换区',
      summary: `增强现有造人页面顶部画面比例按钮，统一 selectedAspectRatio、targetAspectRatio 和 actualAspectRatio 的状态归位。`,
      nodeId: 'local-ratio-tabs-page',
      statusCount: 5,
      modules: ['画面比例 Tab 按钮组', '当前入口状态', '生成中任务归位提示', '参数不匹配提示'],
      interactions: [
        `点击比例 Tab 切换 selectedAspectRatio：${ratioLabel}`,
        '切换比例后刷新当前入口默认 targetAspectRatio，不清空已上传图片或已编辑内容。',
        '生成结果返回 actualAspectRatio 后，不匹配则切到对应比例 Tab 并展示生成中的数字人。'
      ],
      detailSections: [
        { title: '页面目标', items: ['把顶部比例切换做成现有造人入口的统一参数控制区。'] },
        { title: '核心模块', items: ['画面比例 Tab 按钮组', '当前入口状态', '生成任务状态提示'] },
        { title: '用户点击动作', items: [`点击 16:9 / 9:16 等比例选项，写入 selectedAspectRatio 和 targetAspectRatio。`] },
        { title: '加载 / 空 / 失败 / 权限状态', items: ['默认当前 tab', '已修改未提交', '生成中', '结果比例不匹配', '失败可重试'] },
        { title: '接口或数据依赖', items: ['selectedAspectRatio', 'targetAspectRatio', 'actualAspectRatio', 'generationTaskId'] },
        { title: '验收点', items: ['比例切换不丢失当前入口内容', '结果比例不匹配时能自动归位到对应 tab'] }
      ]
    },
    {
      id: 'local-reference-generation-page',
      sliceId: sliceIdAt(1),
      title: 'Generate From Reference 参考图入口',
      summary: '在 Speaker Focus、Cartoon、Pet 的参考图生成入口中，支持同一背景图配置不同画面比例素材。',
      nodeId: 'local-reference-generation-page',
      statusCount: 5,
      modules: ['入口模式选择', '背景图预览区', '画面比例选择器', '多比例素材配置列表', '素材状态'],
      interactions: [
        `在 Generate From Reference 中选择 targetAspectRatio：${ratioLabel}`,
        '同一背景图维护不同画面比例素材映射。',
        '缺少对应比例素材时展示待生成/待配置状态。'
      ],
      detailSections: [
        { title: '页面目标', items: ['让参考图生成入口能按目标比例选择或生成匹配素材。'] },
        { title: '核心模块', items: ['背景图预览', '比例选择器', '多比例素材配置', '生成按钮'] },
        { title: '用户点击动作', items: ['选择入口类型', '切换画面比例', '生成或保存对应比例素材'] },
        { title: '加载 / 空 / 失败 / 权限状态', items: ['未配置', '部分配置', '生成中', '已配置', '生成失败'] },
        { title: '接口或数据依赖', items: ['assetRatioVariants', 'backgroundImageId', 'targetAspectRatio'] },
        { title: '验收点', items: ['同一背景图可保存多个比例素材', '切换比例后素材状态清晰'] }
      ]
    },
    {
      id: 'local-photo-generation-page',
      sliceId: sliceIdAt(2),
      title: 'Use your Photo 照片生成入口',
      summary: '在照片生成数字人入口下方增加画面比例参数，默认读取当前 tab 的比例数值。',
      nodeId: 'local-photo-generation-page',
      statusCount: 5,
      modules: ['照片上传/已选照片预览', '数字人比例参数', '生成提交区', '生成中状态卡片'],
      interactions: [
        '上传或选择照片后保留当前 tab 的比例上下文。',
        `下方比例参数默认读取当前 tab：${ratioLabel}`,
        '生成结果 actualAspectRatio 不匹配时切到对应比例下展示任务。'
      ],
      detailSections: [
        { title: '页面目标', items: ['让 Use your Photo 入口明确本次生成数字人的目标画面比例。'] },
        { title: '核心模块', items: ['照片预览', '比例参数', '生成按钮', '任务状态'] },
        { title: '用户点击动作', items: ['上传照片', '切换比例参数', '点击生成数字人'] },
        { title: '加载 / 空 / 失败 / 权限状态', items: ['未上传', '已上传', '提交中', '生成中', '上传失败'] },
        { title: '接口或数据依赖', items: ['photoAssetId', 'targetAspectRatio', 'actualAspectRatio', 'generationTaskId'] },
        { title: '验收点', items: ['默认比例与当前 tab 一致', '失败重试时保留照片和比例参数'] }
      ]
    },
    {
      id: 'local-ai-host-generation-page',
      sliceId: sliceIdAt(2),
      title: 'AI generate host 主播生成入口',
      summary: '在 Split Screen、Solo 的 AI 主播生成入口中补充 16:9 / 9:16 画面比例选择和生成状态归位。',
      nodeId: 'local-ai-host-generation-page',
      statusCount: 5,
      modules: ['Split Screen / Solo 模式', 'AI Host / Cartoon / Pet 类型', '画面比例选择', '生成任务状态', '结果预览'],
      interactions: [
        `选择 16:9 / 9:16 等画面比例并写入 targetAspectRatio。`,
        '提交生成后锁定当前 entryMode 与 targetAspectRatio。',
        '结果比例不匹配时切换到 actualAspectRatio 对应 tab。'
      ],
      detailSections: [
        { title: '页面目标', items: ['让 AI 主播生成入口的比例参数和生成中状态可见、可追踪。'] },
        { title: '核心模块', items: ['模式切换', '主播类型选择', '比例选择', '任务状态卡片'] },
        { title: '用户点击动作', items: ['切换 Split Screen / Solo', '选择主播类型', '选择比例', '点击生成'] },
        { title: '加载 / 空 / 失败 / 权限状态', items: ['默认当前 tab', '已修改', '排队中', '生成中', '失败重试'] },
        { title: '接口或数据依赖', items: ['entryMode', 'hostType', 'targetAspectRatio', 'actualAspectRatio', 'generationTaskId'] },
        { title: '验收点', items: ['生成任务携带比例参数', '任务状态在对应比例 tab 下可见'] }
      ]
    },
    {
      id: 'local-photo-to-host-crop-page',
      sliceId: sliceIdAt(3),
      title: 'Photo to Host 上传框选区',
      summary: '图片上传后直接在画框中显示目标比例虚线画框，用户可在画框内框选并提交 cropBox。',
      nodeId: 'local-photo-to-host-crop-page',
      statusCount: 6,
      modules: ['上传图片预览画布', '目标比例虚线画框', '拖拽/缩放框选区', 'cropBox 数值', '确认框选并生成'],
      interactions: [
        '上传图片后显示符合当前生成画面比例的虚线画框。',
        '用户直接在画框内拖拽/缩放完成框选，替换右上角裁剪入口。',
        '提交时携带 cropBox、targetAspectRatio 和 uploadedImageId。'
      ],
      detailSections: [
        { title: '页面目标', items: ['把 Photo to Host 的裁剪动作收敛到上传预览画框内完成。'] },
        { title: '核心模块', items: ['图片上传', '虚线画框', '框选调整', '预览结果', '确认生成'] },
        { title: '用户点击动作', items: ['上传图片', '拖拽/缩放虚线画框', '确认框选并生成'] },
        { title: '加载 / 空 / 失败 / 权限状态', items: ['未上传', '上传中', '上传失败', '未框选', '框选中', '已框选'] },
        { title: '接口或数据依赖', items: ['uploadedImageId', 'cropBox', 'targetAspectRatio', 'actualAspectRatio'] },
        { title: '验收点', items: ['虚线画框比例与目标比例一致', 'cropBox 提交准确', '生成结果可按 actualAspectRatio 归位'] }
      ]
    }
  ]
  return enrichLocalFeatureOptimizationPages(analysis, pages)
}

function pagesForAnalysis(analysis = {}, activeSliceId = '', requirementSlices = []) {
  const text = analysisText(analysis)
  if (hasStrongLocalFeatureOptimizationContext(text)) {
    return localFeatureOptimizationPages(analysis, activeSliceId, requirementSlices)
  }
  if (hasWorkflowAnalysisCoverageContext(analysis)) {
    return workflowAnalysisCoveragePagesForAnalysis(analysis, activeSliceId)
  }
  const modelPages = modelPagesForAnalysis(analysis, activeSliceId)
  if (modelPages?.length) {
    const normalizedPages = normalizeFrontendUserPagesForAnalysis(analysis, modelPages, activeSliceId, requirementSlices)
    return enrichLocalFeatureOptimizationPages(analysis, enrichTeaModelPagesIfNeeded(analysis, normalizedPages, activeSliceId, requirementSlices))
  }
  if (isHomePromptShortcutRequest(analysis)) return scopedHomePromptShortcutPages(analysis, activeSliceId)
  const nodes = analysis.canvas?.nodes || []
  const nodeTitles = nodes.map((node) => node.title)
  if (hasTeaContext(text) && !TEA_ORDERING_PAGE_TITLES.every((title) => nodeTitles.includes(title))) {
    return TEA_ORDERING_PAGE_TITLES.map((title, index) => ({
      id: `tea-page-${index + 1}`,
      sliceId: activeSliceId,
      title,
      summary: `${title} 的页面级交互节点。`,
      nodeId: `tea-page-${index + 1}`,
      statusCount: 1,
      pendingQuestionCount: 0,
      detailSections: [
        { title: '页面目标', items: [`明确「${title}」在茶饮点单主流程中的职责。`] },
        { title: '核心模块', items: ['信息展示', '主操作', '状态反馈'] },
        { title: '用户点击动作', items: ['点击主按钮', '返回上一步', '处理异常提示'] },
        { title: '跳转到哪个页面', items: ['按主路径进入下一页面或回到上一页面。'] },
        { title: '加载 / 空 / 失败 / 权限状态', items: ['加载中', '空状态', '失败重试', '权限提示'] },
        { title: '接口或数据依赖', items: ['门店、菜单、购物车、订单、支付或会员相关接口。'] },
        { title: '验收点', items: ['页面目标清晰', '主操作可达', '异常状态可恢复'] }
      ]
    }))
  }
  return enrichLocalFeatureOptimizationPages(analysis, (analysis.canvas?.nodes || [])
    .map((node, index) => ({
      id: node.id || `page-${index + 1}`,
      sliceId: activeSliceId,
      title: node.title || `页面 ${index + 1}`,
      summary: node.summary || '',
      nodeId: node.id || `page-${index + 1}`,
      statusCount: (node.detailSections || []).filter((section) => /状态|异常|权限|加载|失败|空/.test(section.title || '')).length,
      pendingQuestionCount: 0
    })))
}

function detailsForNodes(nodes = []) {
  return Object.fromEntries(nodes.map((node) => [
    node.id,
    {
      title: node.title || '',
      summary: node.summary || '',
      sections: node.detailSections || []
    }
  ]))
}

function detailsForPages(pages = [], nodeDetails = {}) {
  return Object.fromEntries(pages.map((page) => [
    page.id,
    nodeDetails[page.id] || {
      title: page.title || '',
      summary: page.summary || '',
      sections: page.detailSections || []
    }
  ]))
}

function stageDetailSection(title, items = [], meta = '') {
  return {
    title,
    meta,
    items: (Array.isArray(items) ? items : [items])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  }
}

function resolveContentStatus(analysis = {}) {
  if (analysis.totalDesignFlowMode === 'waiting-model') return 'waiting-model'
  const provider = String(analysis.generation?.provider || '').toLowerCase()
  if (
    analysis.generation?.status === 'generated' &&
    analysis.generation?.validation?.ok &&
    !analysis.generation?.fallbackUsed &&
    provider &&
    provider !== 'deterministic'
  ) {
    return 'model-generated'
  }
  return 'fallback-structure'
}

function contentSourceForStatus(contentStatus = '') {
  if (contentStatus === 'waiting-model') return 'model-pending'
  if (contentStatus === 'model-generated') return 'model-generated'
  return 'fallback-structure'
}

function contentStatusLabel(contentStatus = '') {
  if (contentStatus === 'waiting-model') return '模型增强中'
  if (contentStatus === 'model-generated') return '模型生成'
  return '基础结构'
}

function modelSummaryItems(analysis = {}) {
  const aiItems = Array.isArray(analysis.aiSummary?.items) ? analysis.aiSummary.items : []
  const readableSummary = analysis.generation?.output?.readableSummary || {}
  return [
    ...aiItems,
    readableSummary.oneSentence ? `模型结论：${readableSummary.oneSentence}` : '',
    readableSummary.userGoal ? `用户目标：${readableSummary.userGoal}` : '',
    ...(Array.isArray(readableSummary.coreModules) && readableSummary.coreModules.length ? [`核心模块：${readableSummary.coreModules.join('、')}`] : []),
    ...(Array.isArray(readableSummary.recommendedFlow) && readableSummary.recommendedFlow.length ? [`推荐流程：${readableSummary.recommendedFlow.join(' -> ')}`] : []),
    ...(Array.isArray(readableSummary.questions) && readableSummary.questions.length ? [`待确认：${readableSummary.questions.join('；')}`] : [])
  ].map((item) => String(item || '').trim()).filter(Boolean)
}

function normalizeModelStageNode(raw = {}) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || raw.nodeId || raw.key || '').trim()
  const title = String(raw.title || raw.nodeName || raw.name || raw.pageTitle || raw.page || '').trim()
  const sourcePageId = String(raw.sourcePageId || raw.pageId || raw.pageNodeId || '').trim()
  if (!id && !title && !sourcePageId) return null
  const detailSections = Array.isArray(raw.detailSections)
    ? raw.detailSections
    : Array.isArray(raw.sections)
      ? raw.sections
      : []
  return {
    id,
    title,
    sourcePageId,
    summary: raw.summary || raw.description || '',
    content: Array.isArray(raw.content)
      ? raw.content
      : Array.isArray(raw.highlights)
        ? raw.highlights
        : [],
    detailSections: detailSections.map((section) => ({
      title: section.title || section.name || '模型详情',
      meta: section.meta || '',
      items: Array.isArray(section.items) ? section.items : [section.content || section.summary || ''].filter(Boolean)
    })).filter((section) => section.title || section.items.length)
  }
}

function modelStageNodeMap(analysis = {}) {
  const totalFlow = analysis.generation?.output?.totalDesignFlow || analysis.generation?.output?.totalFlow || null
  const stageCanvases = totalFlow?.stageCanvases || {}
  const entries = Object.entries(stageCanvases).flatMap(([stageId, canvas]) =>
    (Array.isArray(canvas?.nodes) ? canvas.nodes : []).map((node) => [stageId, node])
  )
  const stageEntries = Array.isArray(totalFlow?.stages)
    ? totalFlow.stages.flatMap((stage) =>
      (Array.isArray(stage?.nodes) ? stage.nodes : []).map((node) => [stage.id || stage.stageId, node])
    )
    : []
  const map = new Map()
  ;[...entries, ...stageEntries].forEach(([stageId, node]) => {
    const normalized = normalizeModelStageNode(node)
    const normalizedStageId = String(stageId || node?.stageId || '').trim()
    if (!normalizedStageId || !normalized) return
    ;[normalized.id, normalized.title, normalized.sourcePageId]
      .map((key) => String(key || '').trim())
      .filter(Boolean)
      .forEach((key) => {
        map.set(`${normalizedStageId}:${key}`, normalized)
      })
  })
  return map
}

function stageContentForStatus({ analysis = {}, title = '', summary = '', content = [], detailSections = [], contentStatus = '', hasModelNode = false }) {
  const source = contentSourceForStatus(contentStatus)
  if (contentStatus === 'waiting-model') {
    return {
      contentSource: source,
      loading: false,
      contentLoading: false,
      summary: `模型增强中：${summary}`,
      content: [
        ...(Array.isArray(content) ? content : [content]).filter(Boolean)
      ].slice(0, 6),
      detailSections: [
        stageDetailSection('内容状态', ['已先填入当前可用数据', '大模型结果返回后会自动增强或覆盖该节点内容']),
        ...(Array.isArray(detailSections) ? detailSections : [])
      ]
    }
  }
  if (contentStatus === 'model-generated') {
    const generatedItems = modelSummaryItems(analysis)
    const ownContent = (Array.isArray(content) ? content : [content]).filter(Boolean)
    return {
      contentSource: source,
      loading: false,
      contentLoading: false,
      summary: `模型生成：${summary}`,
      content: hasModelNode || ownContent.length
        ? ownContent
        : generatedItems.length ? generatedItems.slice(0, 6) : ownContent,
      detailSections: [
        stageDetailSection('内容来源', ['大模型根据输入、文档和项目上下文生成']),
        ...(Array.isArray(detailSections) ? detailSections : [])
      ]
    }
  }
  return {
    contentSource: source,
    loading: false,
    contentLoading: false,
    summary: `基础结构：${summary}`,
    content: [
      '这是系统基础结构，不是完整大模型分析结论。',
      ...(Array.isArray(content) ? content : [content]).filter(Boolean)
    ].slice(0, 6),
    detailSections: [
      stageDetailSection('内容来源', ['系统根据流程模板和输入内容生成基础结构；模型结果返回后会替换为模型生成内容']),
      ...(Array.isArray(detailSections) ? detailSections : [])
    ]
  }
}

function isAgentWorkbenchStage(stageId = '') {
  return ['requirement-dissection'].includes(String(stageId || '').trim())
}

function stageCanvasNode(stageId, id, title, summary, content = [], index = 0, detailSections = [], quickActions = [], options = {}) {
  const contentStatus = options.contentStatus || resolveContentStatus(options.analysis || {})
  const lookupKeys = [id, title, options.sourcePageId]
    .map((key) => String(key || '').trim())
    .filter(Boolean)
  const modelNode = lookupKeys.map((key) => options.modelNodes?.get(`${stageId}:${key}`)).find(Boolean) || null
  const statusContent = stageContentForStatus({
    analysis: options.analysis || {},
    title,
    summary: modelNode?.summary || summary,
    content: modelNode?.content?.length ? modelNode.content : content,
    detailSections: modelNode?.detailSections?.length ? modelNode.detailSections : detailSections,
    contentStatus,
    hasModelNode: Boolean(modelNode)
  })
  return {
    id,
    stageId,
    title: modelNode?.title || title,
    ...(options.sourcePageId ? { sourcePageId: options.sourcePageId } : {}),
    ...(options.sliceId ? { sliceId: options.sliceId } : {}),
    summary: statusContent.summary,
    content: statusContent.content,
    contentSource: statusContent.contentSource,
    contentStatus,
    contentStatusLabel: contentStatusLabel(contentStatus),
    loading: statusContent.loading,
    contentLoading: statusContent.contentLoading,
    x: 80 + (index % 4) * 400,
    y: 140 + Math.floor(index / 4) * 300,
    width: 340,
    height: 230,
    agentWorkbench: isAgentWorkbenchStage(stageId),
    detailLayout: isAgentWorkbenchStage(stageId) ? 'stage-agent-workbench' : undefined,
    agentScope: `当前只围绕「${title}」回答。`,
    quickActions,
    detailSections: statusContent.detailSections
  }
}

function stageCanvasFromNodes(nodes = [], meta = {}) {
  return {
    ...meta,
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `${node.id}-${nodes[index + 1].id}`,
      from: node.id,
      to: nodes[index + 1].id,
      label: '下一步'
    })),
    orderedTabs: nodes.map((node) => ({ key: node.id, label: node.title }))
  }
}

function modelStageCanvasForAnalysis(analysis = {}, stageId = '') {
  const totalFlow = modelTotalDesignFlow(analysis)
  const canvas = totalFlow?.stageCanvases?.[stageId]
  if (canvas && Array.isArray(canvas.nodes) && canvas.nodes.length) return canvas
  const stage = Array.isArray(totalFlow?.stages)
    ? totalFlow.stages.find((item) => item?.id === stageId || item?.stageId === stageId)
    : null
  if (stage && Array.isArray(stage.nodes) && stage.nodes.length) return stage
  return null
}

function normalizeModelStageCanvasNode(stageId = '', raw = {}, index = 0, analysis = {}) {
  const normalized = normalizeModelStageNode(raw)
  if (!normalized) return null
  const contentStatus = resolveContentStatus(analysis)
  const nodeId = normalized.id || raw.nodeId || raw.key || `${stageId}-model-${index + 1}`
  const title = normalized.title || raw.title || raw.name || `模型节点 ${index + 1}`
  const pageLayoutArtifact = stageId === 'interaction-lofi'
    ? pageLayoutArtifactForPage({ ...raw, ...normalized, title }, analysis)
    : null
  const statusContent = stageContentForStatus({
    analysis,
    title,
    summary: normalized.summary || raw.summary || title,
    content: normalized.content?.length ? normalized.content : raw.content || [],
    detailSections: normalized.detailSections?.length ? normalized.detailSections : raw.detailSections || [],
    contentStatus,
    hasModelNode: true
  })
  return {
    ...raw,
    id: nodeId,
    stageId,
    title,
    summary: statusContent.summary,
    content: statusContent.content,
    detailSections: statusContent.detailSections,
    contentSource: statusContent.contentSource,
    contentStatus,
    contentStatusLabel: contentStatusLabel(contentStatus),
    loading: false,
    contentLoading: false,
    x: Number.isFinite(Number(raw.x)) ? Number(raw.x) : 80 + (index % 4) * 400,
    y: Number.isFinite(Number(raw.y)) ? Number(raw.y) : 140 + Math.floor(index / 4) * 300,
    width: Number(raw.width || 340),
    height: Number(raw.height || 230),
    agentWorkbench: isAgentWorkbenchStage(stageId),
    detailLayout: raw.detailLayout || (isAgentWorkbenchStage(stageId) ? 'stage-agent-workbench' : undefined),
    agentScope: raw.agentScope || `当前只围绕「${title}」回答。`,
    quickActions: Array.isArray(raw.quickActions) ? raw.quickActions : [],
    ...(pageLayoutArtifact ? { pageLayoutArtifact } : {})
  }
}

function applyStageNodeDefaults(stageId = '', node = {}, index = 0, pages = [], acceptance = {}) {
  if (stageId === 'interaction-lofi') {
    return {
      ...node,
      detailLayout: node.detailLayout || 'interaction-page-split',
      wireframeTree: node.wireframeTree || [
        { label: node.title || `页面 ${index + 1}`, type: 'page' },
        { label: '页面目标', type: 'section', children: [] },
        { label: '核心模块', type: 'section', children: [] },
        { label: '主操作区', type: 'action', children: [] },
        { label: '跳转关系', type: 'route', children: [] },
        { label: '状态层', type: 'state', children: [] }
      ],
      interactionSpec: node.interactionSpec || (node.detailSections || []).flatMap((section) =>
        (Array.isArray(section.items) ? section.items : []).map((item) => `${section.title}：${item}`)
      ),
      pageArchitecture: node.pageArchitecture || {
        title: node.title,
        goal: node.summary,
        sections: [],
        primaryActions: [],
        states: [],
        nextPage: ''
      },
      interactionDetails: node.interactionDetails || {
        clickActions: [],
        routeTargets: [],
        stateCoverage: [],
        dataDependencies: [],
        acceptanceCriteria: []
      },
      interactionSpecArtifact: node.interactionSpecArtifact || interactionSpecArtifactForPage(node, index, pages)
    }
  }
  if (stageId === 'ui-visual') {
    return {
      ...node,
      detailLayout: node.detailLayout || 'visual-gallery',
      targetGenerator: node.targetGenerator || 'gpt-image-2',
      artifactStatus: node.artifactStatus || 'pending',
      generationActions: Array.isArray(node.generationActions) && node.generationActions.length
        ? node.generationActions
        : [generationAction('generate-visual', '生成高保真图', '调用视觉模型生成当前页面高保真图。', 'gpt-image-2')],
      visualPreview: node.visualPreview || visualPreviewForPage(node),
      visualBrief: node.visualBrief || visualBriefForPage(node)
    }
  }
  if (stageId === 'html-output' || stageId === 'vue-output') {
    const kind = stageId === 'vue-output' ? 'vue' : 'html'
    return {
      ...node,
      detailLayout: node.detailLayout || 'preview-code-split',
      targetGenerator: node.targetGenerator || kind,
      artifactStatus: node.artifactStatus || 'pending',
      generationActions: Array.isArray(node.generationActions) && node.generationActions.length
        ? node.generationActions
        : [generationAction(`generate-${kind}`, kind === 'vue' ? '生成 Vue' : '生成 HTML', `根据已确认页面生成 ${kind.toUpperCase()} 产物。`, kind)],
      codePreview: node.codePreview || codePreviewArtifact(kind),
      engineeringPlan: node.engineeringPlan || engineeringPlanArtifact(kind)
    }
  }
  if (stageId === 'acceptance-deposit') {
    return {
      ...node,
      detailLayout: node.detailLayout || 'acceptance-deposit',
      acceptanceChecklist: node.acceptanceChecklist || acceptance.acceptanceChecklist,
      ruleAcceptance: node.ruleAcceptance || acceptance.ruleAcceptance,
      stateAcceptance: node.stateAcceptance || acceptance.stateAcceptance,
      nonFunctionalAcceptance: node.nonFunctionalAcceptance || acceptance.nonFunctionalAcceptance,
      permissionAcceptance: node.permissionAcceptance || acceptance.permissionAcceptance,
      riskItems: node.riskItems || acceptance.riskItems,
      knowledgeDeposits: node.knowledgeDeposits || acceptance.knowledgeDeposits,
      deliveryPackage: node.deliveryPackage || acceptance.deliveryPackage
    }
  }
  return node
}

function modelStageCanvasFromAnalysis(analysis = {}, stageId = '', pages = [], acceptance = {}) {
  if (isAgentWorkbenchStage(stageId)) return null
  const modelCanvas = modelStageCanvasForAnalysis(analysis, stageId)
  if (!modelCanvas) return null
  const nodes = modelCanvas.nodes
    .map((node, index) => normalizeModelStageCanvasNode(stageId, node, index, analysis))
    .filter(Boolean)
    .map((node, index) => applyStageNodeDefaults(stageId, node, index, pages, acceptance))
  if (!nodes.length) return null
  if (shouldPreferLocalPageCanvas(stageId, nodes, pages)) return null
  const fallbackCanvas = stageCanvasFromNodes(nodes)
  return {
    ...modelCanvas,
    nodes,
    edges: Array.isArray(modelCanvas.edges) && modelCanvas.edges.length ? modelCanvas.edges : fallbackCanvas.edges,
    orderedTabs: Array.isArray(modelCanvas.orderedTabs) && modelCanvas.orderedTabs.length
      ? modelCanvas.orderedTabs
      : nodes.map((node) => ({ key: node.id, label: node.title }))
  }
}

function stageAgentNode(stageId, id, title, summary, content = [], detailSections = [], quickActions = []) {
  return {
    id,
    stageId,
    title,
    summary,
    content: (Array.isArray(content) ? content : [content]).filter(Boolean),
    agentWorkbench: true,
    detailLayout: 'stage-agent-workbench',
    agentScope: `确认「${title}」阶段信息。`,
    quickActions,
    detailSections: (Array.isArray(detailSections) ? detailSections : []).filter(Boolean)
  }
}

function applyModelNodeToAgentNode(node = {}, analysis = {}) {
  const contentStatus = resolveContentStatus(analysis)
  const modelNode = [node.id, node.title]
    .map((key) => String(key || '').trim())
    .filter(Boolean)
    .map((key) => modelStageNodeMap(analysis).get(`${node.stageId}:${key}`))
    .find(Boolean)
  if (!modelNode) return node
  const statusContent = stageContentForStatus({
    analysis,
    title: node.title,
    summary: modelNode.summary || node.summary,
    content: modelNode.content?.length ? modelNode.content : node.content,
    detailSections: modelNode.detailSections?.length ? modelNode.detailSections : node.detailSections,
    contentStatus,
    hasModelNode: true
  })
  return {
    ...node,
    title: modelNode.title || node.title,
    summary: statusContent.summary,
    content: statusContent.content,
    detailSections: statusContent.detailSections,
    contentSource: statusContent.contentSource,
    contentStatus,
    contentStatusLabel: contentStatusLabel(contentStatus),
    loading: statusContent.loading,
    contentLoading: statusContent.contentLoading
  }
}

function requirementDissectionAgentNode(analysis = {}, requirementSlices = [], questions = [], projectFunctionMap = null, requirementDissectionArtifact = null) {
  const blueprint = analysis.blueprint || {}
  const productName = blueprint.profile?.productName || blueprint.title || '当前需求'
  const firstSlice = requirementSlices[0] || {}
  const artifact = requirementDissectionArtifact || {}
  const modelOnly = Boolean(artifact.__modelOnly)
  const node = stageAgentNode(
    'requirement-dissection',
    'requirement-dissection-agent',
    '需求分析',
    artifact.__modelMissing ? '模型未返回需求分析结构。' : artifact.productDefinition?.oneLine || (modelOnly ? '模型未返回需求分析摘要。' : `先把「${productName}」的原始输入、文档、项目背景和待确认风险拆清楚。`),
    [
      ...(modelOnly ? [] : [`需求/项目：${productName}`, `文档数量：${analysis.summary?.parsed || 0}/${analysis.summary?.total || 0}`, `小需求数量：${requirementSlices.length || 1}`]),
      artifact.__modelMissing ? '模型未返回需求分析结构' : '',
      artifact.productDefinition?.productType ? `产品类型：${artifact.productDefinition.productType}` : '',
      artifact.competitiveAnalysis?.referenceMode ? `竞品参考：${artifact.competitiveAnalysis.referenceMode}` : '',
      !modelOnly && firstSlice.sourceExcerpt ? `来源片段：${firstSlice.sourceExcerpt}` : ''
    ],
    [
      ...(modelOnly ? [] : [
        stageDetailSection('阶段目标', ['把产品需求转换成设计需求', '区分事实、推断和待确认风险', '避免直接跳到页面画布导致主意图误判']),
        stageDetailSection('输入来源', [analysis.input || '未输入文字', ...(analysis.documents || []).map((doc) => doc.name || '未命名文档')])
      ]),
      stageDetailSection('页面需求清单', (artifact.designRequirementMap?.pages || []).map((page) => `${page.pageName}：${page.goal}`)),
      stageDetailSection('竞品参考', artifact.competitiveAnalysis?.industryBaseline || []),
      stageDetailSection('下游生成依据', artifact.downstreamHints?.interactionLofi || []),
      stageDetailSection('待确认问题', questions)
    ],
    []
  )
  if (projectFunctionMap) node.projectFunctionMap = projectFunctionMap
  if (requirementDissectionArtifact) node.requirementDissectionArtifact = requirementDissectionArtifact
  return applyModelNodeToAgentNode(node, analysis)
}

function pendingQuestions(analysis = {}) {
  const blueprint = analysis.blueprint || {}
  return (blueprint.outlineDiff?.pending || []).length
    ? blueprint.outlineDiff.pending
    : ['目标用户是否需要分层？', '一期成功标准是什么？', '异常状态是否需要进入本期验收？']
}

function buildStageSlices(stageId, requirementSlices = []) {
  return (requirementSlices.length ? requirementSlices : [requirementSlice('main-requirement-flow', '需求主流程', '围绕当前输入生成主要需求流程。', '', [])])
    .map((slice) => ({
      ...slice,
      id: `${stageId}-${slice.id}`,
      sourceSliceId: slice.id,
      stageId
    }))
}

function buildStagePages(stageId, pages = [], stageSlices = []) {
  const activeSliceId = stageSlices[0]?.id || ''
  return pages.map((page) => ({
    ...page,
    id: `${stageId}-${page.id}`,
    sourcePageId: page.id,
    nodeId: `${stageId}-${page.nodeId || page.id}`,
    sliceId: activeSliceId,
    stageId
  }))
}

function isInteractionRuleSlice(slice = {}) {
  const text = [slice.id, slice.title, slice.goal, slice.summary, slice.sourceExcerpt]
    .map((item) => String(item || ''))
    .join(' ')
  return /配置|降级|兜底|数据契约|接口|字段|埋点|兼容|权限|频控|开关|规则/.test(text) &&
    !/页面|首页|详情页|弹窗|列表|工作台|控制台|Dashboard|Home/i.test(String(slice.title || ''))
}

function pageSliceIds(pages = []) {
  return new Set((Array.isArray(pages) ? pages : [])
    .map((page) => String(page?.sliceId || '').trim())
    .filter(Boolean))
}

function sliceById(requirementSlices = [], sliceId = '') {
  const normalized = String(sliceId || '').trim()
  return (Array.isArray(requirementSlices) ? requirementSlices : [])
    .find((slice) => String(slice?.id || '').trim() === normalized) || null
}

function relatedRuleSliceIdsForPage(page = {}, requirementSlices = [], pages = []) {
  const pageSliceSet = pageSliceIds(pages)
  const pageSliceId = String(page.sliceId || '').trim()
  const pageSlice = sliceById(requirementSlices, pageSliceId)
  if (!pageSliceId || !pageSlice) return []
  const pageText = [page.title, page.summary, pageSlice.title, pageSlice.goal]
    .map((item) => String(item || ''))
    .join(' ')
  const pageIsPromptShortcut = /(快捷|提示词|prompt|chip|输入)/i.test(pageText)
  return (Array.isArray(requirementSlices) ? requirementSlices : [])
    .filter((slice) => {
      const id = String(slice?.id || '').trim()
      if (!id || id === pageSliceId || pageSliceSet.has(id)) return false
      if (!isInteractionRuleSlice(slice)) return false
      const sliceText = [slice.title, slice.goal, slice.sourceExcerpt].map((item) => String(item || '')).join(' ')
      if (pageIsPromptShortcut && /(提示词|prompt|chip|快捷|输入|降级|兜底|配置)/i.test(sliceText)) return true
      return pageSliceId === (requirementSlices[0]?.id || '')
    })
    .map((slice) => slice.id)
}

function promptFallbackRowsForPage(page = {}, relatedSlices = []) {
  const text = [
    page.title,
    page.summary,
    ...(Array.isArray(relatedSlices) ? relatedSlices : []).flatMap((slice) => [slice.title, slice.goal, slice.sourceExcerpt])
  ].map((item) => String(item || '')).join(' ')
  if (!/(提示词|prompt|chip|快捷|输入)/i.test(text) || !/(配置|降级|兜底|数据契约|接口|字段|埋点|兼容|权限|频控|开关|规则)/.test(text)) return []
  return [
    {
      id: 'I-prompt-shortcut-fallback',
      annotationId: 'A-prompt-fallback',
      target: '提示词配置与降级',
      gesture: '系统状态触发',
      condition: '进入首页后请求远端提示词配置；接口失败、无推荐、权限不足或业务开关关闭时进入降级。',
      enableCondition: '页面核心数据加载完成，Topic/input composer 可见，且当前输入模式允许展示快捷提示词。',
      disableCondition: '请求处理中、频控命中、业务开关关闭、用户已进入提交中状态或当前输入模式不支持提示词时禁用。',
      displayCondition: 'Topic/input composer 可见时，展示在输入区下方或主操作附近。',
      hideCondition: '提示词列表为空且本地默认 Chips 不可用，或用户已进入提交中状态时隐藏。',
      operation: '优先展示远端配置 Chips；失败时展示本地默认 Chips；点击 Chips 写入或追加到 Topic/input composer，不覆盖用户已输入内容。',
      feedback: '换一批时出现轻量 loading，完成后替换输入框内部 Chips 列表，保留当前 composer 内容。',
      statePromptCopy: '暂时使用默认提示词，你仍可以继续编辑输入内容',
      result: '停留首页并更新 Topic/input composer 或 Chips 列表；不改变 Next、登录检查和进入 Studio 的原路径。',
      motion: '普通点击反馈 120ms 内完成；换一批 loading 使用轻量过渡。',
      states: ['远端配置成功', '本地默认兜底', '不可用/禁用'],
      testPoints: [
        '远端配置失败时仍展示默认 Chips 或明确空态。',
        '点击快捷提示词不会覆盖用户已输入内容。',
        '换一批不会清空 composer 内容。',
        '权限不足、禁用、频控时不能静默失败。'
      ]
    }
  ]
}

function attachInteractionRuleSlicesToPages(pages = [], requirementSlices = []) {
  return (Array.isArray(pages) ? pages : []).map((page) => {
    const relatedSliceIds = relatedRuleSliceIdsForPage(page, requirementSlices, pages)
    if (!relatedSliceIds.length) return page
    const relatedSlices = relatedSliceIds
      .map((sliceId) => sliceById(requirementSlices, sliceId))
      .filter(Boolean)
    const promptRows = promptFallbackRowsForPage(page, relatedSlices)
    const ruleSummaries = relatedSlices.map((slice) => `${slice.title}：${slice.goal || slice.sourceExcerpt || '写入当前页面交互说明。'}`)
    return {
      ...page,
      interactionRole: 'page-visible',
      relatedSliceIds,
      relatedRequirementRules: ruleSummaries,
      interactionHotspots: mergePageInteractionHotspots(
        page.interactionHotspots || page.controls || page.hotspots,
        promptRows,
        page,
        0,
        pages,
        12
      ),
      additionalInteractionRows: [
        ...(Array.isArray(page.additionalInteractionRows) ? page.additionalInteractionRows : []),
        ...promptRows
      ],
      detailSections: mergeDetailSections(page.detailSections, [
        stageDetailSection('关联规则型小需求', ruleSummaries),
        ...(promptRows.length ? [stageDetailSection('配置/降级规则', promptRows.map((row) => row.operation))] : [])
      ])
    }
  })
}

function pageSectionItems(page = {}, title = '') {
  return (Array.isArray(page.detailSections) ? page.detailSections : [])
    .filter((section) => String(section?.title || '').includes(title))
    .flatMap((section) => Array.isArray(section.items) ? section.items : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function nextPageTitle(pages = [], index = 0) {
  return pages[index + 1]?.title || '流程结束或返回上一页'
}

function interactionWireframeTree(page = {}, index = 0, pages = []) {
  return [
    { label: page.title || `页面 ${index + 1}`, type: 'page' },
    { label: '页面目标', type: 'section', children: pageSectionItems(page, '页面目标').slice(0, 2) },
    { label: '核心模块', type: 'section', children: pageSectionItems(page, '核心模块').slice(0, 4) },
    { label: '主操作区', type: 'action', children: pageSectionItems(page, '用户点击动作').slice(0, 4) },
    { label: `跳转：${nextPageTitle(pages, index)}`, type: 'route' },
    { label: '状态层', type: 'state', children: pageSectionItems(page, '状态').slice(0, 4) }
  ]
}

function interactionSpec(page = {}, index = 0, pages = []) {
  return [
    `页面目标：${pageSectionItems(page, '页面目标')[0] || page.summary || `明确「${page.title}」职责。`}`,
    `点击动作：${pageSectionItems(page, '用户点击动作').join('；') || '点击主按钮、返回上一步、处理异常提示。'}`,
    `跳转关系：${pageSectionItems(page, '跳转')[0] || `主操作后进入「${nextPageTitle(pages, index)}」。`}`,
    `状态覆盖：${pageSectionItems(page, '状态').join('；') || '加载中、空状态、失败重试、权限提示。'}`,
    `数据依赖：${pageSectionItems(page, '接口')[0] || pageSectionItems(page, '数据')[0] || '依赖当前页面业务接口和状态数据。'}`,
    `验收点：${pageSectionItems(page, '验收点').join('；') || '页面目标清晰、主操作可达、异常状态可恢复。'}`
  ]
}

function pageArchitecture(page = {}, index = 0, pages = []) {
  const sectionItems = pageSectionItems(page, '核心模块')
  const stateItems = pageSectionItems(page, '状态')
  const hotspots = pageInteractionHotspots(page, index, pages)
  return {
    title: page.title || `页面 ${index + 1}`,
    goal: pageSectionItems(page, '页面目标')[0] || page.summary || `明确「${page.title || `页面 ${index + 1}`}」的职责。`,
    sections: sectionItems.length ? sectionItems : ['页面标题/导航', '核心内容区', '主操作区', '状态反馈区'],
    primaryActions: pageSectionItems(page, '用户点击动作').length
      ? pageSectionItems(page, '用户点击动作')
      : hotspots.map((item) => item.operation).slice(0, 6),
    states: stateItems.length ? stateItems : ['加载中', '空状态', '失败重试', '权限提示'],
    nextPage: nextPageTitle(pages, index)
  }
}

function interactionDetails(page = {}, index = 0, pages = []) {
  const interactionHotspots = pageInteractionHotspots(page, index, pages)
  const clickActions = pageSectionItems(page, '用户点击动作')
  const routeTargets = pageSectionItems(page, '跳转')
  const stateItems = pageSectionItems(page, '状态')
  const dataItems = [
    ...pageSectionItems(page, '接口'),
    ...pageSectionItems(page, '数据')
  ]
  const acceptanceItems = pageSectionItems(page, '验收点')
  const unique = (items = []) => Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)))
  return {
    interactionHotspots,
    clickActions: unique(clickActions.length ? clickActions : interactionHotspots.map((item) => `${item.target}：${item.operation}`)),
    routeTargets: unique(routeTargets.length ? routeTargets : interactionHotspots.map((item) => item.result).filter(Boolean).concat([`主操作后进入「${nextPageTitle(pages, index)}」。`])),
    stateCoverage: unique(stateItems.length ? stateItems : ['加载中、空状态、失败重试、权限提示。']),
    dataDependencies: unique(dataItems.length ? dataItems : interactionHotspots.flatMap((item) => item.dataDependencies || []).concat(['依赖当前页面业务接口、用户选择状态和需求分析中的流程约束。'])),
    acceptanceCriteria: unique(acceptanceItems.length ? acceptanceItems : interactionHotspots.flatMap((item) => item.testPoints || []).concat(['页面目标清晰。', '主操作可达。', '异常状态可恢复。']))
  }
}

function interactionSpecArtifactForPage(page = {}, index = 0, pages = []) {
  const details = interactionDetails(page, index, pages)
  const architecture = pageArchitecture(page, index, pages)
  const hotspots = details.interactionHotspots?.length
    ? details.interactionHotspots
    : pageInteractionHotspots(page, index, pages)
  const relatedStates = Array.isArray(page.relatedStateMachine?.states) ? page.relatedStateMachine.states : []
  const defaultStates = listFromValues(
    [...details.stateCoverage, ...relatedStates],
    ['默认态', '加载态', '空状态', '失败重试态'],
    8
  )
  const defaultPromptCopy = defaultStates.map((state) => {
    const text = String(state || '').trim()
    if (/加载|请求|处理中/.test(text)) return '加载中，请稍候'
    if (/空|暂无/.test(text)) return '暂无可用内容'
    if (/失败|错误|异常|超时/.test(text)) return '加载失败，请重试'
    if (/权限|登录/.test(text)) return '暂无权限，请登录或切换账号'
    return text || '操作已更新'
  })
  const hotspotRows = hotspots.map((hotspot, actionIndex) => ({
    id: `I${String(actionIndex + 1).padStart(2, '0')}`,
    annotationId: `A${actionIndex + 1}`,
    target: hotspot.target || architecture.sections[actionIndex] || `交互对象 ${actionIndex + 1}`,
    gesture: hotspot.gesture || '单击',
    condition: hotspot.condition || (actionIndex === 0 ? '默认可操作；加载中、禁用、权限不足时需给出反馈。' : '用户完成前置选择或进入对应区域后触发。'),
    enableCondition: hotspot.enableCondition || '页面核心数据加载完成，且用户具备当前操作权限。',
    disableCondition: hotspot.disableCondition || '请求处理中、必填项缺失、权限不足或业务状态不允许时禁用。',
    displayCondition: hotspot.displayCondition || '进入当前页面且该模块与当前用户任务相关时显示。',
    hideCondition: hotspot.hideCondition || '模块无数据、权限不满足、业务开关关闭或已被上游流程替代时隐藏。',
    operation: hotspot.operation || '点击后立即给出 pressed/loading 状态，防止重复提交。',
    feedback: hotspot.feedback || `${hotspot.target || '交互对象'}触发后给出即时反馈。`,
    statePromptCopy: hotspot.statePromptCopy || defaultPromptCopy[actionIndex] || defaultPromptCopy[0] || '操作已提交，请稍候',
    result: hotspot.result || details.routeTargets[actionIndex] || details.routeTargets[0] || `进入「${nextPageTitle(pages, index)}」或停留当前页展示反馈。`,
    motion: hotspot.motion || '基础点击反馈 120ms 内完成，页面跳转使用系统默认转场。',
    states: Array.isArray(hotspot.states) ? hotspot.states.slice(0, 3) : [],
    testPoints: [
      ...(Array.isArray(hotspot.testPoints) ? hotspot.testPoints.slice(0, 2) : []),
      details.acceptanceCriteria[actionIndex] || details.acceptanceCriteria[0] || '交互对象可点击且反馈明确。',
      '异常、禁用、权限不足时不能静默失败。'
    ].filter(Boolean).slice(0, 4)
  }))
  const additionalRows = (Array.isArray(page.additionalInteractionRows) ? page.additionalInteractionRows : [])
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row, rowIndex) => ({
      id: cleanText(row.id || `I-extra-${rowIndex + 1}`),
      annotationId: cleanText(row.annotationId || `A-extra-${rowIndex + 1}`),
      target: cleanText(row.target || `补充交互 ${rowIndex + 1}`),
      gesture: cleanText(row.gesture || '系统状态触发'),
      condition: cleanText(row.condition || row.enableCondition || '满足当前页面状态时触发。'),
      enableCondition: cleanText(row.enableCondition || '页面核心数据加载完成，且当前操作可用。'),
      disableCondition: cleanText(row.disableCondition || '请求处理中、权限不足或业务状态不允许时禁用。'),
      displayCondition: cleanText(row.displayCondition || '进入当前页面且该规则适用时显示。'),
      hideCondition: cleanText(row.hideCondition || '规则不适用、无数据或业务开关关闭时隐藏。'),
      operation: cleanText(row.operation || ''),
      feedback: cleanText(row.feedback || ''),
      statePromptCopy: cleanText(row.statePromptCopy || '状态已更新'),
      result: cleanText(row.result || '停留当前页并更新相关状态。'),
      motion: cleanText(row.motion || '基础点击反馈 120ms 内完成。'),
      states: Array.isArray(row.states) ? row.states.slice(0, 4) : [],
      testPoints: Array.isArray(row.testPoints) ? row.testPoints.slice(0, 4) : []
    }))
  const decisionRows = (Array.isArray(page.relatedDecisionPoints) ? page.relatedDecisionPoints : [])
    .map((row, rowIndex) => ({
      id: `I-decision-${rowIndex + 1}`,
      annotationId: `A-decision-${rowIndex + 1}`,
      target: cleanText(row.decisionPoint || `决策点 ${rowIndex + 1}`),
      gesture: '选择',
      condition: cleanText(row.pageName ? `用户位于「${row.pageName}」并需要确定分支。` : '用户需要确定当前页面分支。'),
      enableCondition: '相关页面数据和可选项加载完成。',
      disableCondition: '选项缺失、权限不足或上游信息未确认时禁用。',
      displayCondition: '该决策会影响当前页面、后续页面或数据流时显示。',
      hideCondition: '当前路径不涉及该决策或用户已确认固定策略时隐藏。',
      operation: cleanText(`选择${artifactList(row.options, 4).join(' / ') || '合适选项'}。`),
      feedback: cleanText(row.impact || '选择后刷新后续页面和状态。'),
      statePromptCopy: '已更新决策路径',
      result: cleanText(row.recommendation || '按当前选择继续生成后续页面。'),
      motion: '选项切换使用即时选中反馈，分支内容轻量刷新。',
      states: ['未选择', '已选择', '不可选'],
      testPoints: ['选项影响的页面和数据同步更新。', '禁用或无权限时说明原因。']
    }))
  const exceptionRows = (Array.isArray(page.relatedExceptions) ? page.relatedExceptions : [])
    .map((row, rowIndex) => ({
      id: `I-exception-${rowIndex + 1}`,
      annotationId: `A-exception-${rowIndex + 1}`,
      target: cleanText(row.scenario || `异常路径 ${rowIndex + 1}`),
      gesture: '系统状态触发',
      condition: cleanText(row.triggerCondition || '发生异常状态时触发。'),
      enableCondition: '异常可被识别且当前页面允许恢复。',
      disableCondition: '异常原因不可恢复或需要人工处理时禁用自动恢复。',
      displayCondition: '异常发生或用户需要了解恢复方式时显示。',
      hideCondition: '状态正常且不需要提示时隐藏。',
      operation: cleanText(row.systemFeedback || '展示明确异常反馈。'),
      feedback: cleanText(row.systemFeedback || '提示异常原因。'),
      statePromptCopy: cleanText(row.systemFeedback || '操作异常，请按提示恢复'),
      result: cleanText(row.recoveryPath || '保留当前输入并提供重试或返回入口。'),
      motion: '错误提示出现/消失使用轻量过渡，不遮挡关键恢复操作。',
      states: ['正常', '异常', '恢复中'],
      testPoints: ['异常提示包含原因和恢复方式。', '恢复操作不清空关键输入。']
    }))
  const seenRows = new Set()
  const rows = [...hotspotRows, ...decisionRows, ...exceptionRows, ...additionalRows].filter((row) => {
    const key = `${row.target}|${row.operation}|${row.result}`
    if (seenRows.has(key)) return false
    seenRows.add(key)
    return true
  })
  const stateMatrix = defaultStates.map((state, stateIndex) => ({
    state,
    trigger: stateIndex === 0 ? '进入页面或刷新数据' : '当前页面数据/权限/网络变化',
    display: state,
    promptCopy: defaultPromptCopy[stateIndex] || defaultPromptCopy[0] || '状态已更新',
    recovery: /失败|错误|异常/.test(state) ? '展示重试入口或返回路径。' : '状态变化后保持页面主任务可继续。'
  }))
  return {
    version: 'page-interaction-spec/v1',
    pageName: page.title || `页面 ${index + 1}`,
    snapshotRef: 'pageLayoutArtifact.asciiWireframe',
    annotations: rows.map((row) => ({
      id: row.annotationId,
      target: row.target,
      type: 'interaction-hotspot'
    })),
    interactionRows: rows,
    stateMatrix,
    relatedDecisionPoints: page.relatedDecisionPoints || [],
    relatedExceptions: page.relatedExceptions || [],
    relatedDataFlow: page.relatedDataFlow || null,
    relatedStateMachine: page.relatedStateMachine || null,
    relatedJumpEdges: page.relatedJumpEdges || [],
    transitionRules: details.routeTargets.map((target, targetIndex) => ({
      from: page.title || `页面 ${index + 1}`,
      action: rows[targetIndex]?.feedback || rows[0]?.feedback || '完成当前页主操作',
      to: target,
      transition: '保持原型默认转场；特殊动效另行标注。'
    })),
    gestureNotes: [
      '下拉手势 → 触发接口刷新页面数据',
      '内容区域纵向滚动 → 顶部/底部固定区不跟随滚动'
    ],
    motionNotes: [
      '普通点击反馈使用即时状态变化；复杂动效需补充 demo、缓动和可中断规则。',
      '需要动效时说明触发对象、起止状态、时长、缓动、是否可中断和失败回退。'
    ]
  }
}

function pageLayoutSpecPageKey(rawPage = {}) {
  return pageTitleComparisonKey(rawPage?.page || rawPage?.pageName || rawPage?.title || rawPage?.name || rawPage?.id || rawPage?.pageId || '')
}

function selectCurrentPageLayoutSpecPage(rawPages = [], page = {}) {
  const candidates = [
    page.title,
    page.pageName,
    page.name,
    page.id,
    page.nodeId,
    page.sourcePageId
  ].map(pageTitleComparisonKey).filter(Boolean)
  if (!candidates.length) return null
  return (Array.isArray(rawPages) ? rawPages : []).find((rawPage) => {
    const rawKey = pageLayoutSpecPageKey(rawPage)
    return rawKey && candidates.includes(rawKey)
  }) || null
}

function pageLayoutSpecForPage(page = {}, analysis = {}) {
  const rawSpec = page.pageLayoutSpec || page.layoutPlan || page.structuredLayoutPlan || page.page_layout_spec
  const blueprint = analysis.blueprint || {}
  const projectName = rawSpec?.projectName || rawSpec?.name || blueprint.profile?.productName || blueprint.title || '页面布局方案'
  // Model-provided layout specs are the source of truth. The fallback below only
  // keeps legacy/sparse pages renderable when the model did not return a
  // structured pageLayoutSpec/layoutPlan.
  if (!rawSpec || typeof rawSpec !== 'object' || Array.isArray(rawSpec)) {
    return fallbackPageLayoutSpecForPage(page, analysis, projectName)
  }
  if (Array.isArray(rawSpec.pages)) {
    const rawPages = rawSpec.pages.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    const selectedPage = selectCurrentPageLayoutSpecPage(rawPages, page) || rawPages[0]
    return {
      ...rawSpec,
      projectName,
      pages: selectedPage ? [selectedPage] : []
    }
  }
  return {
    projectName,
    pages: [
      {
        ...rawSpec,
        page: rawSpec.page || rawSpec.name || rawSpec.title || page.title,
        pageType: rawSpec.pageType || rawSpec.type || page.pageType,
        layoutType: rawSpec.layoutType || rawSpec.layout || rawSpec.recommendedLayout
      }
    ]
  }
}

function isGenericFallbackModule(item = '') {
  return /^(页面目标|核心信息|核心内容区|核心内容卡片|主操作入口|主操作区|状态反馈|状态反馈区|页面标题区|信息展示)$/.test(cleanText(item))
}

function joggHomeLayoutEvidence(text = '') {
  if (!hasJoggContext(text)) return null
  const modules = [
    /首页|Home|生成/.test(text) ? 'Jogg 首页生成入口' : '',
    /Tools/i.test(text) ? 'Tools 生成入口' : '',
    /Studio/i.test(text) ? 'Studio 编辑渲染入口' : '',
    /Media|My Media|Stock|AI Generate/i.test(text) ? 'Media 素材面板：My Media / Stock / AI Generate' : '',
    /My Media/i.test(text) ? 'My Media：Upload / Capture Screen / Search from Space' : '',
    /Stock|Pexels|Pixabay/i.test(text) ? 'Stock：Pexels / Pixabay 素材检索' : '',
    /AI Generate|Image|Video/i.test(text) ? 'AI Generate：Image / Video 生成' : '',
    /Voice/i.test(text) ? 'Voice 音色配置入口' : '',
    /Projects/i.test(text) ? 'Projects 项目管理入口' : ''
  ].filter(Boolean)
  return {
    topFixed: [
      'Jogg Logo / Home 当前选中',
      'Tools / Studio 导航入口',
      'Voice / Projects / 账号状态'
    ],
    scrollModules: uniqueTexts(modules, 9).length
      ? uniqueTexts(modules, 9)
      : ['Jogg 首页生成入口', 'Tools 生成入口', 'Studio 编辑渲染入口', 'Voice 配置入口', 'Projects 项目管理入口'],
    interactions: [
      '点击 Home 保持首页生成入口和最近任务',
      '点击 Tools 进入生成工具流',
      '点击 Studio 进入编辑渲染工作区',
      '点击 Media 面板在 My Media / Stock / AI Generate 间切换素材来源',
      '点击 Voice 或 Projects 进入音色配置和项目管理'
    ],
    frontendTasks: [
      '保留 Jogg 首页全局导航和当前选中态',
      '按 Tools / Studio / Media / Voice / Projects 渲染入口卡片、状态角标和空态',
      'Media 面板支持 My Media、Stock、AI Generate 三类素材区切换'
    ],
    backendTasks: [
      '提供最近项目、生成任务状态、素材库索引和用户 credits/权限状态',
      '为 My Media、Stock、AI Generate 返回素材列表、检索结果、生成任务和错误码'
    ],
    overlays: ['LoginDialog / credits 拦截', '素材选择弹窗', '生成失败提示']
  }
}

function homePromptShortcutLayoutEvidence(analysis = {}, title = '') {
  if (!isHomePromptShortcutRequest(analysis)) return null
  if (!/首页|Home|Video Podcast/i.test(String(title || ''))) return null
  const text = analysisText(analysis)
  const hasPodcastStep = /PodcastStep1|Generate Script|Upload Script|Upload Audio|Studio|Video Podcast/i.test(text)
  return {
    layoutType: hasPodcastStep
      ? '左侧全局导航 + 首屏 PodcastStep1 输入面板 + 快捷提示词 Chips'
      : '顶部固定区 + 主体输入区 + 快捷提示词 Chips',
    topFixed: hasPodcastStep
      ? ['左侧 AppNavRail 保持 Home 激活', '右侧账号/登录/升级入口保持原逻辑']
      : ['产品导航', '账号入口', '状态/消息入口'],
    scrollModules: hasPodcastStep
      ? [
          'Hero 标题 Turn Your Ideas Into Podcasts',
          '输入类型 Tabs：Generate Script / Upload Script / Upload Audio',
          'Topic/input composer 输入框内部：placeholder「Enter a topic, script, or link」',
          'Topic/input composer 输入框内部：快捷提示词 Chips / 更多/换一批',
          'Try Sample 入口',
          '参数栏：host / storytelling / duration / language',
          'Generate podcast / Next 主按钮'
        ]
      : ['首屏主任务区', '主输入框', '快捷提示词按钮组', '参数栏', 'Next 主按钮'],
    interactions: hasPodcastStep
      ? [
          '点击快捷提示词写入或追加到主输入框',
          '切换 Generate Script / Upload Script / Upload Audio 时控制提示词显示',
          '用户已输入时不静默覆盖',
          '点击 Next 沿用 checkOpenGuestLoginDialog 与 createPodcastVideoTask，成功后进入 Studio'
        ]
      : ['点击快捷提示词填充输入框', '继续编辑输入内容', '点击 Next 进入原主流程'],
    frontendTasks: [
      '在现有输入区渲染快捷提示词 Chips',
      '维护已选中、追加/替换、手动编辑后的状态',
      '移动端横向滚动或换行展示，不能遮挡 Next 主按钮'
    ],
    backendTasks: [
      '提供首页快捷提示词列表',
      '按语言、输入模式、用户状态返回推荐',
      '接口失败时允许前端使用当前项目语境下的兜底提示词',
      '保留原创建任务接口不变'
    ],
    overlays: ['LoginDialog', 'Pricing Drawer/credits 拦截', '提示词更多弹层（可选）'],
    reasons: ['当前小需求是首页快捷提示词局部增强，必须围绕原首页输入区生成，不能退回泛化首页或商城首页。']
  }
}

function fallbackPageLayoutSpecForPage(page = {}, analysis = {}, projectName = '页面布局方案') {
  // Fallback heuristics are intentionally limited: they help old or incomplete
  // runs produce a readable wireframe, but must not override real model artifacts.
  const title = page.title || page.page || page.name || '页面'
  const text = analysisText(analysis)
  const isTeaProduct = hasTeaContext(text)
  const homePromptEvidence = homePromptShortcutLayoutEvidence(analysis, title)
  const joggHomeEvidence = /首页|Home/i.test(title) ? joggHomeLayoutEvidence(text) : null
  const moduleItems = [
    ...valuesAsList(page.modules),
    ...valuesAsList(page.sections),
    ...valuesAsList(page.requirementRow?.mustCarry),
    ...pageSectionItems(page, '核心模块'),
    ...pageSectionItems(page, '页面核心模块')
  ].filter(Boolean).filter((item) => !isGenericFallbackModule(item))
  const actionItems = uniqueTexts([
    ...valuesAsList(page.interactions),
    ...valuesAsList(page.primaryActions),
    ...valuesAsList(page.requirementRow?.primaryAction),
    ...valuesAsList(page.requirementRow?.interactionHotspots?.map((item) => item.operation || item.target)),
    ...pageSectionItems(page, '用户点击动作')
  ], 10)
  const stateItems = uniqueTexts([
    ...valuesAsList(page.states),
    ...valuesAsList(page.requirementRow?.states),
    ...pageSectionItems(page, '状态')
  ], 10)
  const dataItems = [
    ...valuesAsList(page.dataDependencies),
    ...valuesAsList(page.requirementRow?.dataDependencies),
    ...pageSectionItems(page, '接口'),
    ...pageSectionItems(page, '数据')
  ]
  const isProductDetailPage = /商品详情|商品定制|规格|定制/.test(title)
  const isMenuPage = !isProductDetailPage && /点单|点餐|菜单|菜单与商品/.test(title)
  const isTeaHomePage = isTeaProduct && /首页|选店|门店选择/.test(title)
  const isMemberPage = isTeaProduct && /我的|会员|个人/.test(title)
  const isCartPage = /购物车|结算|确认/.test(title)
  const isOrderPage = /订单|支付|取餐|制作/.test(title)
  const isMerchantPage = /商家|运营|订单台/.test(title)
  const normalizedPage = title
  const layoutType = isMenuPage
    ? '左右分栏 + 右侧商品列表 + 悬浮购物车'
    : isProductDetailPage
      ? '商品大图 + 规格定制表单 + 底部加购'
      : homePromptEvidence
        ? homePromptEvidence.layoutType
        : joggHomeEvidence
          ? '左侧全局导航 + 首页任务入口网格 + Tools/Studio/Media 快捷入口'
      : isTeaHomePage
        ? '首页信息流 + Banner/快捷入口/推荐商品'
        : isCartPage
      ? '结算流 + 表单/列表混排 + 底部固定操作'
      : isOrderPage
        ? '信息流卡片 + 状态步骤条 + 底部操作'
        : isMerchantPage
          ? '商家订单看板 + 状态筛选 + 列表处理'
          : '顶部固定区 + 主体滚动区 + 底部固定操作区'
  return {
    projectName,
    pages: [
      {
        page: normalizedPage,
        pageType: page.pageType || '页面级交互低保',
        layoutType,
        topFixed: isMenuPage
          ? ['门店名', '自取/外卖', '搜索']
          : homePromptEvidence
            ? homePromptEvidence.topFixed
          : joggHomeEvidence
            ? joggHomeEvidence.topFixed
          : isTeaHomePage
            ? ['门店选择', '搜索', '消息']
            : title === '首页'
              ? ['产品导航', '账号入口', '状态/消息入口']
              : ['返回/标题', '搜索或状态入口'],
        scrollModules: moduleItems.length
          ? moduleItems
          : isMenuPage
            ? ['左侧分类', '右侧商品列表', '商品卡片']
            : isProductDetailPage
              ? ['商品大图', '商品信息', '规格选择', '甜度冰度', '加料列表', '数量步进器']
              : isTeaHomePage
              ? ['Banner轮播', '快捷入口', '分类标签', '热销商品', '限时秒杀']
              : homePromptEvidence
                ? homePromptEvidence.scrollModules
              : joggHomeEvidence
                ? joggHomeEvidence.scrollModules
              : isCartPage
                ? ['商品/条目清单', '优惠/权益入口', '金额明细', '备注/附加信息', '结算确认区']
                : isMerchantPage
                  ? ['订单状态筛选', '订单卡片列表', '出杯/完成操作', '异常订单提示']
                  : title === '首页'
                    ? ['首屏主任务区', '输入/选择区', '快捷操作区', '状态反馈区']
                    : ['页面标题区', '核心内容卡片', '主操作区', '状态反馈区'],
        bottomFixed: isMenuPage
          ? ['悬浮购物车', '已选数量', '总价', '去结算']
          : isProductDetailPage
            ? ['加入购物车', '立即结算']
            : isCartPage
              ? ['去支付/提交订单主按钮', '返回修改次操作']
              : homePromptEvidence
                ? []
              : joggHomeEvidence
                ? []
                : ['底部主按钮', '次操作入口'],
        overlays: isMenuPage
          ? ['规格选择弹窗']
          : isProductDetailPage
            ? ['会员价说明弹窗', '库存不足提示']
            : isCartPage
              ? ['优惠选择弹窗', '确认提交弹窗', '库存/金额变化提示']
              : homePromptEvidence
                ? homePromptEvidence.overlays
              : joggHomeEvidence
                ? joggHomeEvidence.overlays
                : ['确认弹窗', '错误提示'],
        interactions: actionItems.length
          ? actionItems
          : homePromptEvidence
            ? homePromptEvidence.interactions
          : joggHomeEvidence
            ? joggHomeEvidence.interactions
            : ['点击主按钮触发主流程', '内容区域支持纵向滚动', '异常时展示可恢复提示'],
        frontendTasks: homePromptEvidence?.frontendTasks || joggHomeEvidence?.frontendTasks || ['前端接管页面结构、组件状态、点击/滚动/弹窗交互和埋点。'],
        backendTasks: dataItems.length
          ? dataItems
          : homePromptEvidence?.backendTasks
            ? homePromptEvidence.backendTasks
          : joggHomeEvidence?.backendTasks || ['后端提供页面接口数据、业务状态、错误码和权限校验。'],
        reasons: stateItems.length
          ? [`覆盖状态：${stateItems.join('；')}`]
          : homePromptEvidence
            ? homePromptEvidence.reasons
          : joggHomeEvidence
            ? ['当前分析和项目材料提供了 Jogg 首页、Tools、Studio、Media、Voice、Projects 证据，不能退回通用首页壳。']
            : ['根据页面目标、模块密度和主操作路径生成低保线框。']
      }
    ]
  }
}

function pageLayoutArtifactForPage(page = {}, analysis = {}) {
  const spec = pageLayoutSpecForPage(page, analysis)
  if (!spec) return null
  return buildPageLayoutArtifactFromSpec(spec)
}

function visualPreviewForPage(page = {}) {
  return {
    imagePrompt: `为「${page.title}」生成一张移动端高保真 UI 视觉稿，保留页面核心模块、主按钮、状态反馈和真实业务层级。`,
    figmaReady: true,
    imageStatus: 'pending',
    componentNotes: ['导航与页面标题', '核心内容卡片/列表', '主操作按钮', '加载/空/失败状态']
  }
}

function visualBriefForPage(page = {}) {
  const pageTitle = page.title || '当前页面'
  const detailModules = pageSectionItems(page, '页面核心模块')
  const stateItems = pageSectionItems(page, '状态')
  return {
    pageTitle,
    goal: pageSectionItems(page, '页面目标')[0] || `把「${pageTitle}」转成可生成高保真图的视觉说明。`,
    layoutFocus: [
      '首屏信息层级清晰',
      '主操作按钮在当前任务路径中突出',
      '关键状态反馈不遮挡核心内容'
    ],
    componentChecklist: detailModules.length
      ? detailModules
      : ['导航与页面标题', '核心内容卡片/列表', '主操作按钮', '状态提示', '底部操作区'],
    stateShots: stateItems.length
      ? stateItems
      : ['默认态', '加载态', '空状态', '失败重试态', '禁用/权限态'],
    imagePrompt: `为「${pageTitle}」生成一张移动端高保真 UI 视觉稿，体现页面目标、核心模块、主按钮、异常状态和真实业务层级。`,
    figmaHandoff: {
      ready: true,
      notes: ['可按页面生成独立 Figma Frame', '组件命名跟随页面模块', '后续可接 Figma MCP 编辑页面']
    }
  }
}

function generationAction(id, label, description, targetGenerator) {
  return {
    id,
    label,
    description,
    targetGenerator,
    status: 'pending'
  }
}

function codePreviewArtifact(kind = 'html') {
  const isVue = kind === 'vue'
  return {
    previewTitle: isVue ? 'Vue 运行预览' : 'HTML 运行预览',
    previewSummary: isVue ? '左侧展示 Vue 页面运行效果。' : '左侧展示 HTML Demo 效果。',
    codeLanguage: isVue ? 'vue' : 'html',
    code: ''
  }
}

function engineeringPlanArtifact(kind = 'html') {
  const isVue = kind === 'vue'
  return {
    previewTarget: isVue ? 'vue' : 'html',
    inputArtifacts: [
      '交互低保页面结构',
      'UI视觉阶段组件与状态说明',
      '页面跳转、接口和验收点'
    ],
    outputFiles: isVue
      ? ['src/App.vue', 'src/router/index.js', 'src/api/order.js', 'src/styles/workflow.css']
      : ['index.html', 'styles.css', 'main.js'],
    runtimeStates: ['默认态', '加载态', '空状态', '失败重试态', '禁用/权限态'],
    dataContracts: isVue
      ? ['页面路由参数', '接口请求参数', '接口返回结构', '错误码与空态约定']
      : ['页面本地状态', 'Mock 数据结构', '按钮点击事件', '异常提示文案'],
    acceptanceCriteria: [
      '左侧预览可运行',
      '右侧代码展示主要文件',
      '主路径点击不阻塞',
      '关键状态有可演示入口'
    ]
  }
}

function pageIdentityKeys(node = {}) {
  return uniqueTexts([
    node?.id,
    node?.sourcePageId,
    node?.pageId,
    node?.sourceNodeId,
    String(node?.id || '').startsWith('ui-') ? String(node.id).slice(3) : '',
    String(node?.id || '').startsWith('html-page-') ? String(node.id).slice('html-page-'.length) : '',
    cleanText(node?.title || '')
      .replace(/\s*(UI视觉|HTML|高保真|页面)\s*$/i, '')
  ], 12)
}

function normalizePageTitleForMatch(value = '') {
  return cleanText(value)
    .replace(/\s*(UI视觉|HTML|高保真|页面)\s*$/i, '')
    .toLowerCase()
}

function interactionNodesWithArtifacts(totalFlow = {}) {
  const nodes = totalFlow?.stageCanvases?.['interaction-lofi']?.nodes
  return (Array.isArray(nodes) ? nodes : []).filter((node) => node?.pageLayoutArtifact || node?.interactionSpecArtifact)
}

function findInteractionSourceNode(totalFlow = {}, node = {}) {
  const interactionNodes = interactionNodesWithArtifacts(totalFlow)
  if (!interactionNodes.length) return null
  const keys = new Set(pageIdentityKeys(node).filter(Boolean))
  const byKey = interactionNodes.find((sourceNode) =>
    pageIdentityKeys(sourceNode).some((key) => keys.has(key)) ||
    (sourceNode?.id && node?.id === `ui-${sourceNode.id}`) ||
    (sourceNode?.id && node?.id === `html-page-${sourceNode.id}`)
  )
  if (byKey) return byKey
  const nodeTitle = normalizePageTitleForMatch(node?.title || node?.visualBrief?.pageTitle || node?.codePreview?.previewTitle || '')
  if (!nodeTitle) return null
  return interactionNodes.find((sourceNode) => normalizePageTitleForMatch(sourceNode?.title || '') === nodeTitle) || null
}

function evidenceRefIds(artifact = {}) {
  return uniqueTexts((Array.isArray(artifact?.evidenceRefs) ? artifact.evidenceRefs : [])
    .map((ref) => typeof ref === 'string' ? ref : ref?.id || ref?.source || ref?.title), 10)
}

function sourceLayoutRegions(sourceNode = {}) {
  const regions = Array.isArray(sourceNode?.pageLayoutArtifact?.layout?.regions)
    ? sourceNode.pageLayoutArtifact.layout.regions
    : []
  return regions.map((region) => ({
    id: cleanText(region?.id),
    type: cleanText(region?.type),
    label: cleanText(region?.label),
    parentId: cleanText(region?.parentId),
    containment: cleanText(region?.containment)
  })).filter((region) => region.id || region.label).slice(0, 18)
}

function sourceStateNames(sourceNode = {}) {
  const fromInteraction = Array.isArray(sourceNode?.interactionSpecArtifact?.stateMatrix)
    ? sourceNode.interactionSpecArtifact.stateMatrix.map((state) => state?.state || state?.label || state?.id)
    : []
  const fromLayout = Array.isArray(sourceNode?.pageLayoutArtifact?.layout?.states)
    ? sourceNode.pageLayoutArtifact.layout.states.map((state) => state?.label || state?.id)
    : []
  return uniqueTexts([...fromInteraction, ...fromLayout], 8)
}

function sourceInteractionTargets(sourceNode = {}) {
  const rows = Array.isArray(sourceNode?.interactionSpecArtifact?.interactionRows)
    ? sourceNode.interactionSpecArtifact.interactionRows
    : []
  return uniqueTexts(rows.map((row) => [row?.target, row?.targetRegionId].filter(Boolean).join(' -> ')), 10)
}

function sourceRegionLabels(sourceNode = {}) {
  return uniqueTexts(sourceLayoutRegions(sourceNode).map((region) =>
    [region.label, region.id].filter(Boolean).join(' / ')
  ), 12)
}

function visualPromptFromSourceNode(sourceNode = {}, node = {}) {
  const artifact = sourceNode?.pageLayoutArtifact || {}
  const regions = sourceRegionLabels(sourceNode)
  const targets = sourceInteractionTargets(sourceNode)
  return [
    `为「${sourceNode.title || node.title || '当前页面'}」生成高保真 UI 视觉稿。`,
    '必须延续上一阶段交互低保和页面骨架，不要自由改版。',
    artifact.layout?.shell ? `布局外壳：${artifact.layout.shell}` : '',
    regions.length ? `关键区域：${regions.join('、')}` : '',
    targets.length ? `关键交互：${targets.join('、')}` : '',
    artifact.asciiWireframe ? `低保框架：${compactTextForPrompt(artifact.asciiWireframe, 900)}` : ''
  ].filter(Boolean).join('\n')
}

function compactTextForPrompt(value = '', limit = 900) {
  const text = cleanText(value).replace(/\n{3,}/g, '\n\n')
  return text.length > limit ? `${text.slice(0, limit)}\n...` : text
}

function upstreamArtifactPatch(sourceNode = {}) {
  const artifact = sourceNode?.pageLayoutArtifact || null
  const interactionSpec = sourceNode?.interactionSpecArtifact || null
  const regions = sourceLayoutRegions(sourceNode)
  return {
    ...(artifact ? { sourcePageLayoutArtifact: artifact } : {}),
    ...(interactionSpec ? { sourceInteractionSpecArtifact: interactionSpec } : {}),
    sourceStageId: 'interaction-lofi',
    sourceNodeId: sourceNode.id || '',
    sourcePageId: sourceNode.id || sourceNode.sourcePageId || '',
    upstreamPageLayoutVersion: artifact?.version || '',
    upstreamInteractionSpecVersion: interactionSpec?.version || '',
    upstreamEvidenceRefs: evidenceRefIds(artifact),
    upstreamLayoutRegions: regions
  }
}

function enrichVisualNodeWithSource(node = {}, sourceNode = {}) {
  const patch = upstreamArtifactPatch(sourceNode)
  const regionLabels = sourceRegionLabels(sourceNode)
  const states = sourceStateNames(sourceNode)
  const targets = sourceInteractionTargets(sourceNode)
  const existingBrief = node.visualBrief && typeof node.visualBrief === 'object' ? node.visualBrief : {}
  const existingPreview = node.visualPreview && typeof node.visualPreview === 'object' ? node.visualPreview : {}
  const componentChecklist = uniqueTexts([
    ...regionLabels,
    ...(Array.isArray(existingBrief.componentChecklist) ? existingBrief.componentChecklist : [])
  ], 14)
  const layoutFocus = uniqueTexts([
    `延续「${sourceNode.title || node.title || '上一阶段页面'}」交互低保`,
    sourceNode.pageLayoutArtifact?.layout?.shell ? `布局外壳：${sourceNode.pageLayoutArtifact.layout.shell}` : '',
    ...regionLabels.slice(0, 6),
    ...targets.slice(0, 4),
    ...(Array.isArray(existingBrief.layoutFocus) ? existingBrief.layoutFocus : [])
  ], 14)
  const imagePrompt = visualPromptFromSourceNode(sourceNode, node)
  return {
    ...node,
    ...patch,
    content: uniqueTexts([
      `上游低保：${sourceNode.title || '交互低保页面'} 已继承`,
      ...(Array.isArray(node.content) ? node.content : [])
    ], 10),
    detailSections: [
      {
        title: '上游页面骨架',
        items: regionLabels.length ? regionLabels : ['已继承交互低保页面骨架'],
        sourceStageId: 'interaction-lofi'
      },
      {
        title: '上游交互绑定',
        items: targets.length ? targets : ['等待上游交互行补齐'],
        sourceStageId: 'interaction-lofi'
      },
      ...(Array.isArray(node.detailSections) ? node.detailSections.filter((section) => !/上游页面骨架|上游交互绑定/.test(section?.title || '')) : [])
    ],
    visualBrief: {
      ...existingBrief,
      pageTitle: sourceNode.title || existingBrief.pageTitle || node.title,
      goal: `基于「${sourceNode.title || existingBrief.pageTitle || node.title || '当前页面'}」交互低保生成 UI 视觉，必须延续页面区域、控件层级、状态和交互绑定。`,
      layoutFocus,
      componentChecklist,
      stateShots: uniqueTexts([
        ...states,
        ...(Array.isArray(existingBrief.stateShots) ? existingBrief.stateShots : [])
      ], 10),
      evidenceRefs: patch.upstreamEvidenceRefs,
      sourcePageLayoutVersion: patch.upstreamPageLayoutVersion,
      sourceInteractionSpecVersion: patch.upstreamInteractionSpecVersion
    },
    visualPreview: {
      ...existingPreview,
      imagePrompt: existingPreview.imageStatus === 'generated' && existingPreview.imagePrompt
        ? existingPreview.imagePrompt
        : imagePrompt,
      sourcePageId: patch.sourcePageId,
      sourceNodeId: patch.sourceNodeId,
      layoutVersion: patch.upstreamPageLayoutVersion,
      evidenceRefs: patch.upstreamEvidenceRefs
    }
  }
}

function enrichCodeNodeWithSource(node = {}, sourceNode = {}, kind = 'html') {
  const patch = upstreamArtifactPatch(sourceNode)
  const regions = sourceRegionLabels(sourceNode)
  const targets = sourceInteractionTargets(sourceNode)
  const existingPlan = node.engineeringPlan && typeof node.engineeringPlan === 'object' ? node.engineeringPlan : engineeringPlanArtifact(kind)
  const existingPreview = node.codePreview && typeof node.codePreview === 'object' ? node.codePreview : codePreviewArtifact(kind)
  return {
    ...node,
    ...patch,
    content: uniqueTexts([
      `上游低保：${sourceNode.title || '交互低保页面'} 已继承`,
      ...(Array.isArray(node.content) ? node.content : [])
    ], 10),
    detailSections: [
      {
        title: '上游页面骨架',
        items: regions.length ? regions : ['已继承交互低保页面骨架'],
        sourceStageId: 'interaction-lofi'
      },
      {
        title: '上游交互绑定',
        items: targets.length ? targets : ['等待上游交互行补齐'],
        sourceStageId: 'interaction-lofi'
      },
      ...(Array.isArray(node.detailSections) ? node.detailSections.filter((section) => !/上游页面骨架|上游交互绑定/.test(section?.title || '')) : [])
    ],
    codePreview: {
      ...existingPreview,
      previewSummary: `基于「${sourceNode.title || node.title || '当前页面'}」交互低保、UI视觉和状态说明生成。`
    },
    engineeringPlan: {
      ...existingPlan,
      inputArtifacts: uniqueTexts([
        `${sourceNode.title || '当前页面'} pageLayoutArtifact ${patch.upstreamPageLayoutVersion || ''}`.trim(),
        ...regions,
        ...targets,
        ...(Array.isArray(existingPlan.inputArtifacts) ? existingPlan.inputArtifacts : [])
      ], 16),
      dataContracts: uniqueTexts([
        ...(Array.isArray(existingPlan.dataContracts) ? existingPlan.dataContracts : []),
        '页面区域 id、控件 targetRegionId、状态矩阵和异常恢复规则'
      ], 12)
    }
  }
}

function vueUpstreamContracts(totalFlow = {}) {
  return interactionNodesWithArtifacts(totalFlow).map((sourceNode) => ({
    pageId: sourceNode.id || sourceNode.sourcePageId || '',
    pageTitle: sourceNode.title || '',
    layoutVersion: sourceNode.pageLayoutArtifact?.version || '',
    interactionSpecVersion: sourceNode.interactionSpecArtifact?.version || '',
    evidenceRefs: evidenceRefIds(sourceNode.pageLayoutArtifact),
    regions: sourceLayoutRegions(sourceNode).map((region) => region.id || region.label).filter(Boolean),
    interactions: sourceInteractionTargets(sourceNode)
  }))
}

function enrichVueNodeWithSources(node = {}, totalFlow = {}) {
  const contracts = vueUpstreamContracts(totalFlow)
  if (!contracts.length) return node
  const existingPlan = node.engineeringPlan && typeof node.engineeringPlan === 'object' ? node.engineeringPlan : engineeringPlanArtifact('vue')
  return {
    ...node,
    upstreamPageContracts: contracts,
    engineeringPlan: {
      ...existingPlan,
      inputArtifacts: uniqueTexts([
        ...contracts.map((contract) => `${contract.pageTitle} ${contract.layoutVersion}`.trim()),
        ...(Array.isArray(existingPlan.inputArtifacts) ? existingPlan.inputArtifacts : [])
      ], 16),
      dataContracts: uniqueTexts([
        ...(Array.isArray(existingPlan.dataContracts) ? existingPlan.dataContracts : []),
        '从 interaction-lofi 继承 pageLayoutArtifact、interactionSpecArtifact、区域 id 和状态矩阵'
      ], 12)
    }
  }
}

export function withDownstreamStageArtifactContext(totalFlow = {}) {
  if (!totalFlow || typeof totalFlow !== 'object' || !totalFlow.stageCanvases) return totalFlow
  const hasSources = interactionNodesWithArtifacts(totalFlow).length > 0
  if (!hasSources) return totalFlow
  const stageCanvases = { ...(totalFlow.stageCanvases || {}) }
  const visualCanvas = stageCanvases['ui-visual']
  if (Array.isArray(visualCanvas?.nodes)) {
    stageCanvases['ui-visual'] = {
      ...visualCanvas,
      nodes: visualCanvas.nodes.map((node) => {
        const sourceNode = findInteractionSourceNode(totalFlow, node)
        return sourceNode ? enrichVisualNodeWithSource(node, sourceNode) : node
      })
    }
  }
  const htmlCanvas = stageCanvases['html-output']
  if (Array.isArray(htmlCanvas?.nodes)) {
    stageCanvases['html-output'] = {
      ...htmlCanvas,
      nodes: htmlCanvas.nodes.map((node) => {
        if (node.htmlOutputKind === 'total-interactive' || /总交互/.test(node.title || '')) return node
        const sourceNode = findInteractionSourceNode(totalFlow, node)
        return sourceNode ? enrichCodeNodeWithSource(node, sourceNode, 'html') : node
      })
    }
  }
  const vueCanvas = stageCanvases['vue-output']
  if (Array.isArray(vueCanvas?.nodes)) {
    stageCanvases['vue-output'] = {
      ...vueCanvas,
      nodes: vueCanvas.nodes.map((node) => enrichVueNodeWithSources(node, totalFlow))
    }
  }
  return {
    ...totalFlow,
    stageCanvases
  }
}

function htmlCodePreviewArtifactForPage(page = {}, index = 0) {
  const title = page.title || `页面 ${index + 1}`
  return {
    ...codePreviewArtifact('html'),
    previewTitle: `${title} HTML 运行预览`,
    previewSummary: `生成后在这里预览「${title}」的独立页面 HTML。`,
    filePath: `pages/${page.id || `page-${index + 1}`}.html`
  }
}

function htmlEngineeringPlanForPage(page = {}, index = 0) {
  const plan = engineeringPlanArtifact('html')
  return {
    ...plan,
    previewTarget: 'page-html',
    inputArtifacts: [
      `${page.title || `页面 ${index + 1}`} 交互低保`,
      `${page.title || `页面 ${index + 1}`} UI视觉稿`,
      '当前页状态、跳转和验收点'
    ],
    outputFiles: [
      `pages/${page.id || `page-${index + 1}`}.html`,
      'styles/page.css',
      'scripts/page.js'
    ]
  }
}

function htmlPageNode(page = {}, index = 0, analysis = {}, contentStatus = resolveContentStatus(analysis), pages = []) {
  const pageTitle = page.title || `页面 ${index + 1}`
  const pageId = page.id || `page-${index + 1}`
  const nodeOptions = {
    analysis,
    contentStatus,
    modelNodes: modelStageNodeMap(analysis),
    sourcePageId: page.sourcePageId || pageId,
    sliceId: page.sliceId
  }
  return {
    ...stageCanvasNode('html-output', `html-page-${pageId}`, `${pageTitle} HTML`, `生成「${pageTitle}」的独立页面 HTML。`, [
      `输入：${pageTitle} 的交互低保、UI视觉稿和状态说明`,
      '输出：独立页面 HTML、局部样式和页面脚本',
      '验收：当前页面可运行、可点击、状态可演示'
    ], index, [
      stageDetailSection('页面输入', [
        `${pageTitle} 交互低保`,
        `${pageTitle} UI视觉`,
        '页面级状态和跳转关系'
      ]),
      stageDetailSection('页面产物', [
        `pages/${pageId}.html`,
        '局部样式',
        '当前页交互脚本'
      ]),
      stageDetailSection('验收点', [
        '页面独立打开不空白',
        '主操作和异常状态可演示',
        '图片、文字、按钮不变形不遮挡'
      ])
    ], ['生成 HTML', '下载 HTML'], nodeOptions),
    htmlOutputKind: 'page',
    detailLayout: 'preview-code-split',
    targetGenerator: 'html',
    artifactStatus: 'pending',
    generationActions: [
      generationAction(`generate-html-${pageId}`, '生成 HTML', `根据「${pageTitle}」生成独立 HTML 页面。`, 'html')
    ],
    codePreview: htmlCodePreviewArtifactForPage(page, index),
    engineeringPlan: htmlEngineeringPlanForPage(page, index)
  }
}

function htmlTotalInteractiveNode(pages = [], analysis = {}, contentStatus = resolveContentStatus(analysis)) {
  const nodeOptions = { analysis, contentStatus, modelNodes: modelStageNodeMap(analysis) }
  const pageTitles = pages.map((page) => page.title).filter(Boolean)
  return {
    ...stageCanvasNode('html-output', 'html-total-preview', '总交互 HTML 预览', '把每个页面 HTML 串成可点击的总交互 Demo。', [
      '输入：所有页面级 HTML 产物、页面跳转关系、状态说明',
      '输出：index.html 总入口、页面路由/锚点、可演示主路径',
      `覆盖页面：${pageTitles.slice(0, 6).join('、') || '当前页面'}${pageTitles.length > 6 ? ' 等' : ''}`
    ], pages.length, [
      stageDetailSection('总入口', ['index.html 汇总导航', '主路径页面串联', '跨页状态与返回路径']),
      stageDetailSection('页面清单', pageTitles.length ? pageTitles : ['等待页面级 HTML 产物']),
      stageDetailSection('验收点', ['可从入口走完整主路径', '页面切换不丢状态', '异常和空态可演示'])
    ], ['生成总交互 HTML', '下载 HTML'], nodeOptions),
    htmlOutputKind: 'total-interactive',
    detailLayout: 'preview-code-split',
    targetGenerator: 'html',
    artifactStatus: 'pending',
    generationActions: [
      generationAction('generate-html-total', '生成总交互 HTML', '根据页面级 HTML 和跳转关系生成总交互 Demo。', 'html')
    ],
    codePreview: {
      ...codePreviewArtifact('html'),
      previewTitle: '总交互 HTML 运行预览',
      previewSummary: '生成后在这里预览可点击的总交互 Demo。',
      filePath: 'index.html'
    },
    engineeringPlan: {
      ...engineeringPlanArtifact('html'),
      previewTarget: 'interactive-html',
      inputArtifacts: ['页面级 HTML', '页面跳转关系', '状态机和异常恢复'],
      outputFiles: ['index.html', 'styles/app.css', 'scripts/router.js']
    },
    linkedPageIds: pages.map((page) => page.id).filter(Boolean)
  }
}

function acceptanceArtifact(productName = '当前需求', pages = [], requirementSlices = [], requirementDissectionArtifact = {}) {
  const acceptanceBasis = requirementDissectionArtifact?.acceptanceBasis || {}
  const businessRules = requirementDissectionArtifact?.businessRuleMatrix?.rules || []
  const pageStates = requirementDissectionArtifact?.stateMachineMap?.pageStates || []
  const globalStates = requirementDissectionArtifact?.stateMachineMap?.globalStates || []
  const permissionOperations = requirementDissectionArtifact?.permissionMatrix?.operations || []
  const boundaryConditions = requirementDissectionArtifact?.boundaryConditionMatrix || []
  const acceptanceChecklist = [
    `${productName} 主流程可以从入口走到完成态`,
    '每个页面都有加载、空、失败、权限或禁用状态说明',
    '页面跳转、接口依赖和验收点已对齐',
    'HTML/Vue 产物可预览、可交付、可回归',
    ...listFromValues(acceptanceBasis.functional, [], 6)
  ]
  const ruleAcceptance = (businessRules.length ? businessRules : [{ category: '业务规则', rule: '页面目标、主操作、数据依赖和状态反馈需要可追溯到需求分析。', verification: '检查页面覆盖矩阵、交互说明和验收点是否一致。' }])
    .slice(0, 10)
    .map((rule, index) => ({
      id: cleanText(rule.id || `rule-acceptance-${index + 1}`),
      title: `${rule.category || '业务规则'}：${rule.rule || rule.title || `规则 ${index + 1}`}`,
      expected: cleanText(rule.verification || '可通过页面状态、接口返回和用户操作路径验证'),
      priority: cleanText(rule.priority || 'P1'),
      sourceRef: 'businessRuleMatrix'
    }))
  const stateAcceptance = [
    ...globalStates.map((state, index) => ({
      id: `global-state-acceptance-${index + 1}`,
      title: cleanText(state.state || state.display || `全局状态 ${index + 1}`),
      expected: cleanText(state.display || state.recovery || '状态需要有用户可见反馈和恢复动作。'),
      sourceRef: 'stateMachineMap'
    })),
    ...pageStates.slice(0, 8).map((row, index) => ({
      id: `page-state-acceptance-${index + 1}`,
      title: `${row.pageName || `页面 ${index + 1}`}：${listFromValues(row.states, ['默认', '加载', '失败'], 4).join(' / ')}`,
      expected: '状态切换、按钮可用性、loading、失败和完成态可验证。',
      sourceRef: 'stateMachineMap'
    }))
  ].slice(0, 14)
  const nonFunctionalAcceptance = uniqueTexts([
    ...listFromValues(acceptanceBasis.nonFunctional, [], 8),
    '关键接口失败可重试且不丢失用户输入。',
    '页面信息层级在移动端和桌面端基本可读。',
    '权限、错误、空态不能只依赖颜色表达。'
  ], 10).map((item, index) => ({
    id: `non-functional-${index + 1}`,
    title: item,
    expected: '在 UI/HTML/Vue 产物中可观察、可复现、可回归。',
    sourceRef: 'acceptanceBasis'
  }))
  const riskItems = [
    '待确认问题未关闭会影响页面范围',
    '项目知识库未同步会导致原流程改动点不准确',
    '视觉稿或代码生成后需要人工验收关键路径',
    ...boundaryConditions.slice(0, 4).map((row) => `${row.scenario || '边界条件'}：${row.recoveryPath || row.expectedBehavior || '需要确认恢复路径'}`)
  ]
  const knowledgeDeposits = [
    '需求背景与本期目标',
    '页面原流程与本次改动入口',
    '交互决策、异常处理和接口约束',
    '业务规则、状态机、权限矩阵与边界条件',
    '验收结论与后续可复用知识'
  ]
  const sliceCount = Array.isArray(requirementSlices) && requirementSlices.length ? requirementSlices.length : 1
  const pageCount = Array.isArray(pages) && pages.length ? pages.length : 1
  return {
    deliveryPackage: {
      summary: `${productName} 已汇总为可交付闭环：从需求分析，到页面级交互低保、UI视觉、HTML/Vue 产物和验收知识沉淀。`,
      metrics: [
        { label: '需求切片', value: String(sliceCount), hint: '本次拆解后可独立跟进的小需求数量' },
        { label: '页面节点', value: String(pageCount), hint: '交互低保阶段覆盖的页面画布数量' },
        { label: '验收项', value: String(acceptanceChecklist.length + ruleAcceptance.length + stateAcceptance.length), hint: '上线前需要逐项确认的检查点' },
        { label: '知识条目', value: String(knowledgeDeposits.length), hint: '可沉淀到项目知识库的复用内容' }
      ],
      artifacts: [
        '需求分析与切片线索',
        '业务规则矩阵',
        '状态机',
        '权限矩阵',
        '非功能验收',
        '页面级交互低保',
        'UI视觉生成任务',
        'HTML/Vue工程产物',
        '验收清单与知识库沉淀'
      ]
    },
    acceptanceChecklist,
    ruleAcceptance,
    stateAcceptance,
    nonFunctionalAcceptance,
    permissionAcceptance: permissionOperations.slice(0, 8).map((row) => `${row.pageName}：${row.operation} / ${row.deniedBehavior}`),
    riskItems,
    knowledgeDeposits
  }
}

function interactionPageNode(page = {}, index = 0, analysis = {}, contentStatus = resolveContentStatus(analysis), pages = []) {
  const nodeId = page.nodeId || page.id
  // interaction-lofi cards are generated page results. Keep the page artifact on
  // the node so card preview, fullscreen detail, and Agent context all read the
  // same model/backend-owned structure.
  const pageLayoutArtifact = pageLayoutArtifactForPage(page, analysis)
  const interactionSpecArtifact = interactionSpecArtifactForPage(page, index, pages)
  const interactionHotspots = pageInteractionHotspots(page, index, pages)
  const content = [
    pageLayoutArtifact ? '页面骨架已生成：模型结构化布局 + 旧 ASCII renderer 线框。' : '',
    `页面目标：${page.detailSections?.find((section) => section.title === '页面目标')?.items?.[0] || `明确 ${page.title} 的职责。`}`,
    `用户动作：${interactionHotspots.slice(0, 3).map((item) => item.target).join('、') || '点击主按钮、返回上一步、处理异常提示'}`,
    '跳转关系：按主路径进入下一页面或回到上一页面',
    '状态覆盖：加载、空状态、失败、权限'
  ].filter(Boolean)
  const nodeOptions = {
    analysis,
    contentStatus,
    modelNodes: modelStageNodeMap(analysis),
    sourcePageId: page.sourcePageId || page.id,
    sliceId: page.sliceId
  }
  return {
    ...stageCanvasNode('interaction-lofi', nodeId, page.title, page.summary || `${page.title} 的页面级交互节点。`, content, index, [
      ...(page.detailSections || []),
      stageDetailSection('页面架构图', interactionWireframeTree(page, index, pages).map((item) => item.label)),
      stageDetailSection('交互说明', interactionSpec(page, index, pages))
    ], ['给布局方案', '补交互细节', '重生成本页'], nodeOptions),
    detailLayout: 'interaction-page-split',
    ...(page.interactionRole ? { interactionRole: page.interactionRole } : {}),
    ...(Array.isArray(page.relatedSliceIds) && page.relatedSliceIds.length ? { relatedSliceIds: page.relatedSliceIds } : {}),
    ...(Array.isArray(page.relatedRequirementRules) && page.relatedRequirementRules.length ? { relatedRequirementRules: page.relatedRequirementRules } : {}),
    ...(Array.isArray(page.relatedDecisionPoints) && page.relatedDecisionPoints.length ? { relatedDecisionPoints: page.relatedDecisionPoints } : {}),
    ...(Array.isArray(page.relatedExceptions) && page.relatedExceptions.length ? { relatedExceptions: page.relatedExceptions } : {}),
    ...(page.relatedDataFlow ? { relatedDataFlow: page.relatedDataFlow } : {}),
    ...(page.relatedStateMachine ? { relatedStateMachine: page.relatedStateMachine } : {}),
    ...(Array.isArray(page.relatedJumpEdges) && page.relatedJumpEdges.length ? { relatedJumpEdges: page.relatedJumpEdges } : {}),
    ...(pageLayoutArtifact ? { pageLayoutArtifact } : {}),
    interactionHotspots,
    interactionSpecArtifact,
    wireframeTree: interactionWireframeTree(page, index, pages),
    interactionSpec: interactionSpec(page, index, pages),
    pageArchitecture: pageArchitecture(page, index, pages),
    interactionDetails: interactionDetails(page, index, pages)
  }
}

function buildStageCanvases(analysis = {}, requirementSlices = [], pages = [], projectFunctionMap = null, requirementDissectionArtifact = null, modelOnlyRequirementDissectionArtifact = null) {
  const blueprint = analysis.blueprint || {}
  const productName = blueprint.profile?.productName || blueprint.title || '当前需求'
  const questions = pendingQuestions(analysis)
  const contentStatus = resolveContentStatus(analysis)
  const nodeOptions = { analysis, contentStatus, modelNodes: modelStageNodeMap(analysis) }
  const acceptance = acceptanceArtifact(productName, pages, requirementSlices, requirementDissectionArtifact)
  const requirementDisplayArtifact = modelOnlyRequirementDissectionArtifact || modelOnlyRequirementDissectionArtifactForAnalysis(analysis)
  const requirementNodeOptions = {
    ...nodeOptions,
    contentStatus: requirementDisplayArtifact?.__modelOnly ? 'model-generated' : contentStatus,
    modelNodes: new Map()
  }
  const requirementCards = requirementDissectionCards(requirementDisplayArtifact || requirementDissectionArtifact || {})
  const baseCanvases = {
    'requirement-dissection': stageCanvasFromNodes(
      requirementCards.map((card, index) =>
        ({
          ...stageCanvasNode('requirement-dissection', card.id, card.title, card.summary, card.content, index, card.sections, card.quickActions || [], requirementNodeOptions),
          requirementPipelineTabId: card.requirementPipelineTabId,
          detailBlocks: card.detailBlocks || [],
          requirementDissectionArtifact,
          ...(requirementDisplayArtifact ? { modelOnlyRequirementDissectionArtifact: requirementDisplayArtifact } : {}),
        })
      ),
      {
        mode: 'stage-agent-workbench',
        agentWorkbench: true,
        agentNode: {
          ...requirementDissectionAgentNode(analysis, requirementSlices, questions, projectFunctionMap, requirementDisplayArtifact || requirementDissectionArtifact),
          requirementDissectionArtifact,
          ...(requirementDisplayArtifact ? { modelOnlyRequirementDissectionArtifact: requirementDisplayArtifact } : {})
        }
      }
    ),
    'interaction-lofi': stageCanvasFromNodes(pages.map((page, index) => interactionPageNode(page, index, analysis, contentStatus, pages))),
    'ui-visual': stageCanvasFromNodes(pages.map((page, index) =>
      ({
        // UI visual nodes are generation targets derived from the page flow.
        // They provide preview/status/actions; the actual image is produced later
        // through generationActions and patched back onto the same stage node.
        ...stageCanvasNode('ui-visual', `ui-${page.id}`, `${page.title} UI视觉`, '定义视觉层级、组件、状态和风格。', [
        '视觉重点：信息层级、主按钮、卡片/列表/表单状态',
        '组件：导航、商品卡、状态提示、底部操作栏',
        '状态：默认、加载、空、失败、禁用'
        ], index, [
          stageDetailSection('高保真图片', ['可通过 Agent 调用 gpt-image-2 生成页面视觉稿', '后续可接 Figma 页面生成与编辑']),
          stageDetailSection('视觉目标', [`让「${page.title}」符合业务场景并可直接进入高保真设计。`]),
          stageDetailSection('组件建议', ['按钮', '卡片', '列表', '弹窗/抽屉', 'Toast/状态条'])
        ], ['生成视觉', '补组件'], { ...nodeOptions, sourcePageId: page.id, sliceId: page.sliceId }),
        detailLayout: 'visual-gallery',
        targetGenerator: 'gpt-image-2',
        artifactStatus: 'pending',
        generationActions: [
          generationAction('generate-visual', '生成高保真图', '调用视觉模型生成当前页面高保真图。', 'gpt-image-2')
        ],
        visualPreview: visualPreviewForPage(page),
        visualBrief: visualBriefForPage(page)
      })
    )),
    'html-output': stageCanvasFromNodes([
      ...pages.map((page, index) => htmlPageNode(page, index, analysis, contentStatus, pages)),
      htmlTotalInteractiveNode(pages, analysis, contentStatus)
    ]),
    'vue-output': stageCanvasFromNodes([
      {
        ...stageCanvasNode('vue-output', 'vue-app', 'Vue 页面', '把 HTML/视觉方案拆成可维护 Vue 工程。', [
        '输入：HTML Demo、页面状态、接口依赖',
        '输出：Vue 组件、路由、状态管理、Mock 数据',
        '验收：组件边界清晰，接口契约明确'
        ], 0, [
          stageDetailSection('左侧预览', ['展示 Vue 开发出来的运行效果']),
          stageDetailSection('右侧代码', ['展示组件、路由、状态和 API 代码']),
          stageDetailSection('前后端依赖', ['接口路径', '请求参数', '返回结构', '错误码'])
        ], ['导出 Vue', '下载源码'], nodeOptions),
        detailLayout: 'preview-code-split',
        targetGenerator: 'vue',
        artifactStatus: 'pending',
        generationActions: [
          generationAction('generate-vue', '生成 Vue', '根据已确认页面和 HTML 结构生成 Vue 工程。', 'vue')
        ],
        codePreview: codePreviewArtifact('vue'),
        engineeringPlan: engineeringPlanArtifact('vue')
      }
    ]),
    'acceptance-deposit': stageCanvasFromNodes([
      {
        ...stageCanvasNode('acceptance-deposit', 'acceptance-checklist', '验收清单', '把阶段产物转成测试和评审项。', [
        '需求分析已确认',
        '页面跳转完整',
        '异常状态可恢复',
        'HTML/Vue 可交付'
        ], 0, [
          stageDetailSection('验收清单', acceptance.acceptanceChecklist),
          stageDetailSection('业务规则验收', acceptance.ruleAcceptance.map((item) => `${item.title}：${item.expected}`)),
          stageDetailSection('状态流验收', acceptance.stateAcceptance.map((item) => `${item.title}：${item.expected}`)),
          stageDetailSection('非功能验收', acceptance.nonFunctionalAcceptance.map((item) => `${item.title}：${item.expected}`)),
          stageDetailSection('风险项', acceptance.riskItems),
          stageDetailSection('知识库沉淀内容', acceptance.knowledgeDeposits)
        ], ['保存验收', '沉淀知识库'], nodeOptions),
        detailLayout: 'acceptance-deposit',
        ...acceptance
      },
      {
        ...stageCanvasNode('acceptance-deposit', 'knowledge-deposit', '知识沉淀', '把本次确认结果沉淀为下次项目上下文。', [
        '沉淀项目知识库',
        '关联需求文档',
        '保留版本历史'
        ], 1, [
          stageDetailSection('沉淀内容', acceptance.knowledgeDeposits)
        ], ['沉淀知识库'], nodeOptions),
        detailLayout: 'acceptance-deposit',
        ...acceptance
      }
    ])
  }
  return Object.fromEntries(Object.entries(baseCanvases).map(([stageId, canvas]) => [
    stageId,
    modelStageCanvasFromAnalysis(analysis, stageId, pages, acceptance) || canvas
  ]))
}

function stageCanvasesToPages(stageCanvases = {}, fallbackPages = []) {
  return Object.fromEntries(Object.entries(stageCanvases).map(([stageId, canvas]) => [
    stageId,
    isAgentWorkbenchStage(stageId) ? [] : (canvas.nodes || []).map((node, index) => ({
      id: node.sourcePageId || `${stageId}-page-${index + 1}`,
      nodeId: node.id,
      sliceId: node.sliceId || node.sourceSliceId || `${stageId}-slice`,
      sourcePageId: node.sourcePageId || '',
      stageId,
      title: node.title,
      summary: node.summary,
      statusCount: (node.detailSections || []).filter((section) => /状态|异常|权限|加载|失败|空|验收/.test(section.title || '')).length,
      pendingQuestionCount: (node.detailSections || []).filter((section) => /待确认/.test(section.title || '')).length
    }))
  ]))
}

export function buildTotalDesignFlow(analysis = {}) {
  const requirementSlices = requirementSlicesForAnalysis(analysis)
  const activeSliceId = requirementSlices[0]?.id || ''
  const pages = attachInteractionRuleSlicesToPages(pagesForAnalysis(analysis, activeSliceId, requirementSlices), requirementSlices)
  if (requirementSlices[0]) requirementSlices[0].pageCount = pages.length
  const contentStatus = resolveContentStatus(analysis)
  const projectFunctionMap = projectFunctionMapForAnalysis(analysis, requirementSlices, pages)
  const requirementDissectionArtifact = requirementDissectionArtifactForAnalysis(analysis, requirementSlices, pages, projectFunctionMap)
  const modelOnlyRequirementDissectionArtifact = modelOnlyRequirementDissectionArtifactForAnalysis(analysis)
  const pagesWithRequirementContext = attachRequirementRowsToPages(pages, requirementDissectionArtifact)
  const stageCanvases = buildStageCanvases(analysis, requirementSlices, pagesWithRequirementContext, projectFunctionMap, requirementDissectionArtifact, modelOnlyRequirementDissectionArtifact)
  const stageSlices = Object.fromEntries(TOTAL_DESIGN_FLOW_STAGES.map((stage) => [stage.id, buildStageSlices(stage.id, requirementSlices)]))
  const stagePagesFromCanvases = stageCanvasesToPages(stageCanvases, pagesWithRequirementContext)
  const hasModelInteractionCanvas = Boolean(modelStageCanvasForAnalysis(analysis, 'interaction-lofi'))
  const stagePages = {
    ...stagePagesFromCanvases,
    'interaction-lofi': hasModelInteractionCanvas && stagePagesFromCanvases['interaction-lofi']?.length
      ? stagePagesFromCanvases['interaction-lofi']
      : buildStagePages('interaction-lofi', pages, stageSlices['interaction-lofi'])
  }

  const totalFlow = {
    runId: analysis.analysisRunId || analysis.requestId || '',
    currentStage: TOTAL_DESIGN_FLOW_STAGES[0]?.id || 'requirement-dissection',
    contentStatus,
    contentStatusLabel: contentStatusLabel(contentStatus),
    stages: TOTAL_DESIGN_FLOW_STAGES,
    requirementSlices,
    requirementDissectionArtifact,
    modelOnlyRequirementDissectionArtifact,
    projectFunctionMap,
    activeSliceId,
    stageCanvases,
    stageSlices,
    stagePages,
    flows: requirementSlices.map((item) => ({
      id: `${item.id}-flow`,
      sliceId: item.id,
      title: item.title,
      pageIds: item.id === activeSliceId ? pagesWithRequirementContext.map((page) => page.id) : []
    })),
    pages: pagesWithRequirementContext,
    pageStates: [],
    edges: analysis.canvas?.edges || [],
    visualSpecs: [],
    codeArtifacts: [],
    details: detailsForPages(pagesWithRequirementContext, detailsForNodes(analysis.canvas?.nodes || [])),
    knowledgeRefs: [],
    knowledgeDeposits: [],
    versions: analysis.versions || []
  }
  const advancedUxTotalFlow = withAdvancedUxGeneratingState(totalFlow, analysis)
  const enrichedTotalFlow = withDownstreamStageArtifactContext(advancedUxTotalFlow)
  return {
    ...enrichedTotalFlow,
    stageRuntime: buildWorkflowStageRuntime(enrichedTotalFlow)
  }
}
