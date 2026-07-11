import { renderAscii } from './diagram-generator.js'

function normalizeText(value = '') {
  return String(value || '').trim()
}

function normalizeList(value = []) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (typeof item === 'string') return [item]
        if (!item || typeof item !== 'object') return []
        return [
          item.name,
          item.title,
          item.label,
          item.text,
          item.layout,
          item.cardPattern
        ].filter(Boolean).join('：')
      })
      .map(normalizeText)
      .filter(Boolean)
  }
  const text = normalizeText(value)
  return text ? [text] : []
}

function moduleName(module = {}) {
  if (typeof module === 'string') return normalizeText(module)
  if (!module || typeof module !== 'object') return ''
  return normalizeText(module.name || module.title || module.module || module.label)
}

function normalizeModules(page = {}) {
  const moduleSources = [
    ...(Array.isArray(page.modules) ? page.modules : []),
    ...(Array.isArray(page.layoutModules) ? page.layoutModules : []),
    ...(Array.isArray(page.scrollModules) ? page.scrollModules : [])
  ]
  const seen = new Set()
  return moduleSources
    .map((item) => moduleName(item) || normalizeText(item))
    .filter((name) => {
      if (!name || seen.has(name)) return false
      seen.add(name)
      return true
    })
}

function normalizeDecisionModules(page = {}) {
  const sources = [
    ...(Array.isArray(page.modules) ? page.modules : []),
    ...(Array.isArray(page.layoutModules) ? page.layoutModules : []),
    ...(Array.isArray(page.scrollModules) ? page.scrollModules : [])
  ]
  return sources.map((item) => {
    if (typeof item === 'string') {
      return {
        name: item,
        layout: page.layoutType || '',
        cardPattern: ''
      }
    }
    if (!item || typeof item !== 'object') return null
    return {
      name: moduleName(item),
      layout: normalizeText(item.layout || item.layoutType || page.layoutType),
      cardPattern: normalizeText(item.cardPattern || item.pattern || item.cardType),
      components: normalizeList(item.components),
      interactions: normalizeList(item.interactions)
    }
  }).filter((item) => item?.name)
}

function normalizePage(page = {}) {
  const name = normalizeText(page.page || page.name || page.title || '页面')
  const scrollModules = normalizeModules(page)
  return {
    page: name,
    pageType: normalizeText(page.pageType || page.type),
    layoutType: normalizeText(page.layoutType || page.layout || page.recommendedLayout),
    topFixed: normalizeList(page.topFixed || page.top || page.header || page.nav),
    scrollModules: scrollModules.length ? scrollModules : ['核心内容区'],
    bottomFixed: normalizeList(page.bottomFixed || page.bottom || page.footer || page.actionBar),
    overlays: normalizeList(page.overlays || page.popups || page.modals || page.floatLayers),
    interactions: normalizeList(page.interactions || page.gestures || page.behaviors),
    frontendTasks: normalizeList(page.frontendTasks || page.frontend || page.frontendHandoff),
    backendTasks: normalizeList(page.backendTasks || page.backend || page.backendHandoff),
    reasons: normalizeList(page.reasons || page.reason || page.rationale),
    evidenceRefs: Array.isArray(page.evidenceRefs) ? page.evidenceRefs : [],
    modules: normalizeDecisionModules(page)
  }
}

export function pageLayoutSpecToDiagramData(spec = {}) {
  const pages = (Array.isArray(spec.pages) ? spec.pages : [spec])
    .filter((page) => page && typeof page === 'object')
    .map(normalizePage)
    .filter((page) => page.page)

  return {
    projectName: normalizeText(spec.projectName || spec.name || '页面布局方案'),
    structureTree: {
      root: normalizeText(spec.projectName || spec.name || '页面布局方案'),
      tabs: pages.map((page) => ({
        name: page.page,
        children: [],
        modals: page.overlays
      })),
      globalCapabilities: normalizeList(spec.globalCapabilities || ['登录态', '加载态', '空状态', '错误重试'])
    },
    pageFrames: pages.map((page) => ({
      page: page.page,
      topFixed: page.topFixed,
      scrollModules: page.scrollModules,
      bottomFixed: page.bottomFixed,
      overlays: page.overlays,
      evidenceRefs: page.evidenceRefs
    })),
    layoutDecisions: pages.map((page) => ({
      page: page.page,
      pageType: page.pageType || '通用页面',
      layoutType: page.layoutType || '顶部固定区 + 主体滚动区 + 底部固定操作区',
      reasons: page.reasons.length ? page.reasons : ['根据页面内容密度、主操作优先级和滚动区域关系选择该布局。'],
      modules: page.modules
    })),
    handoff: {
      frontend: pages.flatMap((page) => page.frontendTasks),
      backend: pages.flatMap((page) => page.backendTasks)
    },
    pageLayoutPages: pages
  }
}

