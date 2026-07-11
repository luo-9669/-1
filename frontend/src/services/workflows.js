function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function nowIso() {
  return new Date().toISOString()
}

const demandFourStep = {
  id: 'demand-four-step',
  name: '需求拆解四步法',
  assetType: '需求拆解文档',
  description: '从模糊需求进入需求补全、结构化拆解、方案生成和质量校验。',
  steps: [
    {
      id: 'requirement-completion',
      title: 'Step 1：需求补全',
      goal: '识别用户、业务背景、五问法答案和核心场景。',
      requiredFields: ['主要用户', '业务目标', '成功标准'],
      outputTitle: '需求补全结果'
    },
    {
      id: 'structure-breakdown',
      title: 'Step 2：结构化拆解',
      goal: '拆成 Epic、Feature、User Story、优先级和依赖关系。',
      requiredFields: ['Epic', '核心功能'],
      outputTitle: '结构化拆解结果'
    },
    {
      id: 'solution-options',
      title: 'Step 3：方案生成',
      goal: '生成 MVP、完整方案和风险最低方案。',
      requiredFields: ['推荐方向'],
      outputTitle: '方案对比'
    },
    {
      id: 'quality-validation',
      title: 'Step 4：质量校验',
      goal: '用 INVEST、验收标准、异常场景和逆向回溯校验需求可靠性。',
      requiredFields: ['验收标准'],
      outputTitle: '质量校验结果'
    }
  ]
}

const demandCardFlow = {
  id: 'demand-card-flow',
  name: '需求拆解卡片流',
  assetType: '需求拆解卡片资产',
  description: '用卡片式 AI 工作流完成需求理解、质疑、场景拆解、方案生成、交互转化和质量校验。',
  recommendedFor: ['需求拆解', '模糊需求', '交互设计', 'AI 工作流'],
  steps: [
    {
      id: 'card-requirement-understanding',
      title: 'Step 1：需求理解',
      goal: '明确当前理解、目标用户、业务目标、成功标准和缺失信息。',
      requiredFields: ['目标用户', '原始目标'],
      outputTitle: '需求理解'
    },
    {
      id: 'card-requirement-challenge',
      title: 'Step 2：需求质疑',
      goal: '指出需求不清楚的问题、冲突点、风险和关键追问。',
      requiredFields: ['关键疑点', '主要风险'],
      outputTitle: '需求质疑'
    },
    {
      id: 'card-scenario-breakdown',
      title: 'Step 3：场景拆解',
      goal: '拆解用户场景、主流程、异常流程和边界条件。',
      requiredFields: ['核心场景', '异常场景'],
      outputTitle: '场景拆解'
    },
    {
      id: 'card-solution-generation',
      title: 'Step 4：方案生成',
      goal: '生成 MVP、完整方案和低风险方案。',
      requiredFields: ['推荐方向'],
      outputTitle: '方案生成'
    },
    {
      id: 'card-interaction-transform',
      title: 'Step 5：交互转化',
      goal: '转成页面结构、核心组件、关键状态和反馈机制。',
      requiredFields: ['关键页面', '核心组件'],
      outputTitle: '交互转化'
    },
    {
      id: 'card-quality-validation',
      title: 'Step 6：质量校验',
      goal: '输出验收标准、风险清单、待确认问题和开发任务。',
      requiredFields: ['验收标准', '待确认问题'],
      outputTitle: '质量校验'
    }
  ]
}

const eightModuleFuzzyArchitectureFlow = {
  id: 'eight-module-fuzzy-architecture',
  name: '8模块模糊架构',
  assetType: '模糊需求8模块归档',
  description: '把模糊产品想法拆成需求理解、合理假设、目标用户、JTBD、主路径、功能范围、待确认问题和页面结构。',
  recommendedFor: ['模糊需求', '需求归档', '产品方案', 'MVP 范围', '页面结构'],
  steps: [
    {
      id: 'eight-requirement-understanding',
      title: 'Step 1：需求理解',
      goal: '复盘用户原始需求、表层诉求，并盘点角色、终端、场景、付费、边界和合规缺口。',
      requiredFields: ['用户原始需求', '表层诉求'],
      outputTitle: '需求理解'
    },
    {
      id: 'eight-reversible-assumptions',
      title: 'Step 2：合理假设',
      goal: '提出可推翻修改的基础落地假设、体验增值假设和边界禁区假设。',
      requiredFields: ['基础落地假设'],
      outputTitle: '合理假设'
    },
    {
      id: 'eight-target-users',
      title: 'Step 3：目标用户',
      goal: '区分核心用户、次要用户和排斥用户，明确产品先服务谁、不服务谁。',
      requiredFields: ['核心用户'],
      outputTitle: '目标用户'
    },
    {
      id: 'eight-core-jtbd',
      title: 'Step 4：核心 JTBD',
      goal: '把需求转成用户要完成的功能型任务和希望获得的情绪型结果。',
      requiredFields: ['功能型JTBD'],
      outputTitle: '核心JTBD'
    },
    {
      id: 'eight-main-path',
      title: 'Step 5：主路径草案',
      goal: '梳理新用户首次路径和老用户复用路径。',
      requiredFields: ['新用户首次路径'],
      outputTitle: '主路径草案'
    },
    {
      id: 'eight-scope',
      title: 'Step 6：P0/P1功能范围',
      goal: '拆出 P0 必做上线、P1 二期迭代、P2 远期规划和本期禁区。',
      requiredFields: ['P0必做上线'],
      outputTitle: 'P0/P1功能范围'
    },
    {
      id: 'eight-confirmation-questions',
      title: 'Step 7：待确认问题',
      goal: '输出 3-5 个会影响方向、范围或交付的关键确认问题。',
      requiredFields: ['待确认问题'],
      outputTitle: '待确认问题'
    },
    {
      id: 'eight-page-structure',
      title: 'Step 8：初版页面结构',
      goal: '整理游客端页面、登录用户页面和二级功能模块。',
      requiredFields: ['游客端页面'],
      outputTitle: '初版页面结构'
    }
  ]
}

