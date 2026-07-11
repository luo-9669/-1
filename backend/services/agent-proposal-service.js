import { buildAnalysisQualityGate, buildAnalysisVersionDiff } from './analysis-quality.js'

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function buildCanvasVersion(canvas = {}) {
  const text = stableStringify({
    nodes: Array.isArray(canvas.nodes) ? canvas.nodes : [],
    edges: Array.isArray(canvas.edges) ? canvas.edges : [],
    orderedTabs: Array.isArray(canvas.orderedTabs) ? canvas.orderedTabs : []
  })
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  }
  return `canvas-${Math.abs(hash).toString(36)}-${text.length.toString(36)}`
}

function compactLine(value = '', maxLength = 220) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function uniqueLines(lines = [], limit = 8) {
  const seen = new Set()
  return lines
    .map((line) => compactLine(line))
    .filter((line) => {
      if (!line || seen.has(line)) return false
      seen.add(line)
      return true
    })
    .slice(0, limit)
}

function contentLinesFromText(content = '') {
  return uniqueLines(String(content || '')
    .split(/\n|。|；|;/)
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean), 8)
}

function layoutOptionLabel(index = 0) {
  return ['方案一', '方案二', '方案三'][index] || `方案${index + 1}`
}

function layoutOptionFrameworkRows(option = {}) {
  return uniqueLines(
    option.frameworkRows ||
    option.sharedFramework ||
    option.pageFramework ||
    option.wireframeRows ||
    option.pageStructure ||
    [],
    12
  )
}

function cleanFrameworkLine(line = '') {
  return compactLine(String(line || '')
    .replace(/[┌┐└┘│─├┤┬┴┼╭╮╰╯═║╠╣╦╩╬]+/g, ' ')
    .replace(/^\s*[-*•\d.]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim(), 180)
}

function currentPageFrameworkRows(context = {}, nodeTitle = '当前页面') {
  const node = context.currentNode || context.node || {}
  const artifact = node.pageLayoutArtifact && typeof node.pageLayoutArtifact === 'object' && !Array.isArray(node.pageLayoutArtifact)
    ? node.pageLayoutArtifact
    : {}
  if (!artifact.asciiWireframe && !artifact.modelDecision) return []
  const sourceLines = [
    artifact.modelDecision,
    artifact.asciiWireframe,
    ...(Array.isArray(node.content) ? node.content : []),
    node.summary
  ]
    .filter(Boolean)
    .flatMap((item) => String(item || '').split(/\r?\n|。|；|;/))
    .map(cleanFrameworkLine)
    .filter((line) =>
      line &&
      line.length >= 4 &&
      !/^(:{3}|#+|JSON|页面骨架|ASCII 页面线框图|模块交互明细|前后端交付)/i.test(line)
    )

  const rows = uniqueLines(sourceLines, 10)
  if (!rows.length) return []
  const hasTitle = rows.some((line) => line.includes(nodeTitle))
  return uniqueLines([
    hasTitle ? '' : `${nodeTitle}：保留当前页面功能大纲与关键控件。`,
    ...rows
  ], 11)
}

function layoutOptionRowsWithStrategy(strategy = '', baseRows = [], fallbackRows = []) {
  const rows = baseRows.length ? baseRows : fallbackRows
  return uniqueLines([
    strategy ? `布局组织：${strategy}` : '',
    ...rows
  ], 12)
}

function alignLayoutOptionsToCurrentPage(options = [], context = {}, nodeTitle = '当前页面') {
  const baseRows = currentPageFrameworkRows(context, nodeTitle)
  if (!baseRows.length) return options
  return (Array.isArray(options) ? options : []).map((option) => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return option
    const strategy = option.layoutStrategy || option.arrangement || option.strategy || option.title || ''
    return {
      ...option,
      frameworkRows: layoutOptionRowsWithStrategy(strategy, baseRows, layoutOptionFrameworkRows(option))
    }
  })
}

function comparisonOptionValue(option = {}, key = '') {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return ''
  if (key === 'style') return compactLine(option.layoutStyle || option.visualTone || option.tone || option.productTone || option.title || '', 180)
  if (key === 'strategy') return compactLine(option.layoutStrategy || option.arrangement || option.strategy || option.title || option.summary || '', 180)
  if (key === 'bestFor') return compactLine(option.bestFor || option.suitableFor || option.scenario || option.summary || '', 180)
  if (key === 'risk') return compactLine(option.risk || option.tradeoff || option.limitation || '需要结合当前页面重点继续确认。', 180)
  if (key === 'framework') {
    const rows = layoutOptionFrameworkRows(option)
      .filter((row) => !/^布局组织[：:]/.test(row))
      .filter((row) => !/沿用当前页面框架内容|保留当前页面功能大纲/.test(row))
      .slice(0, 4)
    return compactLine(rows.join(' / ') || option.summary || '', 220)
  }
  return ''
}

function layoutComparisonRowsFromOptions(options = []) {
  const normalizedOptions = (Array.isArray(options) ? options : []).filter(Boolean).slice(0, 3)
  if (normalizedOptions.length < 3) return []
  return [
    {
      label: '设计调性',
      option1: comparisonOptionValue(normalizedOptions[0], 'style'),
      option2: comparisonOptionValue(normalizedOptions[1], 'style'),
      option3: comparisonOptionValue(normalizedOptions[2], 'style')
    },
    {
      label: '布局组织',
      option1: comparisonOptionValue(normalizedOptions[0], 'strategy'),
      option2: comparisonOptionValue(normalizedOptions[1], 'strategy'),
      option3: comparisonOptionValue(normalizedOptions[2], 'strategy')
    },
    {
      label: '适合场景',
      option1: comparisonOptionValue(normalizedOptions[0], 'bestFor'),
      option2: comparisonOptionValue(normalizedOptions[1], 'bestFor'),
      option3: comparisonOptionValue(normalizedOptions[2], 'bestFor')
    },
    {
      label: '风险取舍',
      option1: comparisonOptionValue(normalizedOptions[0], 'risk'),
      option2: comparisonOptionValue(normalizedOptions[1], 'risk'),
      option3: comparisonOptionValue(normalizedOptions[2], 'risk')
    },
    {
      label: '保留框架',
      option1: comparisonOptionValue(normalizedOptions[0], 'framework'),
      option2: comparisonOptionValue(normalizedOptions[1], 'framework'),
      option3: comparisonOptionValue(normalizedOptions[2], 'framework')
    }
  ].filter((row) => row.option1 || row.option2 || row.option3)
}

function normalizeLayoutComparisonRows(rows = [], options = []) {
  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null
      const values = Array.isArray(row.values) ? row.values : []
      const label = compactLine(row.label || row.title || row.name || '', 60)
      const option1 = compactLine(row.option1 || row.a || row.first || values[0] || '', 220)
      const option2 = compactLine(row.option2 || row.b || row.second || values[1] || '', 220)
      const option3 = compactLine(row.option3 || row.c || row.third || values[2] || '', 220)
      if (!label || (!option1 && !option2 && !option3)) return null
      return { label, option1, option2, option3 }
    })
    .filter(Boolean)
    .slice(0, 8)
  return normalized.length ? normalized : layoutComparisonRowsFromOptions(options)
}

function layoutOptionQualityText(option = {}, fields = []) {
  return fields
    .map((field) => compactLine(option?.[field] || '', 160).toLowerCase())
    .filter(Boolean)
    .join(' | ')
}

function distinctLayoutOptionCount(options = [], fields = []) {
  return new Set(
    (Array.isArray(options) ? options : [])
      .map((option) => layoutOptionQualityText(option, fields))
      .filter(Boolean)
  ).size
}