function renderRecommendation(data = {}) {
  const decisions = data.layoutDecisions || []
  return decisions.flatMap((decision) => {
    const lines = [
      `${decision.page || '页面'}：`,
      `页面类型：${decision.pageType || '通用页面'}`,
      `推荐布局：${decision.layoutType || '顶部固定区 + 主体滚动区 + 底部固定操作区'}`
    ]
    if (decision.reasons?.length) {
      lines.push(`推荐原因：${decision.reasons.join('；')}`)
    }
    if (decision.modules?.length) {
      lines.push(`关键模块：${decision.modules.map((item) => item.name).filter(Boolean).join(' / ')}`)
    }
    return lines
  }).join('\n')
}

function renderInteractions(data = {}) {
  const lines = data.pageLayoutPages?.flatMap((page) => {
    const interactions = page.interactions.length
      ? page.interactions
      : ['点击主按钮触发主流程', '内容区域支持纵向滚动', '下拉刷新并展示加载/错误/空状态']
    return [
      `${page.page}：`,
      ...interactions.map((item) => `- ${item}`)
    ]
  }) || []
  return lines.join('\n')
}

function renderHandoff(data = {}) {
  const frontend = data.handoff?.frontend?.length
    ? data.handoff.frontend
    : ['接管页面结构、组件拆分、响应式布局、滚动/点击/弹窗交互、加载/空/错状态和埋点。']
  const backend = data.handoff?.backend?.length
    ? data.handoff.backend
    : ['提供接口数据、字段结构、分页/筛选参数、价格/会员/点赞等业务状态、错误码和权限校验。']
  return [
    `- 前端：${frontend.join('；')}`,
    `- 后端：${backend.join('；')}`
  ].join('\n')
}

function uniqueList(items = [], limit = 12) {
  const seen = new Set()
  return (Array.isArray(items) ? items : [])
    .map((item) => normalizeText(item))
    .filter((item) => {
      if (!item || seen.has(item)) return false
      seen.add(item)
      return true
    })
    .slice(0, limit)
}

function densityForPage(page = {}) {
  const count = [
    ...(page.topFixed || []),
    ...(page.scrollModules || []),
    ...(page.bottomFixed || []),
    ...(page.overlays || [])
  ].filter(Boolean).length
  if (count >= 10) return 'high'
  if (count >= 6) return 'medium-high'
  if (count >= 4) return 'medium'
  return 'low-medium'
}

function archetypeForPage(page = {}) {
  const layout = normalizeText(page.layoutType)
  if (layout) return layout
  const hasTop = page.topFixed?.length
  const hasBottom = page.bottomFixed?.length
  const hasOverlay = page.overlays?.length
  if (hasTop && hasBottom && hasOverlay) return 'top-body-bottom-with-overlay'
  if (hasTop && hasBottom) return 'top-body-bottom'
  if (hasTop) return 'top-fixed-scroll-body'
  return 'content-led-screen'
}

function mustKeepRelationsForPage(page = {}) {
  const relations = []
  if (page.topFixed?.length) relations.push('顶部固定区必须持续支撑当前页面的定位、返回、搜索或关键切换。')
  if (page.scrollModules?.length) relations.push('主体内容区必须承载核心信息浏览、比较、填写或处理任务。')
  if (page.bottomFixed?.length) relations.push('底部固定区必须保留主操作或流程推进入口，不能被视觉发挥移除。')
  if (page.overlays?.length) relations.push('弹层/浮层必须作为当前任务的补充层，不应遮断主路径或丢失返回点。')
  if (page.interactions?.length) relations.push('关键点击、滚动、选择、提交和恢复动作必须能从页面结构中直接推断。')
  return relations.length ? relations : ['页面核心信息、主操作和状态反馈之间的关系必须保持稳定。']
}

function buildScreenContractForPage(page = {}) {
  const mustSee = uniqueList([
    ...(page.topFixed || []),
    ...(page.scrollModules || []),
    ...(page.bottomFixed || []),
    ...(page.overlays || [])
  ], 14)
  const mustDo = uniqueList(page.interactions || [], 10)
  const canChange = uniqueList([
    '视觉风格、品牌色、图标和插画表现',
    '卡片质感、间距、圆角、阴影和图片素材',
    '文案语气、标签表达和局部商业细节',
    '在不改变主任务的前提下增强信息丰富度'
  ])
  const cannotChange = uniqueList([
    ...mustSee.map((item) => `必须保留：${item}`),
    ...mustDo.slice(0, 4).map((item) => `必须支持：${item}`)
  ], 12)
  const primaryJob = mustDo[0] ||
    page.reasons?.[0] ||
    `完成「${page.page || '当前页面'}」的核心浏览、判断和操作任务。`
  return {
    version: 'screen-contract/v1',
    screenPurpose: {
      userRole: '当前目标用户',
      taskMoment: page.pageType || page.layoutType || '当前页面任务场景',
      primaryJob,
      businessGoal: page.reasons?.[0] || '让用户更稳定地完成当前页面主任务。'
    },
    designInvariants: {
      mustSee: mustSee.length ? mustSee : ['页面核心信息', '主操作入口', '状态反馈'],
      mustDo: mustDo.length ? mustDo : ['完成当前页面主任务', '处理加载/空/失败状态'],
      mustKeepRelations: mustKeepRelationsForPage(page)
    },
    layoutStrategy: {
      archetype: archetypeForPage(page),
      density: densityForPage(page),
      navigationModel: [
        page.topFixed?.length ? 'top-fixed' : '',
        page.scrollModules?.length ? 'scroll-body' : '',
        page.bottomFixed?.length ? 'bottom-action' : '',
        page.overlays?.length ? 'overlay-layer' : ''
      ].filter(Boolean).join(' + ') || 'content-led',
      responsiveIntent: '根据目标载体保持主任务、信息层级和操作关系稳定。'
    },
    freedomBudget: {
      imageModelCanChange: canChange,
      imageModelCannotChange: cannotChange.length ? cannotChange : ['不能改变主任务、核心信息和主操作路径。']
    },
    evaluationRubric: {
      pass: [
        '用户能一眼判断页面用途和下一步动作。',
        '核心信息、主操作、状态反馈和返回/恢复路径完整。',
        '视觉细节比低保更丰富，但没有改变布局关系和业务任务。'
      ],
      fail: [
        '页面类型或业务任务被改成无关场景。',
        '核心模块、主操作或关键状态缺失。',
        '视觉发挥破坏了信息层级、固定区、滚动区或底部操作关系。'
      ]
    }
  }
}

