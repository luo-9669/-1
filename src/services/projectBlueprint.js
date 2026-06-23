import { buildOpportunityValidation, renderOpportunityValidationMarkdown } from './opportunityValidation.js'

function nowIso() {
  return new Date().toISOString()
}

function textOf(input = '', documents = []) {
  return [input, ...documents.map((doc) => `${doc.name || ''}\n${doc.text || ''}`)].join('\n').toLowerCase()
}

function node(title, children = [], meta = '', extra = {}) {
  return { title, meta, children, ...extra }
}

function component(type, label, detail = '', behavior = '') {
  return { type, label, detail, behavior }
}

function section(name, detail, components = []) {
  return { name, detail, components }
}

const interactionStandards = [
  {
    source: 'Material Design',
    pattern: '组件状态必须覆盖 enabled、hover/focus、pressed、disabled、loading，并用状态变化表达可操作性。'
  },
  {
    source: 'Apple HIG',
    pattern: '反馈要及时、可理解，破坏性或高成本操作需要确认；返回路径应符合用户对层级导航的预期。'
  },
  {
    source: 'Microsoft Fluent',
    pattern: '错误、验证、权限与进度提示应靠近触发点，并提供可恢复的下一步操作。'
  },
  {
    source: 'Atlassian / Polaris / Ant Design',
    pattern: '空状态、结果页、消息提示、弹窗、进度和异常页要明确说明原因、影响和下一步。'
  }
]

function pageSpecForScreen(screen = {}, index = 0, screens = []) {
  const first = screens[0]?.id || screen.id
  const previous = screens[index - 1]?.id || first
  const nextAction = screen.actions?.[0] || null
  const componentLabels = (screen.wireframe?.components || []).map((item) => item.label).join('、') || '页面核心控件'
  const isHome = screen.id === 'home' || screen.id === 'brief'
  const isEditor = screen.id === 'editor'
  const isGenerating = screen.id === 'generating'
  const isProject = screen.id === 'project' || screen.id === 'assets'
  return {
    screenId: screen.id,
    pageName: screen.title,
    layout: screen.wireframe?.layout || screen.description || '页面布局待补充',
    components: (screen.wireframe?.components || []).map((item) => ({
      name: item.label,
      type: item.type,
      defaultState: '默认可用',
      interaction: item.behavior || item.detail || '点击或输入后更新当前页面状态',
      edgeCase: item.type?.includes('button') ? '禁用、重复点击、接口失败时需要说明文案和恢复动作' : '空值、超长、禁用、加载、错误状态需覆盖'
    })),
    states: [
      { name: '初始态', trigger: '首次进入页面', ui: `展示${componentLabels}，主操作遵循单一优先级。`, next: nextAction ? `点击 ${nextAction.label} 后进入 ${nextAction.to}` : '等待用户操作' },
      { name: '加载态', trigger: isGenerating ? '开始生成视频' : '上传、解析、生成或保存请求发出后', ui: '显示进度、骨架屏或按钮 loading；禁用重复提交。', next: '成功进入完成态；失败进入错误态' },
      { name: '成功态', trigger: '当前操作完成', ui: '显示成功提示、完成状态或生成结果。', next: nextAction ? `允许继续 ${nextAction.label}` : '允许保存、复用或返回' },
      { name: '空状态', trigger: isProject ? '当前筛选没有资产' : '没有输入、没有文件或没有生成结果', ui: '说明为什么为空，并给出主操作入口。', next: isHome ? '引导输入需求、上传文档或直接体验示例流程' : '返回上一步或重新生成' },
      { name: '错误态', trigger: isHome ? '文件解析失败、URL 不可访问、格式不支持' : isGenerating ? '音频或视频生成失败、credits 不足' : '请求失败、数据不可用、保存失败', ui: '错误信息靠近触发点，保留用户已输入内容。', next: '提供重试、重新上传、返回编辑或联系客服' },
      { name: '权限态', trigger: '用户未登录、无项目权限、会员/credits 不足', ui: '说明缺失权限和影响范围，不丢失当前草稿。', next: '登录、申请权限、升级或返回上一步' },
      { name: '未保存态', trigger: isEditor ? '脚本、主持人、音色或配置被修改' : '页面内容被用户修改', ui: '显示未保存提示，离开前二次确认。', next: '保存草稿、放弃修改或继续编辑' }
    ],
    events: [
      { gesture: '单击', target: nextAction?.label || '主按钮', effect: nextAction ? `跳转到 ${nextAction.to}` : '执行当前主操作', feedback: '按钮 loading 或即时状态提示' },
      { gesture: '输入/粘贴', target: '输入框', effect: '更新表单内容和按钮可用状态', feedback: '必要时展示字数、格式、解析状态' },
      { gesture: '上传/拖拽', target: '上传控件', effect: '显示文件 chip、解析进度、失败原因', feedback: '成功保留文件名，失败提供重新上传' },
      { gesture: '返回', target: '导航返回或浏览器返回', effect: `返回 ${previous}`, feedback: '存在未保存内容时弹出确认' }
    ],
    navigation: {
      entry: index === 0 ? '项目入口 / 流程开始' : `由 ${previous} 进入`,
      next: nextAction ? `${nextAction.label} -> ${nextAction.to}` : '当前为流程末端',
      back: index === 0 ? '返回项目工作台' : `返回 ${previous}`,
      deepLink: `允许从项目资产直接打开 ${screen.id}，缺少上下文时回到 ${first}`
    },
    exceptions: [
      { trigger: '网络异常 / 服务超时', message: '当前操作未完成，请检查网络后重试。', recovery: '保留输入，提供重试和返回上一步' },
      { trigger: '权限不足 / credits 不足', message: '当前能力需要登录、权限或额度。', recovery: '引导登录、申请权限、升级或保存草稿' },
      { trigger: '解析失败 / 文件格式不支持', message: '文件无法解析，请重新上传 PDF/DOCX/TXT 或改用文本输入。', recovery: '保留文件名，允许删除、重试或换入口' }
    ]
  }
}

function buildInteractionSpec({ profile = {}, demoScreens = [], reviewChecklist = [] } = {}) {
  const screens = Array.isArray(demoScreens) ? demoScreens : []
  return {
    title: `${profile.productName || '项目'} 交互说明规格`,
    sourceDoc: '06-交互说明编写规范 + Material / Apple HIG / Fluent / Atlassian / Polaris / Ant Design 公开设计模式',
    principles: [
      '先总后分：先说明页面目标和主路径，再说明控件、状态、异常和跳转。',
      '一页一说明：每个产品页面对应一个页面规格，复杂页面可拆分区域说明。',
      '短句可测试：每条说明都包含触发条件、界面反馈、下一步和恢复动作。',
      '状态优先：默认、加载、成功、空、错误、权限、未保存必须显式覆盖。'
    ],
    standards: interactionStandards,
    pageSpecs: screens.map(pageSpecForScreen),
    navigationRules: [
      { rule: '进入下一级页面时保留来源上下文，返回时回到触发操作的页面和滚动位置。' },
      { rule: '存在未保存修改时，返回、关闭、切换项目都需要确认；确认后说明保存或放弃的结果。' },
      { rule: '深链打开缺少上下文时回到项目首页，并提示缺少的资料或权限。' }
    ],
    feedbackRules: [
      { level: '页面内反馈', usage: '字段校验、解析失败、空状态和权限提示，尽量靠近触发点。' },
      { level: 'Toast / Message', usage: '保存成功、复制成功、轻量失败，显示后不阻断主流程。' },
      { level: 'Modal / Dialog', usage: '删除、放弃修改、生成消耗 credits、离开未保存页面。' },
      { level: 'Result / Status page', usage: '长任务完成、全局失败、生成完成后保存或分发。' }
    ],
    acceptanceChecks: [
      '每个页面至少覆盖初始态、加载态、成功态、空状态、错误态、权限态。',
      '每个主按钮必须写明可用条件、点击反馈、成功去向、失败恢复。',
      '每个返回路径必须写明返回到哪里，以及未保存内容如何处理。',
      '每个上传/解析/生成动作必须保留失败原因、重试入口和用户已输入内容。',
      '空状态必须说明原因，并提供一个清晰的下一步操作。',
      ...reviewChecklist
    ]
  }
}

function titleIncludes(text = '', patterns = []) {
  return patterns.some((pattern) => new RegExp(pattern, 'i').test(text))
}

function buildRequirementGroups(profile = {}, demoScreens = []) {
  return demoScreens.map((screen, index) => {
    const title = screen.title || screen.id
    const isEntry = titleIncludes(`${screen.id} ${title}`, ['home', 'brief', '首页', '入口', '输入'])
    const isEditor = titleIncludes(`${screen.id} ${title}`, ['editor', '编辑'])
    const isGenerate = titleIncludes(`${screen.id} ${title}`, ['generat', '生成'])
    return {
      id: `req-${screen.id}`,
      title: isEntry ? '首页 / 创作入口需求组' : isEditor ? '核心编辑器需求组' : `${title}需求组`,
      priority: index === 0 || isEntry ? 'P0' : isEditor || isGenerate ? 'P1' : 'P2',
      source: 'prd + 对话 + 交互说明规范',
      keyQuestions: [
        '这个页面解决哪个用户任务？',
        '主操作是什么，次操作是什么？',
        '空/错/权限/未保存时用户下一步做什么？'
      ],
      reviewPoints: [
        screen.description || `${title}目标待确认`,
        ...(screen.wireframe?.sections || []).slice(0, 3).map((item) => item.detail),
        '评审时确认字段、规则、状态和风险是否完整'
      ].filter(Boolean)
    }
  })
}

function buildPageGroups(demoScreens = []) {
  return demoScreens.map((screen, index) => ({
    id: `page-group-${screen.id}`,
    title: screen.title,
    priority: index === 0 ? 'P0' : index < 3 ? 'P1' : 'P2',
    pages: [screen.id],
    goal: screen.description,
    selectedSolutionId: `solution-${screen.id}-recommended`,
    reviewStatus: index === 0 ? '已选方案' : '待评审'
  }))
}

function buildSolutionGroups(demoScreens = []) {
  return demoScreens.map((screen) => ({
    id: `solution-group-${screen.id}`,
    pageGroupId: `page-group-${screen.id}`,
    title: `${screen.title}方案组`,
    selectedOptionId: `solution-${screen.id}-recommended`,
    options: [
      {
        id: `solution-${screen.id}-safe`,
        label: 'A',
        title: '低风险方案',
        description: '沿用当前信息结构，只补齐关键状态、返回和异常恢复。',
        tradeoff: '改动小，但体验提升有限。'
      },
      {
        id: `solution-${screen.id}-recommended`,
        label: 'B',
        title: '推荐方案',
        description: '围绕主任务重排模块，把主操作、上传、状态反馈和下一步收束在同一任务区。',
        tradeoff: '需要调整布局，但评审和开发都更清楚。'
      },
      {
        id: `solution-${screen.id}-complete`,
        label: 'C',
        title: '完整方案',
        description: '增加右侧审阅面板、历史记录、分组优化和质量检查闭环。',
        tradeoff: '完整但成本最高，适合二期或复杂项目。'
      }
    ]
  }))
}

function wireframeComponentFrom(component = {}, screen = {}) {
  const type = component.type || 'block'
  const isUpload = /upload|dropzone|上传/i.test(`${type} ${component.label}`)
  const isButton = /button|按钮|next|save|generate/i.test(`${type} ${component.label}`)
  return {
    id: `${screen.id}-${String(component.label || type).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')}`,
    type: isUpload ? 'dropzone' : type,
    label: component.label || type,
    required: isButton ? false : /input|textarea|upload|dropzone/i.test(type),
    source: 'interaction-skill-v2',
    states: isUpload
      ? ['empty', 'dragover', 'uploading', 'parsed', 'failed', 'removed']
      : isButton
        ? ['enabled', 'hover', 'loading', 'disabled', 'failed']
        : ['default', 'focused', 'filled', 'empty', 'error'],
    placement: isUpload ? '输入框底部左侧或输入框下方文件列表' : '跟随页面信息层级'
  }
}

function buildWireframePlan(demoScreens = [], interactionSpec = {}) {
  return {
    schemaVersion: 'wireframe-plan.v2',
    pages: demoScreens.map((screen, index) => ({
      id: screen.id,
      title: screen.title,
      route: `/${screen.id}`,
      layout: screen.wireframe?.layout || screen.description,
      priority: index === 0 ? 'P0' : index < 3 ? 'P1' : 'P2',
      components: (screen.wireframe?.components || []).map((item) => wireframeComponentFrom(item, screen)),
      primaryActions: (screen.actions || []).slice(0, 1).map((action) => action.label),
      secondaryActions: (screen.actions || []).slice(1).map((action) => action.label),
      states: interactionSpec.pageSpecs?.find((page) => page.screenId === screen.id)?.states || []
    })),
    actions: demoScreens.flatMap((screen) =>
      (screen.actions || []).map((action) => ({
        id: `${screen.id}-${action.label}`.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-'),
        label: action.label,
        actionType: 'navigate',
        source: { type: 'page', pageId: screen.id },
        target: { type: 'page', pageId: action.to },
        feedback: '按钮 loading 后进入目标页面；失败时保留当前页面和输入内容'
      }))
    ),
    states: ['idle', 'uploaded', 'reading', 'parsed', 'partial', 'analyzing', 'reviewing', 'optioning', 'selected', 'wireframing', 'checking', 'repairing', 'ready', 'exporting', 'failed'],
    containers: [
      { id: 'main-canvas', role: '页面画布', behavior: '承载线框或高保真预览' },
      { id: 'review-sidebar', role: '需求拆解侧栏', behavior: '展示页面组、方案组、质量检查和优化入口' }
    ]
  }
}

function buildQualityReport(wireframePlan = {}, interactionSpec = {}) {
  const pages = wireframePlan.pages || []
  const missingUploadPlacement = pages.some((page) =>
    page.components.some((item) => item.type === 'dropzone' && !/输入框/.test(item.placement))
  )
  const issueCount = pages.reduce((count, page) => count + (page.states?.length >= 6 ? 0 : 1), 0) + (missingUploadPlacement ? 1 : 0)
  return {
    score: Math.max(82, 100 - issueCount * 6),
    issueCount,
    checks: [
      { id: 'state-coverage', label: '状态覆盖', passed: pages.every((page) => page.states?.length >= 6) },
      { id: 'navigation-closure', label: '跳转闭环', passed: (wireframePlan.actions || []).every((action) => action.target?.pageId) },
      { id: 'upload-placement', label: '上传位置', passed: !missingUploadPlacement },
      { id: 'exception-recovery', label: '异常恢复', passed: Boolean(interactionSpec.pageSpecs?.every((page) => page.exceptions?.length)) }
    ],
    repairItems: [
      { id: 'repair-upload-placement', reason: '上传入口应放在输入框底部或输入框下方文件列表，避免遮挡输入内容。', action: '将上传按钮从输入框中部移到 footer chip 区，并保留文件 chip。' },
      { id: 'repair-state-matrix', reason: '状态矩阵必须覆盖空、加载、成功、失败、权限、未保存和返回确认。', action: '为每个页面补齐 states 和 exceptions。' },
      { id: 'repair-back-path', reason: '返回路径需要说明回到哪里以及未保存内容如何处理。', action: '为每个页面生成 navigation.back 和未保存确认。' }
    ]
  }
}