function normalizeLayoutOptionSemanticText(value = '') {
  return compactLine(value, 240)
    .replace(/方案\s*[A-ZＤＥＦ一二三四五六123456]/gi, '方案')
    .replace(/layout-option-\d+/gi, 'layout-option')
    .replace(/\boption\s*[A-Z0-9]+\b/gi, 'option')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function layoutOptionFrameworkSemanticText(option = {}) {
  const rows = [
    option.layoutStrategy || option.arrangement || option.strategy || '',
    ...layoutOptionFrameworkRows(option).filter((row) => !/沿用当前页面框架内容|保留当前页面功能大纲/.test(row)),
    ...uniqueLines(option.layout || option.items || option.sections || [], 8)
  ]
  return normalizeLayoutOptionSemanticText(rows.join(' | '))
}

function distinctLayoutOptionFrameworkCount(options = []) {
  return new Set(
    (Array.isArray(options) ? options : [])
      .map(layoutOptionFrameworkSemanticText)
      .filter(Boolean)
  ).size
}

function layoutOptionsQualityIssues(options = []) {
  const normalizedOptions = (Array.isArray(options) ? options : []).filter(Boolean).slice(0, 3)
  const issues = []
  if (normalizedOptions.length < 3) issues.push('缺少 3 套完整候选方案')
  if (normalizedOptions.some((option) => !option.layoutStyle)) issues.push('缺少设计调性字段')
  if (normalizedOptions.some((option) => !layoutOptionFrameworkRows(option).length && !uniqueLines(option.layout || [], 4).length)) {
    issues.push('缺少可预览的页面功能大纲')
  }
  if (normalizedOptions.length >= 3 && distinctLayoutOptionCount(normalizedOptions, ['layoutStyle', 'title']) < 3) {
    issues.push('三套方案设计调性区分度不足')
  }
  if (normalizedOptions.length >= 3 && distinctLayoutOptionCount(normalizedOptions, ['layoutStrategy', 'summary']) < 3) {
    issues.push('三套方案布局组织区分度不足')
  }
  if (normalizedOptions.length >= 3 && distinctLayoutOptionFrameworkCount(normalizedOptions) < 3) {
    issues.push('三套方案框架预览区分度不足')
  }
  return issues
}

function guardLayoutOptionsQuality(options = [], fallbackOptions = [], context = {}, nodeTitle = '当前页面') {
  // Contract: repair weak layout candidates, but keep them aligned to the current page framework.
  const issues = layoutOptionsQualityIssues(options)
  if (!issues.length) {
    return {
      options,
      status: 'model-accepted',
      reason: ''
    }
  }
  const fallback = normalizeLayoutOptions(alignLayoutOptionsToCurrentPage(fallbackOptions, context, nodeTitle))
  return {
    options: fallback.length >= 3 ? fallback : options,
    status: 'fallback-applied',
    reason: issues.join('；')
  }
}

function normalizeLayoutOptions(options = []) {
  return (Array.isArray(options) ? options : [])
    .map((option, index) => {
      if (!option || typeof option !== 'object' || Array.isArray(option)) return null
      const id = compactLine(option.id || `layout-option-${index + 1}`, 80)
      const label = compactLine(option.label || layoutOptionLabel(index), 40)
      const title = compactLine(option.title || option.name || label, 80)
      const summary = compactLine(option.summary || option.description || '', 220)
      const layout = uniqueLines(option.layout || option.items || option.sections || [], 8)
      const frameworkRows = layoutOptionFrameworkRows(option)
      const previewRows = frameworkRows.length ? frameworkRows : layout
      const bestFor = compactLine(option.bestFor || option.suitableFor || option.scenario || '', 180)
      const risk = compactLine(option.risk || option.tradeoff || option.limitation || '', 180)
      const layoutStrategy = compactLine(option.layoutStrategy || option.arrangement || option.strategy || '', 160)
      const layoutStyle = compactLine(option.layoutStyle || option.visualTone || option.tone || option.productTone || '', 160)
      const acceptanceCriteria = uniqueLines(option.acceptanceCriteria || option.writeableContent?.acceptanceCriteria || [], 6)
      if (!id || !title || !summary || !previewRows.length) return null
      return {
        id,
        label,
        title,
        summary,
        layout: layout.length ? layout : previewRows,
        ...(frameworkRows.length ? { frameworkRows } : {}),
        ...(layoutStrategy ? { layoutStrategy } : {}),
        ...(layoutStyle ? { layoutStyle } : {}),
        ...(bestFor ? { bestFor } : {}),
        ...(risk ? { risk } : {}),
        writeableContent: {
          summary: compactLine(option.writeableContent?.summary || `${label}：${title}。${summary}`, 300),
          items: uniqueLines(option.writeableItems || option.writeableContent?.items || previewRows, 10),
          acceptanceCriteria
        }
      }
    })
    .filter(Boolean)
    .slice(0, 3)
}

function defaultLayoutOptions(nodeTitle = '当前页面', baseFrameworkRows = []) {
  const options = normalizeLayoutOptions([
    {
      id: 'layout-option-1',
      label: '方案一',
      title: '轻量入口型',
      summary: `${nodeTitle}保留同一套功能大纲，但用更克制的首屏入口降低决策成本，让用户快速理解当前上下文并进入主任务。`,
      bestFor: '适合新用户、移动端首页、选店页、轻量工具入口和需要快速开始的页面。',
      risk: '商业内容和辅助信息露出较少，需要把活动、历史记录、帮助等放到次屏或折叠区。',
      layoutStyle: '轻量、清爽、低认知负担，强调留白和一个明确主入口。',
      layoutStrategy: '首屏只保留上下文、关键状态、主推荐/当前任务和主按钮，辅助内容后置到滚动区或折叠区。',
      frameworkRows: layoutOptionRowsWithStrategy('轻量入口型', baseFrameworkRows, [
        `顶部固定区：保留${nodeTitle}的标题、返回/关闭、定位/切换和必要状态。`,
        '首屏核心区：只放用户马上要做的主任务、当前推荐或继续入口。',
        '内容滚动区：补充活动、历史、说明、帮助和低频入口，不压过主任务。',
        '底部固定区：固定一个清晰主按钮，并保留 loading、禁用和失败恢复反馈。'
      ]),
      layout: [
        '轻顶部上下文 → 单一主任务卡/主推荐 → 次要内容滚动区 → 固定主按钮。',
        '同一批页面功能不删减，只把非主任务信息延后展示。',
        '首屏避免多入口竞争，适合把用户快速带入下一步。'
      ],
      acceptanceCriteria: ['三套方案使用同一页面功能内容，不删减关键区域。', '首屏能一眼看到当前页目标和主操作。']
    },
    {
      id: 'layout-option-2',
      label: '方案二',
      title: '运营推荐型',
      summary: `${nodeTitle}保留同一套功能大纲，但把推荐、权益、活动或热区前置，用更强的运营层级引导用户继续操作。`,
      bestFor: '适合茶饮/电商/内容推荐、会员权益、活动转化、热销推荐和需要提升点击转化的页面。',
      risk: '信息密度更高，必须控制运营模块不能遮挡主路径和主按钮。',
      layoutStyle: '更有活动感和推荐感，强调横幅、推荐卡、权益入口和内容热区。',
      layoutStrategy: '顶部保留上下文，首屏用运营推荐区承接注意力，主任务入口常驻或紧贴推荐区，完整功能在滚动区展开。',
      frameworkRows: layoutOptionRowsWithStrategy('运营推荐型', baseFrameworkRows, [
        `顶部固定区：保留${nodeTitle}的标题、定位/搜索/切换、状态提示和返回入口。`,
        '首屏核心区：前置活动横幅、会员权益、热门推荐或当前任务推荐，但保留主路径入口。',
        '内容滚动区：按推荐优先级组织列表、商品/内容卡、筛选和辅助入口。',
        '底部固定区：固定主操作、购物车/结算/继续入口，并显示操作反馈。'
      ]),
      layout: [
        '顶部上下文 → 运营/推荐首屏 → 主内容流 + 横向推荐/权益入口 → 固定主操作。',
        '同一批页面功能不删减，只改变运营内容和主任务的视觉权重。',
        '需要明确主操作优先级，避免活动区域抢走核心任务。'
      ],
      acceptanceCriteria: ['宽屏和窄屏都有明确的主任务优先级。', '辅助信息不能覆盖或替代当前页面主操作。']
    },
    {
      id: 'layout-option-3',
      label: '方案三',
      title: '效率任务型',
      summary: `${nodeTitle}保留同一套功能大纲，但把高频动作、最近状态、继续任务和关键反馈前置，让目标明确的用户少停顿。`,
      bestFor: '适合老用户、高频任务、订单状态、继续操作、后台工具、效率型 SaaS 或强任务链路页面。',
      risk: '对首次用户解释较少，需要补足空态、首次引导和异常恢复入口。',
      layoutStyle: '紧凑、直接、任务驱动，强调状态、快捷动作和清晰反馈。',
      layoutStrategy: '先展示关键状态/继续动作/快捷入口，再用紧凑列表或分组承载完整内容，主操作与反馈保持常驻。',
      frameworkRows: layoutOptionRowsWithStrategy('效率任务型', baseFrameworkRows, [
        `顶部固定区：保留${nodeTitle}的当前位置、状态提醒、返回/关闭和必要的全局操作。`,
        '首屏核心区：前置最近任务、关键状态、快捷操作或继续入口。',
        '内容滚动区：按“高频 → 次要 → 说明/历史/推荐”的顺序紧凑展开同一套页面内容。',
        '底部固定区：固定主操作和异常恢复入口，操作后给出清晰状态提示。'
      ]),
      layout: [
        '状态/上下文顶部 → 继续任务/快捷操作 → 紧凑内容分组 → 固定操作与反馈。',
        '同一批页面功能不删减，只把高频动作和状态反馈提前。',
        '失败、空态、权限不足等恢复入口靠近主操作或状态提示。'
      ],
      acceptanceCriteria: ['核心任务在首屏即可开始。', '完整页面内容仍可在滚动区找到，不因前置重点而缺失。']
    }
  ])
  return options.map((option) => ({ ...option }))
}

function normalizeInteractionRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null
      const states = uniqueLines(row.states || [], 8)
      const testPoints = uniqueLines(row.testPoints || [], 8)
      return {
        id: compactLine(row.id || row.annotationId || `interaction-row-${index + 1}`, 80),
        annotationId: compactLine(row.annotationId || row.id || `A${index + 1}`, 40),
        target: compactLine(row.target || '', 120),
        gesture: compactLine(row.gesture || '', 80),
        enableCondition: compactLine(row.enableCondition || row.enabledCondition || row.condition || '', 180),
        disableCondition: compactLine(row.disableCondition || row.disabledCondition || '', 180),
        displayCondition: compactLine(row.displayCondition || row.visibleCondition || '', 180),
        hideCondition: compactLine(row.hideCondition || row.hiddenCondition || '', 180),
        operation: compactLine(row.operation || row.operationEffect || '', 220),
        feedback: compactLine(row.feedback || '', 220),
        statePromptCopy: compactLine(row.statePromptCopy || row.promptCopy || row.toastCopy || row.messageCopy || '', 180),
        result: compactLine(row.result || '', 220),
        motion: compactLine(row.motion || row.animation || row.motionNote || '', 220),
        states,
        testPoints
      }
    })
    .filter((row) => row && (row.target || row.feedback || row.result))
    .slice(0, 12)
}