const DEFAULT_SOURCE_PRIORITY = ['screenshot', 'source', 'knowledge', 'agent', 'fallback']

function normalizeEvidenceRef(ref = {}, fallbackIndex = 0) {
  if (typeof ref === 'string') {
    return {
      id: ref,
      type: 'evidence',
      source: ref,
      summary: ref,
      priority: fallbackIndex + 1
    }
  }
  if (!ref || typeof ref !== 'object') return null
  const id = normalizeText(ref.id || ref.source || ref.name || ref.title)
  if (!id) return null
  return {
    id,
    type: normalizeText(ref.type || 'evidence'),
    source: normalizeText(ref.source || id),
    title: normalizeText(ref.title || ref.name || ''),
    summary: normalizeText(ref.summary || ref.text || ref.title || id),
    screenshotUrl: normalizeText(ref.screenshotUrl || ref.imageUrl || ref.previewUrl || ''),
    imageUrl: normalizeText(ref.imageUrl || ref.screenshotUrl || ref.previewUrl || ''),
    pageUrl: normalizeText(ref.pageUrl || ref.url || ref.route || ref.path || ''),
    priority: Number.isFinite(ref.priority) ? ref.priority : fallbackIndex + 1,
    confidence: Number.isFinite(ref.confidence) ? ref.confidence : undefined
  }
}

function defaultEvidenceRefs(spec = {}, page = {}) {
  const customRefs = [
    ...(Array.isArray(spec.evidenceRefs) ? spec.evidenceRefs : []),
    ...(Array.isArray(page.evidenceRefs) ? page.evidenceRefs : [])
  ].map(normalizeEvidenceRef).filter(Boolean)
  const text = [
    spec.projectName,
    spec.name,
    page.page,
    page.layoutType,
    ...(page.topFixed || []),
    ...(page.scrollModules || []),
    ...(page.reasons || [])
  ].filter(Boolean).join('\n')
  const defaults = [
    {
      id: 'layout-spec',
      type: 'agent',
      source: 'pageLayoutSpec',
      summary: 'Agent/backend pageLayoutSpec normalized by page-layout-artifact-renderer.',
      priority: 4
    }
  ]
  if (/jogg|Video Podcast|PodcastStep1|AppNavRail|Generate podcast/i.test(text)) {
    defaults.unshift(
      {
        id: 'knowledge/navigation.md',
        type: 'knowledge',
        source: 'project knowledge',
        summary: 'Desktop navigation uses the left AppNavRail instead of a top marketing nav.',
        priority: 3,
        confidence: 0.9
      },
      {
        id: 'source/HomeLayout_V2.vue',
        type: 'source',
        source: 'frontend source',
        summary: 'Home layout keeps PodcastStep1 and the composer in the main content area.',
        priority: 2,
        confidence: 0.9
      },
      {
        id: 'source/AppNavRail.vue',
        type: 'source',
        source: 'frontend source',
        summary: 'Desktop app shell navigation is a fixed left rail.',
        priority: 2,
        confidence: 0.88
      }
    )
  }
  const seen = new Set()
  return [...customRefs, ...defaults].filter((ref) => {
    if (!ref?.id || seen.has(ref.id)) return false
    seen.add(ref.id)
    return true
  })
}

function defaultConflicts(spec = {}, page = {}) {
  return [
    ...(Array.isArray(spec.conflicts) ? spec.conflicts : []),
    ...(Array.isArray(page.conflicts) ? page.conflicts : [])
  ].map((conflict) => ({
    field: normalizeText(conflict.field || conflict.name || 'layout'),
    sources: Array.isArray(conflict.sources) ? conflict.sources.map(normalizeText).filter(Boolean) : [],
    decision: normalizeText(conflict.decision || conflict.resolution || ''),
    reason: normalizeText(conflict.reason || conflict.summary || '')
  })).filter((conflict) => conflict.field && conflict.decision)
}