function buildDemoScenarioMatrix() {
  return [
    { id: 'happy-path', label: '正常主流程', trigger: '用户输入或上传资料后点击 Next', expected: '进入编辑器并生成脚本草稿', recovery: '无需恢复' },
    { id: 'upload-error', label: '上传失败', trigger: '文件格式不支持或解析超时', expected: '保留文件名和失败原因', recovery: '重新上传、删除文件或改用文本输入' },
    { id: 'permission', label: '权限不足', trigger: '使用高级音色、视频生成或额度不足', expected: '展示权限原因并保留草稿', recovery: '登录、升级、申请权限或保存草稿' },
    { id: 'empty', label: '空状态', trigger: '无输入、无资产或筛选无结果', expected: '说明为空原因并给出主操作', recovery: '返回输入、创建新作品或清空筛选' },
    { id: 'network', label: '网络失败', trigger: '生成或保存过程网络中断', expected: '显示失败阶段和已完成进度', recovery: '重试、返回编辑或保存草稿' },
    { id: 'unsaved-back', label: '未保存返回', trigger: '编辑后返回或切换页面', expected: '弹出保存/放弃/继续编辑确认', recovery: '保存草稿或放弃修改' }
  ]
}

function buildInteractionSkillV2({ profile = {}, demoScreens = [], interactionSpec = {} } = {}) {
  const requirementGroups = buildRequirementGroups(profile, demoScreens)
  const pageGroups = buildPageGroups(demoScreens)
  const solutionGroups = buildSolutionGroups(demoScreens)
  const wireframePlan = buildWireframePlan(demoScreens, interactionSpec)
  const qualityReport = buildQualityReport(wireframePlan, interactionSpec)
  return {
    version: 'v2',
    title: `${profile.productName || '项目'} 页面交互规则`,
    inputStrategy: {
      uploadPlacement: '上传入口放在输入框底部 chip 区，已上传文件展示在输入框下方；主输入为上传时切换成 dropzone。',
      textPlacement: '文本输入保持 160px 固定高度，placeholder 只描述当前 Tab 的输入任务。',
      projectPlacement: '项目选择放在输入框左下角，作为上下文 chip，不与主按钮竞争。',
      clearBehavior: '清除上传文件时同步清空由文件生成的需求、蓝图、Demo 和质量检查结果。'
    },
    agentStages: [
      { id: 'requirement-review', name: '需求拆解审阅', statusFlow: ['idle', 'uploaded', 'reading', 'parsed', 'partial', 'failed'], output: 'requirementGroups' },
      { id: 'solution-grouping', name: '页面组与方案组', statusFlow: ['analyzing', 'reviewing', 'optioning', 'selected'], output: 'pageGroups + solutionGroups' },
      { id: 'wireframe-plan', name: 'Wireframe Plan JSON', statusFlow: ['wireframing', 'ready', 'failed'], output: 'wireframePlan' },
      { id: 'quality-repair', name: '质量检查与自动修复', statusFlow: ['checking', 'repairing', 'ready'], output: 'qualityReport + repairItems' },
      { id: 'interactive-demo', name: '可交互 Demo', statusFlow: ['ready', 'exporting', 'failed'], output: 'interactiveDemo + markdown' },
      { id: 'html-delivery', name: '完整 HTML 交付', statusFlow: ['ready', 'exporting', 'failed'], output: 'standaloneHtml + sourcePreview' },
      { id: 'figma-handoff', name: 'Figma 设计稿交付', statusFlow: ['ready', 'exporting', 'failed'], output: 'figmaFrames + annotations + variants' },
      { id: 'vue-export', name: 'Vue 页面导出', statusFlow: ['ready', 'exporting', 'failed'], output: 'frontendFiles + backendContracts + mockData' }
    ],
    requirementGroups,
    pageGroups,
    solutionGroups,
    wireframePlan,
    qualityReport,
    demoScenarioMatrix: buildDemoScenarioMatrix()
  }
}

function buildStateMachines(demoScreens = [], interactionSpec = {}) {
  const firstPage = demoScreens[0]?.id || 'home'
  return demoScreens.map((screen, index) => {
    const nextAction = screen.actions?.[0] || null
    const previous = demoScreens[index - 1]?.id || firstPage
    const pageSpec = interactionSpec.pageSpecs?.find((page) => page.screenId === screen.id) || {}
    return {
      pageId: screen.id,
      initialState: 'idle',
      states: ['idle', 'editing', 'uploading', 'parsed', 'submitting', 'success', 'empty', 'error', 'permission', 'unsaved-confirm'],
      transitions: [
        {
          event: 'input.changed',
          from: 'idle',
          to: 'editing',
          uiFeedback: '输入框显示已输入内容，主按钮根据必填条件切换可用状态。',
          recovery: '允许清空输入并回到空状态。'
        },
        {
          event: 'upload.started',
          from: 'editing',
          to: 'uploading',
          uiFeedback: '输入框底部显示文件 chip、进度条和读取状态，禁用重复上传。',
          recovery: '允许取消上传并保留已输入文本。'
        },
        {
          event: 'upload.parsed',
          from: 'uploading',
          to: 'parsed',
          uiFeedback: '文件 chip 显示已读取，输入框下方展示摘要和可删除入口。',
          recovery: '可删除文件并重新上传。'
        },
        {
          event: 'upload.failed',
          from: 'uploading',
          to: 'error',
          uiFeedback: '在上传 chip 旁展示失败原因，不清空输入内容。',
          recovery: '保留文件名和文本，支持重新上传、删除文件或改用文本输入。'
        },
        {
          event: 'primary.clicked',
          from: 'parsed',
          to: nextAction ? 'submitting' : 'success',
          uiFeedback: nextAction ? `${nextAction.label} 进入 loading，完成后跳转 ${nextAction.to}。` : '执行当前页面主操作并展示完成提示。',
          route: nextAction?.to || screen.id,
          recovery: '失败时停留当前页并展示重试。'
        },
        {
          event: 'permission.denied',
          from: 'submitting',
          to: 'permission',
          uiFeedback: '展示权限/额度原因，保留当前草稿和已选配置。',
          recovery: '登录、升级、申请权限或保存草稿后返回。'
        },
        {
          event: 'back.clicked',
          from: 'editing',
          to: 'unsaved-confirm',
          uiFeedback: '弹出保存草稿、放弃修改、继续编辑三个操作。',
          route: previous,
          recovery: '用户确认后返回上一级，否则留在当前页面。'
        },
        {
          event: 'empty.detected',
          from: 'idle',
          to: 'empty',
          uiFeedback: pageSpec.states?.find((state) => state.name === '空状态')?.ui || '展示空状态原因和下一步入口。',
          recovery: '引导输入需求、上传文件或使用示例。'
        }
      ]
    }
  })
}

function buildUiNodeTree(demoScreens = []) {
  return demoScreens.map((screen) => ({
    pageId: screen.id,
    title: screen.title,
    layout: screen.wireframe?.layout || screen.description,
    nodes: (screen.wireframe?.components || []).map((item, index) => {
      const mapped = wireframeComponentFrom(item, screen)
      const isPrimary = /primary|next|generate|save/i.test(`${item.type} ${item.label}`)
      return {
        id: mapped.id,
        order: index + 1,
        label: item.label,
        control: mapped.type,
        placement: mapped.type === 'dropzone' ? '输入框底部 chip 区或输入框下方文件列表' : mapped.placement,
        visualRule: mapped.type === 'dropzone'
          ? '胶囊上传按钮 + 文件 chip + 解析状态，不能悬浮在输入框中部。'
          : isPrimary
            ? '主按钮使用高对比实色，loading 时保持宽度稳定。'
            : '跟随当前页面布局栅格，状态文案靠近控件。',
        interactionRule: item.behavior || item.detail || '点击或输入后更新页面状态。',
        requiredStates: mapped.states
      }
    })
  }))
}

function buildDemoSchema(demoScreens = [], skillV2 = {}) {
  return {
    schemaVersion: 'demo-schema.v3',
    styleVariants: ['studio', 'editorial', 'product'],
    interactionModes: ['wizard', 'split', 'command'],
    defaultScenarioId: 'happy-path',
    pages: demoScreens.map((screen, index) => ({
      id: screen.id,
      title: screen.title,
      route: `/${screen.id}`,
      defaultScenarioId: index === 0 ? 'happy-path' : 'normal',
      layout: screen.wireframe?.layout || screen.description,
      visibleRegions: (screen.wireframe?.sections || []).map((item) => item.name),
      actions: (screen.actions || []).map((action) => ({
        label: action.label,
        type: 'navigate',
        targetPageId: action.to,
        feedback: '按钮进入 loading，成功跳转，失败保留当前输入。'
      }))
    })),
    scenarios: skillV2.demoScenarioMatrix || buildDemoScenarioMatrix()
  }
}

function buildReviewWorkbench(skillV2 = {}) {
  return {
    layout: '主画布 + 右侧审阅栏 + 底部质量检查结果',
    panels: [
      { id: 'requirement-tree', title: '需求树', placement: '右侧审阅栏顶部', dataSource: 'requirementGroups', action: '定位到对应页面组' },
      { id: 'solution-options', title: '方案组 A/B/C', placement: '右侧审阅栏中段', dataSource: 'solutionGroups', action: '切换推荐方案并刷新 Wireframe Plan' },
      { id: 'change-outline', title: '原大纲 / 新需求对比', placement: '右侧审阅栏下段', dataSource: 'outlineDiff', action: '查看新增、修改、待确认' },
      { id: 'quality-repair', title: '质量检查与修复', placement: '底部抽屉', dataSource: 'qaProtocol', action: '一键应用修复建议' }
    ],
    confirmationRules: [
      '切换推荐方案前保留当前方案版本。',
      '应用自动修复前展示影响页面、修改控件和状态变化。',
      '离开审阅页时如果存在未保存修改，需要确认保存或放弃。'
    ]
  }
}

function buildQaProtocol(skillV2 = {}, stateMachines = [], uiNodeTree = [], demoSchema = {}) {
  const pages = skillV2.wireframePlan?.pages || []
  return {
    score: Math.max(86, skillV2.qualityReport?.score || 86),
    gates: [
      { id: 'state-machine-coverage', label: '每页有状态机和失败恢复', required: true, passed: stateMachines.every((machine) => machine.transitions.some((transition) => transition.to === 'error')) },
      { id: 'ui-node-detail', label: '每个 UI 节点有控件类型、位置和状态', required: true, passed: uiNodeTree.every((page) => page.nodes.every((node) => node.control && node.placement && node.requiredStates?.length)) },
      { id: 'demo-schema-coverage', label: 'Demo Schema 覆盖页面、风格和交互方式', required: true, passed: Boolean(demoSchema.pages?.length && demoSchema.styleVariants?.length >= 3 && demoSchema.interactionModes?.length >= 3) },
      { id: 'upload-placement', label: '上传入口不遮挡输入内容', required: true, passed: pages.every((page) => page.components.every((item) => item.type !== 'dropzone' || /输入框/.test(item.placement))) }
    ],
    repairLoop: [
      { step: 1, action: '扫描缺失状态、缺失返回、缺失异常恢复。', output: 'issueList' },
      { step: 2, action: '修复 UI 节点位置、控件类型和 requiredStates。', output: 'patchedUiNodeTree' },
      { step: 3, action: '修复状态机 transition 的反馈、路由和 recovery。', output: 'patchedStateMachines' },
      { step: 4, action: '重新生成 Demo Schema 并刷新可交互 Demo。', output: 'demoSchema' }
    ],
    acceptance: [
      '主路径能从输入、上传、编辑、生成、保存形成闭环。',
      '每个上传/生成/保存动作都有失败原因、重试和返回。',
      '每个页面都有空、错、权限、未保存返回。',
      'Demo 至少覆盖三种风格、三种交互方式和六类异常演练。'
    ]
  }
}

function buildInteractionSkillV3({ profile = {}, demoScreens = [], interactionSpec = {}, skillV2 = {} } = {}) {
  const stateMachines = buildStateMachines(demoScreens, interactionSpec)
  const uiNodeTree = buildUiNodeTree(demoScreens)
  const demoSchema = buildDemoSchema(demoScreens, skillV2)
  const reviewWorkbench = buildReviewWorkbench(skillV2)
  const qaProtocol = buildQaProtocol(skillV2, stateMachines, uiNodeTree, demoSchema)
  return {
    version: 'v3',
    title: `${profile.productName || '项目'} Demo 生成规则`,
    goal: '把交互说明升级为可执行协议，用状态机、UI 节点树、Demo Schema 和 QA 修复闭环驱动蓝图与可交互 Demo。',
    executionOrder: ['需求审阅', '页面组/方案组', 'UI 节点树', 'State Machine', 'Demo Schema', 'QA 修复', '完整 HTML', 'Figma 设计稿', 'Vue 页面', '交付沉淀'],
    stateMachines,
    uiNodeTree,
    demoSchema,
    reviewWorkbench,
    qaProtocol
  }
}

function productKeywordSummary(profile = {}) {
  return [
    profile.productName && `产品名称：${profile.productName}`,
    profile.positioning && `产品定位：${profile.positioning}`,
    profile.targetUsers && `目标人群：${profile.targetUsers}`,
    profile.primaryGoal && `核心目标：${profile.primaryGoal}`
  ].filter(Boolean)
}

function buildProductAnalysis({ profile = {}, framework = {}, demoScreens = [], outlineDiff = {}, reviewChecklist = [], confidence = 'medium' } = {}) {
  const firstScreen = demoScreens[0]
  const pageNames = demoScreens.map((screen) => screen.title).filter(Boolean)
  return {
    title: `${profile.productName || '当前项目'} 产品分析报告`,
    confidence,
    sections: [
      {
        id: 'what',
        title: 'What｜文档核心分析',
        items: [
          `${profile.productName || '当前项目'} 本质上是 ${profile.positioning || '围绕上传资料抽取出的产品方向'}。`,
          `核心用户是 ${profile.targetUsers || '待确认用户'}，主目标是 ${profile.primaryGoal || '把需求转成可验证方案'}。`,
          `当前资料覆盖的核心场景包括：${(profile.coreScenarios || []).join('、') || '资料上传、方案生成、Demo 验证'}。`
        ]
      },
      {
        id: 'why',
        title: 'Why｜产品机会与战略价值',
        items: [
          '应该先围绕用户主任务组织流程，而不是把功能能力平铺成工具列表。',
          `首要价值是降低用户从“${firstScreen?.title || '需求入口'}”到“可评审产物”的理解和操作成本。`,
          '通过项目档案、结构树、路径树、框架图和 Demo 串联，可以让产品、设计、研发在同一份蓝图上评审。'
        ]
      },
      {
        id: 'how',
        title: 'How｜产品结构与交互主路径',
        items: [
          `建议以 ${pageNames.join(' → ') || '输入 → 分析 → 方案 → Demo → 交付'} 作为主路径。`,
          `产品框架拆为 ${(framework.children || []).map((item) => item.title).join('、') || '核心模块待补充'}。`,
          '每个页面必须同时说明页面形态、核心控件、点击跳转、返回路径、状态与异常恢复。'
        ]
      },
      {
        id: 'priority',
        title: '优先级｜P0 / P1 / P2',
        items: [
          `P0：${pageNames.slice(0, 2).join('、') || '主入口与主流程'}，保证用户能完成核心任务。`,
          `P1：${pageNames.slice(2, 4).join('、') || '状态异常、资产沉淀、Agent 追问'}，保证流程可评审、可恢复。`,
          'P2：完整 HTML、Figma、Vue 导出和自动化质量修复，作为确认后的交付链路。'
        ]
      },
      {
        id: 'risk',
        title: '风险与待确认',
        items: [
          ...((outlineDiff.pending || []).length ? outlineDiff.pending : ['目标用户、成功标准、权限边界和一期范围需要确认']),
          ...reviewChecklist.slice(0, 2)
        ]
      }
    ]
  }
}