const fiveStageClientConsensusFlow = {
  id: 'five-stage-client-c-consensus-breakdown',
  name: '5阶甲方C端共识拆解方案',
  assetType: '甲方C端共识方案',
  description: '面向甲方沟通，把 C 端模糊需求拆成共情复盘、可控共识、人群价值、最小闭环和双向确认。',
  recommendedFor: ['甲方沟通', 'C端产品', '共识确认', '最小闭环', '交付范围'],
  steps: [
    {
      id: 'five-empathy-recap',
      title: 'Step 1：需求共情复盘',
      goal: '复刻甲方原话，翻译底层意图，并温和列出信息缺口。',
      requiredFields: ['原话复刻', '底层意图'],
      outputTitle: '需求共情复盘'
    },
    {
      id: 'five-consensus-presets',
      title: 'Step 2：可控共识预设',
      goal: '建立通用行业共识、本次临时限定和本期绝不承接。',
      requiredFields: ['通用行业共识'],
      outputTitle: '可控共识预设'
    },
    {
      id: 'five-users-value',
      title: 'Step 3：人群&核心价值',
      goal: '定义受用人群和具体场景，聚焦一个核心痛点。',
      requiredFields: ['受用人群+场景'],
      outputTitle: '人群&核心价值'
    },
    {
      id: 'five-minimum-loop',
      title: 'Step 4：最小闭环交付',
      goal: '整理通用使用流程、交付分级、必做落地、备选优化、延后规划和页面极简拓扑。',
      requiredFields: ['通用使用流程', '必做落地'],
      outputTitle: '最小闭环交付'
    },
    {
      id: 'five-mutual-confirmation',
      title: 'Step 5：双向共识确认',
      goal: '区分不确认无法落地的必确认项和不影响核心的可选微调项。',
      requiredFields: ['必确认项'],
      outputTitle: '双向共识确认'
    }
  ]
}

const journeyMapFlow = {
  id: 'user-journey-map-flow',
  name: '用户旅程地图',
  assetType: '用户旅程地图',
  description: '从旅程对象、边界、阶段、触点、痛点到设计动作，逐步生成用户旅程。',
  steps: [
    {
      id: 'journey-object',
      title: 'Step 1：确定旅程对象',
      goal: '明确主用户、次用户、决策者和受影响者。',
      requiredFields: ['主用户', '用户目标'],
      outputTitle: '旅程对象'
    },
    {
      id: 'journey-boundary',
      title: 'Step 2：确定旅程边界',
      goal: '明确旅程从哪里开始，到哪里结束。',
      requiredFields: ['起点', '终点'],
      outputTitle: '旅程边界'
    },
    {
      id: 'journey-stages',
      title: 'Step 3：拆阶段',
      goal: '把用户完成目标的路径拆成 4-7 个连续阶段。',
      requiredFields: ['阶段列表'],
      outputTitle: '阶段拆解'
    },
    {
      id: 'journey-touchpoints',
      title: 'Step 4：补行为和触点',
      goal: '为每个阶段补充用户行为、系统触点和关键页面。',
      requiredFields: ['触点'],
      outputTitle: '行为与触点'
    },
    {
      id: 'journey-painpoints',
      title: 'Step 5：标注情绪、痛点、机会点',
      goal: '识别每个阶段的情绪、阻塞点和体验机会。',
      requiredFields: ['痛点'],
      outputTitle: '痛点机会'
    },
    {
      id: 'journey-actions',
      title: 'Step 6：生成设计动作',
      goal: '把机会点转成页面、流程、文案、状态和反馈设计动作。',
      requiredFields: ['设计动作'],
      outputTitle: '设计动作'
    },
    {
      id: 'journey-validation',
      title: 'Step 7：校验并保存',
      goal: '检查阶段连续性、痛点覆盖和可执行设计动作。',
      requiredFields: ['校验结论'],
      outputTitle: '旅程校验'
    }
  ]
}

const productInteractionReviewFlow = {
  id: 'product-interaction-design-review-skill',
  name: '交互skill',
  assetType: '产品交互评审报告',
  description: '从业务目标、用户任务、信息架构、交互流程、异常边界和交付协作六个维度检查设计方案，避免漏逻辑、漏状态、漏分工。',
  recommendedFor: ['交互设计', '产品设计评审', '原型自检', '异常场景', '交付对齐'],
  steps: [
    {
      id: 'business-direction-review',
      title: 'Step 1：业务方向评审',
      goal: '确认业务目标、用户分层、核心痛点、竞品边界和迭代约束。',
      requiredFields: ['业务目标', '目标用户', '迭代阶段'],
      outputTitle: '业务方向结论'
    },
    {
      id: 'user-task-review',
      title: 'Step 2：用户任务评审',
      goal: '梳理主任务、次任务、边缘任务、新手任务和用户认知负荷。',
      requiredFields: ['主任务', '次任务', '新手路径'],
      outputTitle: '用户任务与认知负荷'
    },
    {
      id: 'ia-navigation-review',
      title: 'Step 3：信息架构与导航评审',
      goal: '检查页面结构、导航、搜索筛选收藏和跨页面连续性。',
      requiredFields: ['页面结构', '导航结构'],
      outputTitle: '信息架构问题清单'
    },
    {
      id: 'flow-interaction-review',
      title: 'Step 4：流程与交互细节评审',
      goal: '检查输入、AI处理或上传、编辑、预览、导出、分发的完整闭环。',
      requiredFields: ['核心流程', '关键组件'],
      outputTitle: '交互流程补齐方案'
    },
    {
      id: 'boundary-compliance-review',
      title: 'Step 5：异常边界与合规评审',
      goal: '补齐加载、空状态、失败、权限、付费、超时、删除、恢复和数据安全场景。',
      requiredFields: ['异常状态', '权限边界'],
      outputTitle: '异常边界清单'
    },
    {
      id: 'handoff-acceptance-review',
      title: 'Step 6：交付协作与验收',
      goal: '明确产品、UI/交互、前端、后端、测试和运营分工，并输出验收清单。',
      requiredFields: ['交付对象', '验收标准'],
      outputTitle: '交付分工与验收清单'
    }
  ]
}