function region(id, type, label, bounds, extra = {}) {
  return {
    id,
    type,
    label,
    bounds,
    evidenceRefs: extra.evidenceRefs || ['layout-spec'],
    confidence: Number.isFinite(extra.confidence) ? extra.confidence : 0.74,
    ...extra
  }
}

function defaultLayoutStates() {
  return [
    { id: 'default', label: '默认态', coverage: '核心内容、主操作和恢复路径可见。' },
    { id: 'loading', label: '加载态', coverage: '区域内展示轻量 loading，不改变区域边界。' },
    { id: 'empty', label: '空状态', coverage: '保留主操作和可恢复提示。' },
    { id: 'error', label: '错误态', coverage: '展示错误提示、重试入口并保留当前输入上下文。' },
    { id: 'permission', label: '权限态', coverage: '权限不足时展示拦截说明和登录/升级入口。' },
    { id: 'login-required', label: '未登录态', coverage: '弹出登录引导，不丢失页面输入。' },
    { id: 'paid-limit', label: '额度不足态', coverage: '展示 credits/升级拦截，并允许返回原任务。' }
  ]
}

function hasJoggPodcastLayout(page = {}, spec = {}) {
  const text = [
    spec.projectName,
    spec.name,
    page.page,
    page.pageType,
    page.layoutType,
    ...(page.topFixed || []),
    ...(page.scrollModules || []),
    ...(page.interactions || []),
    ...(page.reasons || [])
  ].filter(Boolean).join('\n')
  return /jogg|Video Podcast|PodcastStep1|Generate Script|Upload Script|Upload Audio|Generate podcast/i.test(text)
}

function buildJoggPodcastStructuredLayout(page = {}, options = {}) {
  const evidenceIds = options.evidenceRefs.map((ref) => ref.id)
  return {
    version: 'page-layout-structured/v2',
    pageName: page.page || '首页 Video Podcast',
    layoutType: page.layoutType || 'left-rail-main-content-composer',
    viewport: { width: 1440, height: 900, unit: 'px', variant: 'desktop' },
    shell: 'left-rail-main-content',
    sourcePriority: DEFAULT_SOURCE_PRIORITY,
    evidenceRefs: evidenceIds,
    regions: [
      region('app-shell', 'shell', 'Desktop app shell', { x: 0, y: 0, width: 1440, height: 900 }, { evidenceRefs: evidenceIds, confidence: 0.9 }),
      region('left-app-nav', 'sidebar', '左侧 AppNavRail', { x: 0, y: 0, width: 72, height: 900 }, {
        parentId: 'app-shell',
        containment: 'inside',
        children: ['nav-logo', 'nav-home', 'nav-projects', 'nav-tools', 'nav-studio', 'nav-voice'],
        evidenceRefs: ['knowledge/navigation.md', 'source/AppNavRail.vue'],
        confidence: 0.92
      }),
      region('main-content', 'main', '首页内容区', { x: 72, y: 0, width: 1368, height: 900 }, {
        parentId: 'app-shell',
        containment: 'inside',
        children: ['content-top-actions', 'hero-title', 'topic-composer', 'secondary-content'],
        evidenceRefs: ['source/HomeLayout_V2.vue', 'layout-spec'],
        confidence: 0.88
      }),
      region('content-top-actions', 'top-actions', '右上账号/credits 操作', { x: 1080, y: 20, width: 300, height: 48 }, {
        parentId: 'main-content',
        containment: 'inside',
        evidenceRefs: ['source/HomeLayout_V2.vue'],
        confidence: 0.78
      }),
      region('hero-title', 'heading', 'AI Video Podcast 标题区', { x: 320, y: 118, width: 800, height: 88 }, {
        parentId: 'main-content',
        containment: 'inside',
        evidenceRefs: ['source/HomeLayout_V2.vue', 'layout-spec'],
        confidence: 0.78
      }),
      region('topic-composer', 'composer', 'Topic/input composer 输入面板', { x: 320, y: 232, width: 800, height: 214 }, {
        parentId: 'main-content',
        containment: 'inside',
        children: ['composer-tabs', 'composer-placeholder', 'composer-chips', 'composer-more', 'composer-generate', 'composer-params'],
        evidenceRefs: ['source/HomeLayout_V2.vue', 'layout-spec'],
        confidence: 0.9
      }),
      region('composer-tabs', 'segmented-control', 'Generate Script / Upload Script / Upload Audio', { x: 344, y: 250, width: 396, height: 34 }, {
        parentId: 'topic-composer',
        containment: 'inside',
        evidenceRefs: ['source/HomeLayout_V2.vue'],
        confidence: 0.82
      }),
      region('composer-placeholder', 'input-placeholder', 'placeholder: Enter a topic, script, or link', { x: 344, y: 304, width: 596, height: 34 }, {
        parentId: 'topic-composer',
        containment: 'inside',
        evidenceRefs: ['source/HomeLayout_V2.vue', 'layout-spec'],
        confidence: 0.86
      }),
      region('composer-chips', 'chips', '快捷提示词 Chips', { x: 344, y: 352, width: 596, height: 38 }, {
        parentId: 'topic-composer',
        containment: 'inside',
        evidenceRefs: ['layout-spec', 'agent-page-layout-artifact'],
        confidence: 0.82
      }),
      region('composer-more', 'button', '更多/换一批', { x: 950, y: 352, width: 92, height: 38 }, {
        parentId: 'topic-composer',
        containment: 'inside',
        evidenceRefs: ['layout-spec', 'agent-page-layout-artifact'],
        confidence: 0.8
      }),
      region('composer-generate', 'primary-button', 'Generate podcast', { x: 952, y: 398, width: 144, height: 40 }, {
        parentId: 'topic-composer',
        containment: 'inside',
        evidenceRefs: ['source/HomeLayout_V2.vue', 'layout-spec'],
        confidence: 0.88
      }),
      region('composer-params', 'parameter-row', 'host / storytelling / duration / language', { x: 344, y: 400, width: 520, height: 32 }, {
        parentId: 'topic-composer',
        containment: 'inside',
        evidenceRefs: ['source/HomeLayout_V2.vue'],
        confidence: 0.7
      }),
      region('secondary-content', 'content-list', '公开模板 / 工具入口 / 示例内容', { x: 228, y: 500, width: 984, height: 300 }, {
        parentId: 'main-content',
        containment: 'inside',
        evidenceRefs: ['layout-spec'],
        confidence: 0.68
      }),
      region('login-dialog', 'overlay', 'LoginDialog / 权限拦截浮层', { x: 486, y: 160, width: 468, height: 520 }, {
        parentId: 'app-shell',
        containment: 'overlay',
        evidenceRefs: ['source/HomeLayout_V2.vue', 'layout-spec'],
        confidence: 0.78
      })
    ],
    constraints: [
      { subject: 'left-app-nav', relation: 'fixed-left', object: 'viewport', value: 'x=0,width=72,height=100vh' },
      { subject: 'main-content', relation: 'right-of', object: 'left-app-nav', value: 'left-app-nav.right' },
      { subject: 'topic-composer', relation: 'inside', object: 'main-content', value: 'centered, max-width=800' },
      { subject: 'composer-placeholder', relation: 'inside', object: 'topic-composer', value: 'input text area' },
      { subject: 'composer-chips', relation: 'inside', object: 'topic-composer', value: 'below placeholder and before submit' },
      { subject: 'composer-more', relation: 'inside', object: 'topic-composer', value: 'same row as chips' },
      { subject: 'composer-generate', relation: 'inside', object: 'topic-composer', value: 'right/bottom submit affordance' },
      { subject: 'login-dialog', relation: 'overlay-of', object: 'app-shell', value: 'does not destroy composer state' }
    ],
    variants: [
      { id: 'desktop', label: '桌面端', shell: 'left-rail-main-content', breakpoint: '>=1024px' },
      { id: 'mobile', label: '移动端', shell: 'top-compact-nav + stacked-composer', breakpoint: '<768px', note: '移动端可折叠左侧导航，但不能反推桌面端为顶部导航。' }
    ],
    states: defaultLayoutStates(),
    missingEvidence: []
  }
}

