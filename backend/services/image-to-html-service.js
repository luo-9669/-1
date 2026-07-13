import { randomUUID } from 'node:crypto'
import { createRestoredPageAsset } from '../../frontend/src/services/factoryWorkspace.js'

// Contract: image-to-HTML quality is judged at product viewports, not raw screenshot pixels.
const IMAGE_HTML_QUALITY_VIEWPORTS = [
  { id: 'mobile', width: 390, height: 844 },
  { id: 'tablet', width: 768, height: 1024 },
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'wide', width: 1920, height: 1080 }
]

function safeParseJsonObject(text = '') {
  const source = String(text || '').trim()
  if (!source) return null
  const normalizedSource = source.replace(/"([A-Za-z][A-Za-z0-9_]*)\1"\s*:/g, '"$1":')
  const fenced = normalizedSource.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : source
  try {
    const parsed = JSON.parse(candidate)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(candidate.slice(start, end + 1))
        return parsed && typeof parsed === 'object' ? parsed : null
      } catch {
        return null
      }
    }
    return null
  }
}

function extractHtmlFromModelText(text = '') {
  const source = String(text || '').trim()
  if (!source) return ''
  const htmlFence = source.match(/```(?:html)?\s*([\s\S]*?<\/html>)\s*```/i)
  if (htmlFence) return htmlFence[1].trim()
  const doctypeStart = source.toLowerCase().indexOf('<!doctype html')
  const htmlEnd = source.toLowerCase().lastIndexOf('</html>')
  if (doctypeStart >= 0 && htmlEnd > doctypeStart) return source.slice(doctypeStart, htmlEnd + 7).trim()
  return ''
}

function backendRenderVerificationFailed(visualVerification = {}) {
  if (visualVerification.status !== 'failed') return false
  const details = [
    ...(visualVerification.recommendations || []),
    ...(visualVerification.results || []).map((item) => item?.comparison?.error || item?.error || '')
  ].join('\n')
  return /生成页面截图失败|渲染失败|截图失败|Chromium|Playwright|脚本报错|setContent|browser/i.test(details)
}

function imageHtmlVisualVerificationFailed(visualVerification = {}) {
  return visualVerification.status === 'failed'
}

function uniqueItems(items = []) {
  return Array.from(new Set(items.filter(Boolean)))
}