const interactionDesignFlow = {
  id: 'interaction-design-workflow',
  name: '交互方案生成',
  assetType: '交互方案',
  description: '把模糊需求或改版目标转成信息架构、任务流、页面结构、组件状态、交互评审和交付拆解。',
  recommendedFor: ['交互设计', '已有项目改版', 'B 端复杂流程', '页面结构梳理'],
  steps: [
    {
      id: 'interaction-diagnosis',
      title: 'Step 1：需求诊断',
      goal: '明确目标用户、核心问题、业务背景、成功标准、约束和缺失信息。',
      requiredFields: ['目标用户', '核心问题', '成功标准'],
      outputTitle: '需求诊断卡'
    },
    {
      id: 'information-architecture',
      title: 'Step 2：信息架构',
      goal: '拆分核心对象、导航结构、页面层级、内容分组和权限入口。',
      requiredFields: ['核心对象', '导航结构'],
      outputTitle: '信息架构建议'
    },
    {
      id: 'core-task-flow',
      title: 'Step 3：核心任务流',
      goal: '梳理主路径、分支路径、回退路径和关键决策点。',
      requiredFields: ['主任务', '关键分支'],
      outputTitle: '核心任务流'
    },
    {
      id: 'page-structure',
      title: 'Step 4：页面结构',
      goal: '定义关键页面的模块、主次动作、输入输出和跳转关系。',
      requiredFields: ['关键页面', '主操作'],
      outputTitle: '页面结构表'
    },
    {
      id: 'component-states',
      title: 'Step 5：组件状态与异常',
      goal: '补充表单、列表、详情、弹窗、空状态、错误状态、加载状态和权限状态。',
      requiredFields: ['关键组件', '异常状态'],
      outputTitle: '状态与异常清单'
    },
    {
      id: 'interaction-review',
      title: 'Step 6：交互评审',
      goal: '用一致性、效率、可理解性、可恢复性和可测试性检查方案。',
      requiredFields: ['评审维度', '主要风险'],
      outputTitle: '交互评审'
    },
    {
      id: 'delivery-breakdown',
      title: 'Step 7：交付拆解',
      goal: '转成设计任务、开发任务、验收标准和后续风险。',
      requiredFields: ['交付对象', '验收标准'],
      outputTitle: '交付清单'
    }
  ]
}

const podcastProductFlow = {
  id: 'podcastor-product-flow',
  name: 'AI 播客产品体验流',
  assetType: 'AI 播客产品方案',
  description: '面向 AI 播客工作站，从创作者需求、首页入口、核心编辑器、资产复用、分发增长到验收指标逐步拆解。',
  recommendedFor: ['内容创作', 'AI 播客', '创作者工作流'],
  steps: [
    {
      id: 'podcast-requirement-diagnosis',
      title: 'Step 1：播客需求诊断',
      goal: '识别目标创作者、核心痛点、工作站定位、成功标准和一期范围。',
      requiredFields: ['目标创作者', '核心痛点', '产品定位', '一期范围', '成功标准'],
      outputTitle: '播客需求诊断'
    },
    {
      id: 'podcast-home-entry',
      title: 'Step 2：首页创作入口',
      goal: '把 Generate Script、Upload Script、Upload Audio 组织成低门槛开始创作路径。',
      requiredFields: ['首页入口', '输入方式'],
      outputTitle: '首页入口方案'
    },
    {
      id: 'podcast-editor-flow',
      title: 'Step 3：核心编辑器流程',
      goal: '拆解脚本预览、主持人选择、音色选择、音频生成、视频生成和编辑动作。',
      requiredFields: ['核心编辑器', '关键操作'],
      outputTitle: '核心编辑器流程'
    },
    {
      id: 'podcast-assets-growth',
      title: 'Step 4：资产复用与分发',
      goal: '定义脚本库、音色库、主持人库、作品库，以及短切片和平台分发能力。',
      requiredFields: ['资产类型', '分发渠道'],
      outputTitle: '资产与增长方案'
    },
    {
      id: 'podcast-validation-delivery',
      title: 'Step 5：验收与交付拆解',
      goal: '输出一期范围、关键状态、异常、埋点、验收标准和开发任务。',
      requiredFields: ['一期范围', '验收标准'],
      outputTitle: 'AI 播客交付清单'
    }
  ]
}

export function getBuiltinWorkflows() {
  return [
    clone(podcastProductFlow),
    clone(productInteractionReviewFlow),
    clone(eightModuleFuzzyArchitectureFlow),
    clone(fiveStageClientConsensusFlow),
    clone(demandFourStep),
    clone(demandCardFlow),
    clone(journeyMapFlow),
    clone(interactionDesignFlow)
  ]
}

export function createWorkflowRun(workflow, input = '') {
  const steps = workflow.steps.map((step, index) => ({
    ...clone(step),
    status: index === 0 ? 'active' : 'locked'
  }))
  return {
    id: crypto.randomUUID?.() || `${Date.now()}`,
    workflowId: workflow.id,
    workflowName: workflow.name,
    assetType: workflow.assetType,
    input,
    currentStepId: steps[0]?.id || '',
    steps,
    stepInputs: {},
    stepOutputs: {},
    stepDraftOutputs: {},
    stepChallenges: {},
    stepVersions: {},
    candidateOptions: {},
    finalConclusion: null,
    projectId: '',
    status: 'running',
    createdAt: nowIso(),
    updatedAt: nowIso()
  }
}

export function getCurrentStep(run) {
  const steps = Array.isArray(run?.steps) ? run.steps : []
  return steps.find((step) => step.id === run?.currentStepId) || steps[0] || null
}

export function canAdvanceStep(run) {
  const step = getCurrentStep(run)
  const input = run.stepInputs[step.id] || {}
  const missing = (step.requiredFields || []).filter((field) => !String(input[field] || '').trim())
  return {
    ok: missing.length === 0,
    missing
  }
}

function renderKeyValues(values = {}) {
  const entries = Object.entries(values).filter(([, value]) => String(value || '').trim())
  if (!entries.length) return '- 暂无补充信息'
  return entries.map(([key, value]) => `- ${key}：${value}`).join('\n')
}

function renderAcceptedContext(run, currentStepId) {
  const accepted = run.steps
    .filter((step) => step.id !== currentStepId && run.stepOutputs?.[step.id])
    .map((step) => `### ${step.title}\n${run.stepOutputs[step.id]}`)
  return accepted.length ? accepted.join('\n\n') : '暂无已采纳上文'
}

function produceDemandOutput(step, input, rawDemand) {
  if (step.id === 'requirement-completion') {
    return `# 需求补全结果\n\n## 原始需求\n${rawDemand}\n\n## 角色与背景\n${renderKeyValues(input)}\n\n## 五问法\n1. 解决什么痛点：围绕“${input.业务目标 || '业务目标未明确'}”降低当前阻塞。\n2. 如果不做会怎样：继续依赖线下沟通和返工确认。\n3. 理想状态：用户能按清晰流程完成任务。\n4. 如何衡量成功：${input.成功标准 || '需补充成功指标'}。\n5. 优先级关系：先做能支撑主流程闭环的 MVP。`
  }
  if (step.id === 'structure-breakdown') {
    return `# 结构化拆解结果\n\n## Epic\n${input.Epic || '核心体验优化'}\n\n## Feature\n- M：${input.核心功能 || '主流程闭环'}\n- S：状态反馈与异常提示\n- C：数据看板和高级筛选\n\n## User Story\n作为${input.主要用户 || '目标用户'}，我想完成${input.核心功能 || '核心任务'}，以便${input.业务目标 || '达成业务目标'}。\n\n## 依赖\n- 技术依赖：接口、状态机、权限组件\n- 数据依赖：用户、流程、审批记录\n- 业务依赖：审批规则和责任人确认`
  }
  if (step.id === 'solution-options') {
    return `# 方案对比\n\n## 方案 A：MVP 方案\n保留最短主流程，优先验证核心价值。\n\n## 方案 B：完整方案\n覆盖主流程、异常流、权限、通知和数据追踪。\n\n## 方案 C：风险最低方案\n先做低成本流程梳理和人工兜底，逐步替换为自动化。\n\n## 推荐\n优先采用：${input.推荐方向 || 'MVP 方案'}。`
  }
  return `# 质量校验结果\n\n## INVEST 检查\n- Independent：故事边界清晰\n- Negotiable：方案仍可调整\n- Valuable：对应明确业务价值\n- Estimable：可进入评估\n- Small：可拆进迭代\n- Testable：${input.验收标准 || '需要补充可测试验收标准'}\n\n## 异常场景\n- 权限不足\n- 数据为空\n- 流程超时\n- 审批被驳回\n\n## 逆向回溯\n请让需求方复述流程，并对照本拆解确认是否一致。`
}