function treeConnector(index, total) {
  return index === total - 1 ? '└── ' : '├── '
}

function childIndent(index, total) {
  return index === total - 1 ? '    ' : '│   '
}

function renderStructureTreeLines(tree, depth = 0, prefix = '') {
  if (!tree) return []
  if (depth === 0) {
    return [
      tree.title,
      ...(tree.children || []).flatMap((child, index, list) =>
        renderStructureTreeLines(child, depth + 1, `${treeConnector(index, list.length)}`)
      )
    ]
  }
  const line = `${prefix}${tree.title}${tree.meta ? `：${tree.meta}` : ''}`
  return [
    line,
    ...(tree.children || []).flatMap((child, index, list) => {
      const base = prefix.replace(/[├└]── $/, index === list.length - 1 ? '    ' : '│   ')
      return renderStructureTreeLines(child, depth + 1, `${base}${treeConnector(index, list.length)}`)
    })
  ]
}

function buildStructureTree(framework = {}, interactionTree = {}) {
  return {
    title: `${framework.title || '产品'} 结构树`,
    lines: renderStructureTreeLines(framework),
    interactionLines: renderStructureTreeLines(interactionTree)
  }
}

function asciiWireframe(screen = {}) {
  const components = screen.wireframe?.components || []
  const primary = screen.actions?.[0]?.label || '主按钮'
  const upload = components.find((item) => /upload|上传|dropzone/i.test(`${item.type} ${item.label}`))
  const input = components.find((item) => /textarea|input|输入/i.test(`${item.type} ${item.label}`))
  return [
    `┌─ ${screen.title} ─────────────────────────┐`,
    `│ 页面形态：${screen.wireframe?.layout || screen.description || '待补充'} │`,
    `│ 核心区块：${(screen.wireframe?.sections || []).slice(0, 3).map((item) => item.name).join(' / ') || '待补充'} │`,
    `│ 输入控件：${input?.label || '按页面任务决定'}${upload ? `；上传：${upload.label}` : ''} │`,
    `│ 主操作：${primary}；反馈：loading / success / failed │`,
    `└──────────────────────────────────────────┘`
  ]
}

function buildFrameworkDiagrams(demoScreens = []) {
  return {
    title: '页面框架图',
    pages: demoScreens.map((screen, index) => ({
      id: screen.id,
      title: screen.title,
      priority: index === 0 ? 'P0' : index < 3 ? 'P1' : 'P2',
      layoutLines: asciiWireframe(screen),
      components: (screen.wireframe?.components || []).map((item) => ({
        type: item.type,
        label: item.label,
        detail: item.detail || '',
        behavior: item.behavior || ''
      })),
      navigation: (screen.actions || []).map((action) => `点击 ${action.label} -> ${action.to}`)
    }))
  }
}

function renderAnalysisMarkdown(analysis = {}) {
  return (analysis.sections || []).map((section) => `## ${section.title}
${(section.items || []).map((item) => `- ${item}`).join('\n')}`).join('\n\n')
}

function renderFrameworkDiagramMarkdown(diagrams = {}) {
  return (diagrams.pages || []).map((page) => `### ${page.title}（${page.priority}）
\`\`\`text
${page.layoutLines.join('\n')}
\`\`\`
控件：
${page.components.map((item) => `- ${item.label}（${item.type}）：${item.detail || '待补充'}${item.behavior ? `；${item.behavior}` : ''}`).join('\n')}

跳转：
${page.navigation.map((item) => `- ${item}`).join('\n') || '- 流程末端'}`).join('\n\n')
}

function buildDesignMarkdown(blueprint = {}) {
  const analysis = blueprint.productAnalysis || buildProductAnalysis(blueprint)
  const structureTree = blueprint.structureTree || buildStructureTree(blueprint.framework, blueprint.interactionTree)
  const frameworkDiagrams = blueprint.frameworkDiagrams || buildFrameworkDiagrams(blueprint.demoScreens)
  return `# ${blueprint.title || `${blueprint.profile?.productName || '项目'} 项目蓝图`}

## ${blueprint.profile?.productName || blueprint.title} 项目交互设计方案

${renderAnalysisMarkdown(analysis)}

## 项目档案
- 产品名称：${blueprint.profile?.productName || ''}
- 产品定位：${blueprint.profile?.positioning || ''}
- 目标人群：${blueprint.profile?.targetUsers || ''}
- 核心目标：${blueprint.profile?.primaryGoal || ''}
- 当前阶段：${blueprint.profile?.stage || ''}

## 产品结构树
\`\`\`text
${(structureTree.lines || []).join('\n')}
\`\`\`

## 交互路径树
\`\`\`text
${(structureTree.interactionLines || []).join('\n')}
\`\`\`

### 交互路径 UI 细节
${renderTree(blueprint.interactionTree).join('\n')}

## 页面框架图
${renderFrameworkDiagramMarkdown(frameworkDiagrams)}

## 交互说明规格
${renderInteractionSpec(blueprint.interactionSpec)}

## 状态与异常
${(blueprint.interactionSpec?.pageSpecs || []).map((page) => `### ${page.pageName}
${(page.states || []).map((state) => `- ${state.name}：${state.trigger}；${state.ui}；下一步=${state.next}`).join('\n')}

异常：
${(page.exceptions || []).map((item) => `- ${item.trigger}：${item.message}；恢复=${item.recovery}`).join('\n')}`).join('\n\n')}

${blueprint.backendContract ? `## 前后端接口契约
${(blueprint.backendContract.endpoints || []).map((endpoint) => `- ${endpoint.method} ${endpoint.path}：${endpoint.description}；前端提交 ${endpoint.requestFields.join('、')}；后端返回 ${endpoint.responseFields.join('、')}`).join('\n')}

错误码：
${(blueprint.backendContract.errorCodes || []).map((item) => `- ${item.code}：${item.message}；前端处理=${item.frontendAction}`).join('\n')}` : ''}

${blueprint.handoff ? `## 前后端分工
- 前端接管：${(blueprint.handoff.frontend || []).join('；')}
- 后端接管：${(blueprint.handoff.backend || []).join('；')}
- 数据流：${(blueprint.handoff.dataFlow || []).join(' -> ')}` : ''}

## 优先级与评审清单
${(analysis.sections?.find((section) => section.id === 'priority')?.items || []).map((item) => `- ${item}`).join('\n')}

${(blueprint.reviewChecklist || []).map((item) => `- ${item}`).join('\n')}

## Interaction Skill v2
${renderInteractionSkillV2(blueprint.interactionSkillV2)}

## Interaction Skill v3
${renderInteractionSkillV3(blueprint.interactionSkillV3)}

${blueprint.opportunityValidation ? `## Opportunity Validation
${renderOpportunityValidationMarkdown(blueprint.opportunityValidation)}` : ''}

## 交付链路
- 先确认产品分析、结构树、路径树和页面框架图。
- 再生成低保真 Demo 和完整 HTML，验证主路径、状态和异常。
- 最后按需要输出 Figma 文件或 Vue 页面，并区分前端文件、后端接口契约和 Mock 数据。
`
}

function completeBlueprint(blueprint = {}) {
  const productAnalysis = buildProductAnalysis(blueprint)
  const structureTree = buildStructureTree(blueprint.framework, blueprint.interactionTree)
  const frameworkDiagrams = buildFrameworkDiagrams(blueprint.demoScreens || [])
  const enriched = {
    ...blueprint,
    productAnalysis,
    structureTree,
    frameworkDiagrams
  }
  return {
    ...enriched,
    designMarkdown: buildDesignMarkdown(enriched)
  }
}

function uploadedContextText(input = '', documents = []) {
  return `${input || ''}\n${documents.map((doc) => `${doc.name || ''}\n${doc.text || ''}`).join('\n')}`.trim()
}

function isPodcastorContext(project = {}, input = '', documents = []) {
  const uploadedText = uploadedContextText(input, documents)
  return /podcastor(?:\.ai)?/i.test(`${project.name || ''}\n${project.description || ''}\n${uploadedText}`)
}

function classifyBlueprintIntent(project = {}, input = '', documents = []) {
  const text = textOf(`${project.name || ''}\n${project.description || ''}\n${input || ''}`, documents)
  const hasAuthPage = /登录|登陆|注册|找回密码|忘记密码|重置密码|验证码|短信码|邮箱码|第三方登录|oauth|auth|sign\s*in|sign\s*up|login|register|password reset/i.test(text)
  const hasPageIntent = /页面|界面|弹窗|弹层|浮层|对话框|modal|dialog|popup|表单|按钮|前端|后端|接口|校验|交互|传给后端|返回给前端|联调|api/i.test(text)
  if (hasAuthPage && hasPageIntent) return 'auth-page'
  return 'product-blueprint'
}

function extractDocumentTitle(input = '', documents = []) {
  const source = [
    projectNameCandidate(documents[0]?.name || ''),
    ...String(input || '').split(/\n+/)
  ].map((item) => item.trim()).filter(Boolean)
  const first = source.find((line) => /[\u4e00-\u9fa5A-Za-z0-9]/.test(line)) || ''
  return first
    .replace(/\.(docx|pdf|md|txt|xlsx)$/i, '')
    .replace(/[【】]/g, '')
    .replace(/^上传文档[:：]\s*/i, '')
    .slice(0, 48)
}

function cleanProductName(name = '') {
  return String(name || '')
    .replace(/\s+v?\d+(?:\.\d+)*版本?.*$/i, '')
    .replace(/\s+(prd|mrd|需求文档|产品文档|说明文档)$/i, '')
    .replace(/^上传文档[:：]\s*/i, '')
    .replace(/[【】]/g, '')
    .trim()
}