function normalizeStateMatrix(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null
      return {
        state: compactLine(row.state || row.name || '', 100),
        trigger: compactLine(row.trigger || '', 160),
        display: compactLine(row.display || row.ui || '', 180),
        promptCopy: compactLine(row.promptCopy || row.copy || row.message || '', 160),
        recovery: compactLine(row.recovery || row.recover || '', 180)
      }
    })
    .filter((row) => row && (row.state || row.promptCopy || row.recovery))
    .slice(0, 12)
}

function parseJsonObject(value) {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value
  const text = String(value || '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1])
    } catch {}
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {}
  }
  return null
}

function downstreamImpactFromContext(context = {}) {
  return (context.downstreamNodes || []).slice(0, 6).map((node) => ({
    nodeId: node.id,
    reason: `当前节点 ${context.scopeId} 的确认内容会影响「${node.title || node.id}」的口径。`
  }))
}

function canvasActionIntentWriteableContent(context = {}, actionResult = {}, fallbackItems = []) {
  const intent = context.canvasAction?.actionIntent || ''
  const nodeTitle = actionResult.nodeTitle || context.node?.title || context.currentNode?.title || '当前画布'
  const actionLabel = context.canvasAction?.actionLabel || context.canvasAction?.action || '当前动作'
  const currentFrameworkRows = currentPageFrameworkRows(context, nodeTitle)
  const defaultPageLayoutOptions = defaultLayoutOptions(nodeTitle, currentFrameworkRows)
  const map = {
    'target-user-enrichment': {
      summary: `${nodeTitle}需要补齐目标用户分层、进入场景、核心任务、顾虑点和成功标准。`,
      items: [
        '用户分层：未登录用户、新注册用户、忘记密码用户、第三方登录用户需要分别描述。',
        '进入场景：从业务页被动唤起、主动点击登录、注册后回流、忘记密码恢复后返回原任务。',
        '核心任务：快速登录、低摩擦注册、安全找回密码、处理授权失败或账号绑定。',
        '顾虑点：账号安全、验证码可达、第三方授权隐私、错误提示是否可理解。',
        '成功标准：用户能完成主路径并在失败后获得可恢复入口，后续页面结构和校验规则可据此展开。'
      ],
      acceptanceCriteria: [
        '目标用户不再是泛称，至少包含 3 类可设计、可验收的人群。',
        '每类用户都能对应进入场景、核心任务和成功判断。',
        '后续页面结构、表单校验和接口契约能引用这些人群口径。'
      ],
      impactKeyword: '目标用户'
    },
    'positioning-adjustment': {
      summary: `${nodeTitle}需要重新校准页面定位、核心价值、不包含范围、上下游依赖和业务边界。`,
      items: [
        '页面定位：认证弹窗是安全进入系统与账号创建的业务入口，不只是表单集合。',
        '核心价值：降低登录注册摩擦，同时保证账号安全、错误可恢复、成功后能回到原任务。',
        '不包含范围：不在本节点展开复杂账号体系、风控策略后台配置和完整运营增长链路。',
        '上下游依赖：上游由触发登录的业务页面决定，下游影响页面结构、表单校验、接口契约和埋点。',
        '业务边界：登录、注册、忘记密码、第三方授权失败态需要有统一容器和清晰主次任务。'
      ],
      acceptanceCriteria: [
        '页面定位能指导 UX、产品和研发对齐同一交付目标。',
        '明确本期包含和不包含范围，避免后续画布继续发散。',
        '下游节点能基于定位重写结构、校验和接口说明。'
      ],
      impactKeyword: '定位'
    },
    'acceptance-criteria-enrichment': {
      summary: `${nodeTitle}需要补齐可测试、可验收、可追踪的验收标准，覆盖成功路径、失败态和边界条件。`,
      items: [
        '验收场景：覆盖登录、注册、忘记密码、第三方授权和协议确认等主路径。',
        '成功路径：用户输入合法信息后能完成认证，弹窗关闭并回到触发登录前的业务任务。',
        '失败条件：账号密码错误、验证码错误或过期、手机号格式错误、第三方授权失败时必须有字段级或区域级提示。',
        '测试口径：每条验收标准都要能被前端、后端和测试分别验证，不使用“体验良好”“功能正常”等模糊描述。',
        '埋点观察：记录弹窗打开、登录提交、注册提交、找回密码、第三方授权失败和成功回流事件。'
      ],
      acceptanceCriteria: [
        '成功路径、失败态和边界条件都有明确可测试结果。',
        '每条验收标准能对应页面状态、接口返回或埋点事件。',
        '失败态有可恢复入口，不会让用户停留在无反馈状态。',
        '后续接口契约和表单校验能引用这些验收标准。'
      ],
      impactKeyword: '验收标准'
    },
    'api-contract-enrichment': {
      summary: `${nodeTitle}需要补齐接口端点、请求字段、返回字段、错误码、Mock 数据和前后端接管边界。`,
      items: [
        '接口端点：至少明确登录、注册、忘记密码/重置密码、第三方授权回调等端点及方法。',
        '请求字段：账号、密码、验证码、手机号/邮箱、协议确认、redirectUri、第三方 provider 和 traceId 需要标注必填、格式和来源。',
        '返回字段：token、用户基础信息、下一步动作、回跳地址、错误提示文案 key 和安全策略字段需要给前端可消费结构。',
        '错误码：账号不存在、密码错误、验证码错误或过期、账号锁定、第三方授权失败、频控命中和服务超时必须有可恢复说明。',
        '前端接管：表单校验、按钮 loading、错误展示、回跳和本地 Mock；后端接管：认证校验、验证码、风控、token 签发和错误码。',
        'Mock 数据：为成功、字段错误、业务错误、系统异常和第三方失败分别提供示例响应。'
      ],
      acceptanceCriteria: [
        '每个端点都有请求字段、返回字段、错误码和示例 Mock。',
        '前端能基于接口契约实现 loading、错误提示和成功回跳。',
        '后端能基于契约实现认证、风控、验证码和统一错误码。',
        '联调时字段命名、错误码和状态流转不需要二次猜测。'
      ],
      impactKeyword: '接口契约'
    },
    'exception-state-enrichment': {
      summary: `${nodeTitle}需要补齐加载、空、错、权限、超时等异常状态，并明确触发条件、反馈文案和恢复入口。`,
      items: [
        '加载态：提交登录/注册/找回密码后按钮进入 loading，禁止重复提交，并保留用户已输入内容。',
        '空状态：未输入账号、验证码为空或未勾选协议时，展示字段级提示并定位到对应输入项。',
        '错误态：密码错误、验证码错误或第三方授权失败时，说明原因、影响范围和下一步动作。',
        '权限/安全态：账号锁定、频控、二次验证或地区限制需要给出安全说明和可恢复路径。',
        '恢复入口：支持重新输入、重新获取验证码、返回登录、切换注册、重新授权和联系客服。',
        '后端条件：错误状态必须能映射到接口错误码、超时、网络失败或风控返回。'
      ],
      acceptanceCriteria: [
        '每个异常状态都有明确触发条件、UI 反馈和恢复入口。',
        '异常提示不覆盖用户已输入内容，用户能继续完成主任务。',
        '前端状态能对应后端错误码或网络状态，测试可以复现。',
        '加载、失败、超时和权限场景都有可测试结果。'
      ],
      impactKeyword: '异常状态'
    },
    'analytics-enrichment': {
      summary: `${nodeTitle}需要补齐关键事件、触发时机、事件属性、成功指标、漏斗影响和隐私边界。`,
      items: [
        '事件名：auth_modal_open、auth_login_submit、auth_login_success、auth_register_submit、auth_error_show、auth_third_party_fail。',
        '触发时机：弹窗打开、切换登录/注册、提交表单、接口返回成功、错误提示曝光、关闭或成功回跳时记录。',
        '事件属性：entry_source、auth_mode、error_code、provider、is_new_user、duration_ms、redirect_target 和 experiment_id。',
        '转化指标：登录成功率、注册完成率、找回密码完成率、第三方授权失败率、错误恢复率和平均完成耗时。',
        '漏斗影响：从触发登录到认证成功回流分层观察，区分字段校验失败、业务错误和系统失败。',
        '隐私边界：不得上报明文账号、密码、验证码、token 或可直接识别个人身份的信息。'
      ],
      acceptanceCriteria: [
        '埋点事件能覆盖打开、提交、成功、失败、关闭和回流关键节点。',
        '指标能支撑登录注册漏斗分析和异常定位。',
        '事件属性不包含敏感信息，满足隐私和安全边界。',
        '前端、后端和数据同学能按同一事件口径验收。'
      ],
      impactKeyword: '埋点指标'
    },
    'competitor-reference-enrichment': {
      summary: `${nodeTitle}需要补齐竞品参考证据边界、对比维度、检索方向和下一步采集动作。`,
      items: [
        '证据状态：先标明已有内容属于真实竞品证据、项目知识库证据、用户截图/链接，还是仅为行业模式假设。',
        '候选方向：没有明确证据时，只给可检索的产品类型、关键词和场景方向，不编造真实竞品名称、价格或研究结论。',
        '对比维度：围绕首屏入口、主任务路径、快捷开始/模板入口、状态反馈、异常恢复、账号与数据规则拆解。',
        '项目适配：把参考模式转成当前项目可借鉴项和不建议照搬项，不把竞品复杂能力直接塞进本期范围。',
        '补充入口：让用户选择“让 Agent 找 3 个竞品”“上传竞品截图/链接”“从知识库选择参考”之一继续补证据。'
      ],
      acceptanceCriteria: [
        '竞品参考能清楚区分事实证据和模型假设。',
        '没有用户证据或知识库证据时，不出现伪造的真实竞品事实。',
        '输出包含可执行检索方向、对比维度、下一步采集动作，并能指导需求分析画布继续完善。'
      ],
      impactKeyword: '竞品参考'
    },
    'page-layout-plan': {
      summary: `${nodeTitle}需要基于当前页面目标和已有线框补齐可执行的布局方案，明确区域层级、组件位置、固定操作区和响应式约束。`,
      items: [
        '信息层级：先说明首屏必须让用户看到什么、优先操作什么、哪些信息可以折叠或延后展示。',
        '首屏区域：明确顶部导航/状态区、核心内容区、列表或表单区、底部主操作区的相对位置和视觉权重。',
        '组件摆放：按钮、输入框、图片、价格/状态标签、说明文案和二级入口要有稳定位置，避免用户在滚动中丢失主任务。',
        '固定操作区：对结算、提交、保存、下一步等关键动作说明是否吸底、悬浮或随内容滚动，以及禁用/loading 状态。',
        '滚动与手势：说明纵向滚动、横向切换、筛选、展开收起、返回和手势冲突的处理方式。',
        '响应式约束：说明移动端、桌面端或容器宽度变化时哪些区域堆叠、哪些区域保持常驻。'
      ],
      acceptanceCriteria: [
        '布局方案能直接指导低保真线框调整，包含首屏、主要区域和主操作入口。',
        '关键按钮、输入框、图片或列表位置有明确规则，不只停留在抽象原则。',
        '滚动、固定区和响应式变化有可测试判断。',
        '页面调整后仍保留当前页面目标和必要业务关系。'
      ],
      impactKeyword: '布局方案',
      layoutOptions: defaultPageLayoutOptions,
      layoutComparisonRows: layoutComparisonRowsFromOptions(defaultPageLayoutOptions)
    },
    'interaction-detail-enrichment': {
      summary: `${nodeTitle}需要补齐可落地的交互细节，覆盖用户动作、状态反馈、异常恢复和页面跳转。`,
      items: [
        '点击动作：列出主按钮、次按钮、列表项、图片/卡片、返回和关闭等可点击元素的触发结果。',
        '滑动与滚动：说明滚动区域、吸顶/吸底元素、分页加载、横向切换和手势冲突处理。',
        '输入与校验：说明输入框、选择器、上传、搜索或筛选的即时反馈、错误提示和提交前校验。',
        '状态反馈：覆盖 loading、成功、失败、空状态、禁用态、已选中、未选中和操作撤销。',
        '弹窗与浮层：说明弹窗触发条件、关闭方式、二次确认、遮罩点击和层级回退。',
        '跳转目标：列出每个关键动作跳到哪个页面/状态，返回时是否保留筛选、滚动位置和已输入内容。',
        '异常恢复：说明网络失败、接口错误、权限不足、库存/数据变化或超时后的恢复入口。'
      ],
      acceptanceCriteria: [
        '每个关键交互都有触发条件、系统反馈和下一状态。',
        '点击、滑动、输入、弹窗、跳转至少覆盖当前页面的主路径和异常路径。',
        '交互细节能被前端、后端和测试直接转成任务或用例。',
        '异常和失败状态不会让用户停留在无反馈或不可恢复状态。'
      ],
      impactKeyword: '交互细节'
    },
    'supplement-detail': {
      summary: `${nodeTitle}需要补齐当前结论的依据、缺口风险、边界状态和可确认写入内容。`,
      items: [
        '补充结论：明确当前节点已有事实、缺失事实和需要用户确认的判断。',
        '依据与假设：区分来自原始需求、画布事实、知识库引用和模型推断的内容。',
        '缺口与风险：列出影响后续页面、交互、接口和验收的空白点。',
        '可写入画布内容：把可确认的补充资料整理成当前节点条目。',
        '待确认问题：保留无法从上下文确定、需要用户继续补充的问题。'
      ],
      acceptanceCriteria: [
        '补充内容可直接进入当前画布节点。',
        '不把未知信息伪装成项目事实。',
        '后续节点能根据补充结论重新对齐。'
      ],
      impactKeyword: '补充资料'
    },
    reanalysis: {
      summary: `${nodeTitle}需要重新分析当前结论，并明确原结论不足、修正结论和后续影响。`,
      items: [
        '重新分析结论：给出当前节点更新后的核心判断。',
        '原结论不足：指出原画布内容缺少或不准确的部分。',
        '修正内容：补齐用户目标、业务边界、异常状态或验收标准。',
        '后续画布影响：说明哪些后续节点需要随当前结论重算。',
        '确认建议：用户确认后再写入画布并刷新后续节点。'
      ],
      acceptanceCriteria: [
        '新结论比原画布更具体且可交付。',
        '明确哪些内容来自现有画布，哪些是模型修正建议。',
        '后续节点刷新范围清晰。'
      ],
      impactKeyword: '重新分析'
    }
  }
  const shaped = map[intent]
  if (!shaped) return null
  return {
    summary: shaped.summary,
    items: uniqueLines([...shaped.items, ...fallbackItems], 12),
    acceptanceCriteria: uniqueLines(shaped.acceptanceCriteria, 8),
    ...(shaped.layoutOptions ? { layoutOptions: shaped.layoutOptions } : {}),
    ...(shaped.layoutComparisonRows ? { layoutComparisonRows: shaped.layoutComparisonRows } : {}),
    impactKeyword: shaped.impactKeyword,
    actionLabel
  }
}