function produceCardOutput(step, input, rawDemand, context = '暂无已采纳上文', challenge = '') {
  const challengeBlock = challenge
    ? `\n\n## 根据质疑修订\n${challenge}\n\n## 修订重点\n- 回应用户质疑，不覆盖原始目标。\n- 补充遗漏的角色、场景、状态或约束。\n- 保留可以进入下一步的明确结论。`
    : ''

  if (step.id === 'card-requirement-understanding') {
    return `# 需求理解

## 原始需求
${rawDemand}

## 当前理解
- 目标用户：${input.目标用户 || '未明确'}
- 原始目标：${input.原始目标 || '未明确'}
- 业务目标：减少需求理解偏差，让后续交互方案更可靠。
- 成功标准：用户能看懂、质疑、修正并采纳每一步结论。

## 缺失信息
- 业务约束
- 关键角色权限
- 当前流程样例

## 下一步建议
进入需求质疑，先检查这个理解是否可靠。${challengeBlock}`
  }
  if (step.id === 'card-requirement-challenge') {
    return `# 需求质疑

## 关键疑点
${input.关键疑点 || '目标用户、业务边界、成功指标是否清楚。'}

## 主要风险
${input.主要风险 || 'AI 直接生成方案会掩盖需求不清晰的问题。'}

## 需要追问
- 谁是主用户，谁是审批或决策角色？
- 当前流程最痛的阻塞点是什么？
- 哪些规则必须保留？

## 已采纳上文
${context}${challengeBlock}`
  }
  if (step.id === 'card-scenario-breakdown') {
    return `# 场景拆解

## 核心场景
${input.核心场景 || '用户输入需求，系统逐步拆解并生成交互方案。'}

## 主流程
1. 输入需求。
2. 生成需求理解。
3. 用户质疑并重新生成。
4. 采纳本步进入下一步。

## 异常场景
${input.异常场景 || '输入缺失、理解偏差、权限不足、输出不可采纳。'}${challengeBlock}`
  }
  if (step.id === 'card-solution-generation') {
    return `# 方案生成

## MVP 方案
先做卡片式流程、质疑输入、重新生成、采纳和版本记录。

## 完整方案
增加知识库引用、版本对比、资产评审和团队协作。

## 低风险方案
保留原流程页结构，只替换当前步骤为卡片交互。

## 推荐方向
${input.推荐方向 || 'MVP 方案'}${challengeBlock}`
  }
  if (step.id === 'card-interaction-transform') {
    return `# 交互转化

## 关键页面
${input.关键页面 || '流程运行页'}

## 核心组件
${input.核心组件 || '步骤卡片、质疑输入、版本记录、采纳按钮'}

## 状态
- 待输入
- 已生成
- 已质疑
- 已采纳
- 已锁定${challengeBlock}`
  }
  return `# 质量校验

## 验收标准
${input.验收标准 || '用户必须能生成、质疑、重新生成、采纳并进入下一步。'}

## 待确认问题
${input.待确认问题 || '是否需要接入真实知识库和大模型。'}

## 开发任务
- 增加卡片状态数据。
- 增加重新生成和版本记录。
- 改造流程运行页 UI。
- 导出质疑记录。${challengeBlock}`
}

function produceEightModuleOutput(step, input, rawDemand) {
  if (step.id === 'eight-requirement-understanding') {
    return `# 需求理解

用户原始需求：${input.用户原始需求 || rawDemand || '暂无原始需求'}

表层诉求：${input.表层诉求 || '希望把模糊想法整理成可讨论、可拆范围、可继续推进的产品方案。'}

缺失要素盘点：角色 / 终端 / 场景 / 付费 / 边界 / 合规
- 角色：${input.角色 || '需确认核心使用者、管理者、决策者是否分离。'}
- 终端：${input.终端 || '需确认优先落地小程序、Web、App 还是管理后台。'}
- 场景：${input.场景 || '需确认首次使用、复用、异常和运营场景。'}
- 付费：${input.付费 || '需确认免费、订阅、按次、佣金或线下付费。'}
- 边界：${input.边界 || '需确认本期不做的角色、功能和运营动作。'}
- 合规：${input.合规 || '涉及支付、个人信息、UGC、医疗/教育/金融等需单独确认。'}`
  }
  if (step.id === 'eight-reversible-assumptions') {
    return `# 合理假设（均可推翻修改）

基础落地假设：${input.基础落地假设 || '先用一个核心角色、一个主终端、一条主路径完成 MVP 闭环。'}

体验增值假设：${input.体验增值假设 || '通过清晰入口、默认模板、过程反馈和结果沉淀降低首次使用成本。'}

边界禁区假设：${input.边界禁区假设 || '本期不承接复杂多角色权限、重运营后台、支付结算、外部系统深度集成和强合规审核，除非甲方明确纳入范围。'}`
  }
  if (step.id === 'eight-target-users') {
    return `# 目标用户

核心用户：${input.核心用户 || '最直接因当前痛点受影响、且会高频完成主任务的人。'}

次要用户：${input.次要用户 || '围绕核心用户提供协助、审核、运营或查看结果的人。'}

排斥用户：${input.排斥用户 || '需求过于专业、流程差异极大、需要重定制或不符合本期场景的人群。'}`
  }
  if (step.id === 'eight-core-jtbd') {
    return `# 核心JTBD

功能型JTBD：${input.功能型JTBD || '当用户遇到当前场景时，希望快速完成核心任务，并获得可保存、可复用、可交付的结果。'}

情绪型JTBD：${input.情绪型JTBD || '用户希望减少不确定、返工和沟通成本，感觉方案清楚、边界可控、下一步可执行。'}`
  }
  if (step.id === 'eight-main-path') {
    return `# 主路径草案

新用户首次路径：${input.新用户首次路径 || '进入产品 -> 选择或输入目标 -> 补齐必要信息 -> 生成/提交核心结果 -> 查看反馈 -> 保存或分享。'}

老用户复用路径：${input.老用户复用路径 || '进入历史记录/模板 -> 复用上次配置 -> 快速调整 -> 再次生成/提交 -> 对比和沉淀结果。'}`
  }
  if (step.id === 'eight-scope') {
    return `# P0/P1功能范围

P0必做上线：${input.P0必做上线 || '主入口、核心表单/输入、主流程提交或生成、结果页、基础状态反馈、历史记录。'}

P1二期迭代：${input.P1二期迭代 || '模板库、筛选搜索、协作评论、数据统计、批量操作、运营配置。'}

P2远期规划：${input.P2远期规划 || '多角色权限、自动化策略、商业化增长、第三方深度集成、智能推荐。'}

本期禁区：${input.本期禁区 || '复杂财务结算、强审核后台、跨平台全量同步、大规模内容运营、未确认合规责任的功能。'}`
  }
  if (step.id === 'eight-confirmation-questions') {
    return `# 待确认问题

1. ${input.待确认问题 || '核心用户到底是谁，是否存在管理者/审核者/运营者分工？'}
2. 首期优先终端是什么，小程序、Web、App 还是后台？
3. 用户完成一次主任务后，什么结果算成功？
4. 本期是否涉及支付、个人信息、内容审核或行业资质？
5. 哪些功能明确不在本期交付范围内？`
  }
  return `# 初版页面结构

游客端页面：${input.游客端页面 || '首页/介绍页、示例结果页、登录注册入口、价格或服务说明页。'}

登录用户页面：${input.登录用户页面 || '工作台、创建/输入页、结果详情页、历史记录页、个人/设置页。'}

二级功能模块：${input.二级功能模块 || '模板选择、状态反馈、结果编辑、分享导出、消息通知、帮助说明、权限/套餐提示。'}`
}