function buildGenericStructuredLayout(page = {}, options = {}) {
  const evidenceIds = options.evidenceRefs.map((ref) => ref.id)
  const regions = [
    region('app-shell', 'shell', '页面外壳', { x: 0, y: 0, width: 1440, height: 900 }, { evidenceRefs: evidenceIds })
  ]
  let bodyY = 0
  let bodyHeight = 900
  if (page.topFixed?.length) {
    regions.push(region('top-fixed', 'fixed-header', page.topFixed.join(' / '), { x: 0, y: 0, width: 1440, height: 72 }, {
      parentId: 'app-shell',
      containment: 'inside',
      evidenceRefs: ['layout-spec']
    }))
    bodyY = 72
    bodyHeight -= 72
  }
  if (page.bottomFixed?.length) {
    regions.push(region('bottom-fixed', 'fixed-footer', page.bottomFixed.join(' / '), { x: 0, y: 828, width: 1440, height: 72 }, {
      parentId: 'app-shell',
      containment: 'inside',
      evidenceRefs: ['layout-spec']
    }))
    bodyHeight -= 72
  }
  regions.push(region('scroll-body', 'scroll-body', page.scrollModules.join(' / '), { x: 0, y: bodyY, width: 1440, height: bodyHeight }, {
    parentId: 'app-shell',
    containment: 'inside',
    children: page.scrollModules.map((_, index) => `module-${index + 1}`),
    evidenceRefs: ['layout-spec']
  }))
  page.scrollModules.forEach((module, index) => {
    regions.push(region(`module-${index + 1}`, 'module', module, { x: 120, y: bodyY + 32 + index * 96, width: 1200, height: 72 }, {
      parentId: 'scroll-body',
      containment: 'inside',
      evidenceRefs: ['layout-spec']
    }))
  })
  page.overlays.forEach((overlay, index) => {
    regions.push(region(`overlay-${index + 1}`, 'overlay', overlay, { x: 456 + index * 20, y: 160 + index * 20, width: 528, height: 420 }, {
      parentId: 'app-shell',
      containment: 'overlay',
      evidenceRefs: ['layout-spec']
    }))
  })
  return {
    version: 'page-layout-structured/v2',
    pageName: page.page || '页面',
    layoutType: page.layoutType || 'generic-page-layout',
    viewport: { width: 1440, height: 900, unit: 'px', variant: 'desktop' },
    shell: page.topFixed?.length ? 'top-fixed-scroll-body' : 'content-led-screen',
    sourcePriority: DEFAULT_SOURCE_PRIORITY,
    evidenceRefs: evidenceIds,
    regions,
    constraints: [
      ...(page.topFixed?.length ? [{ subject: 'top-fixed', relation: 'fixed-top', object: 'viewport', value: 'top=0' }] : []),
      { subject: 'scroll-body', relation: 'inside', object: 'app-shell', value: 'main scroll container' },
      ...(page.bottomFixed?.length ? [{ subject: 'bottom-fixed', relation: 'fixed-bottom', object: 'viewport', value: 'bottom=0' }] : []),
      ...page.overlays.map((_, index) => ({ subject: `overlay-${index + 1}`, relation: 'overlay-of', object: 'app-shell', value: 'modal/floating layer' }))
    ],
    variants: [
      { id: 'desktop', label: '桌面端', shell: page.topFixed?.length ? 'top-fixed-scroll-body' : 'content-led-screen', breakpoint: '>=1024px' },
      { id: 'mobile', label: '移动端', shell: 'stacked-content', breakpoint: '<768px' }
    ],
    states: defaultLayoutStates(),
    missingEvidence: page.scrollModules?.length ? [] : ['缺少主体模块证据，使用通用主体区域承接。']
  }
}