function canvasActionIntentDownstreamImpact(context = {}, keyword = '') {
  const nodes = Array.isArray(context.downstreamNodes) ? context.downstreamNodes : []
  return nodes.slice(0, 6).map((node) => ({
    nodeId: node.id,
    reason: `${keyword || '当前动作'}会影响「${node.title || node.id}」的内容口径，需要确认后同步刷新。`
  }))
}

function proposalImpactReasonForNode(proposal = {}, nodeId = '') {
  const impact = (Array.isArray(proposal.downstreamImpact) ? proposal.downstreamImpact : [])
    .find((item) => (item?.nodeId || item?.id) === nodeId)
  return compactLine(impact?.reason || '', 260)
}

function proposalRationaleFromContext(context = {}, summary = '') {
  return uniqueLines([
    summary ? `提案结论：${summary}` : '',
    context.node?.summary ? `当前节点目标：${context.node.summary}` : '',
    context.message?.content ? `用户本轮诉求：${context.message.content}` : '',
    context.retrievedKnowledge?.length ? '已结合项目知识库召回片段。' : '',
    context.downstreamNodes?.length ? '当前节点变化会影响后续画布节点，需要确认后同步刷新。' : ''
  ], 5)
}

function proposalContextSourcesFromContext(context = {}) {
  const knowledgeSources = (Array.isArray(context.retrievedKnowledge) ? context.retrievedKnowledge : []).slice(0, 4).map((item) => ({
    type: item.sourceType || item.materialType || 'knowledge',
    title: item.title || item.sourceTitle || '未命名知识',
    snippet: compactLine(item.snippet || item.content || item.text || '', 220),
    matchReason: compactLine(item.matchReason || item.verification?.reason || '与当前问题相关', 160)
  }))
  const canvasSources = [
    context.currentNode?.id ? {
      type: 'canvas-current',
      title: context.currentNode.title || context.currentNode.id,
      snippet: compactLine(context.currentNode.summary || (context.currentNode.content || []).join('；'), 220),
      matchReason: '当前画布节点'
    } : null,
    ...(Array.isArray(context.downstreamNodes) ? context.downstreamNodes.slice(0, 3).map((node) => ({
      type: 'canvas-downstream',
      title: node.title || node.id,
      snippet: compactLine(node.summary || (node.content || []).join('；'), 180),
      matchReason: '确认后需要同步刷新的后续节点'
    })) : [])
  ].filter(Boolean)
  return [...knowledgeSources, ...canvasSources].filter((item) => item.title || item.snippet).slice(0, 6)
}