function produceFiveStageOutput(step, input, rawDemand) {
  if (step.id === 'five-empathy-recap') {
    return `# 需求共情复盘

原话复刻：${input.原话复刻 || rawDemand || '暂无原话'}

底层意图：${input.底层意图 || '甲方希望把一个面向 C 端用户的想法先变成双方能理解、能确认、能估算的交付方向。'}

信息缺口：${input.信息缺口 || '目标人群、使用场景、核心转化、内容/供应来源、支付与售后、合规边界、一期验收标准。'}`
  }
  if (step.id === 'five-consensus-presets') {
    return `# 可控共识预设（全部可修改）

通用行业共识：${input.通用行业共识 || 'C 端产品首期应优先验证清晰入口、低门槛完成、可信反馈和可复用价值，不宜一开始承接过重运营。'}

本次临时限定：${input.本次临时限定 || '先限定一个核心人群、一个高频场景、一条最短闭环，并把未确认内容标成待确认。'}

本期绝不承接：${input.本期绝不承接 || '未明确的复杂定制、深度第三方集成、支付清结算、内容生产外包、投放运营、强合规责任兜底。'}`
  }
  if (step.id === 'five-users-value') {
    return `# 人群&核心价值

受用人群+场景：${input['受用人群+场景'] || '在具体生活/消费/服务场景里，需要快速发现、判断、预约、购买或完成某项任务的 C 端用户。'}

解决核心痛点：${input.解决核心痛点 || '降低选择和行动成本，让用户更快获得可信结果，同时让甲方能验证需求是否成立。'}`
  }
  if (step.id === 'five-minimum-loop') {
    return `# 最小闭环交付

通用使用流程：${input.通用使用流程 || '进入入口 -> 浏览/输入需求 -> 查看推荐或详情 -> 执行动作 -> 获得确认反馈 -> 留存记录或复用。'}

交付分级：
- 必做落地：${input.必做落地 || '首页入口、核心列表/表单、详情/结果、主操作、成功失败状态、基础记录。'}
- 备选优化：${input.备选优化 || '筛选、收藏、分享、提醒、模板、运营位、轻量数据看板。'}
- 延后规划：${input.延后规划 || '支付结算、会员体系、商家后台、复杂推荐、增长投放、跨平台同步。'}

页面极简拓扑：${input.页面极简拓扑 || '首页/入口 -> 列表或创建页 -> 详情/结果页 -> 确认反馈页 -> 我的记录。'}`
  }
  return `# 双向共识确认

必确认项（不改无法落地）：${input.必确认项 || '目标人群、首期场景、主操作、数据/内容来源、支付/售后边界、合规责任、上线验收标准。'}

可选微调项（改动不影响核心）：${input.可选微调项 || '文案语气、视觉风格、列表排序、运营推荐位、分享样式、非主流程快捷入口。'}`
}

function produceJourneyOutput(step, input, rawDemand) {
  if (step.id === 'journey-object') {
    return `# 旅程对象\n\n## 原始需求\n${rawDemand}\n\n## 用户识别\n${renderKeyValues(input)}\n\n## 不确定项\n- 次用户、决策者和受影响者是否需要单独建旅程。`
  }
  if (step.id === 'journey-boundary') {
    return `# 旅程边界\n\n- 起点：${input.起点 || '用户产生需求'}\n- 终点：${input.终点 || '用户完成目标并沉淀结果'}\n- 边界外：长期运营、跨系统后续自动化。`
  }
  if (step.id === 'journey-stages') {
    return `# 阶段拆解\n\n| 阶段 | 用户目标 | 关键动作 |\n| --- | --- | --- |\n| 发现问题 | 明确要解决什么 | 输入需求、上传资料 |\n| 补齐上下文 | 让系统理解项目 | 选择知识库、回答追问 |\n| 生成方案 | 获得可比较结果 | 执行 Skill、查看方案 |\n| 确认沉淀 | 形成可复用资产 | 编辑、确认、保存 |`
  }
  if (step.id === 'journey-touchpoints') {
    return `# 行为与触点\n\n- 触点：${input.触点 || '项目诊断台、步骤运行器、结果编辑区、资产库'}\n- 用户行为：输入需求、补字段、确认每一步输出。\n- 系统反馈：缺失信息、质量闸门、下一步按钮状态。`
  }
  if (step.id === 'journey-painpoints') {
    return `# 痛点机会\n\n## 痛点\n${input.痛点 || '流程不可点击，用户不知道下一步做什么。'}\n\n## 机会点\n- 把方法论变成可执行步骤。\n- 每一步提供输入提示和质量闸门。\n- 让中间产物可编辑、可确认。`
  }
  if (step.id === 'journey-actions') {
    return `# 设计动作\n\n- 设计动作：${input.设计动作 || '新增分步流程运行器'}\n- 页面动作：步骤导航、当前步骤表单、输出确认、下一步按钮。\n- 状态动作：未开始、运行中、待确认、已完成、需补充。`
  }
  return `# 旅程校验\n\n## 校验结论\n${input.校验结论 || '校验通过'}\n\n## 检查项\n- 阶段是否连续\n- 每阶段是否有行为和触点\n- 痛点是否对应机会点\n- 设计动作是否可执行`
}