function htmlToPlainText(html = '') {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function classifyGeneratedPageDensity(html = '', visualModel = {}, payload = {}) {
  const source = String(html || '')
  const plainText = htmlToPlainText(source)
  const context = `${payload.title || ''}\n${payload.prompt || ''}\n${JSON.stringify(visualModel || {})}\n${plainText}`
  let pageType = String(visualModel?.pageType || '').trim()
  if (!pageType) {
    if (/后台|控制台|dashboard|数据|表格|筛选|工作台|admin|console/i.test(context)) pageType = 'admin-dashboard'
    else if (/官网|落地页|landing|hero|营销|立即开始|预约|注册|价格|pricing/i.test(context)) pageType = 'landing-page'
    else if (/表单|登录|注册|输入|提交|form/i.test(context)) pageType = 'form-page'
    else if (/移动|App|H5|手机|tabbar|底部导航/i.test(context)) pageType = 'mobile-app'
    else pageType = 'web-page'
  }
  let densityMode = 'web-normal'
  if (/admin|dashboard|后台|控制台|数据|表格|工作台/i.test(pageType) || /后台|控制台|dashboard|表格|筛选/i.test(context)) {
    densityMode = 'admin-dense'
  } else if (/landing|官网|营销|hero|pricing/i.test(pageType) || /官网|落地页|landing|hero|营销|价格|pricing/i.test(context)) {
    densityMode = 'landing-editorial'
  } else if (/mobile|app|h5/i.test(pageType) || /移动|App|H5|手机|tabbar/i.test(context)) {
    densityMode = 'mobile-app'
  } else if (/form|表单|登录|注册/i.test(pageType) || /表单|登录|注册|输入|提交/i.test(context)) {
    densityMode = 'form-focused'
  }
  return { pageType, densityMode }
}

function auditGeneratedHtmlQuality(html = '', context = {}) {
  const source = String(html || '')
  const cssBlocks = Array.from(source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)).map((match) => match[1] || '')
  const cssText = cssBlocks.join('\n')
  const issues = []
  const warnings = []
  const density = classifyGeneratedPageDensity(source, context.visualModel, context.payload)
  const responsiveSignals = [
    /@media\b/i.test(cssText),
    /clamp\s*\(/i.test(cssText),
    /minmax\s*\(/i.test(cssText),
    /max-width\s*:/i.test(cssText),
    /grid-template-columns\s*:\s*repeat\([^)]*auto-fit/i.test(cssText),
    /flex-wrap\s*:\s*wrap/i.test(cssText)
  ].filter(Boolean).length

  if (!/<meta\b[^>]*name=["']viewport["'][^>]*>/i.test(source)) {
    issues.push('缺少 viewport meta，移动端和宽屏无法可靠自适应。')
  }
  const unsafeScaleSelectors = Array.from(cssText.matchAll(/([^{}]+)\{[^{}]*transform\s*:\s*[^;{}]*scale\s*\(/gi))
    .map((match) => String(match[1] || '').trim())
    .filter((selector) => /(^|[\s,])(?:html|body|main|#app|#root|\.app|\.page|\.container|\.wrapper|\.layout|\.stage|\.shell)(?=[\s,.#:[{]|$)/i.test(selector))
  if (unsafeScaleSelectors.length) {
    issues.push(`检测到整页或大容器使用 transform: scale（${uniqueItems(unsafeScaleSelectors).join('、')}），可能导致字体、图标、点击区域一起失真。`)
  }
  if (/(^|[;{\s])zoom\s*:\s*(?!1(?:\.0+)?\b)[0-9.]+/i.test(cssText)) {
    issues.push('检测到 zoom 缩放，不能用整页 zoom 解决比例问题。')
  }
  const fixedWidths = Array.from(cssText.matchAll(/(?:^|[;{\s])(?:width|min-width)\s*:\s*(\d{4,})px/gi))
    .map((match) => Number(match[1]))
    .filter((value) => value > 1920)
  if (fixedWidths.length) {
    issues.push(`检测到超过 1920px 的固定宽度：${uniqueItems(fixedWidths).join('px、')}px，页面可能被截图像素带偏。`)
  }
  const hugeFontSizes = Array.from(cssText.matchAll(/font-size\s*:\s*(\d{2,3})px/gi))
    .map((match) => Number(match[1]))
    .filter((value) => value > 72)
  if (hugeFontSizes.length) {
    issues.push(`检测到异常字号：${uniqueItems(hugeFontSizes).join('px、')}px，应使用字号 token 或 clamp() 归一化。`)
  }
  if (/<img\b(?![^>]*\balt=)[^>]*>/i.test(source)) {
    issues.push('检测到图片缺少 alt，生成页面可访问性和资产语义不足。')
  }
  const hasInteractiveElement = /<(button|a|input|select|textarea)\b/i.test(source)
  if (hasInteractiveElement && !/:(hover|focus|focus-visible|active)\b/i.test(cssText)) {
    issues.push('检测到交互控件缺少 hover / focus / active 状态，真实可用页面需要明确反馈。')
  }
  if (/<input\b(?![^>]*(?:aria-label=|id=))[^>]*>/i.test(source) && !/<label\b/i.test(source)) {
    issues.push('检测到表单输入缺少 label 或 aria-label，表单可访问性不足。')
  }
  if (hasInteractiveElement && !/(min-height|height)\s*:\s*(?:4[4-9]|[5-9]\d)px/i.test(cssText)) {
    warnings.push('点击区域缺少 44px 以上高度兜底，移动端可点性可能不足。')
  }
  if (responsiveSignals < 2) {
    warnings.push('响应式信号不足：建议至少包含 @media、clamp()、minmax()、max-width、flex-wrap 等自适应规则中的两类。')
  }

  return {
    status: issues.length ? 'failed' : 'passed',
    mode: 'static-html-quality-audit',
    pageType: density.pageType,
    densityMode: density.densityMode,
    viewports: IMAGE_HTML_QUALITY_VIEWPORTS,
    summary: {
      total: issues.length + warnings.length,
      failed: issues.length,
      warnings: warnings.length,
      passed: issues.length ? 0 : 1
    },
    issues,
    warnings,
    recommendations: [...issues, ...warnings]
  }
}

function mergeVisualVerificationWithQualityAudit(visualVerification = {}, qualityAudit = {}) {
  const baseResults = Array.isArray(visualVerification.results) ? visualVerification.results : []
  const baseRecommendations = Array.isArray(visualVerification.recommendations) ? visualVerification.recommendations : []
  const failed = qualityAudit.status === 'failed'
  const results = failed
    ? [
        ...baseResults,
        {
          id: 'static-quality',
          width: 1440,
          status: 'failed',
          comparison: {
            dimensionMatch: true,
            normalizedDimensions: true,
            differentPixelRatio: 0,
            averageChannelDelta: 0,
            score: 0,
            error: `静态质量审查失败：${qualityAudit.issues?.[0] || '生成 HTML 不符合可用页面规范。'}`
          }
        }
      ]
    : baseResults
  const baseSummary = visualVerification.summary || {}
  const failedCount = results.filter((item) => item.status === 'failed').length
  const total = Math.max(Number(baseSummary.total || 0), baseResults.length) + (failed ? 1 : 0)
  return {
    ...visualVerification,
    status: visualVerification.status === 'failed' || failed ? 'failed' : (visualVerification.status || 'passed'),
    thresholds: {
      ...(visualVerification.thresholds || {}),
      mode: visualVerification.thresholds?.mode
        ? `${visualVerification.thresholds.mode}+static-quality-audit`
        : 'static-quality-audit',
      qualityViewports: IMAGE_HTML_QUALITY_VIEWPORTS.map((item) => ({ ...item }))
    },
    summary: {
      total,
      passed: Math.max(0, total - failedCount),
      failed: failedCount,
      averageScore: failed
        ? Math.min(Number(baseSummary.averageScore || 100), 90)
        : Number(baseSummary.averageScore || 100)
    },
    results,
    recommendations: uniqueItems([
      ...baseRecommendations,
      ...qualityAudit.recommendations.map((item) => `静态质量审查：${item}`)
    ]),
    qualityAudit
  }
}

function validateImageHtmlTopic(payload = {}, modelGeneration = {}) {
  const html = String(modelGeneration?.html || '')
  if (!html) return { ok: false, reason: '视觉模型没有返回 HTML。' }
  const visualText = JSON.stringify(modelGeneration?.visualModel || {})
  const contextText = `${payload.title || ''}\n${payload.prompt || ''}\n${visualText}`
  const htmlText = htmlToPlainText(html)
  const combinedModelText = `${visualText}\n${modelGeneration?.summary || ''}`
  if (/"scripts"\s*:|package\.json|vite\s+build|vite\s+--host|devDependencies|<div\s+id=["']app["']\s*><\/div>\s*<script\s+type=["']module["']\s+src=["']\/src\/main\.js["']/i.test(html)) {
    return { ok: false, reason: '视觉模型返回了项目脚手架/源码包，不是可预览静态 HTML。' }
  }
  if (/未包含可读取的截图像素|未读取到截图|无法读取截图|没有可读取.*截图|image.*not.*read|unable to read.*image/i.test(combinedModelText)) {
    return { ok: false, reason: '视觉模型没有正确读取上传截图，返回了通用页面。' }
  }
  const expectsChanjing = /蝉镜|蝉境|Seedance|数字人|AI创作|创建视频|创建数字人/i.test(contextText)
  const expectsWorkflow = /流程通|工作流|Workflow|workflow|后台控制台|节点|任务队列/i.test(contextText)
  const expectsWechat = /wechat|微信|聊天|会话/i.test(contextText)
  const hasChanjingSignals = /蝉镜|蝉境|Seedance|数字人|AI创作|创建视频|创建数字人|视频生成|图片生成|DeepSeek/i.test(htmlText)
  const hasWorkflowSignals = /Workflow Backend Dashboard|流程通|工作流后端控制台|流程工作台|Product Team|AI Workflow/i.test(`${html}\n${htmlText}`)
  const hasWechatSignals = /微信会话|微信聊天页面|移动端微信样式|根据截图结构生成的微信聊天页面/i.test(htmlText)
  if (expectsChanjing && hasWechatSignals) {
    return { ok: false, reason: '生成结果主题偏离上传截图：检测到微信聊天页面，而不是蝉镜 AI 页面。' }
  }
  if (expectsChanjing && !hasChanjingSignals && hasWorkflowSignals) {
    return { ok: false, reason: '生成结果主题偏离上传截图：检测到流程通/工作流页面，而不是蝉镜 AI 页面。' }
  }
  if (!expectsWorkflow && hasWorkflowSignals) {
    return { ok: false, reason: '生成结果主题偏离上传截图：检测到通用工作流后端控制台，说明视觉模型没有按上传图片还原。' }
  }
  if (expectsWechat && !hasWechatSignals && hasWorkflowSignals) {
    return { ok: false, reason: '生成结果主题偏离上传截图：检测到通用工作流后端控制台，而不是上传的微信截图。' }
  }
  return { ok: true, reason: '' }
}

function buildImageVisualModel(payload = {}) {
  const title = payload.title || '图片转代码页面'
  const prompt = String(payload.prompt || '').trim()
  const target = payload.target || 'static-html'
  const isWorkflowAnalysis = /工作流|analysis|mermaid|rice|tab|设计评审|用户旅程|机会树/i.test(`${title}\n${prompt}`)
  return {
    source: {
      type: 'screenshot',
      title,
      target,
      prompt,
      hasImage: Boolean(payload.imageDataUrl)
    },
    pageType: isWorkflowAnalysis ? '工作流分析页面' : '图片转代码页面',
    layout: isWorkflowAnalysis
      ? [
          { id: 'sidebar', role: 'workflow-menu', position: 'left' },
          { id: 'topbar', role: 'project-actions', position: 'top' },
          { id: 'tabs', role: 'analysis-tabs', position: 'main-top' },
          { id: 'content', role: 'analysis-panels', position: 'main' }
        ]
      : [
          { id: 'app-shell', role: 'page', position: 'root' },
          { id: 'topbar', role: 'navigation', position: 'top' },
          { id: 'primary-panel', role: 'main-content', position: 'center' },
          { id: 'secondary-panel', role: 'details', position: 'right-or-bottom' }
        ],
    styleTokens: {
      colors: {
        background: '#f6f7f9',
        surface: '#ffffff',
        text: '#222529',
        muted: '#7f8792',
        border: '#e8eaec',
        accent: '#69e1f5',
        priorityP0: '#ef4444',
        priorityP1: '#2563eb',
        kano: '#7c3aed'
      },
      spacing: [8, 12, 16, 20, 24, 32],
      radius: [8, 10, 12, 16],
      fontScale: { title: 30, subtitle: 18, body: 14, caption: 12 }
    },
    components: isWorkflowAnalysis
      ? [
          { type: 'sidebar-menu', count: 1 },
          { type: 'tab', count: 8 },
          { type: 'chartPanel', count: 4 },
          { type: 'table', count: 3 },
          { type: 'button', count: 4 },
          { type: 'json-preview', count: 1 }
        ]
      : [
          { type: 'button', count: 2 },
          { type: 'card', count: 3 },
          { type: 'tab', count: 3 },
          { type: 'table', count: 1 },
          { type: 'chartPanel', count: 1 }
        ],
    sections: isWorkflowAnalysis
      ? [
          { id: 'overview', title: '项目概览', content: '展示项目输入、目标用户、核心设计目标和下游交付状态。' },
          { id: 'journey', title: '用户旅程时序图', content: '使用 Mermaid journey / sequence 图表达用户关键路径。' },
          { id: 'opportunity', title: '机会方案树', content: '沉淀机会点、方案分支、风险和验证指标。' },
          { id: 'priority', title: 'RICE 优先级打分', content: '用 Reach、Impact、Confidence、Effort 做优先级表格。' },
          { id: 'review', title: '设计评审清单', content: '记录三轮评审问题、修改建议和验收状态。' }
        ]
      : [
          { id: 'overview', title: '页面概览', content: prompt || '根据截图识别页面主视觉、导航和内容区域。' },
          { id: 'structure', title: '结构分层', content: '侧边栏、顶部导航、主体卡片和操作按钮已拆解为可编辑 DOM。' },
          { id: 'assets', title: '视觉资产', content: '图片素材暂以视觉区域占位，后续可接入裁切资产。' }
        ],
    interactions: ['tab-switch', 'copy-mermaid', 'copy-json', 'download-md'],
    generationRules: [
      '只有截图时生成视觉还原静态 HTML，不声明真实 DOM 采集。',
      '不把整张截图作为页面主体输出。',
      '输出单文件 HTML，可直接双击打开。'
    ]
  }
}

function buildImageToHtmlCaptureResult(payload = {}) {
  const title = payload.title || '图片转代码页面'
  const imageUrl = `image://${title}`
  const prompt = String(payload.prompt || '').trim()
  const imageDataUrl = String(payload.imageDataUrl || '')
  const visualModel = payload.visualModel || buildImageVisualModel(payload)
  return {
    // Keep the frontend's temporary preview route resolvable until the real restored asset id exists.
    taskId: payload.clientTaskId || randomUUID(),
    projectId: payload.projectId || 'default',
    url: imageUrl,
    title,
    status: 'completed',
    pages: [{ title, url: imageUrl, screenshot: imageDataUrl }],
    components: [
      { name: '顶部导航', type: 'navigation', confidence: 0.68 },
      { name: '主视觉内容', type: 'hero', confidence: 0.66 },
      { name: '表单/行动区', type: 'form', confidence: 0.62 }
    ],
    assets: [{ type: 'image-reference', name: title, source: imageDataUrl }],
    links: [],
    textBlocks: prompt ? [{ tag: 'prompt', text: prompt }] : [],
    layoutNodes: [
      { id: 'nav', type: 'surface', tag: 'nav', x: 40, y: 28, width: 1360, height: 64, text: '' },
      { id: 'brand', type: 'text', tag: 'strong', x: 72, y: 48, width: 160, height: 28, text: title },
      { id: 'headline', type: 'text', tag: 'h1', x: 96, y: 190, width: 520, height: 132, text: prompt || '根据上传图片生成的高保真页面' },
      { id: 'summary', type: 'text', tag: 'p', x: 96, y: 344, width: 520, height: 72, text: '后端已生成结构化 HTML/CSS，本地 mock 不再用截图冒充网页。' },
      { id: 'panel', type: 'surface', tag: 'section', x: 800, y: 156, width: 440, height: 520, text: '' },
      { id: 'button', type: 'control', tag: 'button', x: 856, y: 548, width: 328, height: 48, placeholder: '继续' }
    ],
    screenshot: imageDataUrl,
    viewport: { width: 1440, height: 900 },
    raw: {
      source: 'image-to-code',
      captureKind: 'image-to-code',
      screenshotCaptured: Boolean(imageDataUrl),
      layoutNodeCount: 6,
      model: 'deterministic-image-to-html-mock',
      visualModel,
      visualModelCaptured: true,
      capturedAt: new Date().toISOString()
    }
  }
}

function imageVisionPrompt(payload = {}) {
  const advanced = payload.generationMode === 'advanced' || payload.keepBaseFramework === true
  const markdownRules = String(payload.markdownRules || '').trim()
  return [
    '你是一个资深前端工程师和视觉还原专家。请根据用户上传的页面截图，先分析页面，再生成可运行的单文件 HTML。',
    '必须返回严格 JSON，不要 Markdown，不要解释。',
    'JSON 结构：',
    '{',
    '  "visualModel": {',
    '    "source": {"type":"screenshot","title":"...","target":"static-html","prompt":"...","hasImage":true},',
    '    "pageType": "页面类型判断",',
    '    "layout": [{"id":"...","role":"...","position":"...","width":0}],',
    '    "components": [{"type":"...","count":1}],',
    '    "styleTokens": {"colors": {}, "spacing": [], "radius": [], "fontScale": {}},',
    '    "sections": [{"id":"...","title":"...","content":"..."}],',
    '    "interactions": [],',
    '    "generationRules": []',
    '  },',
    '  "html": "<!doctype html>...",',
    '  "summary": "一句话说明分析和生成结果"',
    '}',
    '',
    '分析要求：',
    '1. 先判断页面类型，例如 SaaS / AI 工具后台首页、官网落地页、表单页、数据后台等。',
    '2. 拆出 body / aside / main / topbar / cards / lists / tabs 等布局层级。',
    '3. 提取组件、颜色、字体层级、间距、圆角、阴影和图片处理策略。',
    '4. HTML 必须是可运行静态页面，包含内联 CSS；不要把整张截图作为主体 <img> 直接包进去。',
    '5. 如果人物或封面图无法 1:1 还原，用可编辑的渐变、色块、占位图形或局部视觉替代，但结构要贴近截图。',
    '',
    '截图边界要求：',
    '1. 如果截图包含浏览器外壳，请忽略浏览器外壳，包括标签栏、地址栏、书签栏、系统窗口按钮、Chrome 更新提示和扩展图标。',
    '2. 只还原网页内容区域，也就是浏览器工具栏下方真正属于网页的视觉内容。',
    '3. 不要把浏览器顶部栏当作页面导航，不要生成 localhost 地址栏、标签页、书签文件夹或浏览器按钮。',
    '4. 如果网页内容区域顶部本身有产品 Logo、侧边栏、顶部导航或页面标题，必须保留这些页面内元素。',
    '5. 按网页内容区域的实际第一屏比例生成，优先匹配主要布局、组件数量、相对位置、字号层级、颜色和留白。',
    '',
    '可用页面规范：',
    '1. 生成结果必须像真实可用的 Web 页面或移动 App 页面，而不是只为截图相似拼出的静态海报。',
    '2. 使用语义化结构组织页面：header / main / section / footer / nav / aside / button / form 等元素按职责出现。',
    '3. 保留可操作控件的真实 affordance：按钮、导航、标签、输入框、筛选器、卡片入口要有清晰 hover / focus 状态。',
    '4. 图片必须有 alt；表单项必须有 label 或 aria-label；点击区域和文本层级要符合常见 Web/App 页面规范。',
    '',
    '基础组件密度与交互规范：',
    '1. 搜索框、输入框、按钮、筛选器、分页、标签和侧边栏严格参考饿了么 / Element Plus 中后台基础组件框架还原，保持克制、紧凑、可扫描的信息密度。',
    '2. 按钮最大高度 40px；小按钮 28px-32px，默认按钮 32px-36px，主要按钮和带图标按钮也不能超过 40px；不要做成 48px 以上的营销大按钮。',
    '3. 搜索框和输入框高度不超过 40px，默认 32px-36px；placeholder、前后缀图标、清除按钮和 loading 状态要齐全，focus 时只强化边框或轻量阴影。',
    '4. 不要出现浏览器默认虚框：input、textarea、select、搜索框、按钮和 tab 可写 outline: none，但必须用 :focus-visible 自定义 1px-2px 边框、轻量 box-shadow 或背景态替代，保证键盘可见焦点。',
    '5. 下拉框必须参考 Element Plus 交互：触发器 32px-36px、箭头 12px 或 16px、菜单浮层 4px/8px 圆角、选项 32px-36px；下拉 hover、selected、disabled、focus-visible 和键盘高亮状态都要完整。',
    '6. 同一工具栏里的输入框和按钮必须同高，使用 8px / 12px gap 对齐；按钮文字不换行，图标使用 12px / 16px / 20px / 24px 阶梯并与文字垂直居中。',
    '7. 侧边栏按中后台适配规则：桌面展开宽度 200px-240px，折叠宽度 56px-64px；菜单项高度 40px-48px，图标与菜单文字同轴对齐，窄屏可折叠或转抽屉。',
    '8. 基础组件必须覆盖 hover、focus、active、disabled、loading、clearable 等交互状态，不只画静态外观。',
    '',
    '响应式与自适应布局：',
    '1. CSS 必须考虑 390px 移动端、768px 平板和 1440px 桌面断点，可使用媒体查询、clamp、容器宽度和流式间距。',
    '2. 桌面 Web / SaaS / 后台必须先做 1920px 宽屏布局，再向下适配 1440px / 768px / 390px；不要先做 1440px 内容岛再居中放到 1920px。',
    '3. 1920px 预览要利用宽屏展开内容：后台/工具页可增加列数、拉开主内容、扩展表格/卡片/素材网格、保留侧边栏和工具栏节奏；不要出现 1440 内容岛居中或中间窄岛。',
    '4. 官网/落地页即使有 max-width，也要用 full-width band、背景层、分栏或内容延展处理 1920px，不能让中间区域孤立悬在大空白里。',
    '5. Web/桌面按 1920px 逻辑宽度设计，移动端按 375px 逻辑宽度设计；页面高度随内容自然增长，高度自适应，不要固定高度去凑截图比例。',
    '6. 图片区域可以固定比例容器，但图片本身不要拉伸变形；必须使用 object-fit: contain 或 object-fit: cover 并配合 aspect-ratio、max-width、max-height 保持原始比例。',
    '7. 优先使用 flex、grid、minmax、max-width、min-width: 0、aspect-ratio、object-fit、gap 等稳定布局能力。',
    '8. 固定宽度内容要有 max-width 和 overflow 兜底；卡片、表格、工具栏、图片区域在窄屏下要自然换行或堆叠。',
    '9. 首屏不能因视口变化出现文字压扁、按钮挤出、图片遮挡、卡片重叠或横向不可控溢出。',
    '10. Tab、分类栏、胶囊筛选和横向菜单超出容器时必须横向滚动，不要换行或挤压文字；右侧使用渐隐遮罩 / fade mask 暗示还有内容，滚动条可隐藏但交互必须可用。',
    '11. 390px / H5 移动端如果出现侧边栏、视频入口或大量顶部按钮，参考饿了么 H5 和大厂 H5 页面：移动端顶部按钮要隐藏或收纳，重操作收纳到“更多”按钮、底部导航、悬浮入口或抽屉菜单。',
    '12. 侧边栏视频在 H5 中不要把桌面侧边栏硬塞成九宫格或大面积空白；主操作最多保留 1 个主按钮，其余入口用横向 chip、底部 tab、浮动工具按钮或抽屉二级菜单承接。',
    '13. 避免夸张错落排版：标题、头像、tab、表单、按钮和卡片必须沿 4px 网格、同轴或基线对齐，不要为了像截图而制造随机错位、漂浮、过大的上下落差。',
    '',
    '4px 基础网格与圆角梯度：',
    '1. 页面采用 4px 基础网格：margin、padding、gap、组件高度、图标容器、头像尺寸和分割线间距优先使用 4px 倍数。',
    '2. 间距按 4px 倍数递进：4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48px；不要出现 7px、13px、19px 这类随意间距。',
    '3. 字号以 14px 正文为基准，采用 4px 递进组织层级：12px 辅助/标签、14px 默认正文、16px 主正文、18px 子标题、20px 卡片标题、24px 模块标题、28px 页面标题。',
    '4. 行高也按 4px 网格贴合：12px 对 16px、14px 对 20px、16px 对 22px 或 24px、20px 对 28px、24px 对 32px、28px 对 38px。',
    '5. 圆角梯度使用固定 token：2px 用于细小描边/表格单元，4px 用于标签和小控件，6px 用于输入框和按钮，8px 用于卡片和面板；普通卡片不要超过 8px。',
    '6. 12px / 16px 圆角只用于大图、hero 封面、人物/商品图片容器或截图原图明确的大圆角模块，不能全页面滥用大圆角。',
    '',
    '字号、密度与比例归一化规范：',
    '1. 不直接照搬截图像素尺寸；先判断截图是否来自浏览器缩放、Retina 高分屏、长图裁切或非标准缩放，再归一化到真实产品页面密度。',
    '2. 桌面 Web / SaaS / 后台以 1440px 作为主要桌面验收基准，1920px 作为宽屏验收基准；1920px 下只增加留白、列数或内容宽度，不把整页字体、图标、图片线性放大。',
    '3. 内容容器要按页面类型设置 max-width：官网/落地页常用 1200px-1440px，表单页常用 720px-960px，后台可满宽但保持合理信息密度。',
    '4. 使用字体 token 或 CSS 变量管理字号：辅助文字 12px-13px，后台/SaaS 正文以 14px 为主，普通官网正文以 16px 为主，卡片标题 16px-20px，页面标题 24px-32px，Hero 标题用 clamp() 限制在合理区间。',
    '5. 可读文字不得小于 12px；不要使用负字距；不要用 vw 线性放大正文；标题可用 clamp()，正文保持稳定字号和行高。',
    '6. 按组件语义联动尺寸：小按钮 32px、常规按钮 36px-40px、强主按钮或移动端按钮 44px-48px；图标按 16px-24px 规格匹配按钮、导航、功能入口，不随截图比例盲目等比缩放。',
    '7. 图片不跟字体等比例缩放，图片必须按容器比例和内容语义适配：头像使用 32px / 40px / 48px / 64px 等规格，商品图和封面图使用 aspect-ratio、object-fit、max-width、max-height 保持稳定。',
    '8. 不能用 transform: scale 或整页 zoom 解决页面过大/过小问题；应通过容器、字号 token、组件规格、媒体查询和图片容器比例修正。',
    '',
    '文字可读性与换行规则：',
    '1. 按钮文字、导航项、标签、角标、价格、状态 pill 等短文本不换行，并在 CSS 中使用 white-space: nowrap。',
    '2. 短标签不拆行，短按钮、tab 项、筛选 chip、下拉选项和导航项也不能被拆行或单字换行；空间不足时优先横向滚动、收纳、ellipsis 或缩短文案。',
    '3. 标题、描述、卡片正文允许自然换行，但要设置合理 line-height、max-width，并用 line-clamp 或 ellipsis 处理超长标题。',
    '4. 不要用过小字号或负字距；中文、英文、数字混排时要保证可读，长单词/URL 要有 overflow-wrap 兜底。',
    '5. 任何文字都不能被图片、图标、装饰、遮罩或 fixed/sticky 元素遮挡。',
    '',
    '生成前自检：',
    '1. 自检 390px / 768px / 1440px 三档：导航、按钮文字、标签、卡片标题、图片、表单和底部区域都不能错位或遮挡。',
    '2. 自检 1920px 宽屏：页面只能更舒展，不能整体变巨大；正文、按钮、图标、图片尺寸仍符合产品密度。',
    '3. 比例归一化自检：确认没有直接照搬截图像素、没有使用整页 transform: scale、没有让 Retina/缩放截图导致字体和图片异常放大。',
    '4. 自检语义结构：header / main / section / footer 是否完整，交互控件是否有 hover / focus，图片是否有 alt，表单是否有 label。',
    '5. 灰度测试 / grayscale 自检：把页面色彩去饱和后，标题、正文、按钮、标签、状态、图表和价格仍要黑白可读；选中、警告、成功、禁用等状态不能只靠颜色作为唯一信息。',
    '6. 自检生成 HTML 是单文件可运行、响应式、自适应、可读、可点击的页面。',
    ...(advanced ? [
      '',
      '高级生成模式：',
      '1. 在原截图还原基础上加入 MD 规范约束，但最终仍只返回 JSON。',
      '2. 保留基础框架，不要重构基础布局、页面层级、左右分栏、顶部工具栏或主内容结构。',
      '3. 在不动基础框架的前提下，替换为更高级、更贴合业务语义的图片素材。',
      '4. 图片可以使用高质量远程图片 URL 或可编辑视觉块，但必须服务页面内容；图片优先 PNG，尤其 Logo、透明底元素、产品贴片、头像遮罩和装饰图形优先用 PNG。',
      '5. Logo 必须找更好看的 PNG 或透明底 PNG 替代，不能用模糊截图裁切、低清位图、emoji 或随手画的 SVG 假冒品牌标识。',
      '6. 每个图片位先判断素材类型：纯人物用于头像、数字人、讲师、用户形象；纯元素用于 Logo、icon、产品、徽章、装饰贴片；组合场景用于 hero、课程封面、活动卡片和氛围封面。',
      '7. 图标必须先从一批精致图标库中选择同一风格：Lucide、Heroicons、Tabler Icons、Remix Icon、Phosphor Icons；整页只能使用一个主图标库风格。',
      '8. 图标必须使用当前图标库和当前图标体系：lucide 语义、data-lucide 属性、lucide 风格内联 SVG 或等价线性图标。',
      '9. 图标必须等比例放大缩小，保持 viewBox 和 stroke-width 视觉一致，禁止拉伸、压扁、旋转凑形或把图片当图标硬裁。',
      '10. 图标大小只使用 12px / 16px / 20px / 24px 阶梯：12px 用于极小辅助态，16px 用于正文、按钮和菜单，20px 用于导航和功能入口，24px 用于顶部入口或大按钮。',
      '11. 图标大小要和旁边文字大小接近，图标视觉高度不超过相邻文字高度；正文/菜单图标约等于文字字号或大 1-2px，按钮图标通常 16px-20px，顶部导航/功能入口通常 20px-24px。',
      '12. 图标和文字要用 inline-flex / gap / align-items:center 对齐，不能出现图标过小、漂浮、和文字基线错位。',
      '13. 不使用 Element Plus 图标、混乱 emoji 图标或风格不一致的图标集。',
      '14. 识别截图里的图片位：人物、头像、卡通、封面、商品图都要保留为独立图片/视觉区域，不要用纯色块糊掉。',
      '15. 根据页面品类填充图片素材：食品、餐饮、美食、生鲜类用食物或餐饮场景图；化妆品、美妆、护肤类用产品或质感静物图；人物、头像、卡通类用对应人像、插画或卡通形象。',
      '16. 执行一轮视觉自检：文字元素不能被图片、头像、卡通形象、色块或装饰元素遮挡；按钮文字、标题、标签、时间角标必须可读。',
      '17. 如果原图存在人物/商品卡片，图片和文字要分层布局，使用 z-index、padding、object-fit、背景遮罩保证不遮挡文字。',
      markdownRules ? `MD 规范：\n${markdownRules}` : 'MD 规范：默认使用当前项目设计规范、组件规范和图标规范。'
    ] : []),
    '',
    `标题：${payload.title || '图片转代码页面'}`,
    `目标：${payload.target || 'static-html'}`,
    `用户补充说明：${payload.prompt || '无'}`
  ].join('\n')
}

function shouldRetryImageVisionWithChat(error = {}) {
  const message = `${error?.message || ''} ${error?.response?.error?.message || ''}`
  const status = Number(error?.status || 0)
  return status === 502 ||
    status === 429 ||
    /upstream request failed|upstream_error|capacity|at capacity|overloaded|rate limit|rate_limit|too many requests|temporarily unavailable|服务繁忙|容量不足|限流|过载/i.test(message)
}

function imageVisionFailureMessage(error = {}) {
  const status = Number(error?.status || 0)
  const apiSurface = error?.apiSurface || 'responses'
  const model = error?.model || '当前模型'
  if (status === 502) {
    return `视觉模型图片输入失败：文本模型连通，但 ${model} 在 ${apiSurface} 图片输入链路返回 502 Upstream request failed。请切换支持视觉输入的模型/provider，或稍后重试。`
  }
  if (status === 400 && /image|图片/i.test(error?.message || error?.response?.error?.message || '')) {
    return `视觉模型拒绝了图片输入：${error.message || '图片格式或接口格式不被当前 provider 接受'}。请换一张 PNG/JPG/WebP，或切换支持视觉输入的模型接口。`
  }
  return error.message || '视觉模型调用失败'
}

async function generateImageToHtmlStream(payload = {}, options = {}, routeContext = {}, service = {}) {
  const stream = service.createStreamPusher(routeContext)
  stream.push('status', { status: 'generating', label: '分析图片布局' })
  const result = await service.generate(payload, {
    ...options,
    onModelEvent: (event, data) => stream.push(event, data)
  })
  if (result.status === 'failed') {
    // Failed visual verification can still be a previewable HTML artifact.
    if (result.html) {
      stream.push('artifact', {
        type: 'html',
        html: result.html,
        visualModel: result.visualModel,
        visualVerification: result.visualVerification,
        restoredPage: result.restoredPage
      })
    }
    stream.push('status', {
      status: 'failed',
      label: result.message || '视觉模型未返回真实 HTML，未保存假预览。'
    })
    stream.push('done', result)
    return {
      contentType: 'text/event-stream; charset=utf-8',
      body: stream.body()
    }
  }
  if (result.fallbackUsed) {
    stream.push('status', {
      status: 'fallback',
      label: `视觉模型暂未返回真实 HTML${result.fallbackReason ? `：${result.fallbackReason}` : ''}`
    })
  }
  stream.push('artifact', {
    type: 'html',
    html: result.html,
    visualModel: result.visualModel,
    visualVerification: result.visualVerification,
    restoredPage: result.restoredPage
  })
  stream.push('done', result)
  return {
    contentType: 'text/event-stream; charset=utf-8',
    body: stream.body()
  }
}

export function createImageToHtmlService(config = {}) {
  const timeoutMs = config.timeoutMs === 0 ? 0 : (config.timeoutMs || 600000)
  const verifyGeneratedPage = config.verifyGeneratedPage || (async () => ({ status: 'passed', results: [], recommendations: [] }))
  const createStreamPusher = config.createStreamPusher || ((routeContext = {}) => ({
    push: (event, data) => routeContext.writeEvent?.(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
    body: () => ''
  }))
  const recordModelCall = async (entry) => {
    try {
      await config.recordModelCall?.(entry)
    } catch {}
  }

  async function generateImageVisionModel(payload = {}, options = {}) {
    const provider = options.provider || config.resolveAgentProvider?.(options) || options.agentProvider
    if (!provider || provider.name === 'deterministic') return null
    const userPrompt = imageVisionPrompt(payload)
    const context = {
      task: 'image-to-html-vision-analysis',
      systemPrompt: '你只返回严格 JSON，用于截图转静态 HTML。不要输出 Markdown。',
      userPrompt,
      title: payload.title,
      prompt: payload.prompt,
      target: payload.target,
      imageDataUrl: payload.imageDataUrl,
      generationMode: payload.generationMode || 'standard',
      markdownRules: payload.markdownRules || '',
      keepBaseFramework: Boolean(payload.keepBaseFramework),
      imageUpgrade: payload.imageUpgrade || '',
      iconSystem: payload.iconSystem || '',
      model: 'gpt-5.5',
      timeoutMs: options.timeoutMs === 0 ? 0 : (options.timeoutMs || timeoutMs)
    }
    let modelResult = null
    if (typeof provider.generate === 'function') {
      modelResult = await provider.generate(context)
    } else if (typeof provider.stream === 'function') {
      let streamedContent = ''
      let finalEvent = null
      for await (const event of provider.stream(context)) {
        if (event?.type === 'delta' && event.content) {
          streamedContent += event.content
          options.onModelEvent?.('delta', { content: event.content })
        }
        if (event?.type === 'final') finalEvent = event
      }
      modelResult = {
        content: finalEvent?.content || streamedContent,
        proposal: finalEvent?.proposal,
        usage: finalEvent?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        provider: finalEvent?.provider || provider.name || 'model',
        model: finalEvent?.model || context.model
      }
    }
    const parsed = safeParseJsonObject(modelResult.content)
    if (!parsed?.html || typeof parsed.html !== 'string') {
      const html = extractHtmlFromModelText(modelResult.content)
      if (!html) {
        const error = new Error('视觉模型没有返回 html 字段')
        error.modelResult = modelResult
        throw error
      }
      return {
        html,
        visualModel: buildImageVisualModel(payload),
        summary: '图片转代码已由视觉模型生成 HTML。',
        provider: modelResult.provider || provider.name || 'model',
        model: modelResult.model || 'gpt-5.5',
        usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      }
    }
    return {
      html: parsed.html,
      visualModel: parsed.visualModel && typeof parsed.visualModel === 'object'
        ? parsed.visualModel
        : buildImageVisualModel(payload),
      summary: parsed.summary || '图片转代码已由视觉模型分析并生成 HTML。',
      provider: modelResult.provider || provider.name || 'model',
      model: modelResult.model || 'gpt-5.5',
      usage: modelResult.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    }
  }

  async function generateImageVisionModelWithFallback(payload = {}, options = {}) {
    try {
      return await generateImageVisionModel(payload, options)
    } catch (error) {
      if (!shouldRetryImageVisionWithChat(error)) throw error
      const fallbackProvider = config.resolveFallbackProvider?.(options) || options.imageVisionFallbackProvider
      if (!fallbackProvider || fallbackProvider.name === 'deterministic') throw error
      const fallbackResult = await generateImageVisionModel(payload, {
        ...options,
        provider: fallbackProvider
      })
      if (fallbackResult) {
        fallbackResult.primaryVisionError = {
          message: error.message || '',
          code: error.code || '',
          provider: error.provider || '',
          model: error.model || '',
          apiSurface: error.apiSurface || '',
          status: error.status || '',
          causeCode: error.causeCode || error.cause?.code || '',
          causeMessage: error.causeMessage || error.cause?.message || ''
        }
      }
      return fallbackResult
    }
  }

  async function generateImageToHtml(payload = {}, options = {}) {
    let modelGeneration = null
    let fallbackReason = ''
    let modelError = null
    const startedAt = Date.now()
    try {
      modelGeneration = await generateImageVisionModelWithFallback(payload, options)
    } catch (error) {
      fallbackReason = imageVisionFailureMessage(error)
      modelError = {
        code: error.code || '',
        provider: error.provider || '',
        model: error.model || '',
        apiSurface: error.apiSurface || '',
        status: error.status || '',
        causeCode: error.causeCode || error.cause?.code || '',
        causeMessage: error.causeMessage || error.cause?.message || ''
      }
    }
    const visualModel = modelGeneration?.visualModel || buildImageVisualModel(payload)
    const captureResult = buildImageToHtmlCaptureResult({ ...payload, visualModel })
    if (modelGeneration) {
      captureResult.raw.model = modelGeneration.model
      captureResult.raw.provider = modelGeneration.provider
      captureResult.raw.usage = modelGeneration.usage
      if (modelGeneration.primaryVisionError) captureResult.raw.primaryVisionError = modelGeneration.primaryVisionError
      captureResult.raw.fallbackUsed = false
    } else if (fallbackReason) {
      captureResult.raw.fallbackUsed = true
      captureResult.raw.fallbackReason = fallbackReason
      captureResult.raw.modelError = modelError
    }
    if (!modelGeneration?.html) {
      const message = fallbackReason
        ? `视觉模型未返回真实 HTML：${fallbackReason}`
        : '视觉模型未返回真实 HTML，无法生成真实预览。请检查模型配置后重试。'
      const visualVerification = {
        url: captureResult.url,
        status: 'failed',
        thresholds: { mode: 'vision-model-required' },
        summary: { total: 1, passed: 0, failed: 1, averageScore: 0 },
        results: [],
        recommendations: ['未保存通用兜底页面，避免把假页面当作截图还原效果。', '请检查模型配置或重新生成。']
      }
      await recordModelCall({
        skillId: 'image-to-html-vision-analysis',
        requestedSkillId: 'image-to-html-vision-analysis',
        resolvedSkillId: 'image-to-html-vision-analysis',
        status: 'failed',
        provider: modelError?.provider || 'model',
        model: modelError?.model || captureResult.raw.model,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        durationMs: Date.now() - startedAt,
        demandScope: 'image-to-code',
        projectId: payload.projectId || captureResult.projectId || 'default',
        detectedIntent: 'screenshot-to-html',
        routingReason: '图片转代码需要视觉模型生成真实 HTML',
        fallbackReason: message,
        errorCode: modelError?.code || '',
        apiSurface: modelError?.apiSurface || '',
        errorStatus: modelError?.status || '',
        causeCode: modelError?.causeCode || '',
        causeMessage: modelError?.causeMessage || '',
        createdAt: new Date().toISOString()
      })
      return {
        taskId: randomUUID(),
        status: 'failed',
        ok: false,
        html: '',
        message,
        captureResult,
        visualModel,
        visualVerification,
        restoredPage: null,
        provider: modelError?.provider || 'model',
        model: modelError?.model || captureResult.raw.model,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        fallbackUsed: true,
        fallbackReason: message,
        modelError,
        summary: message
      }
    }
    const html = modelGeneration.html
    const topicValidation = validateImageHtmlTopic(payload, modelGeneration)
    if (!topicValidation.ok) {
      const visualVerification = {
        url: captureResult.url,
        status: 'failed',
        thresholds: { mode: 'image-topic-consistency' },
        summary: { total: 1, passed: 0, failed: 1, averageScore: 0 },
        results: [],
        recommendations: [topicValidation.reason, '请确认当前模型接口支持图片输入，或重新上传原始页面截图后再生成。']
      }
      const message = topicValidation.reason
      await recordModelCall({
        skillId: 'image-to-html-vision-analysis',
        requestedSkillId: 'image-to-html-vision-analysis',
        resolvedSkillId: 'image-to-html-vision-analysis',
        status: 'failed',
        provider: modelGeneration?.provider || 'model',
        model: modelGeneration?.model || captureResult.raw.model,
        usage: modelGeneration?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        durationMs: Date.now() - startedAt,
        demandScope: 'image-to-code',
        projectId: payload.projectId || captureResult.projectId || 'default',
        detectedIntent: 'screenshot-to-html',
        routingReason: '图片转代码主题一致性验收失败',
        fallbackReason: message,
        createdAt: new Date().toISOString()
      })
      return {
        taskId: randomUUID(),
        status: 'failed',
        ok: false,
        html: '',
        message,
        captureResult,
        visualModel,
        visualVerification,
        restoredPage: null,
        provider: modelGeneration?.provider || 'model',
        model: modelGeneration?.model || captureResult.raw.model,
        usage: modelGeneration?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        fallbackUsed: false,
        fallbackReason: message,
        summary: message
      }
    }
    // Backend owns both visual similarity and static usability checks; frontend only displays this metadata.
    const renderedVerification = await (options.verifyGeneratedPage || verifyGeneratedPage)(captureResult, html)
    const qualityAudit = auditGeneratedHtmlQuality(html, { visualModel, payload })
    const visualVerification = mergeVisualVerificationWithQualityAudit(renderedVerification, qualityAudit)
    captureResult.raw.backendRendered = true
    captureResult.raw.visualVerificationStatus = visualVerification.status
    if (imageHtmlVisualVerificationFailed(visualVerification)) {
      const isRenderFailure = backendRenderVerificationFailed(visualVerification)
      const message = isRenderFailure
        ? `后端渲染验收失败：${visualVerification.recommendations?.[0] || '生成 HTML 无法在 Chromium 中渲染。'}`
        : renderedVerification.status !== 'failed' && qualityAudit.status === 'failed'
          ? `后端静态质量审查失败：${qualityAudit.issues?.[0] || '生成 HTML 不符合可用页面规范。'}`
          : `后端视觉验收失败：${visualVerification.recommendations?.[0] || '生成 HTML 与上传截图差异过大。'}`
      const failedRestoredPage = isRenderFailure
        ? null
        : await config.persistRestoredPage?.({
            ...createRestoredPageAsset({
              projectId: payload.projectId || captureResult.projectId || 'default',
              clientTaskId: payload.clientTaskId || captureResult.taskId,
              captureResult,
              html,
              files: [{ path: 'index.html', content: html }],
              visualVerification
            }),
            status: 'failed',
            restoreQuality: 'failed',
            failureReason: message,
            tags: ['图片转代码', 'html', '验收未通过']
          })
      await recordModelCall({
        skillId: 'image-to-html-vision-analysis',
        requestedSkillId: 'image-to-html-vision-analysis',
        resolvedSkillId: 'image-to-html-vision-analysis',
        status: 'failed',
        provider: modelGeneration?.provider || 'model',
        model: modelGeneration?.model || captureResult.raw.model,
        usage: modelGeneration?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        durationMs: Date.now() - startedAt,
        demandScope: 'image-to-code',
        projectId: payload.projectId || captureResult.projectId || 'default',
        detectedIntent: 'screenshot-to-html',
        routingReason: isRenderFailure ? '图片转代码后端 Chromium 渲染验收失败' : '图片转代码后端视觉相似度验收失败',
        fallbackReason: message,
        createdAt: new Date().toISOString()
      })
      return {
        taskId: failedRestoredPage?.id || randomUUID(),
        status: 'failed',
        ok: false,
        html: isRenderFailure ? '' : html,
        message,
        captureResult,
        visualModel,
        visualVerification,
        restoredPage: failedRestoredPage || null,
        provider: modelGeneration?.provider || 'model',
        model: modelGeneration?.model || captureResult.raw.model,
        usage: modelGeneration?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        fallbackUsed: false,
        fallbackReason: message,
        summary: isRenderFailure ? message : `${modelGeneration?.summary || '图片转代码已生成 HTML'}；${message}`
      }
    }
    const restoredPage = await config.persistRestoredPage?.(createRestoredPageAsset({
      projectId: payload.projectId || captureResult.projectId || 'default',
      clientTaskId: payload.clientTaskId || captureResult.taskId,
      captureResult,
      html,
      files: [{ path: 'index.html', content: html }],
      visualVerification
    }))
    await recordModelCall({
      skillId: 'image-to-html-vision-analysis',
      requestedSkillId: 'image-to-html-vision-analysis',
      resolvedSkillId: 'image-to-html-vision-analysis',
      status: modelGeneration ? 'success' : 'fallback',
      provider: modelGeneration?.provider || 'deterministic',
      model: modelGeneration?.model || captureResult.raw.model,
      usage: modelGeneration?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      durationMs: Date.now() - startedAt,
      demandScope: 'image-to-code',
      projectId: payload.projectId || captureResult.projectId || 'default',
      detectedIntent: 'screenshot-to-html',
      routingReason: '图片转代码后端视觉模型生成 HTML',
      fallbackReason,
      createdAt: new Date().toISOString()
    })
    return {
      taskId: randomUUID(),
      status: 'generated',
      html,
      captureResult,
      visualModel,
      visualVerification,
      restoredPage,
      provider: modelGeneration?.provider || 'deterministic',
      model: modelGeneration?.model || captureResult.raw.model,
      usage: modelGeneration?.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      fallbackUsed: !modelGeneration,
      fallbackReason,
      summary: modelGeneration?.summary || '图片转代码已按截图视觉结构生成静态 HTML。'
    }
  }

  const service = {
    createStreamPusher,
    generate: generateImageToHtml
  }
  return {
    generate: generateImageToHtml,
    stream: (payload, options, routeContext) => generateImageToHtmlStream(payload, options, routeContext, service)
  }
}
