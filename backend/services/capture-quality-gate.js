export function captureRestoreReadiness(captureResult = {}) {
  const nodes = Array.isArray(captureResult.layoutNodes) ? captureResult.layoutNodes : []
  const rawNodeCount = Number(captureResult.raw?.layoutNodeCount) || nodes.length
  const hasSingleFileHtml = Boolean(String(captureResult.singleFileHtml || '').trim())
  const hasStaticHtml = Boolean(String(captureResult.staticHtml || '').trim())
  const hasDomSnapshot = Boolean(captureResult.domSnapshot || captureResult.raw?.domSnapshotCaptured)
  const hasScreenshot = Boolean(captureResult.screenshot || captureResult.pages?.some((page) => page?.screenshot))
  const visibleNodes = nodes.filter((node) => Number(node?.width) > 0 && Number(node?.height) > 0)
  const semanticNodes = visibleNodes.filter((node) => {
    const type = String(node.type || '').toLowerCase()
    const text = String(node.text || node.placeholder || node.alt || '').trim()
    return ['text', 'image', 'control', 'svg', 'pseudo'].includes(type) || text
  })
  const hasDesignTree = Boolean(captureResult.designTree)
  const canRestore = hasDesignTree || semanticNodes.length >= 3 || visibleNodes.length >= 12
  const actions = [
    '使用登录态或远程浏览器重新采集',
    '等待目标页面加载完成后重新采集',
    '上传包含 DOM 与样式的网页快照包'
  ]

  if (hasSingleFileHtml || hasStaticHtml) {
    return {
      canRestore: true,
      status: hasSingleFileHtml ? 'singlefile-ready' : 'static-html-ready',
      nodeCount: rawNodeCount,
      semanticNodeCount: semanticNodes.length,
      hasScreenshot,
      hasSingleFileHtml,
      hasStaticHtml,
      hasDomSnapshot,
      reason: hasSingleFileHtml
        ? '已采集到 SingleFile 高保真静态 HTML，可以直接生成可预览页面。'
        : '已采集到授权浏览器当前页 HTML，可以直接生成可预览页面。',
      actions: []
    }
  }

  if (canRestore) {
    return {
      canRestore: true,
      status: 'ready',
      nodeCount: rawNodeCount,
      semanticNodeCount: semanticNodes.length,
      hasScreenshot,
      hasSingleFileHtml,
      hasStaticHtml,
      hasDomSnapshot,
      reason: '已采集到可还原 DOM 与样式节点，可以生成静态 HTML。',
      actions: []
    }
  }

  const reason = rawNodeCount <= 0
    ? '没有采集到可还原 DOM 节点，当前只有截图或空快照，不能生成 1:1 HTML。'
    : `只采集到 ${rawNodeCount} 个 DOM 节点，其中可用于还原的文本/图片/控件不足，继续生成会变成猜测页面。`

  return {
    canRestore: false,
    status: hasScreenshot ? 'screenshot-only' : 'insufficient',
    nodeCount: rawNodeCount,
    semanticNodeCount: semanticNodes.length,
    hasScreenshot,
    hasSingleFileHtml,
    hasStaticHtml,
    hasDomSnapshot,
    reason,
    actions
  }
}

function countMeaningfulTreeNodes(node = {}) {
  if (!node || typeof node !== 'object') return 0
  const text = String(node.text || node.placeholder || node.alt || '').trim()
  const type = String(node.type || '').toLowerCase()
  const src = String(node.src || node.href || '').trim()
  const isMeaningful = Boolean(text || src || ['text', 'image', 'control', 'svg', 'pseudo'].includes(type))
  const children = Array.isArray(node.children) ? node.children : []
  return (isMeaningful ? 1 : 0) + children.reduce((sum, child) => sum + countMeaningfulTreeNodes(child), 0)
}

function duplicateTextRatio(nodes = []) {
  const texts = nodes
    .map((node) => String(node?.text || node?.placeholder || node?.alt || '').trim())
    .filter(Boolean)
  if (texts.length <= 1) return 0
  const unique = new Set(texts)
  return Number(((texts.length - unique.size) / texts.length).toFixed(2))
}