function produceInteractionOutput(step, input, rawDemand) {
  if (step.id === 'interaction-diagnosis') {
    return `# 需求诊断卡

## 原始需求
${rawDemand}

## 当前理解
- 目标用户：${input.目标用户 || '未明确'}
- 核心问题：${input.核心问题 || '未明确'}
- 成功标准：${input.成功标准 || '未明确'}

## 设计判断
当前需求需要先把页面和流程拆开，再把每一步转成可确认的中间产物。

## 缺失信息
- 具体业务规则
- 关键角色权限
- 当前页面或流程截图

## 推荐下一步
进入信息架构步骤，先定义对象、导航和页面层级。`
  }
  if (step.id === 'information-architecture') {
    return `# 信息架构建议

## 核心对象
${input.核心对象 || '项目、用户、流程、资产'}

## 导航结构
${input.导航结构 || '项目诊断、流程运行、资产库、Skill 中心'}

## 页面层级
| 层级 | 页面 | 作用 |
| --- | --- | --- |
| 一级 | 项目诊断 | 输入需求并推荐 Skill |
| 一级 | 流程运行 | 分步执行 Skill |
| 一级 | 资产库 | 管理最终产物和运行链路 |
| 一级 | Skill 中心 | 管理系统 Skill 和我的 Skill |`
  }
  if (step.id === 'core-task-flow') {
    return `# 核心任务流

## 主任务
${input.主任务 || '从需求输入进入完整 Skill 流程'}

## 推荐流程
1. 用户输入原始需求。
2. 系统诊断需求清晰度。
3. 系统推荐 Skill。
4. 用户进入流程运行页。
5. 用户逐步生成、编辑并确认输出。
6. 系统保存为资产。

## 关键分支
${input.关键分支 || '信息不足时先追问；信息足够时直接开始流程。'}`
  }
  if (step.id === 'page-structure') {
    return `# 页面结构表

| 页面 | 核心模块 | 主操作 | 次操作 |
| --- | --- | --- | --- |
| 项目诊断 | 需求输入、推荐 Skill、最近活动 | 开始流程 | 查看推荐理由 |
| 流程运行 | 步骤导航、输入表单、输出编辑器、质量检查 | 确认并进入下一步 | 导出 Markdown |
| 资产库 | 资产列表、资产详情、版本历史 | 查看资产 | 查看运行链路 |

## 关键页面
${input.关键页面 || '项目诊断页、流程运行页、资产库页'}

## 主操作
${input.主操作 || '开始流程、确认步骤、保存资产'}`
  }
  if (step.id === 'component-states') {
    return `# 状态与异常清单

## 关键组件
${input.关键组件 || '步骤导航、输入表单、输出编辑器'}

## 状态
- 空状态：提示输入需求或选择流程。
- 运行中：显示当前步骤和可执行动作。
- 待补充：标出缺少字段。
- 待确认：输出已生成但未确认。
- 已完成：允许保存资产和导出。

## 异常状态
${input.异常状态 || '缺少必填字段、输出为空、重复保存'}`
  }
  if (step.id === 'interaction-review') {
    return `# 交互评审

## 评审维度
${input.评审维度 || '效率、一致性、可理解性、可恢复性、可测试性'}

## 主要风险
${input.主要风险 || '用户不知道下一步动作'}

## 修改建议
- 主页面只保留诊断和推荐，不展示完整运行记录。
- 流程页只处理当前 Skill 的步骤执行。
- 资产库承载最终产物、版本和运行链路。`
  }
  return `# 交付清单

## 交付对象
${input.交付对象 || '设计任务和开发任务'}

## 开发任务
- 新增交互方案 workflow。
- 拆分 Skill 工作台视图。
- 新增资产库详情和运行链路入口。
- 调整样式和浏览器验证。

## 验收标准
${input.验收标准 || '用户能完成至少前两步并保存资产'}

## 后续风险
- 外部 Skill 导入仍需要网络和安全审核。
- 真实知识库检索需要后续接入 RAG。`
}