function enrichProposalExplainability(proposal = {}, context = {}) {
  const summary = proposal.summary || proposal.writeableContent?.summary || ''
  const canvasVersion = proposal.canvasVersion || buildCanvasVersion(context.fullCanvas || context.run?.documentAnalysis?.canvas || {})
  const parsedRationale = uniqueLines(proposal.rationale || proposal.reasons || [], 6)
  const parsedSources = Array.isArray(proposal.contextSources) ? proposal.contextSources : []
  const contextSources = parsedSources
    .map((item) => ({
      type: item?.type || item?.sourceType || 'context',
      title: compactLine(item?.title || item?.sourceTitle || '', 120),
      snippet: compactLine(item?.snippet || item?.content || item?.text || '', 220),
      matchReason: compactLine(item?.matchReason || item?.reason || '', 160)
    }))
    .filter((item) => item.title || item.snippet)
  return {
    ...proposal,
    canvasVersion,
    rationale: parsedRationale.length ? parsedRationale : proposalRationaleFromContext(context, summary),
    contextSources: contextSources.length ? contextSources : proposalContextSourcesFromContext(context)
  }
}

export function normalizeModelProposal(rawProposal = {}, context = {}, fallback = {}) {
  const parsed = parseJsonObject(rawProposal)
  if (!parsed) return null
  const nodeId = parsed.nodeId || fallback.nodeId || context.scopeId || context.node?.id || 'analysis'
  const title = compactLine(parsed.title || fallback.title || `${context.node?.title || '当前画布'}补充建议`, 120)
  const summary = compactLine(parsed.summary || parsed.writeableContent?.summary || fallback.summary || '', 360)
  const items = uniqueLines(parsed.writeableContent?.items || parsed.items || fallback.writeableContent?.items || [], 12)
  const acceptanceCriteria = uniqueLines(
    parsed.writeableContent?.acceptanceCriteria || parsed.acceptanceCriteria || fallback.writeableContent?.acceptanceCriteria || [],
    8
  )
  if (!summary || !items.length) return null
  const downstreamImpact = (Array.isArray(parsed.downstreamImpact) ? parsed.downstreamImpact : [])
    .map((item) => ({
      nodeId: item?.nodeId || item?.id || '',
      reason: compactLine(item?.reason || '', 220)
    }))
    .filter((item) => item.nodeId)
  const rawLayoutOptions = normalizeLayoutOptions(alignLayoutOptionsToCurrentPage(
    parsed.writeableContent?.layoutOptions || parsed.layoutOptions || parsed.options || fallback.writeableContent?.layoutOptions || [],
    context,
    context.node?.title || context.currentNode?.title || nodeId
  ))
  const layoutQuality = guardLayoutOptionsQuality(
    rawLayoutOptions,
    fallback.writeableContent?.layoutOptions || [],
    context,
    context.node?.title || context.currentNode?.title || nodeId
  )
  const layoutOptions = layoutQuality.options
  const layoutComparisonRows = normalizeLayoutComparisonRows(
    parsed.writeableContent?.layoutComparisonRows ||
      parsed.writeableContent?.comparisonRows ||
      parsed.layoutComparisonRows ||
      parsed.comparisonRows ||
      fallback.writeableContent?.layoutComparisonRows ||
      fallback.writeableContent?.comparisonRows ||
      [],
    layoutOptions
  )
  const interactionRows = normalizeInteractionRows(
    parsed.writeableContent?.interactionRows || parsed.interactionRows || fallback.writeableContent?.interactionRows || []
  )
  const stateMatrix = normalizeStateMatrix(
    parsed.writeableContent?.stateMatrix || parsed.stateMatrix || fallback.writeableContent?.stateMatrix || []
  )
  const gestureNotes = uniqueLines(parsed.writeableContent?.gestureNotes || parsed.gestureNotes || fallback.writeableContent?.gestureNotes || [], 8)
  return enrichProposalExplainability({
    ...fallback,
    id: fallback.id || `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nodeId,
    title,
    summary,
    actionIntent: parsed.actionIntent || fallback.actionIntent || context.canvasAction?.actionIntent || '',
    writeableContent: {
      summary: compactLine(parsed.writeableContent?.summary || summary, 360),
      items,
      acceptanceCriteria: acceptanceCriteria.length
        ? acceptanceCriteria
        : uniqueLines(fallback.writeableContent?.acceptanceCriteria || ['当前节点内容可直接支撑产品、UX 和研发继续拆解。'], 6),
      ...(layoutOptions.length ? { layoutOptions } : {}),
      ...(layoutComparisonRows.length ? { layoutComparisonRows } : {}),
      ...(layoutOptions.length && layoutQuality.status === 'fallback-applied'
        ? {
            layoutQualityStatus: layoutQuality.status,
            layoutQualityReason: layoutQuality.reason
          }
        : {}),
      ...(interactionRows.length ? { interactionRows } : {}),
      ...(stateMatrix.length ? { stateMatrix } : {}),
      ...(gestureNotes.length ? { gestureNotes } : {})
    },
    downstreamImpact: downstreamImpact.length ? downstreamImpact : fallback.downstreamImpact || downstreamImpactFromContext(context),
    status: 'pending',
    createdAt: fallback.createdAt || context.now || new Date().toISOString(),
    model: parsed.model || fallback.model || context.model || '',
    source: 'model-structured'
  }, context)
}

export function buildAgentProposal(feedback = {}, context = {}) {
  const content = feedback.assistantMessage?.content || feedback.content || ''
  const actionResult = feedback.actionResult || {}
  const nodeId = actionResult.nodeId || context.scopeId || context.node?.id || 'analysis'
  const nodeTitle = actionResult.nodeTitle || context.node?.title || context.currentNode?.title || '当前画布'
  const items = uniqueLines([
    ...(Array.isArray(actionResult.suggestions) ? actionResult.suggestions : []),
    ...contentLinesFromText(content)
  ], 8)
  const intentWriteable = context.actionType === 'canvas-action-advice'
    ? canvasActionIntentWriteableContent(context, actionResult, items)
    : null
  const summary = compactLine(intentWriteable?.summary || items.find((item) => /可写入|详细|建议|补充|验收/.test(item)) || content || `${nodeTitle}补充建议`, 260)
  const fallback = {
    id: `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nodeId,
    title: `${nodeTitle}补充建议`,
    summary,
    actionIntent: context.canvasAction?.actionIntent || actionResult.actionIntent || '',
    writeableContent: {
      summary,
      items: intentWriteable?.items || (items.length ? items : [`补充 ${nodeTitle} 的目标、边界、异常状态和验收标准。`]),
      acceptanceCriteria: intentWriteable?.acceptanceCriteria || uniqueLines([
        '当前节点内容可直接支撑产品、UX 和研发继续拆解。',
        '后续节点需要根据当前确认内容重新对齐。',
        ...(Array.isArray(actionResult.acceptanceCriteria) ? actionResult.acceptanceCriteria : [])
      ], 6),
      ...(intentWriteable?.layoutOptions ? { layoutOptions: intentWriteable.layoutOptions } : {}),
      ...(intentWriteable?.layoutComparisonRows ? { layoutComparisonRows: intentWriteable.layoutComparisonRows } : {}),
      ...(intentWriteable?.interactionRows ? { interactionRows: intentWriteable.interactionRows } : {}),
      ...(intentWriteable?.stateMatrix ? { stateMatrix: intentWriteable.stateMatrix } : {}),
      ...(intentWriteable?.gestureNotes ? { gestureNotes: intentWriteable.gestureNotes } : {})
    },
    downstreamImpact: intentWriteable
      ? canvasActionIntentDownstreamImpact(context, intentWriteable.impactKeyword)
      : downstreamImpactFromContext(context),
    status: 'pending',
    createdAt: context.now || new Date().toISOString(),
    model: context.model || feedback.model || feedback.assistantMessage?.meta?.model || '',
    source: 'deterministic-fallback'
  }
  return normalizeModelProposal(feedback.proposal || feedback.raw?.proposal || feedback.raw?.agentProposal, context, fallback) || enrichProposalExplainability(fallback, context)
}

function normalizeAnalysis(run = {}) {
  const analysis = run.documentAnalysis || {}
  const canvas = analysis.canvas || { nodes: [], edges: [], orderedTabs: [] }
  return {
    ...analysis,
    input: analysis.input || run.input || '',
    status: 'repaired',
    canvas: {
      ...canvas,
      nodes: Array.isArray(canvas.nodes) ? canvas.nodes : [],
      edges: Array.isArray(canvas.edges) ? canvas.edges : [],
      orderedTabs: Array.isArray(canvas.orderedTabs) ? canvas.orderedTabs : []
    },
    documents: Array.isArray(analysis.documents) ? analysis.documents : [],
    versions: Array.isArray(analysis.versions) ? analysis.versions : []
  }
}

function findNodeIndex(nodes = [], nodeId = '') {
  const index = nodes.findIndex((node) => node?.id === nodeId)
  return index >= 0 ? index : 0
}

function normalizeModelPatch(rawPatch = {}, nodes = [], currentIndex = 0) {
  const parsed = parseJsonObject(rawPatch)
  if (!parsed) return null
  const currentNode = parsed.currentNode && typeof parsed.currentNode === 'object' && !Array.isArray(parsed.currentNode)
    ? parsed.currentNode
    : null
  const downstreamNodes = Array.isArray(parsed.downstreamNodes) ? parsed.downstreamNodes : []
  if (!currentNode && !downstreamNodes.length) return null
  const invalidTarget = downstreamNodes.some((node) => {
    const nodeId = node?.nodeId || node?.id || ''
    const index = nodes.findIndex((item) => item.id === nodeId)
    return !nodeId || index < 0 || index <= currentIndex
  })
  if (invalidTarget) return null
  return {
    currentNode,
    downstreamNodes: downstreamNodes
      .map((node) => ({
        nodeId: node.nodeId || node.id || '',
        summary: compactLine(node.summary || '', 360),
        content: uniqueLines(node.content || node.items || [], 16)
      }))
      .filter((node) => node.nodeId && (node.summary || node.content.length)),
    reason: compactLine(parsed.reason || '模型根据完整画布和确认提案重写当前节点与后续节点。', 360)
  }
}

function invalidModelPatchError(message = '模型返回的画布 patch 无效，未写入画布') {
  const error = new Error(message)
  error.code = 'AGENT_MODEL_PATCH_INVALID'
  return error
}

function staleProposalError(proposal = {}, currentCanvasVersion = '') {
  const error = new Error('该 Agent 提案基于旧画布生成，需重新生成建议后再写入画布')
  error.code = 'AGENT_PROPOSAL_STALE'
  error.recoveryActions = ['重新生成建议']
  error.proposalId = proposal.id || ''
  error.proposalCanvasVersion = proposal.canvasVersion || ''
  error.currentCanvasVersion = currentCanvasVersion
  error.staleReason = 'canvas-version-changed'
  return error
}

function nodeContentCount(node = {}) {
  return Array.isArray(node.content) ? node.content.length : (node.content ? 1 : 0)
}

function buildNodeDiffs(beforeNodes = [], afterNodes = [], changedNodeIds = []) {
  const changed = new Set(changedNodeIds.filter(Boolean))
  return afterNodes
    .filter((node) => changed.has(node.id))
    .map((afterNode) => {
      const beforeNode = beforeNodes.find((node) => node.id === afterNode.id) || {}
      return {
        nodeId: afterNode.id,
        title: afterNode.title || beforeNode.title || afterNode.id,
        before: {
          summary: beforeNode.summary || '',
          contentCount: nodeContentCount(beforeNode)
        },
        after: {
          summary: afterNode.summary || '',
          contentCount: nodeContentCount(afterNode)
        }
      }
    })
}

function stageNodeMatchesCanvasNode(stageNode = {}, canvasNode = {}) {
  if (!stageNode || !canvasNode) return false
  const canvasKeys = [canvasNode.id, canvasNode.sourcePageId, canvasNode.pageId, canvasNode.title].filter(Boolean).map(String)
  const stageKeys = [stageNode.id, stageNode.sourcePageId, stageNode.pageId, stageNode.title].filter(Boolean).map(String)
  return stageKeys.some((key) => canvasKeys.includes(key))
}

function mergeCanvasNodeIntoStageNode(stageNode = {}, canvasNode = {}) {
  const contentText = Array.isArray(canvasNode.content)
    ? uniqueLines(canvasNode.content, 10).join('\n')
    : ''
  const next = {
    ...stageNode,
    summary: canvasNode.summary || stageNode.summary,
    content: Array.isArray(canvasNode.content) ? canvasNode.content : stageNode.content,
    loading: false
  }
  if (stageNode.pageLayoutArtifact && typeof stageNode.pageLayoutArtifact === 'object' && !Array.isArray(stageNode.pageLayoutArtifact)) {
    next.pageLayoutArtifact = {
      ...stageNode.pageLayoutArtifact,
      modelDecision: canvasNode.summary || stageNode.pageLayoutArtifact.modelDecision || '',
      interactionDetails: contentText || stageNode.pageLayoutArtifact.interactionDetails || ''
    }
  }
  if (canvasNode.updatedByAgentProposalId) next.updatedByAgentProposalId = canvasNode.updatedByAgentProposalId
  if (canvasNode.impactedByAgentProposalId) next.impactedByAgentProposalId = canvasNode.impactedByAgentProposalId
  if (Array.isArray(canvasNode.detailSections) && canvasNode.detailSections.length) next.detailSections = canvasNode.detailSections
  return next
}

function syncStageCanvasNodesFromCanvas(analysis = {}, nodes = [], changedNodeIds = []) {
  const totalFlow = analysis.totalDesignFlow
  const stageCanvases = totalFlow?.stageCanvases
  if (!stageCanvases || typeof stageCanvases !== 'object' || Array.isArray(stageCanvases)) return analysis.totalDesignFlow
  const changed = new Set(changedNodeIds.filter(Boolean))
  const changedNodes = nodes.filter((node) => changed.has(node.id))
  if (!changedNodes.length) return analysis.totalDesignFlow
  let touched = false
  const nextStageCanvases = Object.fromEntries(Object.entries(stageCanvases).map(([stageId, canvas]) => {
    if (!Array.isArray(canvas?.nodes)) return [stageId, canvas]
    const nextNodes = canvas.nodes.map((stageNode) => {
      const canvasNode = changedNodes.find((node) => stageNodeMatchesCanvasNode(stageNode, node))
      if (!canvasNode) return stageNode
      touched = true
      return mergeCanvasNodeIntoStageNode(stageNode, canvasNode)
    })
    return [stageId, { ...canvas, nodes: nextNodes }]
  }))
  if (!touched) return analysis.totalDesignFlow
  return {
    ...totalFlow,
    stageCanvases: nextStageCanvases
  }
}

function proposalLayoutOptionById(proposal = {}, optionId = '') {
  const options = normalizeLayoutOptions(proposal.writeableContent?.layoutOptions || [])
  if (!options.length || !optionId) return null
  return options.find((option) => option.id === optionId) || null
}

function proposalLayoutOptionByIndex(proposal = {}, optionIndex = 0) {
  const options = normalizeLayoutOptions(proposal.writeableContent?.layoutOptions || [])
  if (!options.length || !optionIndex) return null
  return options[Math.max(0, Number(optionIndex) - 1)] || null
}

function proposalWithSelectedLayoutOption(proposal = {}, payload = {}) {
  // Contract: applying a layout option writes only the selected candidate, not all three alternatives.
  const option = proposalLayoutOptionById(proposal, payload.selectedLayoutOptionId) ||
    proposalLayoutOptionByIndex(proposal, payload.selectedLayoutOptionIndex)
  if (!option) return proposal
  const optionRows = option.frameworkRows?.length ? option.frameworkRows : option.layout
  const selectedLayoutOption = {
    id: option.id || '',
    label: option.label || '',
    title: option.title || '',
    layoutStyle: option.layoutStyle || '',
    summary: option.summary || ''
  }
  return {
    ...proposal,
    selectedLayoutOptionId: option.id,
    selectedLayoutOptionLabel: option.label,
    selectedLayoutOption,
    summary: `${option.label} ${option.title}：${option.summary}`,
    writeableContent: {
      ...(proposal.writeableContent || {}),
      summary: option.writeableContent.summary,
      items: uniqueLines([
        `${option.label}：${option.title}`,
        option.summary,
        option.layoutStyle ? `设计调性：${option.layoutStyle}` : '',
        option.layoutStrategy ? `布局组织：${option.layoutStrategy}` : '',
        option.bestFor ? `适用场景：${option.bestFor}` : '',
        ...optionRows,
        option.risk ? `风险与取舍：${option.risk}` : ''
      ], 14),
      acceptanceCriteria: uniqueLines(option.writeableContent.acceptanceCriteria || proposal.writeableContent?.acceptanceCriteria || [], 8)
    }
  }
}

function applyModelPatch(nodes = [], currentIndex = 0, patch = {}, proposal = {}) {
  if (!patch) return null
  const nextNodes = nodes.map((node) => ({ ...node }))
  const changedNodeIds = []
  const currentPatch = patch.currentNode || {}
  if (currentPatch.summary || Array.isArray(currentPatch.content)) {
    nextNodes[currentIndex] = {
      ...nextNodes[currentIndex],
      ...(currentPatch.summary ? { summary: currentPatch.summary } : {}),
      ...(Array.isArray(currentPatch.content) ? { content: uniqueLines(currentPatch.content, 16) } : {}),
      updatedByAgentProposalId: proposal.id,
      loading: false
    }
    changedNodeIds.push(nextNodes[currentIndex].id)
  }
  for (const downstreamPatch of patch.downstreamNodes || []) {
    const index = nextNodes.findIndex((node) => node.id === downstreamPatch.nodeId)
    if (index < 0 || index <= currentIndex) continue
    nextNodes[index] = {
      ...nextNodes[index],
      ...(downstreamPatch.summary ? { summary: downstreamPatch.summary } : {}),
      ...(downstreamPatch.content.length ? { content: downstreamPatch.content } : {}),
      impactedByAgentProposalId: proposal.id,
      loading: false
    }
    changedNodeIds.push(nextNodes[index].id)
  }
  if (!changedNodeIds.length) return null
  return {
    nodes: nextNodes,
    appliedPatch: {
      currentNodeId: nextNodes[currentIndex].id,
      changedNodeIds: Array.from(new Set(changedNodeIds)),
      nodeDiffs: buildNodeDiffs(nodes, nextNodes, changedNodeIds),
      ...(proposal.selectedLayoutOption ? { selectedLayoutOption: proposal.selectedLayoutOption } : {}),
      reason: patch.reason || '模型根据完整画布和确认提案重写当前节点与后续节点。'
    }
  }
}

function buildConfirmAudit(proposal = {}, payload = {}) {
  const appliedAt = new Date().toISOString()
  return {
    source: 'agent-proposal-confirm',
    proposalId: proposal.id || '',
    proposalTitle: compactLine(proposal.title || '', 120),
    model: payload.model || '',
    appliedAt,
    confirmMode: payload.confirmMode || 'merge-current-and-downstream'
  }
}

function buildConfirmVersion(analysis = {}, previousVersions = [], appliedPatch = {}) {
  const createdAt = new Date().toISOString()
  const selectedOption = appliedPatch.selectedLayoutOption || null
  const optionLabel = [selectedOption?.label, selectedOption?.title].filter(Boolean).join(' · ')
  const version = {
    id: `agent-proposal-${createdAt.replace(/[-:.TZ]/g, '').slice(0, 14)}`,
    label: selectedOption ? `应用${optionLabel || '布局方案'}` : 'Agent 确认入画布版本',
    source: selectedOption ? 'agent-layout-option' : 'agent-proposal-confirm',
    createdAt,
    summary: selectedOption
      ? `已应用${optionLabel || '布局方案'}${selectedOption.layoutStyle ? `，设计调性：${selectedOption.layoutStyle}` : ''}`
      : 'Agent 提案已写入画布',
    demandScope: analysis.demandScope || 'project',
    requestedSkillId: analysis.requestedSkillId || '',
    resolvedSkillId: analysis.resolvedSkillId || analysis.skillId || '',
    qualityScore: analysis.qualityGate?.score || 0,
    appliedPatch,
    snapshot: {
      blueprint: analysis.blueprint || null,
      canvas: analysis.canvas || null,
      routing: analysis.routing || null,
      generation: analysis.generation || null
    }
  }
  if (previousVersions[0]) version.diff = buildAnalysisVersionDiff(previousVersions[0], version)
  return version
}

export function confirmAgentProposalOnRun(run = {}, proposal = {}, payload = {}) {
  if (!proposal?.id) {
    const error = new Error('未找到可确认的 Agent 提案')
    error.code = 'AGENT_PROPOSAL_NOT_FOUND'
    throw error
  }
  if (proposal.status && proposal.status !== 'pending') {
    const error = new Error('该 Agent 提案已经处理，不能重复写入画布')
    error.code = 'AGENT_PROPOSAL_NOT_PENDING'
    throw error
  }
  const selectedProposal = proposalWithSelectedLayoutOption(proposal, payload)
  const analysis = normalizeAnalysis(run)
  const auditPayload = {
    ...payload,
    model: payload.model || selectedProposal.model || selectedProposal.meta?.model || run.model || analysis.generation?.model || ''
  }
  const nodes = analysis.canvas.nodes.map((node) => ({ ...node }))
  if (!nodes.length) {
    const error = new Error('当前分析结果没有可更新的画布节点')
    error.code = 'AGENT_CANVAS_EMPTY'
    throw error
  }
  const currentCanvasVersion = buildCanvasVersion(analysis.canvas)
  if (selectedProposal.canvasVersion && selectedProposal.canvasVersion !== currentCanvasVersion) {
    throw staleProposalError(selectedProposal, currentCanvasVersion)
  }
  const currentNodeId = payload.nodeId || selectedProposal.nodeId || nodes[0].id
  const currentIndex = findNodeIndex(nodes, currentNodeId)
  const hasModelPatch = payload.modelPatch !== null && payload.modelPatch !== undefined
  const normalizedModelPatch = normalizeModelPatch(payload.modelPatch || payload.patch, nodes, currentIndex)
  if (hasModelPatch && !normalizedModelPatch) throw invalidModelPatchError()
  const modelPatchResult = applyModelPatch(nodes, currentIndex, normalizedModelPatch, selectedProposal)
  if (hasModelPatch && !modelPatchResult) throw invalidModelPatchError()
  if (modelPatchResult) {
    modelPatchResult.appliedPatch.audit = buildConfirmAudit(selectedProposal, auditPayload)
    const nextAnalysis = {
      ...analysis,
      canvas: {
        ...analysis.canvas,
        nodes: modelPatchResult.nodes
      },
      totalDesignFlow: syncStageCanvasNodesFromCanvas(analysis, modelPatchResult.nodes, modelPatchResult.appliedPatch.changedNodeIds),
      repair: {
        checkId: 'agent-proposal-confirm',
        action: selectedProposal.summary || selectedProposal.title || '',
        repairedAt: new Date().toISOString(),
        owner: 'backend-model'
      }
    }
    nextAnalysis.qualityGate = buildAnalysisQualityGate(nextAnalysis)
    const version = buildConfirmVersion(nextAnalysis, analysis.versions, modelPatchResult.appliedPatch)
    nextAnalysis.versions = [version, ...analysis.versions]
    nextAnalysis.blueprint = {
      ...(nextAnalysis.blueprint || {}),
      qualityGate: nextAnalysis.qualityGate,
      versions: nextAnalysis.versions
    }
    return {
      analysis: nextAnalysis,
      appliedPatch: modelPatchResult.appliedPatch
    }
  }
  const confirmedItems = uniqueLines([
    `Agent 提案已确认：${selectedProposal.summary || selectedProposal.title || '补充建议'}`,
    `可写入总结：${selectedProposal.writeableContent?.summary || selectedProposal.summary || ''}`,
    ...(selectedProposal.writeableContent?.items || []),
    ...(selectedProposal.writeableContent?.acceptanceCriteria || []).map((item) => `验收：${item}`)
  ], 12)
  nodes[currentIndex] = {
    ...nodes[currentIndex],
    summary: selectedProposal.writeableContent?.summary || selectedProposal.summary || nodes[currentIndex].summary,
    content: uniqueLines([
      ...(Array.isArray(nodes[currentIndex].content) ? nodes[currentIndex].content : []),
      ...confirmedItems
    ], 14),
    updatedByAgentProposalId: selectedProposal.id,
    loading: false
  }
  const changedNodeIds = [nodes[currentIndex].id]
  for (let index = currentIndex + 1; index < nodes.length; index += 1) {
    const node = nodes[index]
    const impactReason = proposalImpactReasonForNode(selectedProposal, node.id)
    changedNodeIds.push(node.id)
    nodes[index] = {
      ...node,
      content: uniqueLines([
        impactReason
          ? `上游 ${nodes[currentIndex].id} 已更新：${impactReason}`
          : `上游 ${nodes[currentIndex].id} 已更新：需要重新对齐本节点的结论。`,
        ...(Array.isArray(node.content) ? node.content : []),
        `同步依据：${selectedProposal.writeableContent?.summary || selectedProposal.summary || 'Agent 确认提案'}`
      ], 10),
      impactedByAgentProposalId: selectedProposal.id,
      loading: false
    }
  }
  const appliedPatch = {
    currentNodeId: nodes[currentIndex].id,
    changedNodeIds,
    nodeDiffs: buildNodeDiffs(analysis.canvas.nodes, nodes, changedNodeIds),
    ...(selectedProposal.selectedLayoutOption ? { selectedLayoutOption: selectedProposal.selectedLayoutOption } : {}),
    audit: buildConfirmAudit(selectedProposal, auditPayload),
    reason: selectedProposal.downstreamImpact?.[0]?.reason
      ? `当前节点确认写入后，后续节点按影响说明同步刷新：${selectedProposal.downstreamImpact[0].reason}`
      : '当前节点确认写入后，后续节点需要根据新的上游结论同步刷新。'
  }
  const nextAnalysis = {
    ...analysis,
    canvas: {
      ...analysis.canvas,
      nodes
    },
    totalDesignFlow: syncStageCanvasNodesFromCanvas(analysis, nodes, changedNodeIds),
    repair: {
      checkId: 'agent-proposal-confirm',
      action: selectedProposal.summary || selectedProposal.title || '',
      repairedAt: new Date().toISOString(),
      owner: 'backend-model'
    }
  }
  nextAnalysis.qualityGate = buildAnalysisQualityGate(nextAnalysis)
  const version = buildConfirmVersion(nextAnalysis, analysis.versions, appliedPatch)
  nextAnalysis.versions = [version, ...analysis.versions]
  nextAnalysis.blueprint = {
    ...(nextAnalysis.blueprint || {}),
    qualityGate: nextAnalysis.qualityGate,
    versions: nextAnalysis.versions
  }
  return {
    analysis: nextAnalysis,
    appliedPatch
  }
}