function projectNameCandidate(name = '') {
  return String(name || '')
    .replace(/\.(docx|pdf|md|txt|xlsx)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
}

function extractKeywords(text = '') {
  const candidates = [
    ['宠物内容', /宠物|pet/i],
    ['卡通 IP', /卡通|cartoon|动漫|动画/i],
    ['播客内容', /播客|podcast/i],
    ['内容生产', /生产端|内容生产|创作/i],
    ['消费市场', /消费市场|市场|火热/i],
    ['需求拆解', /需求拆解|需求背景|需求/i],
    ['分发能力', /分发|youtube|抖音|小红书|tiktok/i],
    ['管理端', /管理端|后台|admin/i],
    ['创作工具', /工具|工作台|编辑器/i]
  ]
  return candidates.filter(([, pattern]) => pattern.test(text)).map(([label]) => label)
}

function inferProductName(project = {}, input = '', documents = []) {
  const contextText = uploadedContextText(input, documents)
  if (project.name && !/流程通默认项目|未命名项目/.test(project.name) && new RegExp(project.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(contextText)) {
    return project.name
  }
  const explicit = String(input || '').match(/^([A-Za-z0-9][A-Za-z0-9 /._-]{2,60}?(?:Podcast|播客|管理端|平台|系统|工具)(?:\.ai)?)(?=\s+v?\d|\s+[一二三四]|[，。:：]|$|\s+(?:支持|需要|是|为))/i)?.[1] ||
    String(input || '').match(/([A-Za-z0-9][A-Za-z0-9 /._-]{2,40}?(?:Podcast|播客|管理端|平台|系统|工具)(?:\.ai)?)/i)?.[1]
  const documentName = cleanProductName(explicit || extractDocumentTitle(input, documents))
  if (
    documentName &&
    !/^(prd|mr[ed]|需求|需求文档|产品需求|说明|文档|readme)$/i.test(documentName) &&
    !/^(generate|upload)\s+.*podcast$/i.test(documentName) &&
    !/流程通默认项目|未命名项目|需求背景|上传文档/.test(documentName)
  ) return documentName
  if (project.name && !/流程通默认项目|未命名项目/.test(project.name)) return project.name
  return documentName || project.name || '未命名项目'
}

function usesUploadedProductContext(project = {}, input = '', documents = []) {
  const productName = inferProductName({}, input, documents)
  const context = uploadedContextText(input, documents)
  const projectName = String(project.name || '')
  const normalizeName = (value = '') => String(value || '')
    .toLowerCase()
    .replace(/\.ai\b/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '')
  const sameProject =
    productName &&
    projectName &&
    normalizeName(productName) === normalizeName(projectName)
  const explicitlyDifferentPodcastProduct =
    /podcastor(?:\.ai)?/i.test(projectName) &&
    /pets?\s*\/\s*cartoon\s+podcast|宠物和卡通播客|宠物\/卡通播客/i.test(context)
  return Boolean(
    context &&
    productName &&
    project.name &&
    !sameProject &&
    (!/podcastor(?:\.ai)?/i.test(projectName) || explicitlyDifferentPodcastProduct)
  )
}

function sourceSummary(input = '', documents = []) {
  return [input, ...documents.map((doc) => doc.text || '')]
    .join('\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join('；')
    .slice(0, 260)
}

function baseProfile(project = {}, input = '', documents = []) {
  const allText = `${input}\n${documents.map((doc) => doc.text || '').join('\n')}`
  const keywords = extractKeywords(allText)
  const productName = inferProductName(project, input, documents)
  const preferDocumentContext = usesUploadedProductContext(project, input, documents)
  const targetUsers = (!preferDocumentContext && project.targetUsers) || (
    /宠物|卡通|cartoon|pet/i.test(allText)
      ? '播客创作者、宠物内容创作者、卡通 IP 内容团队'
      : '目标用户待确认'
  )
  const positioning = (!preferDocumentContext && (project.domain || project.description)) || (
    keywords.length
      ? `${keywords.slice(0, 3).join(' / ')}相关的产品能力`
      : '基于当前资料待确认'
  )
  const primaryGoal = /宠物|卡通|cartoon|pet/i.test(allText)
    ? '围绕宠物和卡通播客内容的市场需求，帮助创作者完成需求拆解、内容创作、作品管理和分发验证。'
    : '基于上传资料生成项目蓝图、交互路径和可点击 Demo'
  return {
    productName,
    positioning,
    targetUsers,
    primaryGoal,
    stage: project.stage || 'discovery',
    coreScenarios: keywords.length
      ? [...new Set(['需求拆解', ...keywords, '方案验证', 'Demo 预览'])].slice(0, 6)
      : ['资料上传与解析', '项目蓝图生成', '交互路径确认', 'Demo 预览与资产沉淀'],
    sourceSummary: sourceSummary(input, documents) || '暂无原始需求，以下内容为 AI 推断。'
  }
}

function buildPodcastorBlueprint(project, input, documents) {
  const base = baseProfile(project, input, documents)
  const preferDocumentContext = usesUploadedProductContext(project, input, documents)
  const profile = {
    ...base,
    productName: preferDocumentContext ? base.productName : 'Podcastor.ai',
    positioning: preferDocumentContext ? base.positioning : '零门槛的 AI 播客工作站',
    targetUsers: preferDocumentContext ? base.targetUsers : project.targetUsers || '独立播客创作者、自媒体 IP、内容营销人员、知识变现用户',
    primaryGoal: preferDocumentContext ? base.primaryGoal : '让用户从想法、URL、文档或音频开始，一站式生成脚本、音频、视频播客并沉淀资产。',
    coreScenarios: preferDocumentContext ? base.coreScenarios : ['Generate Script', 'Upload Script', 'Upload Audio Podcast', '核心编辑器制作播客', '作品保存与多端分发']
  }
  const demoScreens = [
    {
      id: 'home',
      title: '首页创作入口',
      description: '用户选择 Generate Script / Upload Script / Upload Audio Podcast，并输入资料。',
      wireframe: {
        layout: '居中首屏，标题在上，创作面板在中间，下一屏内容露出一部分。',
        sections: [
          section('标题区', 'Turn Your Ideas Into Podcasts，副文案说明可从想法、URL、文档或音频开始。'),
          section('Tab 区', '三段式 Tab：Generate Script / Upload Script / Upload Audio Podcast。'),
          section('创作输入框', '固定 160px 高的大输入框，左下放项目选择，右下放 Next。'),
          section('上传状态区', '输入框下方展示文件 chip、解析状态和错误提示。')
        ],
        components: [
          component('segmented-tabs', '三入口 Tab', 'Generate Script / Upload Script / Upload Audio Podcast'),
          component('textarea', '创作输入框', '160px 高，placeholder 根据 Tab 切换'),
          component('upload-chip', '上传文档/音频', '胶囊按钮，显示上传窗口'),
          component('project-select', '项目选择', '放在输入框左下角'),
          component('primary-button', 'Next', '输入框右下角主按钮')
        ]
      },
      actions: [{ label: 'Next', to: 'editor' }]
    },
    {
      id: 'editor',
      title: '核心编辑器',
      description: '左侧选择主持人，右侧编辑脚本、选择音色、预览音频。',
      wireframe: {
        layout: '左侧 280px 主持人/素材栏，右侧脚本编辑和操作区，上方保留项目面包屑。',
        sections: [
          section('主持人栏', '卡片列表展示主持人头像、名称、类型、是否已选。'),
          section('脚本编辑区', '按 Speaker 分段展示，每段是可编辑输入框。'),
          section('音色操作区', '每个角色旁有 Voice 下拉、Preview 按钮和高级音色标识。'),
          section('底部操作栏', 'Preview Audio、Save Draft、Generate Video。')
        ],
        components: [
          component('sidebar-card-list', '主持人卡片列表', 'Talk Show / Cartoon / Pet / Visual 筛选'),
          component('script-editor', '脚本编辑器', 'Speaker 分段输入框'),
          component('select', '音色下拉', '按角色选择音色'),
          component('icon-button', 'Preview Audio', '播放按钮'),
          component('primary-button', 'Generate Video', '主按钮')
        ]
      },
      actions: [{ label: 'Generate Video', to: 'generating' }, { label: 'Save Draft', to: 'project' }]
    },
    {
      id: 'generating',
      title: '生成状态',
      description: '展示脚本、音频、视频生成进度和失败重试。',
      wireframe: {
        layout: '居中任务状态页，展示生成步骤和预览占位。',
        sections: [
          section('进度步骤', '脚本确认、音频生成、视频合成、封面生成。'),
          section('预览区', '视频生成前显示 skeleton，完成后展示播放器。'),
          section('异常区', '失败时展示失败步骤、原因和重试按钮。')
        ],
        components: [
          component('stepper', '生成步骤条', '四步状态'),
          component('progress', '整体进度条', '百分比和预计时间'),
          component('video-placeholder', '视频预览占位', '生成完成后变播放器'),
          component('primary-button', 'Save', '保存作品')
        ]
      },
      actions: [{ label: 'Save', to: 'project' }]
    },
    {
      id: 'project',
      title: '项目作品库',
      description: '保存作品、脚本、音频、主持人和分发资产。',
      wireframe: {
        layout: '作品网格 + 左侧类型筛选 + 顶部搜索。',
        sections: [
          section('筛选区', 'All / Script / Audio / Video / Host / Voice。'),
          section('作品卡片', '封面、标题、类型、更新时间、分发状态。'),
          section('详情抽屉', '点击作品后展示脚本、音频、视频和复用入口。')
        ],
        components: [
          component('filter-tabs', '资产类型筛选', 'All / Script / Audio / Video'),
          component('search-input', '搜索输入框', '搜索作品标题和标签'),
          component('asset-card-grid', '作品卡片网格', '封面、状态、操作按钮'),
          component('secondary-button', 'Open Work', '回到编辑器继续编辑')
        ]
      },
      actions: [{ label: 'Open Work', to: 'editor' }]
    }
  ]
  const reviewChecklist = ['目标用户是否准确', '首页三入口是否覆盖主要用户起点', '编辑器是否能完成脚本-音频-视频闭环', '资产库是否支持复用', '异常和付费状态是否进入设计']
  const interactionSpec = buildInteractionSpec({ profile, demoScreens, reviewChecklist })
  const interactionSkillV2 = buildInteractionSkillV2({ profile, demoScreens, interactionSpec })
  const interactionSkillV3 = buildInteractionSkillV3({ profile, demoScreens, interactionSpec, skillV2: interactionSkillV2 })
  const opportunityValidation = buildOpportunityValidation({ profile, documents, demoScreens, interactionSkillV3 })
  return completeBlueprint({
    id: `blueprint-${Date.now()}`,
    projectId: project.id || '',
    type: 'project-blueprint',
    title: `${profile.productName} 项目蓝图`,
    profile,
    framework: node(profile.productName, [
      node('首页创作入口', [
        node('Generate Script', ['输入想法', '粘贴 URL', '上传 PDF/PPT/DOCX'].map((item) => node(item))),
        node('Upload Script', [node('上传脚本文档'), node('解析为可编辑脚本')]),
        node('Upload Audio Podcast', [node('上传音频'), node('STT 转脚本')])
      ]),
      node('核心编辑器', [
        node('主持人选择', [node('真人主持人'), node('卡通主持人'), node('宠物主持人')]),
        node('脚本编辑', [node('角色对调'), node('增加停顿'), node('复制/下载脚本')]),
        node('音色与音频', [node('替换音色'), node('预览音频'), node('下载音频')]),
        node('视频生成', [node('B-roll'), node('贴纸'), node('高级编辑器')])
      ]),
      node('资产体系', [node('脚本&灵感库'), node('音色&音频资产库'), node('播客主播库'), node('作品库')]),
      node('分发增长', [node('YouTube'), node('Spotify / Apple Podcast'), node('TikTok / IG Reels 短切片')])
    ]),
    interactionTree: node('Podcastor 主流程', [
      node('首页创作入口', [
        node('点击 Generate Script', [node('输入 Prompt / URL / 上传文档'), node('点击 Next'), node('跳转核心编辑器')], '', {
          ui: {
            layout: '居中创作面板',
            components: [
              component('segmented-tabs', '分段 Tab', 'Generate Script / Upload Script / Upload Audio Podcast', '切换后输入区文案和上传类型变化'),
              component('textarea', '大输入框', '160px 高，支持输入想法、粘贴 URL、展示上传文档摘要', '输入内容后 Next 按钮高亮'),
              component('upload-chip', '上传按钮', '胶囊按钮，支持 PDF/PPT/DOCX/音频', '上传后显示文件 chip 和解析状态'),
              component('primary-button', 'Next', '主按钮，位于输入框右下或面板底部', '点击后进入核心编辑器')
            ],
            feedback: '上传中显示读取状态；解析失败保留文件名并提示重新上传。'
          }
        }),
        node('点击 Upload Script', [node('上传脚本'), node('解析脚本'), node('跳转脚本编辑区')], '', {
          ui: {
            layout: '上传窗口 + 脚本解析状态',
            components: [
              component('dropzone', '脚本上传框', '虚线边框，支持拖拽和点击选择文件', '上传后自动解析成 Speaker 分段'),
              component('status-pill', '解析状态', '已上传 / 解析中 / 解析失败', '失败时展示重试按钮'),
              component('primary-button', 'Next', '解析完成后可点击', '进入脚本编辑区')
            ],
            feedback: '解析完成后预览前 3 段脚本。'
          }
        }),
        node('点击 Upload Audio Podcast', [node('上传音频'), node('STT 转脚本'), node('跳转音频脚本编辑区')], '', {
          ui: {
            layout: '音频上传窗口',
            components: [
              component('dropzone', '音频上传框', '支持 mp3/wav/m4a', '上传后开始 STT'),
              component('progress', '转写进度条', '展示上传、转写、分段三个阶段', '完成后自动生成脚本草稿'),
              component('secondary-button', 'Preview', '试听上传音频', '播放/暂停当前音频')
            ],
            feedback: '转写失败时保留音频并允许重新转写。'
          }
        })
      ], '', {
        ui: {
          layout: '居中创作面板',
          components: [
            component('headline', '标题', 'Turn Your Ideas Into Podcasts', '首屏表达产品核心价值'),
            component('segmented-tabs', '分段 Tab', 'Generate Script / Upload Script / Upload Audio Podcast', '切换不同创作入口'),
            component('textarea', '创作输入框', '固定 160px 高，左下角放项目选择，右侧放 Next', '承接文本、URL、上传文档摘要'),
            component('upload-chip', '上传文档', '圆角胶囊按钮', '点击打开文件选择窗口'),
            component('primary-button', 'Next', '黑色主按钮', '进入核心编辑器')
          ],
          feedback: '资料上传后在输入框下方显示文件 chip 和“已读取/待解析”。'
        }
      }),
      node('核心编辑器', [
        node('点击 Host', [node('打开主持人选择面板')], '', {
          ui: {
            layout: '左侧素材栏',
            components: [
              component('sidebar-card-list', '主持人卡片列表', '头像、名称、类型标签', '点击选中并替换画布主持人'),
              component('filter-tabs', '主持人类型筛选', 'Talk Show / Cartoon / Pet / Visual', '切换列表内容')
            ],
            feedback: '选中卡片显示描边和“已应用”。'
          }
        }),
        node('点击 Voice', [node('打开音色选择面板')], '', {
          ui: {
            layout: '右侧抽屉或弹窗',
            components: [
              component('voice-list', '音色列表', '语言、性别、试听按钮、会员标识', '点击试听，确认后替换角色音色'),
              component('search-input', '音色搜索框', '按语言/风格筛选', '输入后过滤音色')
            ],
            feedback: '高级音色展示升级提示。'
          }
        }),
        node('点击 Preview Audio', [node('生成试听音频')], '', {
          ui: {
            layout: '脚本工具栏',
            components: [
              component('icon-button', 'Preview Audio', '播放图标按钮', '生成并播放当前脚本音频'),
              component('progress', '音频生成进度', '分角色生成状态', '失败角色可单独重试')
            ],
            feedback: '生成中禁用重复点击。'
          }
        }),
        node('点击 Generate Video', [node('进入生成状态页')], '', {
          ui: {
            layout: '主操作区',
            components: [
              component('primary-button', 'Generate Video', '黑色主按钮，放在编辑器底部或右上角', '进入生成状态页'),
              component('modal', '生成确认弹窗', '展示预计 credits 和视频配置', '确认后开始生成')
            ],
            feedback: '展示 credits 消耗和预计时间。'
          }
        }),
        node('点击 Save', [node('保存到作品库')], '', {
          ui: {
            layout: '顶部操作栏',
            components: [
              component('secondary-button', 'Save Draft', '保存草稿按钮', '保存脚本、主持人、音色、背景配置'),
              component('toast', '保存成功提示', '右上角轻提示', '点击可跳转作品库')
            ],
            feedback: '保存后 Project 作品库新增卡片。'
          }
        })
      ], '', {
        ui: {
          layout: '左右分栏编辑器',
          components: [
            component('sidebar-card-list', '左侧主持人选择', '卡片列表展示主持人、视觉类型、使用状态', '点击切换主持人'),
            component('script-editor', '右侧脚本编辑器', 'Speaker 分段、段落输入框、停顿控制', '编辑后更新音频预览'),
            component('toolbar', '脚本工具栏', '复制脚本、下载 PDF、角色对调、增加停顿', '对脚本执行局部操作'),
            component('primary-button', 'Generate Video', '主按钮', '进入视频生成状态')
          ],
          feedback: '脚本/音色/主持人变更后标记为未保存。'
        }
      })
    ]),
    outlineDiff: {
      original: ['首页', '脚本生成', '音频生成', '视频生成'],
      added: ['三 Tab 创作入口', 'URL / 文档 / 音频多入口', '主持人选择', '音色替换', '角色对调与停顿', '短切片分发'],
      changed: ['首页从功能陈列改为创作入口', '编辑器从单一脚本编辑升级为脚本/音色/主持人/视频一体化工作台'],
      removed: [],
      pending: ['一期是否只支持 1-2 人播客', 'PDF/PPT 解析失败兜底', 'Credits 和付费节点是否进入首版']
    },
    demoScreens,
    interactionSpec,
    interactionSkillV2,
    interactionSkillV3,
    opportunityValidation,
    reviewChecklist,
    confidence: documents.length ? 'high' : 'medium',
    createdAt: nowIso()
  })
}

function buildGenericBlueprint(project, input, documents) {
  const profile = baseProfile(project, input, documents)
  const allText = `${input}\n${documents.map((doc) => `${doc.name}\n${doc.text || ''}`).join('\n')}`
  const keywords = extractKeywords(allText)
  const isPetCartoon = /宠物|卡通|cartoon|pet/i.test(allText)
  const marketLabel = keywords.includes('消费市场') ? '市场需求洞察' : '需求背景分析'
  const contentLabel = isPetCartoon ? '宠物/卡通内容创作' : '核心内容创作'
  const distributionLabel = keywords.includes('分发能力') ? '分发能力验证' : '作品管理与验证'
  const demoScreens = [
    {
      id: 'brief',
      title: '需求背景输入',
      description: `围绕${profile.productName}上传 PRD、市场背景或新增需求，先抽取目标用户、场景和约束。`,
      wireframe: {
        layout: '居中需求输入卡片，上传文档在输入框下方，右下角主按钮进入分析。',
        sections: [
          section('需求摘要', profile.sourceSummary),
          section('文档列表', documents.length ? documents.map((doc) => doc.name).join('、') : '暂无文档'),
          section('下一步', '点击分析后进入蓝图画布，逐步加载每个节点。')
        ],
        components: [
          component('textarea', '需求输入框', '固定高度，展示上传文档摘要'),
          component('upload-chip', '上传需求文档', '支持多文件，展示已读取/待解析/失败'),
          component('primary-button', '分析文档', '进入加载页并生成画布节点')
        ]
      },
      actions: [{ label: '分析文档', to: 'blueprint' }]
    },
    {
      id: 'blueprint',
      title: marketLabel,
      description: `${profile.productName} 的用户需求、市场机会、功能优先级和待确认问题。`,
      wireframe: {
        layout: '白色画布节点卡片，左侧为环节导航，主画布串联分析结果。',
        sections: [
          section('市场背景', profile.sourceSummary),
          section('目标用户', profile.targetUsers),
          section('核心场景', profile.coreScenarios.join(' / '))
        ],
        components: [
          component('canvas-node', '文档分析结果', '展示解析来源、产品名、置信度'),
          component('canvas-node', '项目档案', '展示定位、人群、目标'),
          component('agent-button', 'Agent', '针对当前节点追问和重新生成')
        ]
      },
      actions: [{ label: '规划交互', to: 'flow' }]
    },
    {
      id: 'flow',
      title: contentLabel,
      description: isPetCartoon
        ? '从宠物/卡通内容需求出发，规划内容创作、角色/IP、脚本、素材和生成流程。'
        : '规划主流程、页面形态、控件状态和异常恢复。',
      wireframe: {
        layout: '流程树 + 节点详情，展示每一步点击哪里、跳转哪里、失败怎么恢复。',
        sections: [
          section('核心流程', isPetCartoon ? '需求背景 -> IP/角色设定 -> 内容脚本 -> 作品生成 -> 分发验证' : '输入 -> 分析 -> 方案 -> Demo -> 评审'),
          section('状态覆盖', '空、加载、成功、失败、权限、未保存返回。')
        ],
        components: [
          component('flow-tree', '交互路径树', '节点可点击，右侧展示页面/弹窗/抽屉形态'),
          component('state-table', '状态矩阵', '覆盖加载、错误、权限、返回'),
          component('quick-action-row', '快捷追问', '补状态、补跳转、生成 Demo')
        ]
      },
      actions: [{ label: '生成 Demo', to: 'demo' }]
    },
    {
      id: 'demo',
      title: distributionLabel,
      description: isPetCartoon
        ? '验证宠物/卡通播客内容从创意到作品管理、分发反馈的闭环。'
        : '点击页面节点预览跳转并沉淀资产。',
      wireframe: {
        layout: '可交互低保真 Demo，支持不同风格和交互方式切换。',
        sections: [
          section('Demo 预览', '生成可点击 HTML，支持不满意刷新。'),
          section('评审清单', '检查目标用户、核心路径、异常恢复和交付代码。')
        ],
        components: [
          component('preview-frame', 'Demo 预览', '展示可交互 HTML'),
          component('segmented-tabs', '风格/交互切换', '三种风格、三种交互方式'),
          component('primary-button', '保存蓝图', '沉淀为项目资产')
        ]
      },
      actions: [{ label: '保存资产', to: 'assets' }]
    }
  ]
  const reviewChecklist = [
    `${profile.productName} 的目标用户是否明确`,
    isPetCartoon ? '宠物/卡通内容场景和播客市场机会是否成立' : '核心需求场景是否成立',
    '每个画布节点是否引用了上传文档证据',
    '主流程是否闭环，失败和返回是否清楚',
    '是否给出可执行的 Demo 和下一步方案'
  ]
  const interactionSpec = buildInteractionSpec({ profile, demoScreens, reviewChecklist })
  const interactionSkillV2 = buildInteractionSkillV2({ profile, demoScreens, interactionSpec })
  const interactionSkillV3 = buildInteractionSkillV3({ profile, demoScreens, interactionSpec, skillV2: interactionSkillV2 })
  const opportunityValidation = buildOpportunityValidation({ profile, documents, demoScreens, interactionSkillV3 })
  return completeBlueprint({
    id: `blueprint-${Date.now()}`,
    projectId: project.id || '',
    type: 'project-blueprint',
    title: `${profile.productName} 项目蓝图`,
    profile,
    framework: node(profile.productName, [
      node('需求背景与机会', [node(marketLabel), node('目标用户'), node('核心痛点')]),
      node(contentLabel, isPetCartoon
        ? [node('宠物内容场景'), node('卡通/IP 角色'), node('播客脚本与素材'), node('作品生成')]
        : [node('入口'), node('主流程'), node('资产沉淀')]
      ),
      node(distributionLabel, [node('作品管理'), node('分发渠道'), node('效果反馈')]),
      node('交互设计', [node('页面清单'), node('跳转关系'), node('状态与异常')])
    ]),
    interactionTree: node(`${profile.productName} 主流程`, [
      node('上传并解析需求', [node('选择文档'), node('展示趣味加载'), node('生成文档分析结果')]),
      node('确认项目档案', [node('目标用户'), node('产品定位'), node('核心目标')]),
      node(isPetCartoon ? '规划宠物/卡通播客流程' : '查看交互路径', [node('确认页面跳转'), node('补齐状态异常'), node('生成 Demo')]),
      node('评审沉淀', [node('采纳修改'), node('保存资产')])
    ]),
    outlineDiff: {
      original: documents.length ? documents.map((doc) => doc.name) : ['原始需求待补充'],
      added: [marketLabel, contentLabel, distributionLabel, '交互路径树', '可交互 Demo'],
      changed: ['从上传文档直接生成画布节点，并允许 Agent 针对单个节点追问重算'],
      removed: [],
      pending: isPetCartoon
        ? ['宠物/卡通内容定位', '目标创作者细分', '内容生成边界', '分发渠道优先级', '验收标准']
        : ['目标用户', '成功标准', '异常状态', '验收标准']
    },
    demoScreens,
    interactionSpec,
    interactionSkillV2,
    interactionSkillV3,
    opportunityValidation,
    reviewChecklist,
    confidence: input || documents.length ? 'medium' : 'low',
    createdAt: nowIso()
  })
}

function buildAuthPageBlueprint(project, input, documents) {
  const allText = `${input}\n${documents.map((doc) => `${doc.name || ''}\n${doc.text || ''}`).join('\n')}`
  const productName = /登录注册/.test(allText) ? '登录注册页面' : '认证页面'
  const profile = {
    productName,
    positioning: '面向真实业务系统的账号认证入口',
    targetUsers: project.targetUsers || '未登录用户、新注册用户、忘记密码用户、需要第三方登录的用户',
    primaryGoal: '让用户安全完成登录、注册、找回密码，并通过后端认证接口拿到明确的成功、失败和下一步反馈。',
    stage: project.stage || 'design',
    coreScenarios: ['账号密码登录', '手机号/邮箱注册', '验证码校验', '忘记密码/重置密码', '第三方登录入口', '登录成功后跳转来源页'],
    sourceSummary: sourceSummary(input, documents) || '用户要求实现登录注册页面，并且按钮点击后必须把表单数据传给后端，由后端返回认证结果给前端。'
  }
  const backendContract = {
    owner: '后端',
    endpoints: [
      {
        method: 'POST',
        path: '/api/auth/login',
        description: '校验账号密码或验证码，成功后返回 token、用户信息和跳转目标。',
        requestFields: ['account', 'password', 'captchaToken?', 'rememberMe?', 'redirectUri?'],
        responseFields: ['token', 'refreshToken', 'user', 'expiresAt', 'nextAction', 'redirectUri']
      },
      {
        method: 'POST',
        path: '/api/auth/register',
        description: '创建账号并返回注册状态，可按业务决定自动登录或跳转登录页。',
        requestFields: ['account', 'password', 'confirmPassword', 'verificationCode', 'agreeTerms'],
        responseFields: ['userId', 'registered', 'autoLogin', 'token?', 'nextAction']
      },
      {
        method: 'POST',
        path: '/api/auth/send-code',
        description: '向手机号或邮箱发送验证码，并返回倒计时和限流状态。',
        requestFields: ['account', 'scene'],
        responseFields: ['sent', 'cooldownSeconds', 'traceId']
      },
      {
        method: 'POST',
        path: '/api/auth/reset-password',
        description: '校验验证码后重置密码，成功后返回下一步动作。',
        requestFields: ['account', 'verificationCode', 'newPassword', 'confirmPassword'],
        responseFields: ['reset', 'nextAction']
      }
    ],
    errorCodes: [
      { code: 'INVALID_CREDENTIALS', message: '账号或密码错误', frontendAction: '保留账号，清空密码，显示字段级错误和忘记密码入口。' },
      { code: 'ACCOUNT_EXISTS', message: '账号已注册', frontendAction: '引导去登录或找回密码。' },
      { code: 'WEAK_PASSWORD', message: '密码强度不足', frontendAction: '展示密码规则并标记不满足项。' },
      { code: 'CODE_EXPIRED', message: '验证码过期或错误', frontendAction: '保留账号，允许重新发送验证码。' },
      { code: 'RATE_LIMITED', message: '请求过于频繁', frontendAction: '禁用提交或发送验证码按钮并展示倒计时。' }
    ]
  }
  const handoff = {
    recommendation: '推荐采用后端/领域服务接管认证逻辑，前端接管表单体验和状态展示的分层方案。',
    frontend: [
      '实现登录页、注册页、忘记密码页的表单、字段校验、loading、错误态、成功跳转。',
      '按接口契约提交 account/password/verificationCode/agreeTerms/redirectUri。',
      '消费后端 token、user、nextAction、errorCode，并决定保存会话、跳转来源页或展示错误。'
    ],
    backend: [
      '实现 /api/auth/login、/api/auth/register、/api/auth/send-code、/api/auth/reset-password。',
      '负责账号校验、密码加密、验证码、限流、token 签发、审计日志和错误码标准化。',
      '如需大模型反馈，由后端在认证通过后调用 LLM 服务生成 nextAction 或安全提示，再返回前端。'
    ],
    dataFlow: [
      '前端收集并本地校验表单',
      '前端 POST 到认证接口',
      '后端校验账号/验证码/密码和限流',
      '后端按需调用账号服务或大模型服务',
      '后端返回 token/user/nextAction/errorCode',
      '前端根据结果跳转、保存会话或展示字段错误'
    ]
  }
  const demoScreens = [
    {
      id: 'login',
      title: '登录页',
      description: '用户输入手机号/邮箱和密码，点击登录后由前端提交给后端认证接口。',
      wireframe: {
        layout: '居中认证面板，左上保留产品名，表单区包含账号、密码、记住我、忘记密码和第三方登录入口。',
        sections: [
          section('账号密码表单', '账号支持手机号或邮箱；密码输入支持显隐切换和 Caps Lock 提示。'),
          section('辅助操作', '记住我、忘记密码、注册入口、第三方登录入口。'),
          section('接口反馈', '提交后按钮 loading；后端返回错误码时展示字段级错误或全局提示。')
        ],
        components: [
          component('input', '账号输入框', '手机号或邮箱，blur 时做格式校验', '输入后更新登录按钮可用状态'),
          component('password-input', '密码输入框', '支持显示/隐藏密码', '提交失败后清空密码并聚焦'),
          component('checkbox', '记住我', '决定 token 持久化策略', '提交时传 rememberMe'),
          component('text-button', '忘记密码', '跳转忘记密码页', '保留当前账号作为重置默认值'),
          component('primary-button', '登录', '调用 POST /api/auth/login', '成功保存 token 并跳转来源页')
        ]
      },
      actions: [
        { label: '登录', to: 'authenticated', api: 'POST /api/auth/login' },
        { label: '去注册', to: 'register' },
        { label: '忘记密码', to: 'reset-password' }
      ]
    },
    {
      id: 'register',
      title: '注册页',
      description: '用户填写账号、验证码、密码并同意协议，点击注册后由后端创建账号。',
      wireframe: {
        layout: '同一认证容器内切换到注册表单，验证码按钮和协议勾选靠近提交按钮。',
        sections: [
          section('注册字段', '账号、验证码、密码、确认密码、协议勾选。'),
          section('验证码流程', '发送验证码调用后端，返回 cooldownSeconds 后前端展示倒计时。'),
          section('注册结果', '注册成功后按后端 autoLogin 决定直接进入系统或跳回登录页。')
        ],
        components: [
          component('input', '手机号/邮箱输入框', '作为账号和验证码接收地址', '格式合法后允许发送验证码'),
          component('input', '验证码输入框', '6 位数字或邮箱码', '错误时展示 CODE_EXPIRED'),
          component('password-strength', '密码强度提示', '展示长度、数字、字母、特殊字符规则', '后端 WEAK_PASSWORD 时同步高亮'),
          component('checkbox', '同意协议', '必选后注册按钮可用', '提交时传 agreeTerms'),
          component('primary-button', '注册', '调用 POST /api/auth/register', '成功进入自动登录或登录页')
        ]
      },
      actions: [
        { label: '发送验证码', to: 'register', api: 'POST /api/auth/send-code' },
        { label: '注册', to: 'authenticated', api: 'POST /api/auth/register' },
        { label: '已有账号登录', to: 'login' }
      ]
    },
    {
      id: 'reset-password',
      title: '忘记密码/重置密码',
      description: '用户通过账号和验证码验证身份，设置新密码后由后端完成密码重置。',
      wireframe: {
        layout: '两步式表单：先验证账号与验证码，再输入新密码和确认密码。',
        sections: [
          section('身份验证', '账号输入、发送验证码、验证码校验。'),
          section('重置密码', '新密码、确认密码、密码强度提示。'),
          section('成功反馈', '重置成功后提示返回登录页，并可自动填充账号。')
        ],
        components: [
          component('stepper', '重置步骤', '验证身份 / 设置新密码', '后端通过后进入下一步'),
          component('input', '账号输入框', '手机号或邮箱', '复用 send-code 接口 scene=reset-password'),
          component('input', '验证码输入框', '验证码过期时允许重新发送', 'CODE_EXPIRED 显示字段错误'),
          component('password-input', '新密码输入框', '复用密码强度规则', '弱密码不允许提交'),
          component('primary-button', '重置密码', '调用 POST /api/auth/reset-password', '成功返回登录页')
        ]
      },
      actions: [
        { label: '发送验证码', to: 'reset-password', api: 'POST /api/auth/send-code' },
        { label: '重置密码', to: 'login', api: 'POST /api/auth/reset-password' }
      ]
    }
  ]
  const reviewChecklist = [
    '登录成功后必须保存 token/user 并跳转来源页或业务首页。',
    '注册成功必须根据 autoLogin/nextAction 决定自动登录、跳转登录页或完善资料。',
    '所有按钮点击必须走后端接口，不能只做前端假状态。',
    '账号、密码、验证码、协议勾选、限流、错误码和 loading 态必须可测试。',
    '前后端接口契约、错误码、Mock 数据和验收用例必须在交付前对齐。'
  ]
  const interactionSpec = buildInteractionSpec({ profile, demoScreens, reviewChecklist })
  const interactionSkillV2 = buildInteractionSkillV2({ profile, demoScreens, interactionSpec })
  const interactionSkillV3 = buildInteractionSkillV3({ profile, demoScreens, interactionSpec, skillV2: interactionSkillV2 })
  return completeBlueprint({
    id: `blueprint-${Date.now()}`,
    projectId: project.id || '',
    type: 'page-blueprint',
    intent: 'auth-page',
    title: `${profile.productName} 页面蓝图`,
    profile,
    framework: node(profile.productName, [
      node('认证入口页面', [node('登录页'), node('注册页'), node('忘记密码/重置密码')]),
      node('表单校验', [node('账号格式校验'), node('密码强度'), node('验证码'), node('协议勾选')]),
      node('账号安全', [node('限流'), node('错误码'), node('token 签发'), node('审计日志')]),
      node('认证接口', backendContract.endpoints.map((endpoint) => node(`${endpoint.method} ${endpoint.path}`)))
    ]),
    interactionTree: node('认证主流程', [
      node('登录流程', [node('输入账号密码'), node('POST /api/auth/login'), node('成功跳转来源页'), node('失败展示错误码')]),
      node('注册流程', [node('发送验证码'), node('填写密码和协议'), node('POST /api/auth/register'), node('注册成功后登录或完善资料')]),
      node('找回密码流程', [node('验证身份'), node('设置新密码'), node('POST /api/auth/reset-password'), node('返回登录页')])
    ]),
    outlineDiff: {
      original: documents.length ? documents.map((doc) => doc.name) : ['用户输入：做一个登录注册页面'],
      added: ['登录页', '注册页', '忘记密码/重置密码', '表单校验', '认证接口契约', '前后端分工'],
      changed: ['从泛产品蓝图收敛为页面级认证交付物', '按钮交互从本地状态升级为前端提交后端接口'],
      removed: ['泛化机会验证作为主节点'],
      pending: ['第三方登录提供商', '密码规则', 'token 存储策略', '注册后是否自动登录', '验证码渠道和限流阈值']
    },
    demoScreens,
    interactionSpec,
    interactionSkillV2,
    interactionSkillV3,
    opportunityValidation: null,
    backendContract,
    handoff,
    reviewChecklist,
    confidence: input || documents.length ? 'high' : 'medium',
    createdAt: nowIso()
  })
}

function renderTree(tree, depth = 0) {
  const prefix = depth ? `${'  '.repeat(depth - 1)}- ` : '- '
  const lines = [`${prefix}${tree.title}${tree.meta ? `：${tree.meta}` : ''}`]
  if (tree.ui?.layout) lines.push(`${'  '.repeat(depth + 1)}布局：${tree.ui.layout}`)
  ;(tree.ui?.components || []).forEach((item) => {
    lines.push(`${'  '.repeat(depth + 1)}控件：${item.label}${item.detail ? `，${item.detail}` : ''}${item.behavior ? `；${item.behavior}` : ''}`)
  })
  if (tree.ui?.feedback) lines.push(`${'  '.repeat(depth + 1)}反馈：${tree.ui.feedback}`)
  ;(tree.children || []).forEach((child) => {
    lines.push(...renderTree(child, depth + 1))
  })
  return lines
}

function renderWireframe(screen) {
  if (!screen.wireframe) return screen.description
  const sections = (screen.wireframe.sections || [])
    .map((item) => `- ${item.name}：${item.detail}`)
    .join('\n')
  const components = (screen.wireframe.components || [])
    .map((item) => `- ${item.label}（${item.type}）：${item.detail || '待补充'}`)
    .join('\n')
  return `${screen.description}

布局：${screen.wireframe.layout}

界面区块：
${sections}

控件：
${components}`
}

function renderInteractionSpec(spec = {}) {
  if (!spec.pageSpecs?.length) return '暂无交互说明规格。'
  const standards = (spec.standards || [])
    .map((item) => `- ${item.source}：${item.pattern}`)
    .join('\n')
  const pages = spec.pageSpecs.map((page) => {
    const states = (page.states || [])
      .map((state) => `  - ${state.name}：触发=${state.trigger}；界面=${state.ui}；下一步=${state.next}`)
      .join('\n')
    const events = (page.events || [])
      .map((event) => `  - ${event.gesture} ${event.target}：${event.effect}；反馈=${event.feedback}`)
      .join('\n')
    const exceptions = (page.exceptions || [])
      .map((item) => `  - ${item.trigger}：${item.message}；恢复=${item.recovery}`)
      .join('\n')
    return `### ${page.pageName}
布局：${page.layout}

页面状态矩阵：
${states}

手势 / 事件：
${events}

跳转 / 返回：
- 进入：${page.navigation.entry}
- 下一步：${page.navigation.next}
- 返回：${page.navigation.back}
- 深链：${page.navigation.deepLink}

异常与恢复：
${exceptions}`
  }).join('\n\n')
  const feedback = (spec.feedbackRules || [])
    .map((item) => `- ${item.level}：${item.usage}`)
    .join('\n')
  const nav = (spec.navigationRules || [])
    .map((item) => `- ${item.rule}`)
    .join('\n')
  const checks = (spec.acceptanceChecks || [])
    .map((item) => `- ${item}`)
    .join('\n')
  return `来源：${spec.sourceDoc || '交互说明规范'}

原则：
${(spec.principles || []).map((item) => `- ${item}`).join('\n')}

参考模式：
${standards}

${pages}

反馈层级：
${feedback}

导航与返回规则：
${nav}

验收检查：
${checks}`
}

function renderInteractionSkillV2(skill = {}) {
  if (!skill.version) return '暂无 Interaction Skill v2。'
  const inputStrategy = Object.entries(skill.inputStrategy || {})
    .map(([key, value]) => `- ${key}：${value}`)
    .join('\n')
  const agentStages = (skill.agentStages || [])
    .map((stage) => `- ${stage.name}（${stage.id}）：状态=${(stage.statusFlow || []).join(' -> ')}；产物=${stage.output}`)
    .join('\n')
  const requirementGroups = (skill.requirementGroups || [])
    .map((group) => `- ${group.title}（${group.priority}）：${(group.reviewPoints || []).join('；')}`)
    .join('\n')
  const pageGroups = (skill.pageGroups || [])
    .map((group) => `- ${group.title}（${group.priority}）：页面=${(group.pages || []).join('、')}；目标=${group.goal}；状态=${group.reviewStatus}`)
    .join('\n')
  const solutionGroups = (skill.solutionGroups || [])
    .map((group) => {
      const options = (group.options || [])
        .map((option) => `${option.id === group.selectedOptionId ? '推荐' : option.label}.${option.title}：${option.description}`)
        .join(' / ')
      return `- ${group.title}：${options}`
    })
    .join('\n')
  const qualityChecks = (skill.qualityReport?.checks || [])
    .map((item) => `- ${item.label}：${item.passed ? '通过' : '待修复'}`)
    .join('\n')
  const repairItems = (skill.qualityReport?.repairItems || [])
    .map((item) => `- ${item.reason}；修复=${item.action}`)
    .join('\n')
  const scenarios = (skill.demoScenarioMatrix || [])
    .map((item) => `- ${item.label}（${item.id}）：触发=${item.trigger}；预期=${item.expected}；恢复=${item.recovery}`)
    .join('\n')

  return `版本：${skill.version}

### 输入策略
${inputStrategy}

### Agent 阶段
${agentStages}

### 需求组
${requirementGroups}

### 页面组 / 方案组
页面组：
${pageGroups}

方案组：
${solutionGroups}

### Wireframe Plan JSON
\`\`\`json
${JSON.stringify(skill.wireframePlan || {}, null, 2)}
\`\`\`

### 质量检查与修复
质量分：${skill.qualityReport?.score ?? '待检查'}

检查项：
${qualityChecks}

修复项：
${repairItems}

### Demo 场景矩阵
${scenarios}`
}

function renderInteractionSkillV3(skill = {}) {
  if (!skill.version) return '暂无 Interaction Skill v3。'
  const order = (skill.executionOrder || []).map((item) => `- ${item}`).join('\n')
  const machines = (skill.stateMachines || [])
    .map((machine) => {
      const transitions = (machine.transitions || [])
        .map((transition) => `  - ${transition.event}：${transition.from} -> ${transition.to}；反馈=${transition.uiFeedback}；恢复=${transition.recovery}${transition.route ? `；路由=${transition.route}` : ''}`)
        .join('\n')
      return `### ${machine.pageId} State Machine\n初始状态：${machine.initialState}\n状态：${(machine.states || []).join(' / ')}\n${transitions}`
    })
    .join('\n\n')
  const uiNodes = (skill.uiNodeTree || [])
    .map((page) => {
      const nodes = (page.nodes || [])
        .map((node) => `  - ${node.label}（${node.control}）：位置=${node.placement}；视觉=${node.visualRule}；交互=${node.interactionRule}`)
        .join('\n')
      return `### ${page.title}\n布局：${page.layout}\n${nodes}`
    })
    .join('\n\n')
  const panels = (skill.reviewWorkbench?.panels || [])
    .map((panel) => `- ${panel.title}（${panel.id}）：${panel.placement}；数据=${panel.dataSource}；操作=${panel.action}`)
    .join('\n')
  const gates = (skill.qaProtocol?.gates || [])
    .map((gate) => `- ${gate.label}（${gate.id}）：${gate.required ? '必需' : '可选'}；${gate.passed ? '通过' : '待修复'}`)
    .join('\n')
  const repairLoop = (skill.qaProtocol?.repairLoop || [])
    .map((step) => `- Step ${step.step}：${step.action} -> ${step.output}`)
    .join('\n')

  return `版本：${skill.version}

目标：${skill.goal}

### 执行顺序
${order}

### State Machine
${machines}

### UI Node Tree
${uiNodes}

### Review Workbench
布局：${skill.reviewWorkbench?.layout || '待补充'}

${panels}

### QA Protocol
质量分：${skill.qaProtocol?.score ?? '待检查'}

检查门禁：
${gates}

修复循环：
${repairLoop}

### Demo Schema JSON
\`\`\`json
${JSON.stringify(skill.demoSchema || {}, null, 2)}
\`\`\``
}

export function buildProjectBlueprint({ project = {}, input = '', documents = [] } = {}) {
  const text = textOf(input, documents)
  if (isPodcastorContext(project, text, documents) && !usesUploadedProductContext(project, input, documents)) {
    return buildPodcastorBlueprint(project, input, documents)
  }
  const intent = classifyBlueprintIntent(project, input, documents)
  if (intent === 'auth-page') return buildAuthPageBlueprint(project, input, documents)
  return buildGenericBlueprint(project, input, documents)
}

export function exportBlueprintMarkdown(blueprint) {
  if (blueprint?.designMarkdown) return blueprint.designMarkdown
  return `# ${blueprint.title}

## 项目档案
- 产品名称：${blueprint.profile.productName}
- 产品定位：${blueprint.profile.positioning}
- 目标人群：${blueprint.profile.targetUsers}
- 核心目标：${blueprint.profile.primaryGoal}
- 当前阶段：${blueprint.profile.stage}

## 产品框架
${renderTree(blueprint.framework).join('\n')}

## 原大纲 vs 新需求
### 原大纲
${blueprint.outlineDiff.original.map((item) => `- ${item}`).join('\n')}

### 新增
${blueprint.outlineDiff.added.map((item) => `- ${item}`).join('\n')}

### 修改
${blueprint.outlineDiff.changed.map((item) => `- ${item}`).join('\n')}

### 待确认
${blueprint.outlineDiff.pending.map((item) => `- ${item}`).join('\n')}

## 交互路径树
${renderTree(blueprint.interactionTree).join('\n')}

## 交互说明规格
${renderInteractionSpec(blueprint.interactionSpec)}

## Interaction Skill v2
${renderInteractionSkillV2(blueprint.interactionSkillV2)}

## Interaction Skill v3
${renderInteractionSkillV3(blueprint.interactionSkillV3)}

${blueprint.opportunityValidation ? `## Opportunity Validation
${renderOpportunityValidationMarkdown(blueprint.opportunityValidation)}` : ''}

## 可交互 Demo
${blueprint.demoScreens.map((screen) => `### ${screen.title}\n${renderWireframe(screen)}\n\n跳转：\n${screen.actions.map((action) => `- 点击 ${action.label} -> ${action.to}`).join('\n')}`).join('\n\n')}

## 评审清单
${blueprint.reviewChecklist.map((item) => `- ${item}`).join('\n')}
`
}

function blueprintItem({ blueprint, projectId, sourceAssetId, category, title, content, parsed = {} }) {
  const createdAt = nowIso()
  return {
    id: crypto.randomUUID(),
    projectId,
    sourceType: 'blueprint',
    sourceAssetId,
    category,
    title,
    summary: String(content || '').replace(/\s+/g, ' ').slice(0, 180),
    content,
    meta: '项目蓝图 · 知识沉淀',
    status: '已沉淀',
    parsed,
    evidence: [{
      type: 'project-blueprint',
      title: blueprint.title,
      sourceAssetId,
      text: String(content || '').slice(0, 240),
      capturedAt: createdAt
    }],
    createdAt,
    updatedAt: createdAt
  }
}

function flattenTree(tree, path = []) {
  if (!tree) return []
  const currentPath = [...path, tree.title].filter(Boolean)
  const children = Array.isArray(tree.children) ? tree.children : []
  return [
    {
      title: tree.title,
      meta: tree.meta || '',
      path: currentPath,
      ui: tree.ui || null,
      children: children.map((child) => child.title).filter(Boolean)
    },
    ...children.flatMap((child) => flattenTree(child, currentPath))
  ]
}

export function blueprintKnowledgeItems(blueprint, { projectId = blueprint?.projectId || '', sourceAssetId = blueprint?.id || '' } = {}) {
  if (!blueprint) return []
  const items = []
  const profile = blueprint.profile || {}
  const frameworkNodes = flattenTree(blueprint.framework)
  const interactionNodes = flattenTree(blueprint.interactionTree)
  const demoScreens = Array.isArray(blueprint.demoScreens) ? blueprint.demoScreens : []
  const pending = blueprint.outlineDiff?.pending || []
  const reviewChecklist = blueprint.reviewChecklist || []

  items.push(blueprintItem({
    blueprint,
    projectId,
    sourceAssetId,
    category: 'blueprint-profile',
    title: `${profile.productName || blueprint.title}：项目档案`,
    content: [
      `产品名称：${profile.productName || ''}`,
      `产品定位：${profile.positioning || ''}`,
      `目标人群：${profile.targetUsers || ''}`,
      `核心目标：${profile.primaryGoal || ''}`,
      `当前阶段：${profile.stage || ''}`,
      `核心场景：${(profile.coreScenarios || []).join(' / ')}`
    ].filter(Boolean).join('\n'),
    parsed: { profile }
  }))

  items.push(blueprintItem({
    blueprint,
    projectId,
    sourceAssetId,
    category: 'blueprint-framework',
    title: `${profile.productName || blueprint.title}：产品框架`,
    content: renderTree(blueprint.framework).join('\n'),
    parsed: { nodes: frameworkNodes }
  }))

  interactionNodes
    .filter((node) => node.title)
    .forEach((node) => {
      items.push(blueprintItem({
        blueprint,
        projectId,
        sourceAssetId,
        category: 'blueprint-interaction',
        title: `${profile.productName || blueprint.title}：${node.title}交互路径`,
        content: [
          `路径：${node.path.join(' > ')}`,
          node.children.length ? `子节点：${node.children.join('、')}` : '',
          node.ui?.layout ? `布局：${node.ui.layout}` : '',
          node.ui?.components?.length ? `控件：${node.ui.components.map((component) => `${component.label}（${component.type}）`).join('、')}` : '',
          node.ui?.feedback ? `反馈：${node.ui.feedback}` : ''
        ].filter(Boolean).join('\n'),
        parsed: { node }
      }))
    })

  if (blueprint.interactionSpec) {
    items.push(blueprintItem({
      blueprint,
      projectId,
      sourceAssetId,
      category: 'blueprint-interaction-spec',
      title: `${profile.productName || blueprint.title}：交互说明规格`,
      content: renderInteractionSpec(blueprint.interactionSpec),
      parsed: { interactionSpec: blueprint.interactionSpec }
    }))
  }

  if (blueprint.interactionSkillV2) {
    items.push(blueprintItem({
      blueprint,
      projectId,
      sourceAssetId,
      category: 'blueprint-interaction-skill-v2',
      title: `${profile.productName || blueprint.title}：页面交互说明规则`,
      content: renderInteractionSkillV2(blueprint.interactionSkillV2),
      parsed: { interactionSkillV2: blueprint.interactionSkillV2 }
    }))
  }

  if (blueprint.interactionSkillV3) {
    items.push(blueprintItem({
      blueprint,
      projectId,
      sourceAssetId,
      category: 'blueprint-interaction-skill-v3',
      title: `${profile.productName || blueprint.title}：Demo 生成规则`,
      content: renderInteractionSkillV3(blueprint.interactionSkillV3),
      parsed: { interactionSkillV3: blueprint.interactionSkillV3 }
    }))
  }

  if (blueprint.opportunityValidation) {
    items.push(blueprintItem({
      blueprint,
      projectId,
      sourceAssetId,
      category: 'blueprint-opportunity-validation',
      title: `${profile.productName || blueprint.title}：机会验证`,
      content: renderOpportunityValidationMarkdown(blueprint.opportunityValidation),
      parsed: { opportunityValidation: blueprint.opportunityValidation }
    }))
  }

  demoScreens.forEach((screen) => {
    items.push(blueprintItem({
      blueprint,
      projectId,
      sourceAssetId,
      category: 'blueprint-demo-screen',
      title: `${profile.productName || blueprint.title}：${screen.title}页面结构`,
      content: `${renderWireframe(screen)}\n\n跳转：\n${(screen.actions || []).map((action) => `- 点击 ${action.label} -> ${action.to}`).join('\n')}`,
      parsed: { screen }
    }))
  })

  items.push(blueprintItem({
    blueprint,
    projectId,
    sourceAssetId,
    category: 'blueprint-review',
    title: `${profile.productName || blueprint.title}：待确认与验收`,
    content: [
      '待确认：',
      ...pending.map((item) => `- ${item}`),
      '',
      '评审清单：',
      ...reviewChecklist.map((item) => `- ${item}`)
    ].join('\n'),
    parsed: { pending, reviewChecklist }
  }))

  return items
}

export function deleteMaterialItemsById(items = [], ids = []) {
  const selected = new Set(ids)
  return items.filter((item) => !selected.has(item.id))
}

export function toggleAllMaterialIds(items = [], selectedIds = []) {
  const ids = items.map((item) => item.id).filter(Boolean)
  const selected = new Set(selectedIds)
  return ids.length && ids.every((id) => selected.has(id)) ? [] : ids
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function scriptJson(value) {
  return JSON.stringify(value || null)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
}

function demoScreen(screen) {
  const components = (screen.wireframe?.components || [])
    .map((item) => `<span>${escapeHtml(item.label)}</span>`)
    .join('')
  if (screen.id === 'home') {
    return `<section class="screen active" data-screen="home">
      <div class="hero">
        <h1>Turn Your Ideas Into Podcasts</h1>
        <p>Generate scripts, voices, and video podcasts from ideas, URLs, documents, or audio.</p>
        <div class="creator-card">
          <div class="tabs" role="tablist">
            <button type="button" class="active" data-tab="generate">Generate Script</button>
            <button type="button" data-tab="script">Upload Script</button>
            <button type="button" data-tab="audio">Upload Audio Podcast</button>
          </div>
          <div class="input-wrap">
            <textarea id="composer-input" placeholder="Paste a topic, URL, or upload a document..."></textarea>
            <div class="composer-state" id="composer-status">可直接点 Next 体验完整流程，也可以输入 URL / 上传文档后生成。</div>
          </div>
          <div class="upload-row" id="upload-list"></div>
          <div class="composer-footer">
            <button type="button" class="chip project-switch">Podcastor.ai</button>
            <button type="button" class="chip" data-upload-kind="document">Upload document</button>
            <button type="button" class="chip" data-upload-kind="audio">Upload audio</button>
            <button type="button" class="primary" data-action="next-from-home" data-go="editor">Next</button>
          </div>
        </div>
        <div class="component-tags">${components}</div>
      </div>
    </section>`
  }
  if (screen.id === 'editor') {
    return `<section class="screen" data-screen="editor">
      <div class="editor-shell">
        <aside>
          <h3>Host</h3>
          <button type="button" class="host active" data-host="Talk Show Host">Talk Show Host <small>Natural studio</small></button>
          <button type="button" class="host" data-host="Cartoon Host">Cartoon Host <small>Visual IP</small></button>
          <button type="button" class="host" data-host="Pet Host">Pet Host <small>Entertainment</small></button>
          <div class="side-note" id="host-note">已选择 Talk Show Host</div>
        </aside>
        <main>
          <div class="editor-head">
            <div><h2>Podcast Script</h2><span id="editor-summary">由首页输入自动生成脚本草稿</span></div>
            <button type="button" data-action="preview-audio">Preview Audio</button>
          </div>
          <div class="script-line"><b>Speaker 1</b><textarea id="script-a">Welcome to today's episode...</textarea><select id="voice-a"><option>Warm English Voice</option><option>Energetic Creator Voice</option><option>Calm Chinese Voice</option></select></div>
          <div class="script-line"><b>Speaker 2</b><textarea id="script-b">Let's turn this idea into a podcast.</textarea><select id="voice-b"><option>Clear Studio Voice</option><option>Friendly Interview Voice</option><option>Premium Narrator Voice</option></select></div>
          <div class="audio-panel" id="audio-panel">点击 Preview Audio 生成试听音频。</div>
          <div class="toolbar">
            <button type="button" data-action="swap-roles">Swap Roles</button>
            <button type="button" data-action="add-pause">Add Pause</button>
            <button type="button" data-action="copy-script">Copy Script</button>
            <button type="button" data-action="save-draft" data-go="project">Save Draft</button>
            <button type="button" class="primary" data-action="generate-video" data-go="generating">Generate Video</button>
          </div>
        </main>
      </div>
      <div class="component-tags">${components}</div>
    </section>`
  }
  if (screen.id === 'generating') {
    return `<section class="screen" data-screen="generating">
      <div class="status-page">
        <h2>Generating Video Podcast</h2>
        <div class="stepper" id="generation-steps"><span class="done">Script</span><span class="done">Audio</span><span class="active">Video</span><span>Cover</span></div>
        <div class="video-placeholder" id="video-preview">Video preview will appear here</div>
        <div class="progress"><i id="generation-progress"></i></div>
        <p class="generation-copy" id="generation-copy">正在合成视频播客...</p>
        <button type="button" class="primary" data-action="save-final" data-go="project">Save</button>
      </div>
      <div class="component-tags">${components}</div>
    </section>`
  }
  return `<section class="screen" data-screen="${escapeHtml(screen.id)}">
    <div class="project-page">
      <h2>${escapeHtml(screen.title)}</h2>
      <div class="project-tools"><button type="button" class="active" data-filter="all">All</button><button type="button" data-filter="script">Script</button><button type="button" data-filter="audio">Audio</button><button type="button" data-filter="video">Video</button></div>
      <div class="asset-grid" id="asset-grid"><article>Script Draft</article><article>Audio Episode</article><article>Video Podcast</article><article>Host Preset</article></div>
      <div class="drawer" id="asset-drawer">点击卡片查看资产详情。</div>
      <button type="button" data-action="open-work" data-go="editor">Open Work</button>
    </div>
    <div class="component-tags">${components}</div>
  </section>`
}

function demoTheme(styleVariant = 'studio') {
  const themes = {
    studio: {
      background: '#f6f8fb',
      text: '#20242a',
      accent: '#20242a',
      surface: '#ffffff',
      cardRadius: '18px',
      heroAlign: 'center'
    },
    editorial: {
      background: '#fbfaf7',
      text: '#181818',
      accent: '#6d5dfc',
      surface: '#ffffff',
      cardRadius: '6px',
      heroAlign: 'left'
    },
    product: {
      background: '#f2fbff',
      text: '#10212b',
      accent: '#0ea5b7',
      surface: '#ffffff',
      cardRadius: '14px',
      heroAlign: 'center'
    }
  }
  return themes[styleVariant] || themes.studio
}

function interactionCopy(mode = 'wizard') {
  const map = {
    wizard: 'Wizard flow · one primary next action per screen',
    split: 'Split workspace · navigation and preview stay side by side',
    command: 'Command mode · action toolbar drives the workflow'
  }
  return map[mode] || map.wizard
}

export function buildBlueprintDemoHtml(blueprint, options = {}) {
  const styleVariant = options.styleVariant || 'studio'
  const interactionMode = options.interactionMode || 'wizard'
  const referenceUrl = options.referenceUrl || ''
  const revision = Number(options.revision || 1)
  const theme = demoTheme(styleVariant)
  const screens = (blueprint.demoScreens || []).map(demoScreen).join('\n')
  const firstScreen = blueprint.demoScreens?.[0]?.id || 'home'
  const skillV3 = blueprint.interactionSkillV3 || {}
  const demoSchema = skillV3.demoSchema || {
    pages: blueprint.demoScreens || [],
    scenarios: buildDemoScenarioMatrix(),
    styleVariants: ['studio', 'editorial', 'product'],
    interactionModes: ['wizard', 'split', 'command']
  }
  const stateMachines = skillV3.stateMachines || []
  const qaProtocol = skillV3.qaProtocol || {}
  const refreshStrategy = revision > 1
    ? '刷新策略：强调更快主操作和更明显恢复入口'
    : '刷新策略：首版优先覆盖主路径、上传和异常演练'
  const splitPanel = interactionMode === 'split' ? 'Split Workspace' : 'Split Workspace · 可切换'
  const commandPanel = interactionMode === 'command' ? 'Command Palette' : 'Command Palette · 可切换'
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(blueprint.title)} Demo</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:Inter,"PingFang SC","Microsoft YaHei",Arial,sans-serif;background:${theme.background};color:${theme.text}}button,textarea,select{font:inherit}button{border:1px solid #e3e7ec;background:#fff;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}button:hover{border-color:${theme.accent}}.primary{background:${theme.accent};color:#fff;border-color:${theme.accent}}.app{min-height:100vh;padding:32px}.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.topbar h1{margin:0;font-size:24px}.topbar p{margin:6px 0 0;color:#7b8490}.mode-panels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 14px}.mode-panels article,.demo-qa{border:1px solid #e3e7ec;border-radius:14px;background:#fff;padding:12px}.mode-panels strong,.demo-qa strong{display:block;font-size:13px}.mode-panels span,.demo-qa span,.demo-qa li{color:#626b76;font-size:12px;line-height:1.55}.mode-panels article.active{border-color:${theme.accent};box-shadow:0 8px 24px rgba(20,30,45,.08)}.demo-qa{margin:0 0 18px}.demo-qa ul{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:0;margin:10px 0 0;list-style:none}.demo-qa li{border-radius:999px;background:#eef8f2;color:#16834f;padding:7px 9px;font-weight:800}.scenario-bar{display:flex;align-items:center;gap:8px;margin:0 0 24px;padding:10px;border:1px solid #e3e7ec;border-radius:14px;background:#fff}.scenario-bar strong{font-size:13px}.scenario-bar button{padding:8px 10px;font-size:12px}.scenario-banner{display:none;margin:0 0 18px;padding:12px 14px;border-radius:12px;border:1px solid #e3e7ec;background:#fff;color:#626b76;font-weight:700}.scenario-banner.error,.scenario-banner.unsaved{display:block;border-color:#ffd7d2;background:#fff8f6;color:#b42318}.scenario-banner.permission{display:block;border-color:#ffe1a6;background:#fffbeb;color:#92400e}.scenario-banner.empty{display:block;border-color:#d7e7ff;background:#f5f9ff;color:#155eef}.scenario-banner.network{display:block;border-color:#d8dcff;background:#f7f7ff;color:#4f46e5}.screen{display:none}.screen.active{display:block}.hero{min-height:${interactionMode === 'command' ? '620px' : '720px'};display:grid;place-items:center;text-align:${theme.heroAlign}}.hero h1{font-size:${revision > 1 ? '48px' : '52px'};margin:0 0 12px}.hero p{color:#7b8490;font-size:18px}.creator-card{width:min(${interactionMode === 'split' ? '980px' : '860px'},100%);background:${theme.surface};border:1px solid #e3e7ec;border-radius:${theme.cardRadius};box-shadow:0 24px 80px rgba(20,30,45,.08);padding:24px;margin-top:26px}.tabs{display:inline-flex;background:#f0f2f5;border-radius:999px;padding:4px;margin-bottom:18px}.tabs button{border:0;border-radius:999px;background:transparent}.tabs button.active{background:#fff;box-shadow:0 4px 12px rgba(20,30,45,.08);color:${theme.accent}}.input-wrap{position:relative}textarea{width:100%;min-height:160px;border:1px solid #e3e7ec;border-radius:14px;padding:18px;resize:none}.composer-state{position:absolute;left:16px;bottom:12px;color:#7b8490;font-size:12px;pointer-events:none}.upload-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;min-height:30px}.upload-row span,.toast,.audio-panel,.side-note,.drawer{border:1px solid #e3e7ec;border-radius:999px;background:#f8fafc;padding:8px 12px;color:#626b76;font-size:12px}.upload-row span.error{border-color:#ffd7d2;background:#fff8f6;color:#b42318}.composer-footer{display:flex;gap:10px;justify-content:flex-end;align-items:center;margin-top:14px}.chip{background:#f3f5f7}.project-switch{margin-right:auto}.composer-footer [data-go],.toolbar [data-go],.status-page [data-go],.project-page [data-go]{background:${theme.accent};color:#fff;border-color:${theme.accent}}.editor-shell{display:grid;grid-template-columns:${interactionMode === 'split' ? '360px 1fr' : interactionMode === 'command' ? '240px 1fr' : '280px 1fr'};gap:18px;max-width:1160px;margin:0 auto;background:${theme.surface};border:1px solid #e3e7ec;border-radius:${theme.cardRadius};padding:18px;min-height:640px}aside{border-right:1px solid #edf0f3;padding-right:18px}.host{width:100%;display:block;margin:10px 0;text-align:left;min-height:72px}.host small{display:block;color:#7b8490;margin-top:6px}.host.active{border-color:${theme.accent};background:#f8fafc}.editor-head{display:flex;justify-content:space-between;align-items:center}.editor-head h2{margin:0}.editor-head span{color:#7b8490;font-size:13px}.script-line{display:grid;grid-template-columns:120px 1fr 220px;gap:12px;align-items:start;margin:14px 0}.script-line textarea{min-height:110px}.script-line select{height:46px;border:1px solid #e3e7ec;border-radius:10px;padding:0 12px}.toolbar{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}.audio-panel{border-radius:14px;margin-top:10px}.status-page,.project-page{max-width:920px;margin:0 auto;background:${theme.surface};border:1px solid #e3e7ec;border-radius:${theme.cardRadius};padding:28px;min-height:560px}.stepper{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0}.stepper span{border:1px solid #e3e7ec;border-radius:999px;text-align:center;padding:12px;color:#7b8490}.stepper .done{background:#ecfdf3;color:#16834f}.stepper .active{background:#e8f6ff;color:#0875be}.video-placeholder{height:300px;border:1px dashed #cdd5df;border-radius:16px;display:grid;place-items:center;color:#7b8490;background:#f8fafc}.progress{height:10px;background:#edf0f3;border-radius:99px;margin:24px 0;overflow:hidden}.progress i{display:block;width:16%;height:100%;background:${theme.accent};transition:width .25s ease}.generation-copy{color:#626b76}.project-tools{display:flex;gap:8px}.project-tools button.active{background:${theme.accent};color:#fff;border-color:${theme.accent}}.asset-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:20px 0}.asset-grid article{height:150px;border:1px solid #e3e7ec;border-radius:14px;background:#f8fafc;padding:18px;font-weight:800;cursor:pointer}.asset-grid article small{display:block;color:#7b8490;margin-top:8px;font-weight:600}.drawer{border-radius:14px;margin:0 0 18px}.component-tags{display:flex;flex-wrap:wrap;gap:8px;margin:22px auto 0;max-width:1160px}.component-tags span{border:1px solid #e3e7ec;background:#fff;border-radius:999px;padding:7px 10px;color:#626b76;font-size:12px;font-weight:700}.reference{margin-top:8px;color:#7b8490;font-size:12px}
  </style>
</head>
<body data-style="${escapeHtml(styleVariant)}" data-interaction="${escapeHtml(interactionMode)}" data-demo-engine="skill-v3">
  <div class="app">
    <header class="topbar">
      <div><h1>${escapeHtml(blueprint.title)} · Demo v${revision}</h1><p>${interactionCopy(interactionMode)}</p>${referenceUrl ? `<div class="reference">参考风格：${escapeHtml(referenceUrl)}</div>` : ''}<div class="reference">${escapeHtml(refreshStrategy)}</div></div>
      <button type="button" data-go="${escapeHtml(firstScreen)}">Reset</button>
    </header>
    <section class="mode-panels">
      <article data-mode-panel="wizard" class="${interactionMode === 'wizard' ? 'active' : ''}"><strong>Wizard Flow</strong><span>单页主操作推进，适合快速预览主路径。</span></article>
      <article data-mode-panel="split" class="${interactionMode === 'split' ? 'active' : ''}"><strong>${escapeHtml(splitPanel)}</strong><span>左侧上下文和右侧画布并排，适合评审页面组。</span></article>
      <article data-mode-panel="command" class="${interactionMode === 'command' ? 'active' : ''}"><strong>${escapeHtml(commandPanel)}</strong><span>用命令工具栏驱动生成、保存、恢复和跳转。</span></article>
    </section>
    <section class="demo-qa" aria-label="Demo QA">
      <strong>Demo QA · State Machine</strong>
      <span id="qa-summary">基于 Skill v3 检查页面、状态、主路径、上传入口和异常恢复。</span>
      <ul id="qa-gates"></ul>
    </section>
    <section class="scenario-bar" aria-label="异常演练">
      <strong>异常演练</strong>
      <button type="button" data-scenario="normal">恢复正常</button>
      <button type="button" data-scenario="upload-error">上传失败</button>
      <button type="button" data-scenario="permission">权限不足</button>
      <button type="button" data-scenario="empty">空状态</button>
      <button type="button" data-scenario="network">网络失败</button>
      <button type="button" data-scenario="unsaved-back">未保存返回</button>
    </section>
    <div id="scenario-banner" class="scenario-banner"></div>
    ${screens}
  </div>
  <script>
    const demoSchema = ${scriptJson(demoSchema)};
    const stateMachines = ${scriptJson(stateMachines)};
    const qaProtocol = ${scriptJson(qaProtocol)};
    const demoState = {
      pageState: 'idle',
      currentPage: '${escapeHtml(firstScreen)}',
      activeTab: 'generate',
      prompt: '',
      uploads: [],
      host: 'Talk Show Host',
      previewed: false,
      saved: false,
      generationProgress: 16,
      assets: [
        { type: 'script', title: 'Script Draft', meta: '由首页输入生成，可继续编辑' },
        { type: 'audio', title: 'Audio Episode', meta: '试听音频和角色音色' },
        { type: 'video', title: 'Video Podcast', meta: '生成后保存的视频播客' },
        { type: 'host', title: 'Host Preset', meta: '主持人、音色和视觉配置' }
      ]
    };
    function activeMachine(pageId){
      return stateMachines.find((machine)=>machine.pageId === pageId) || null;
    }
    function applyStateTransition(eventName, pageId = demoState.currentPage){
      const machine = activeMachine(pageId);
      if(!machine) return null;
      const transition = machine.transitions.find((item)=>item.event === eventName) || null;
      if(!transition) return null;
      demoState.pageState = transition.to;
      const banner = document.querySelector('#scenario-banner');
      if(banner && transition.uiFeedback) {
        banner.className = 'scenario-banner';
        banner.textContent = 'State Machine · ' + transition.event + '：' + transition.uiFeedback + ' 恢复：' + transition.recovery;
      }
      return transition;
    }
    function runDemoQualityCheck(){
      const gates = qaProtocol.gates || [];
      const list = document.querySelector('#qa-gates');
      const summary = document.querySelector('#qa-summary');
      if(summary) summary.textContent = 'Demo QA：' + (demoSchema.pages || []).length + ' pages · ' + stateMachines.length + ' state machines · ' + ((demoSchema.scenarios || []).length) + ' scenarios';
      if(list) list.innerHTML = gates.map((gate)=>'<li>' + gate.label + '：' + (gate.passed ? '通过' : '待修复') + '</li>').join('');
    }
    const tabConfig = {
      generate: {
        placeholder: 'Paste a topic, URL, or upload a document...',
        status: '输入想法、URL 或上传文档后，将自动生成播客脚本。'
      },
      script: {
        placeholder: 'Upload or paste an existing podcast script...',
        status: '上传脚本文档后，会解析为 Speaker 分段。'
      },
      audio: {
        placeholder: 'Upload an audio podcast to transcribe and edit...',
        status: '上传音频后，会转写成脚本并进入编辑器。'
      }
    };
    function showScreen(id){
      demoState.currentPage = id;
      document.querySelectorAll('.screen').forEach((screen)=>screen.classList.toggle('active', screen.dataset.screen === id));
      if(id === 'editor') renderEditorState();
      if(id === 'generating') startGeneration();
      if(id === 'project') renderAssets('all');
    }
    function renderComposer(){
      document.querySelectorAll('[data-tab]').forEach((button)=>button.classList.toggle('active', button.dataset.tab === demoState.activeTab));
      const input = document.querySelector('#composer-input');
      const status = document.querySelector('#composer-status');
      if(input) {
        input.placeholder = tabConfig[demoState.activeTab].placeholder;
        demoState.prompt = input.value;
      }
      if(status) status.textContent = demoState.prompt ? '已记录输入，点击 Next 进入核心编辑器。' : tabConfig[demoState.activeTab].status;
      const uploadList = document.querySelector('#upload-list');
      if(uploadList) {
        uploadList.innerHTML = demoState.uploads.map((item)=>'<span class="' + (item.status === 'error' ? 'error' : '') + '">' + item.name + ' · ' + (item.status === 'error' ? '解析失败，可删除后重新上传' : '已读取') + '</span>').join('');
      }
    }
    function renderEditorState(){
      const basePrompt = demoState.prompt || '如何把一个产品想法快速做成播客节目';
      const modeLabel = demoState.activeTab === 'audio' ? '音频转写' : demoState.activeTab === 'script' ? '脚本上传' : '脚本生成';
      const summary = document.querySelector('#editor-summary');
      if(summary) summary.textContent = modeLabel + ' · ' + demoState.host + ' · ' + (demoState.uploads.length ? demoState.uploads[0].name : '示例输入');
      const scriptA = document.querySelector('#script-a');
      const scriptB = document.querySelector('#script-b');
      if(scriptA && !scriptA.dataset.touched) scriptA.value = 'Welcome back. Today we turn "' + basePrompt.slice(0, 42) + '" into a clear podcast episode.';
      if(scriptB && !scriptB.dataset.touched) scriptB.value = 'We will shape the hook, key points, voice style, and final video podcast flow.';
      document.querySelectorAll('[data-host]').forEach((button)=>button.classList.toggle('active', button.dataset.host === demoState.host));
      const hostNote = document.querySelector('#host-note');
      if(hostNote) hostNote.textContent = '已选择 ' + demoState.host;
      const audioPanel = document.querySelector('#audio-panel');
      if(audioPanel) audioPanel.textContent = demoState.previewed ? '试听已生成：' + document.querySelector('#voice-a').value + ' + ' + document.querySelector('#voice-b').value : '点击 Preview Audio 生成试听音频。';
    }
    function applyScenario(name){
      demoState.scenario = name;
      const banner = document.querySelector('#scenario-banner');
      if(!banner) return;
      banner.className = 'scenario-banner';
      if(name === 'normal') {
        demoState.uploads = demoState.uploads.filter((item)=>item.status !== 'error');
        if(!demoState.assets.length) {
          demoState.assets = [
            { type: 'script', title: 'Script Draft', meta: '由首页输入生成，可继续编辑' },
            { type: 'audio', title: 'Audio Episode', meta: '试听音频和角色音色' },
            { type: 'video', title: 'Video Podcast', meta: '生成后保存的视频播客' },
            { type: 'host', title: 'Host Preset', meta: '主持人、音色和视觉配置' }
          ];
        }
        banner.textContent = '';
      }
      if(name === 'upload-error') {
        applyStateTransition('upload.failed', 'home');
        banner.classList.add('error');
        banner.textContent = '上传失败：文件格式不支持或解析超时。保留文件名，用户可以删除、重试或改用文本输入。';
        demoState.uploads = [{ name: 'Broken product deck.pdf', kind: 'document', status: 'error' }];
        showScreen('home');
      }
      if(name === 'permission') {
        applyStateTransition('permission.denied', 'editor');
        banner.classList.add('permission');
        banner.textContent = '权限不足：高级音色和视频生成需要登录、项目权限或 credits。当前草稿已保留，可升级或返回编辑。';
        showScreen('editor');
        const audioPanel = document.querySelector('#audio-panel');
        if(audioPanel) audioPanel.textContent = '权限不足：Premium Narrator Voice 需要升级后试听。';
      }
      if(name === 'empty') {
        applyStateTransition('empty.detected', 'project');
        banner.classList.add('empty');
        banner.textContent = '空状态：当前筛选没有作品。说明原因，并给出返回编辑器或创建新作品的主操作。';
        demoState.assets = [];
        showScreen('project');
        renderAssets('all');
        const drawer = document.querySelector('#asset-drawer');
        if(drawer) drawer.textContent = '当前没有资产。点击 Open Work 回到编辑器继续创建。';
      }
      if(name === 'network') {
        banner.classList.add('network');
        banner.textContent = '网络失败：生成任务未完成。保留脚本和配置，允许重试、返回编辑或保存草稿。';
        demoState.generationProgress = 62;
        showScreen('generating');
        const copy = document.querySelector('#generation-copy');
        const preview = document.querySelector('#video-preview');
        if(copy) copy.textContent = '网络中断，视频合成暂停在 62%。';
        if(preview) preview.textContent = '生成失败：可重试或返回编辑';
      }
      if(name === 'unsaved-back') {
        applyStateTransition('back.clicked', 'editor');
        banner.classList.add('unsaved');
        banner.textContent = '未保存返回：检测到脚本、主持人或音色有修改。请选择保存草稿、放弃修改或继续编辑。';
        showScreen('editor');
      }
      renderComposer();
      renderEditorState();
    }
    function startGeneration(){
      demoState.generationProgress = Math.max(demoState.generationProgress, 48);
      renderGeneration();
      window.clearTimeout(window.__demoGenerationTimer);
      window.__demoGenerationTimer = window.setTimeout(()=>{
        demoState.generationProgress = 100;
        renderGeneration();
      }, 700);
    }
    function renderGeneration(){
      const progress = document.querySelector('#generation-progress');
      const copy = document.querySelector('#generation-copy');
      const preview = document.querySelector('#video-preview');
      if(progress) progress.style.width = demoState.generationProgress + '%';
      if(copy) copy.textContent = demoState.generationProgress >= 100 ? '视频播客已生成，可以保存到项目作品库。' : '正在合成视频播客... ' + demoState.generationProgress + '%';
      if(preview) preview.textContent = demoState.generationProgress >= 100 ? 'Generated video podcast preview' : 'Video preview will appear here';
      document.querySelectorAll('#generation-steps span').forEach((step, index)=>{
        step.className = index < Math.ceil(demoState.generationProgress / 25) - 1 ? 'done' : index === Math.ceil(demoState.generationProgress / 25) - 1 ? 'active' : '';
      });
    }
    function renderAssets(filter = 'all'){
      document.querySelectorAll('[data-filter]').forEach((button)=>button.classList.toggle('active', button.dataset.filter === filter));
      const grid = document.querySelector('#asset-grid');
      if(!grid) return;
      const assets = demoState.assets.filter((asset)=>filter === 'all' || asset.type === filter);
      grid.innerHTML = assets.map((asset, index)=>'<article data-asset-index="' + index + '"><strong>' + asset.title + '</strong><small>' + asset.meta + '</small></article>').join('');
    }
    document.addEventListener('click', (event)=>{
      const tab = event.target.closest('[data-tab]');
      if(tab) {
        demoState.activeTab = tab.dataset.tab;
        renderComposer();
      }
      const upload = event.target.closest('[data-upload-kind]');
      if(upload) {
        const name = upload.dataset.uploadKind === 'audio' ? 'Podcast episode.mp3' : demoState.activeTab === 'script' ? 'Podcast script.docx' : 'Product idea.pdf';
        demoState.uploads = [{ name, kind: upload.dataset.uploadKind }];
        applyStateTransition('upload.started', 'home');
        applyStateTransition('upload.parsed', 'home');
        renderComposer();
      }
      const host = event.target.closest('[data-host]');
      if(host) {
        demoState.host = host.dataset.host;
        renderEditorState();
      }
      const action = event.target.closest('[data-action]');
      if(action?.dataset.action === 'next-from-home') {
        const input = document.querySelector('#composer-input');
        demoState.prompt = input?.value || 'Podcastor.ai 新用户如何从想法生成一集播客';
        applyStateTransition('primary.clicked', 'home');
      }
      if(action?.dataset.action === 'preview-audio') {
        demoState.previewed = true;
        renderEditorState();
      }
      if(action?.dataset.action === 'swap-roles') {
        const a = document.querySelector('#script-a');
        const b = document.querySelector('#script-b');
        if(a && b) {
          const value = a.value;
          a.value = b.value;
          b.value = value;
          a.dataset.touched = 'true';
          b.dataset.touched = 'true';
        }
      }
      if(action?.dataset.action === 'add-pause') {
        const a = document.querySelector('#script-a');
        if(a) {
          a.value += '\\n[Pause 1.5s]';
          a.dataset.touched = 'true';
        }
      }
      if(action?.dataset.action === 'copy-script') {
        const panel = document.querySelector('#audio-panel');
        if(panel) panel.textContent = '脚本已复制到剪贴板模拟区。';
      }
      if(action?.dataset.action === 'save-draft' || action?.dataset.action === 'save-final') {
        applyStateTransition('primary.clicked', action.dataset.action === 'save-final' ? 'generating' : 'editor');
        demoState.saved = true;
        if(!demoState.assets.some((asset)=>asset.title === 'Saved Podcast Work')) {
          demoState.assets.unshift({ type: 'video', title: 'Saved Podcast Work', meta: '刚刚保存的可继续编辑作品' });
        }
      }
      if(action?.dataset.action === 'generate-video') {
        applyStateTransition('primary.clicked', 'editor');
      }
      if(action?.dataset.action === 'open-work') {
        applyStateTransition('primary.clicked', 'project');
      }
      const filter = event.target.closest('[data-filter]');
      if(filter) renderAssets(filter.dataset.filter);
      const asset = event.target.closest('[data-asset-index]');
      if(asset) {
        const drawer = document.querySelector('#asset-drawer');
        if(drawer) drawer.textContent = '资产详情：可打开、复用、下载或继续编辑。';
      }
      const scenario = event.target.closest('[data-scenario]');
      if(scenario) applyScenario(scenario.dataset.scenario);
      const target = event.target.closest('[data-go]');
      if(target) showScreen(target.dataset.go);
    });
    document.addEventListener('input', (event)=>{
      if(event.target.id === 'composer-input') {
        demoState.prompt = event.target.value;
        renderComposer();
      }
      if(event.target.id === 'script-a' || event.target.id === 'script-b') {
        event.target.dataset.touched = 'true';
      }
    });
    renderComposer();
    renderEditorState();
    runDemoQualityCheck();
  </script>
</body>
</html>`
}