function producePodcastOutput(step, input, rawDemand) {
  if (step.id === 'podcast-requirement-diagnosis') {
    return `# 播客需求诊断

## 原始资料
${rawDemand}

## 当前理解
- 目标创作者：${input.目标创作者 || '独立播客创作者、自媒体 IP、内容营销人员、轻量知识变现用户'}
- 核心痛点：${input.核心痛点 || '出镜门槛高、脚本/配音/视频制作割裂、缺少灵感和一键同款、多端分发成本高'}
- 产品定位：${input.产品定位 || '零门槛的 AI 播客工作站'}
- 一期范围：${input.一期范围 || '脚本生成、音频播客生成、视频播客生成、图片+波纹图播客、作品存储、核心资产库'}
- 成功标准：${input.成功标准 || '用户能从一个想法、URL、文档或音频开始，在同一工作流内生成脚本、音频、视频并沉淀资产'}

## 一期判断
- 首页应该围绕创作者工作流，而不是底层技术功能。
- 首屏优先承接 Generate Script / Upload Script / Upload Audio Podcast。
- 编辑器要把主持人、脚本、音色、音频预览和视频生成串成单一路径。

## 待确认
- 一期是否只支持 1-2 人播客。
- 上传 PDF/PPT 的解析范围和失败兜底。
- Stripe/PayPal 商业化和 credits 消耗是否进入首版闭环。`
  }
  if (step.id === 'podcast-home-entry') {
    return `# 首页入口方案

## 首页入口
${input.首页入口 || 'Turn Your Ideas Into Podcasts 首屏创作模块'}

## 三个 Tab
1. Generate Script：文本提示词、URL 链接、上传文档生成播客脚本。
2. Upload Script：上传 PDF/文档脚本，解析成可编辑脚本。
3. Upload Audio Podcast：上传已有音频，STT 成脚本并进入视频播客制作。

## 输入方式
${input.输入方式 || '文本、URL、PDF/PPT/DOCX、音频'}

## 推荐交互路径
1. 用户选择 Tab。
2. 输入想法/链接/上传资料。
3. 选择播客人数 1-2 人。
4. 点击 Next。
5. 进入核心编辑器并展示生成/解析 loading。`
  }
  if (step.id === 'podcast-editor-flow') {
    return `# 核心编辑器流程

## 核心编辑器
${input.核心编辑器 || '左侧主持人选择，右侧脚本预览和编辑'}

## 主路径
1. 选择播客类型：Talk Show、Cartoon、Pet、Visual。
2. 生成或解析脚本。
3. 编辑脚本、角色顺序、停顿。
4. 选择音色，必要时提示升级 11Labs 等高级音色。
5. 预览音频。
6. 生成视频播客。
7. 下载或保存到作品库。

## 关键操作
${input.关键操作 || '预览音频、下载脚本 PDF、复制脚本、替换音色、角色对调、增加停顿、上传解析脚本'}

## 状态与兜底
- 脚本生成中：展示分段 loading。
- 音频生成失败：保留脚本并提示重试。
- 上传音频后：先 STT，再允许基于脚本修改音频。`
  }
  if (step.id === 'podcast-assets-growth') {
    return `# 资产与增长方案

## 资产类型
${input.资产类型 || '脚本&灵感库、音色&音频资产库、播客主播库、背景和波纹图、作品库'}

## 资产复用
- 保存常用“声音 + Avatar + 背景”组合。
- 支持一键同款复用优秀案例的视觉和声音资产。
- 用户 DIY 主持人可重复用于视频播客。

## 分发渠道
${input.分发渠道 || 'YouTube；后续 Spotify、Apple Podcast、TikTok/Instagram Reels 短切片'}

## 增长动作
- 长播客自动切成竖屏短视频。
- 灵感案例 hover 预览，点击查看封面、创作者、时间、脚本字幕轴。
- 引导用户从案例一键开始创作。`
  }
  return `# AI 播客交付清单

## 一期范围
${input.一期范围 || '注册登录、脚本生成、音频播客生成、视频播客生成、图片+波纹图播客、作品存储、核心资产库、YouTube 分发'}

## 页面结构
- Home：首页创作入口、工具栏、灵感案例。
- Project：脚本、音频、视频作品列表。
- Host：用户和公共主持人库。
- Voice：声音库。
- Pricing：商业化与 credits。

## 验收标准
${input.验收标准 || '用户能从文本/URL/文档/音频任一入口开始，完成脚本生成或解析、预览音频、选择主持人和音色、生成视频播客并保存作品'}

## 开发任务
- 首页三 Tab 创作入口。
- 文档/URL/音频解析 loading 和失败状态。
- 核心编辑器布局。
- 主持人库、音色库、脚本库、作品库数据模型。
- credits 和升级提示。
- 分发/短切片能力预留。

## 前端文件
- frontend/src/App.vue：流程运行页、AI 分步工作台、当前步骤任务卡、AI 产出确认动作。
- frontend/src/styles.css：步骤状态、锁定原因、工作台布局、交付文件清单样式。
- frontend/src/services/workflowWorkbench.js：前端工作台视图模型，负责状态文案、锁定原因、默认输入和主动作。
- frontend/src/services/projectBlueprint.js：页面蓝图、交互路径、Demo schema 和前端交付节点。
- frontend/src/services/api.js：调用后端文档解析、工作流生成、资产保存、竞品分析等接口。

## 后端文件
- backend/README.md：后端开发流程、目录边界、接口规范和测试约定。
- backend/services/document-parser.js：文档、URL、音频解析任务，输出结构化需求材料。
- backend/services/workflow-generator.js：根据项目资料生成步骤草稿、候选方案和版本记录。
- backend/services/asset-store.js：保存蓝图、Demo、运行记录和项目资产。
- backend/routes/workflows.js：工作流运行、采纳、重新生成、完成流程 API。
- backend/routes/uploads.js：上传文件、多文件解析、失败原因和恢复建议 API。
- backend/routes/competitors.js：竞品流程采集、公开资料分析、参考点和差异化建议 API。`
}

export function produceStepOutput(run) {
  const step = getCurrentStep(run)
  const input = run.stepInputs[step.id] || {}
  let content
  if (run.workflowId === 'podcastor-product-flow') {
    content = producePodcastOutput(step, input, run.input)
  } else if (run.workflowId === 'eight-module-fuzzy-architecture') {
    content = produceEightModuleOutput(step, input, run.input)
  } else if (run.workflowId === 'five-stage-client-c-consensus-breakdown') {
    content = produceFiveStageOutput(step, input, run.input)
  } else if (run.workflowId === 'user-journey-map-flow') {
    content = produceJourneyOutput(step, input, run.input)
  } else if (run.workflowId === 'interaction-design-workflow') {
    content = produceInteractionOutput(step, input, run.input)
  } else {
    content = produceDemandOutput(step, input, run.input)
  }
  return {
    stepId: step.id,
    title: step.outputTitle,
    content
  }
}

function makeVersion(content, challenge = '', accepted = false) {
  return {
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    content,
    challenge,
    accepted,
    createdAt: nowIso()
  }
}

function optionId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function generateCandidateOptions(run, stepId = run.currentStepId) {
  const step = run.steps.find((item) => item.id === stepId) || getCurrentStep(run)
  const base = run.stepDraftOutputs?.[step.id] || produceStepOutput(run).content
  return [
    {
      id: optionId('low-risk'),
      title: '低风险方案',
      summary: '优先复用现有流程和页面结构，降低改动成本。',
      content: `${base}\n\n## 低风险方案\n- 优先沿用当前流程，只调整阻塞点和必要状态。\n- 适合资源紧张、需要快速验证的阶段。`,
      tradeoffs: ['上线快', '组织阻力小', '创新空间有限']
    },
    {
      id: optionId('recommended'),
      title: '推荐方案',
      summary: '平衡体验收益、实现成本和后续扩展。',
      content: `${base}\n\n## 推荐方案\n- 围绕当前项目目标重组主流程和关键页面。\n- 兼顾用户效率、异常处理和后续迭代空间。`,
      tradeoffs: ['收益和成本平衡', '适合进入设计评审', '需要补齐关键约束']
    },
    {
      id: optionId('complete'),
      title: '完整方案',
      summary: '覆盖主流程、分支、异常、验收和交付拆解。',
      content: `${base}\n\n## 完整方案\n- 同时覆盖主路径、异常路径、权限状态、数据状态和交付验收。\n- 适合复杂项目或需要一次性对齐多方的场景。`,
      tradeoffs: ['覆盖完整', '评审充分', '设计和开发成本更高']
    }
  ]
}