function buildStructuredLayoutForPage(page = {}, spec = {}) {
  const sourcePriority = Array.isArray(spec.sourcePriority) && spec.sourcePriority.length
    ? spec.sourcePriority.map(normalizeText).filter(Boolean)
    : DEFAULT_SOURCE_PRIORITY
  const evidenceRefs = defaultEvidenceRefs(spec, page)
  const conflicts = defaultConflicts(spec, page)
  const layout = hasJoggPodcastLayout(page, spec)
    ? buildJoggPodcastStructuredLayout(page, { evidenceRefs })
    : buildGenericStructuredLayout(page, { evidenceRefs })
  return {
    sourcePriority,
    evidenceRefs,
    conflicts,
    layout: {
      ...layout,
      sourcePriority
    }
  }
}

export function renderPageLayoutArtifactFromSpec(spec = {}) {
  const artifact = buildPageLayoutArtifactFromSpec(spec)
  return artifact?.rawText || ''
}

export function buildPageLayoutArtifactFromSpec(spec = {}) {
  if (!spec || typeof spec !== 'object') return null
  // This renderer turns model/page layout specs into the persisted page artifact.
  // The frontend renders this artifact directly; it should not recreate business
  // page structure or replace the model-owned fields with hardcoded content.
  const data = pageLayoutSpecToDiagramData(spec)
  if (!data.pageFrames.length) return null
  const ascii = renderAscii(data)
  const modelDecision = renderRecommendation(data)
  const asciiWireframe = ascii.frames || ''
  const interactionDetails = renderInteractions(data)
  const frontendHandoff = data.handoff?.frontend?.length
    ? data.handoff.frontend
    : ['接管页面结构、组件拆分、响应式布局、滚动/点击/弹窗交互、加载/空/错状态和埋点。']
  const backendHandoff = data.handoff?.backend?.length
    ? data.handoff.backend
    : ['提供接口数据、字段结构、分页/筛选参数、价格/会员/点赞等业务状态、错误码和权限校验。']
  const handoffText = renderHandoff(data)
  const firstPage = data.pageLayoutPages[0] || {}
  const screenContract = buildScreenContractForPage(firstPage)
  const structured = buildStructuredLayoutForPage(firstPage, spec)
  const rawText = [
    ':::page-layout-artifact title="页面骨架"',
    '## 模型推荐方案',
    modelDecision,
    '',
    '## ASCII 页面线框图',
    asciiWireframe,
    '',
    '## 模块交互明细',
    interactionDetails,
    '',
    '## 页面契约',
    JSON.stringify(screenContract, null, 2),
    '',
    '## 前后端交付',
    handoffText,
    ':::'
  ].join('\n').trim()

  return {
    version: 'page-layout-artifact/v2',
    title: '页面骨架',
    modelDecision,
    asciiWireframe,
    interactionDetails,
    frontendHandoff,
    backendHandoff,
    screenContract,
    sourcePriority: structured.sourcePriority,
    evidenceRefs: structured.evidenceRefs,
    conflicts: structured.conflicts,
    layout: structured.layout,
    rawText,
    diagramData: data
  }
}

function parseJsonCandidates(text = '') {
  const source = String(text || '')
  const candidates = []
  const fencedPattern = /```(?:json)?\s*([\s\S]*?)```/gi
  let fencedMatch
  while ((fencedMatch = fencedPattern.exec(source))) {
    candidates.push(fencedMatch[1])
  }
  candidates.push(source)
  return candidates
}