function singleFilePlainText(html = '') {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectInvalidCapturePage(captureResult = {}, ...htmlSources) {
  const textBlocks = Array.isArray(captureResult.textBlocks)
    ? captureResult.textBlocks.map((item) => item.text || item.content || item).join(' ')
    : ''
  const source = [
    captureResult.title,
    captureResult.url,
    ...htmlSources.map((html) => singleFilePlainText(html)),
    textBlocks
  ].join('\n')

  const patterns = [
    { label: '405 异常访问', pattern: /405\s*异常访问|异常访问|请求有异常行为|您的请求地址/i },
    { label: '403 / Access Denied', pattern: /403|access denied|forbidden|request blocked/i },
    { label: '安全验证页', pattern: /安全验证|人机验证|验证码|captcha|robot check|verify you are human/i },
    { label: '登录拦截页', pattern: /请先登录|登录后访问|sign in required|login required/i }
  ]
  return patterns.find((item) => item.pattern.test(source)) || null
}

function capturePageHeight(captureResult = {}) {
  const raw = captureResult.raw || {}
  return Number(raw.capturedPageHeight || raw.pageHeight || captureResult.viewport?.pageHeight || captureResult.designTree?.height || 0)
}

export function captureQualityGate(captureResult = {}, options = {}) {
  const nodes = Array.isArray(captureResult.layoutNodes) ? captureResult.layoutNodes : []
  const semanticNodeCount = nodes.filter((node) => {
    const type = String(node?.type || '').toLowerCase()
    const text = String(node?.text || node?.placeholder || node?.alt || '').trim()
    return ['text', 'image', 'control', 'svg', 'pseudo'].includes(type) || text
  }).length
  const singleFileHtml = String(captureResult.singleFileHtml || '').trim()
  const singleFileLength = singleFileHtml.length
  const staticHtml = String(captureResult.staticHtml || '').trim()
  const staticHtmlLength = staticHtml.length
  const invalidPage = detectInvalidCapturePage(captureResult, singleFileHtml, staticHtml)
  const meaningfulTreeNodes = countMeaningfulTreeNodes(captureResult.designTree)
  const flatNodeCount = nodes.length
  const duplicateRatio = duplicateTextRatio(nodes)
  const pageHeight = capturePageHeight(captureResult)
  const viewportHeight = Number(captureResult.viewport?.height || captureResult.raw?.viewportHeight || 900)
  const heightCoverage = pageHeight ? Number((viewportHeight / pageHeight).toFixed(2)) : 1
  const hasScreenshot = Boolean(captureResult.screenshot || captureResult.pages?.some((page) => page?.screenshot))
  const minSingleFileLength = Number(options.minSingleFileLength) || 40
  const minStaticHtmlLength = Number(options.minStaticHtmlLength) || minSingleFileLength
  const reasons = []
  const actions = [
    '使用授权浏览器等待页面加载完成后重新采集',
    '优先生成 SingleFile 静态 HTML 快照',
    '重新采集包含父子层级、滚动容器和完整页面高度的数据'
  ]

  if (invalidPage) {
    return {
      passed: false,
      status: 'blocked',
      mode: 'access-denied-page',
      score: 0,
      reasons: [`目标站返回 ${invalidPage.label}，这是风控、登录或错误页，不是可还原的目标页面。`],
      actions: ['使用远程浏览器登录后再采集', '提供 Cookie / 登录态', '上传网页快照包', '上传截图走“图片转代码”'],
      metrics: {
        singleFileLength,
        staticHtmlLength,
        meaningfulTreeNodes,
        flatNodeCount,
        semanticNodeCount,
        duplicateTextRatio: duplicateRatio,
        pageHeight,
        viewportHeight,
        heightCoverage,
        hasScreenshot,
        invalidPage: invalidPage.label
      }
    }
  }

  if (singleFileLength >= minSingleFileLength) {
    return {
      passed: true,
      status: 'passed',
      mode: 'singlefile-static',
      score: 100,
      reasons: [],
      actions: [],
      metrics: {
        singleFileLength,
        staticHtmlLength,
        meaningfulTreeNodes,
        flatNodeCount,
        semanticNodeCount,
        duplicateTextRatio: duplicateRatio,
        pageHeight,
        viewportHeight,
        heightCoverage,
        hasScreenshot
      }
    }
  }

  if (staticHtmlLength >= minStaticHtmlLength) {
    return {
      passed: true,
      status: 'passed',
      mode: 'static-html',
      score: 94,
      reasons: [],
      actions: [],
      metrics: {
        singleFileLength,
        staticHtmlLength,
        meaningfulTreeNodes,
        flatNodeCount,
        semanticNodeCount,
        duplicateTextRatio: duplicateRatio,
        pageHeight,
        viewportHeight,
        heightCoverage,
        hasScreenshot
      }
    }
  }

  if (!flatNodeCount && hasScreenshot) {
    reasons.push('当前只有截图，没有可还原的 HTML 或 DOM 层级数据。')
    return {
      passed: false,
      status: 'blocked',
      mode: 'screenshot-only',
      score: 0,
      reasons,
      actions,
      metrics: {
        singleFileLength,
        staticHtmlLength,
        meaningfulTreeNodes,
        flatNodeCount,
        semanticNodeCount,
        duplicateTextRatio: duplicateRatio,
        pageHeight,
        viewportHeight,
        heightCoverage,
        hasScreenshot
      }
    }
  }

  const hasEnoughSemanticFlatNodes = semanticNodeCount >= 3 && duplicateRatio < 0.35 && (!pageHeight || heightCoverage >= 0.5)

  if (!meaningfulTreeNodes && flatNodeCount && !hasEnoughSemanticFlatNodes) {
    reasons.push('采集结果缺少可用父子层级，真实内容只存在于扁平绝对定位节点中。')
  }
  if (duplicateRatio >= 0.35) {
    reasons.push(`重复文本比例 ${Math.round(duplicateRatio * 100)}%，存在较高遮挡或重复采样风险。`)
  }
  if (pageHeight && heightCoverage < 0.5) {
    reasons.push(`当前节点只覆盖约 ${Math.round(heightCoverage * 100)}% 页面高度，长页面采集不完整。`)
  }

  if (reasons.length) {
    return {
      passed: false,
      status: 'blocked',
      mode: meaningfulTreeNodes ? 'incomplete-structure' : 'flat-nodes-only',
      score: Math.max(0, 40 - reasons.length * 10),
      reasons,
      actions,
      metrics: {
        singleFileLength,
        staticHtmlLength,
        meaningfulTreeNodes,
        flatNodeCount,
        semanticNodeCount,
        duplicateTextRatio: duplicateRatio,
        pageHeight,
        viewportHeight,
        heightCoverage,
        hasScreenshot
      }
    }
  }

  return {
    passed: true,
    status: 'passed',
    mode: 'structured-dom',
    score: 78,
    reasons: [],
    actions: [],
    metrics: {
      singleFileLength,
      staticHtmlLength,
      meaningfulTreeNodes,
      flatNodeCount,
      semanticNodeCount,
      duplicateTextRatio: duplicateRatio,
      pageHeight,
      viewportHeight,
      heightCoverage,
      hasScreenshot
    }
  }
}