export function applyCandidateOption(run, optionIdToApply) {
  const next = clone(run)
  const step = getCurrentStep(next)
  const option = (next.candidateOptions?.[step.id] || []).find((item) => item.id === optionIdToApply)
  if (!option) return next
  next.stepDraftOutputs ||= {}
  next.stepDraftOutputs[step.id] = option.content
  next.updatedAt = nowIso()
  return next
}

export function generateStepDraft(run, challenge = '') {
  const next = clone(run)
  const step = getCurrentStep(next)
  const input = next.stepInputs[step.id] || {}
  const context = renderAcceptedContext(next, step.id)
  const content = next.workflowId === 'demand-card-flow'
    ? produceCardOutput(step, input, next.input, context, challenge)
    : produceStepOutput(next).content
  next.stepDraftOutputs ||= {}
  next.stepChallenges ||= {}
  next.stepVersions ||= {}
  next.candidateOptions ||= {}
  next.stepDraftOutputs[step.id] = content
  next.candidateOptions[step.id] = generateCandidateOptions(next, step.id)
  next.stepVersions[step.id] ||= []
  next.stepVersions[step.id].push(makeVersion(content, challenge))
  next.steps = next.steps.map((item) =>
    item.id === step.id ? { ...item, status: challenge ? 'challenged' : 'generated' } : item
  )
  next.updatedAt = nowIso()
  return next
}

export function ensureFinalConclusion(run) {
  const next = clone(run)
  if (next.finalConclusion) return next
  const accepted = next.steps
    .map((step) => ({ step, content: next.stepOutputs?.[step.id] || '' }))
    .filter((item) => item.content.trim())
  next.finalConclusion = {
    title: `${next.workflowName} 最终结论`,
    summary: `基于 ${accepted.length} 个已采纳步骤，形成可进入设计评审和交付拆解的方案。`,
    recommendedPlan: '推荐方案：以当前采纳步骤为主线，优先推进用户主路径、关键页面结构、异常状态和验收标准。',
    keyDecisions: accepted.slice(0, 4).map((item) => `${item.step.title}：采用已采纳输出作为后续依据。`),
    risks: ['知识库资料不足时，需要标注 AI 推断并补充项目事实。', '进入开发前需要确认权限、异常状态和验收标准。'],
    openQuestions: ['是否还有未覆盖的关键用户角色？', '是否存在必须遵守的业务或技术约束？'],
    nextTasks: ['整理为 PRD/交互说明', '补齐关键页面状态', '组织设计评审', '拆分开发验收任务'],
    createdAt: nowIso()
  }
  next.updatedAt = nowIso()
  return next
}

export function regenerateStepDraft(run, challenge) {
  const trimmed = String(challenge || '').trim()
  if (!trimmed) return clone(run)
  const next = clone(run)
  const step = getCurrentStep(next)
  next.stepChallenges ||= {}
  next.stepChallenges[step.id] ||= []
  next.stepChallenges[step.id].push({
    id: crypto.randomUUID?.() || `${Date.now()}`,
    content: trimmed,
    createdAt: nowIso()
  })
  return generateStepDraft(next, trimmed)
}

export function acceptCurrentStep(run, content) {
  const next = clone(run)
  const step = getCurrentStep(next)
  const acceptedContent = String(content || next.stepDraftOutputs?.[step.id] || '').trim()
  if (!acceptedContent) return next
  next.stepOutputs[step.id] = acceptedContent
  next.stepDraftOutputs ||= {}
  next.stepDraftOutputs[step.id] = acceptedContent
  next.stepVersions ||= {}
  next.stepVersions[step.id] ||= []
  if (!next.stepVersions[step.id].length) {
    next.stepVersions[step.id].push(makeVersion(acceptedContent, '', true))
  } else {
    next.stepVersions[step.id] = next.stepVersions[step.id].map((version, index, versions) => ({
      ...version,
      accepted: index === versions.length - 1
    }))
  }
  next.steps = next.steps.map((item) =>
    item.id === step.id ? { ...item, status: 'accepted' } : item
  )
  next.updatedAt = nowIso()
  return next
}

export function canEnterNextStep(run) {
  const step = getCurrentStep(run)
  if (!run.stepOutputs?.[step.id]) {
    return { ok: false, reason: '当前步骤还未采纳' }
  }
  return { ok: true, reason: '' }
}

export function completeCurrentStep(run, content) {
  const next = clone(run)
  const stepIndex = next.steps.findIndex((step) => step.id === next.currentStepId)
  if (stepIndex < 0) return next
  const step = next.steps[stepIndex]
  next.stepOutputs[step.id] = content
  next.steps[stepIndex].status = next.steps[stepIndex].status === 'accepted' ? 'accepted' : 'completed'
  if (stepIndex + 1 < next.steps.length) {
    next.steps[stepIndex + 1].status = 'active'
    next.currentStepId = next.steps[stepIndex + 1].id
  } else {
    next.status = 'completed'
    next.currentStepId = step.id
  }
  next.updatedAt = nowIso()
  return next.status === 'completed' ? ensureFinalConclusion(next) : next
}

export function exportWorkflowRunMarkdown(run) {
  const lines = [
    `# ${run.workflowName}`,
    '',
    `## 原始输入`,
    run.input || '未填写',
    ''
  ]
  if (run.finalConclusion) {
    lines.push(
      '## 最终结论',
      '',
      `### 摘要\n${run.finalConclusion.summary}`,
      '',
      `### 推荐方案\n${run.finalConclusion.recommendedPlan}`,
      '',
      '### 关键决策',
      ...(run.finalConclusion.keyDecisions || []).map((item) => `- ${item}`),
      '',
      '### 风险',
      ...(run.finalConclusion.risks || []).map((item) => `- ${item}`),
      '',
      '### 待确认问题',
      ...(run.finalConclusion.openQuestions || []).map((item) => `- ${item}`),
      '',
      '### 下一步任务',
      ...(run.finalConclusion.nextTasks || []).map((item) => `- ${item}`),
      ''
    )
  }
  run.steps.forEach((step) => {
    lines.push(`## ${step.title}`, '')
    lines.push(run.stepOutputs[step.id] || '未完成', '')
    const challenges = run.stepChallenges?.[step.id] || []
    if (challenges.length) {
      lines.push('### 质疑记录', '')
      challenges.forEach((challenge) => {
        lines.push(`- ${challenge.content}`, '')
      })
    }
  })
  return lines.join('\n')
}