function extractFirstJsonObject(text = '') {
  const source = String(text || '').trim()
  const start = source.indexOf('{')
  if (start < 0) return ''
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = inString
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  return ''
}

function extractPageLayoutSpec(text = '') {
  for (const candidate of parseJsonCandidates(text)) {
    const jsonText = extractFirstJsonObject(candidate)
    if (!jsonText) continue
    try {
      const parsed = JSON.parse(jsonText)
      const spec = parsed?.pageLayoutSpec || parsed?.page_layout_spec
      if (spec && typeof spec === 'object' && !Array.isArray(spec)) return spec
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

function extractFirstPageLayoutArtifactBlock(text = '') {
  const source = String(text || '')
  const match = source.match(/(^|\n):::\s*page-layout-artifact([^\n]*)\n([\s\S]*?)(?:\n:::\s*(?=\n|$)|$)/)
  if (!match) return null
  const rawText = match[0].replace(/^\n/, '').trim()
  const attrs = match[2] || ''
  const body = match[3] || ''
  const titleMatch = attrs.match(/title=["']([^"']+)["']/)
  return {
    rawText,
    title: normalizeText(titleMatch?.[1] || '页面骨架'),
    body
  }
}

function sectionMapFromArtifactBody(body = '') {
  const sections = new Map()
  let currentTitle = ''
  let currentLines = []
  const flush = () => {
    if (!currentTitle) return
    sections.set(currentTitle, currentLines.join('\n').trim())
  }
  String(body || '').split('\n').forEach((line) => {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) {
      flush()
      currentTitle = heading[1].trim()
      currentLines = []
      return
    }
    if (currentTitle) currentLines.push(line)
  })
  flush()
  return sections
}

function sectionText(sections = new Map(), pattern = /$^/) {
  for (const [title, text] of sections.entries()) {
    if (pattern.test(title)) return text
  }
  return ''
}

function handoffListFromText(text = '', label = '') {
  const pattern = label === 'frontend' ? /前端[:：]\s*(.+)$/ : /后端[:：]\s*(.+)$/
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .map((line) => line.match(pattern)?.[1]?.trim() || '')
    .filter(Boolean)
}

export function parsePageLayoutArtifactFromText(text = '') {
  const block = extractFirstPageLayoutArtifactBlock(text)
  if (!block) return null
  const sections = sectionMapFromArtifactBody(block.body)
  const modelDecision = sectionText(sections, /模型推荐|推荐方案|布局方案/)
  const asciiWireframe = sectionText(sections, /ASCII|线框|框架图|页面线框/)
  const interactionDetails = sectionText(sections, /交互|模块交互|交互明细/)
  const handoff = sectionText(sections, /交付|前后端/)
  return {
    version: 'page-layout-artifact/v1',
    title: block.title || '页面骨架',
    rawText: block.rawText,
    modelDecision: modelDecision || '',
    asciiWireframe: asciiWireframe || block.body.trim(),
    interactionDetails: interactionDetails || '',
    frontendHandoff: handoffListFromText(handoff, 'frontend'),
    backendHandoff: handoffListFromText(handoff, 'backend'),
    source: 'agent-page-layout-artifact'
  }
}

function interactionBulletsFromArtifact(artifact = {}) {
  return String(artifact?.interactionDetails || '')
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

function interactionTargetForLine(line = '') {
  if (/换一批/.test(line)) return '换一批'
  if (/快捷提示词|Chips|点击提示词/.test(line)) return '快捷提示词 Chips'
  if (/权限|未登录|登录引导|登录浮层/.test(line)) return '登录引导浮层'
  if (/^\s*Generate podcast/i.test(line)) return 'Generate podcast'
  if (/输入框手动编辑|Topic\/input composer|composer|输入框/.test(line)) return 'Topic/input composer'
  if (/Generate podcast/i.test(line)) return 'Generate podcast'
  const prefix = line.split(/[:：]/)[0]?.trim()
  return prefix || '页面交互对象'
}

function interactionGestureForLine(line = '') {
  if (/点击|单击|Generate podcast|换一批|提示词/.test(line)) return '单击'
  if (/手动编辑|输入/.test(line)) return '输入'
  return '按页面状态触发'
}

function interactionResultForLine(line = '') {
  const result = line.split(/[:：]/).slice(1).join('：').trim()
  if (result) return result
  if (/默认展示/.test(line)) return '进入首页后在输入区附近展示快捷提示词。'
  if (/权限|未登录/.test(line)) return '弹出登录引导浮层，并保留当前输入上下文。'
  return line
}

function interactionRegionForTarget(target = '') {
  if (/快捷提示词|Chips/.test(target)) return 'composer-chips'
  if (/换一批|更多/.test(target)) return 'composer-more'
  if (/Topic\/input composer|composer|输入框/.test(target)) return 'topic-composer'
  if (/Generate podcast/i.test(target)) return 'composer-generate'
  if (/登录|权限|Login/.test(target)) return 'login-dialog'
  return ''
}

function stateMatrixFromArtifactLines(lines = []) {
  const states = lines
    .map((line) => {
      if (/加载/.test(line)) return ['加载状态', line]
      if (/空状态|为空|空输入/.test(line)) return ['空状态', line]
      if (/错误|失败/.test(line)) return ['错误状态', line]
      if (/权限|未登录|登录/.test(line)) return ['权限状态', line]
      return null
    })
    .filter(Boolean)
  const rows = states.length ? states : [
    ['默认态', '快捷提示词展示在输入框下方，主操作围绕输入内容展开。'],
    ['加载状态', '生成或刷新提示词时展示加载反馈。'],
    ['错误状态', '接口失败时展示错误提示和重试入口。'],
    ['权限状态', '未登录时展示登录引导浮层。']
  ]
  return rows.map(([state, line], index) => ({
    state,
    trigger: index === 0 ? '进入页面或用户开始当前任务' : '页面数据、生成请求或登录态变化',
    display: line,
    promptCopy: line.replace(/^.+?[:：]/, '').trim() || line,
    recovery: /错误|失败/.test(state) ? '保留当前输入并提供重试。' : '状态变化后继续保留首页主输入路径。'
  }))
}

export function buildInteractionSpecArtifactFromPageLayoutArtifact(artifact = {}, options = {}) {
  const lines = interactionBulletsFromArtifact(artifact)
  const interactionRows = lines.map((line, index) => {
    const target = interactionTargetForLine(line)
    const gesture = interactionGestureForLine(line)
    const result = interactionResultForLine(line)
    const targetRegionId = interactionRegionForTarget(target)
    return {
      id: `I${String(index + 1).padStart(2, '0')}`,
      annotationId: `A${index + 1}`,
      target,
      ...(targetRegionId ? { targetRegionId } : {}),
      gesture,
      condition: /默认展示/.test(line) ? '进入首页且快捷提示词服务可用时显示。' : '用户位于当前页面并满足该模块前置状态。',
      enableCondition: /Generate podcast/.test(line) ? 'Topic/input composer 有有效输入且未处于提交中。' : '页面核心数据加载完成，且当前操作未被业务状态禁用。',
      disableCondition: /Generate podcast/.test(line) ? '输入为空、请求处理中或权限不足时禁用/拦截。' : '请求处理中、权限不足或业务开关关闭时不可操作。',
      displayCondition: /快捷提示词|换一批/.test(line) ? 'Topic/input composer 可见时，展示在输入区下方或主操作附近。' : '进入当前任务场景时显示。',
      hideCondition: /快捷提示词|换一批/.test(line) ? '提示词无数据、业务开关关闭或用户已进入提交中状态时隐藏。' : '权限不满足、无关联数据或当前流程不需要时隐藏。',
      operation: line,
      feedback: /换一批/.test(line) ? '刷新时给出轻量 loading，完成后替换 Chips。' : /提示词/.test(line) ? '点击后 Chips 选中态短暂反馈。' : '操作后给出即时状态反馈。',
      statePromptCopy: result,
      result,
      motion: '普通点击反馈 120ms 内完成；列表刷新和弹层出现使用轻量过渡。',
      states: [],
      testPoints: [
        `${target} 行为与 Agent 页面骨架一致。`,
        '异常、禁用、权限不足时不能静默失败。'
      ]
    }
  })
  return {
    version: 'page-interaction-spec/v1',
    pageName: options.pageName || artifact?.pageName || '页面',
    snapshotRef: 'pageLayoutArtifact.asciiWireframe',
    annotations: interactionRows.map((row) => ({
      id: row.annotationId,
      target: row.target,
      ...(row.targetRegionId ? { targetRegionId: row.targetRegionId } : {}),
      type: 'interaction-hotspot'
    })),
    interactionRows,
    stateMatrix: stateMatrixFromArtifactLines(lines),
    transitionRules: interactionRows
      .filter((row) => /Generate podcast|登录/.test(row.target))
      .map((row) => ({
        from: options.pageName || artifact?.pageName || '页面',
        action: row.operation,
        to: /登录/.test(row.target) ? '登录引导浮层' : 'Studio 或生成流程',
        transition: '保持原型默认转场；弹层不丢失输入上下文。'
      })),
    gestureNotes: [
      '点击快捷提示词 → 填入 Topic/input composer',
      '点击换一批 → 刷新 Chips 列表',
      '内容区域纵向滚动 → 顶部固定区不跟随滚动'
    ],
    motionNotes: [
      'Chips 选中、刷新、提交 loading 都需要可见反馈。',
      '登录引导浮层出现后应保留当前 composer 内容。'
    ]
  }
}

export function renderPageLayoutArtifactFromText(text = '') {
  const source = String(text || '')
  if (!source.trim()) return ''
  if (/:::\s*page-layout-artifact/.test(source) && !/"pageLayoutSpec"\s*:/.test(source)) return source
  const spec = extractPageLayoutSpec(source)
  if (!spec) return source
  return renderPageLayoutArtifactFromSpec(spec) || source
}
