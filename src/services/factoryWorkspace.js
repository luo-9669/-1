export function normalizeFactoryWorkspace(state = {}) {
  const restoredPages = Array.isArray(state.restoredPages)
    ? state.restoredPages.map((page) => {
        const htmlFile = Array.isArray(page.files)
          ? page.files.find((file) => file.path === 'index.html' && file.content)?.content
          : ''
        const currentHtml = htmlFile || page.html || ''
        const pageData = extractPageData(page.files || [])
        const repairedHtml = legacyImageToCodeScreenshotShell(page, currentHtml)
          ? renderImageToCodeStaticHtml(page)
          : pageData && isEmptyGeneratedShell(currentHtml)
            ? renderStaticHtmlFromPageData(pageData, page)
            : currentHtml
        const repairedFiles = repairedHtml !== currentHtml
          ? ensureIndexHtmlFile(page.files || [], repairedHtml)
          : page.files
        return {
          ...page,
          html: repairedHtml,
          files: repairedFiles
        }
      })
    : []
  return {
    ...state,
    currentFactoryRoute: ['home', 'capture-detail', 'restored-detail'].includes(state.currentFactoryRoute)
      ? state.currentFactoryRoute
      : 'home',
    restoredPages,
    selectedRestoredPageId: typeof state.selectedRestoredPageId === 'string' ? state.selectedRestoredPageId : ''
  }
}

function ensureIndexHtmlFile(files = [], html = '') {
  const list = Array.isArray(files) ? files : []
  const hasIndex = list.some((file) => file?.path === 'index.html')
  if (hasIndex) {
    return list.map((file) => file?.path === 'index.html' ? { ...file, content: html } : file)
  }
  return [{ path: 'index.html', content: html }, ...list]
}

function legacyImageToCodeScreenshotShell(page = {}, html = '') {
  const sourceUrl = String(page.sourceUrl || page.captureResult?.url || '')
  const captureKind = String(page.captureResult?.raw?.captureKind || page.captureResult?.raw?.source || '')
  const isImageToCode = sourceUrl.startsWith('image://') || captureKind === 'image-to-code'
  if (!isImageToCode) return false
  const source = String(html || '')
  const dataImageTags = source.match(/<img\b[^>]+src=["']data:image\/[^"']+["'][^>]*>/gi) || []
  const hasRealStructure = /class=["'][^"']*\bimage-to-html-page\b/i.test(source)
    || /<(form|input|button|nav|aside|article|ul|ol|h1|h2|p)\b/i.test(source.replace(/<img\b[\s\S]*?>/gi, ''))
  return dataImageTags.length > 0 && !hasRealStructure
}

function renderImageToCodeStaticHtml(page = {}) {
  const title = page.title || page.captureResult?.title || '图片转代码页面'
  const prompt = page.captureResult?.textBlocks?.find((item) => item?.text)?.text || '旧图片转代码资产已迁移为可运行静态 HTML。'
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #f6f7f9; color: #222529; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
    .image-to-html-page { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) 460px; gap: 48px; padding: 40px 72px 64px; }
    .topbar { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; height: 60px; border-bottom: 1px solid #e4e7eb; }
    .brand { font-weight: 800; font-size: 18px; }
    .nav { display: flex; gap: 24px; color: #606873; font-size: 14px; }
    .hero { align-self: center; max-width: 620px; }
    .eyebrow { display: inline-flex; border: 1px solid #d9dde3; border-radius: 999px; padding: 8px 14px; background: #fff; color: #606873; font-size: 13px; }
    h1 { margin: 22px 0 16px; font-size: 54px; line-height: 1.08; letter-spacing: 0; }
    p { margin: 0; color: #606873; font-size: 17px; line-height: 1.8; }
    .actions { display: flex; gap: 12px; margin-top: 30px; }
    button, .secondary { height: 46px; border-radius: 8px; padding: 0 20px; border: 1px solid #222529; font-weight: 700; }
    button { background: #222529; color: #fff; }
    .secondary { background: #fff; color: #222529; }
    .panel { align-self: center; background: #fff; border: 1px solid #e4e7eb; border-radius: 16px; box-shadow: 0 28px 80px rgba(34, 37, 41, .10); padding: 28px; }
    .panel h2 { margin: 0 0 18px; font-size: 22px; }
    .row { display: grid; gap: 8px; margin-top: 14px; }
    label { color: #7f8792; font-size: 13px; }
    input { height: 44px; border: 1px solid #dfe3e8; border-radius: 8px; padding: 0 12px; color: #222529; background: #fafbfc; }
    .notice { margin-top: 18px; padding: 14px; border-radius: 10px; background: #f0fdf4; color: #166534; font-size: 13px; line-height: 1.7; }
    @media (max-width: 900px) {
      .image-to-html-page { grid-template-columns: 1fr; padding: 24px; }
      h1 { font-size: 38px; }
    }
  </style>
</head>
<body>
  <main class="image-to-html-page">
    <header class="topbar">
      <div class="brand">${escapeHtml(title)}</div>
      <nav class="nav" aria-label="主导航"><span>首页</span><span>功能</span><span>设置</span></nav>
    </header>
    <section class="hero">
      <span class="eyebrow">图片转代码 · 迁移结果</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(prompt)}</p>
      <div class="actions">
        <button type="button">开始使用</button>
        <button class="secondary" type="button">查看方案</button>
      </div>
    </section>
    <section class="panel">
      <h2>静态 HTML 结构</h2>
      <div class="row"><label>资产来源</label><input value="图片转代码" readonly /></div>
      <div class="row"><label>迁移状态</label><input value="已移除截图壳，改为可运行 DOM" readonly /></div>
      <div class="row"><label>下一步</label><input value="接入视觉模型后可重新生成更高保真页面" readonly /></div>
      <div class="notice">旧图片转代码资产已迁移：当前页面不再把上传截图作为 HTML 结果展示。</div>
    </section>
  </main>
</body>
</html>`
}

export function restoredPagesForProject(pages = [], projectId = '') {
  return pages
    .filter((page) => page?.projectId === projectId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
}

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

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function extractPageData(files = []) {
  const file = files.find((item) => item.path === 'src/pageData.js')
  if (!file?.content) return null
  const match = file.content.match(/export\s+const\s+pageData\s*=\s*([\s\S]*)/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim().replace(/;$/, ''))
  } catch {
    return null
  }
}

function renderNode(node = {}) {
  const style = node.style || {}
  const css = [
    ['left', `${node.x || 0}px`],
    ['top', `${node.y || 0}px`],
    ['width', `${node.width || 0}px`],
    ['height', `${node.height || 0}px`],
    ['position', 'absolute'],
    ['box-sizing', 'border-box'],
    ['color', style.color],
    ['font-size', style.fontSize],
    ['font-family', style.fontFamily],
    ['font-weight', style.fontWeight],
    ['line-height', style.lineHeight],
    ['background', node.type === 'text' ? 'transparent' : style.backgroundColor],
    ['border-radius', style.borderRadius],
    ['box-shadow', style.boxShadow],
    ['overflow', node.type === 'text' ? 'hidden' : style.overflow]
  ]
    .filter(([, value]) => value && value !== 'undefined' && value !== 'normal' && value !== 'none')
    .map(([key, value]) => `${key}:${value}`)
    .join(';')

  if (node.type === 'image' && node.src) {
    return `<img style="${escapeHtml(css)};object-fit:${escapeHtml(style.objectFit || 'cover')}" src="${escapeHtml(node.src)}" alt="${escapeHtml(node.alt || '')}" />`
  }
  const tag = ['h1', 'h2', 'h3', 'p', 'span', 'strong', 'small', 'button', 'a'].includes(node.tag) ? node.tag : 'div'
  return `<${tag} style="${escapeHtml(css)}">${escapeHtml(node.text || node.placeholder || '')}</${tag}>`
}

function treeStyle(node = {}) {
  const style = node.style || {}
  const entries = [
    ['box-sizing', style.boxSizing || 'border-box'],
    ['display', ['html', 'body'].includes(node.tag) ? 'block' : style.display],
    ['position', style.position === 'fixed' ? 'absolute' : style.position],
    ['width', style.width],
    ['height', style.height],
    ['min-width', style.minWidth],
    ['min-height', style.minHeight],
    ['max-width', style.maxWidth],
    ['max-height', style.maxHeight],
    ['margin', node.tag === 'body' ? '0' : style.margin],
    ['padding', style.padding],
    ['gap', style.gap],
    ['flex-direction', style.flexDirection],
    ['flex-wrap', style.flexWrap],
    ['justify-content', style.justifyContent],
    ['align-items', style.alignItems],
    ['color', style.color],
    ['background-color', style.backgroundColor],
    ['background-image', style.backgroundImage],
    ['background-size', style.backgroundSize],
    ['background-position', style.backgroundPosition],
    ['background-repeat', style.backgroundRepeat],
    ['font-family', style.fontFamily],
    ['font-size', style.fontSize],
    ['font-weight', style.fontWeight],
    ['line-height', style.lineHeight],
    ['text-align', style.textAlign],
    ['border-radius', style.borderRadius],
    ['border-color', style.borderColor],
    ['border-style', style.borderStyle],
    ['border-width', style.borderWidth],
    ['box-shadow', style.boxShadow],
    ['opacity', style.opacity],
    ['overflow', style.overflow],
    ['object-fit', style.objectFit],
    ['transform', style.transform],
    ['filter', style.filter]
  ]
  return entries
    .filter(([, value]) => value && value !== 'normal' && value !== 'none' && value !== 'auto' && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent')
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
}

function safeTreeTag(tag = 'div') {
  return ['main', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button', 'ul', 'ol', 'li', 'form', 'label', 'strong', 'small'].includes(tag) ? tag : 'div'
}

function renderTreeNode(node = {}) {
  const style = treeStyle(node)
  if (node.type === 'image' && node.src) {
    return `<img class="tree-node tree-image" style="${escapeHtml(style)}" src="${escapeHtml(node.src)}" alt="${escapeHtml(node.alt || '')}" />`
  }
  const tag = safeTreeTag(node.tag)
  const children = Array.isArray(node.children) ? node.children.map(renderTreeNode).join('') : ''
  return `<${tag} class="tree-node tree-${escapeHtml(node.type || 'container')}" style="${escapeHtml(style)}">${escapeHtml(node.text || node.placeholder || '')}${children}</${tag}>`
}

function visibleTextFromHtml(html = '') {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function htmlStructureSummary(html = '') {
  const tags = []
  const tagPattern = /<(main|header|nav|section|article|aside|footer|div|span|p|h1|h2|h3|button|a|input|textarea|img)\b([^>]*)>/gi
  let match
  while ((match = tagPattern.exec(String(html || ''))) && tags.length < 80) {
    const textAfter = String(html || '').slice(tagPattern.lastIndex, tagPattern.lastIndex + 120)
    const text = visibleTextFromHtml(textAfter).slice(0, 40)
    const attrs = match[2] || ''
    const className = attrs.match(/\sclass=["']([^"']+)["']/i)?.[1] || ''
    tags.push({
      tag: match[1].toLowerCase(),
      text,
      className
    })
  }
  return tags
}

function captureStructureSummary(page = {}) {
  const nodes = Array.isArray(page.captureResult?.layoutNodes) ? page.captureResult.layoutNodes : []
  return nodes
    .slice(0, 160)
    .map((node) => {
      const rect = node.rect || node
      const width = Math.round(Number(rect.width) || 0)
      const height = Math.round(Number(rect.height) || 0)
      return {
        tag: String(node.tag || node.nodeName || node.type || 'div').toLowerCase(),
        text: String(node.text || node.placeholder || node.alt || '').trim().slice(0, 80),
        className: String(node.className || node.class || '').trim().slice(0, 80),
        type: node.type || '',
        size: width || height ? `${width}x${height}` : ''
      }
    })
    .filter((node) => node.tag || node.text || node.className || node.size)
}

function iframeSrcdoc(html = '') {
  return escapeHtml(String(html || ''))
}

function renderHtmlStructure(html = '', title = 'HTML 结构', page = {}) {
  const nodes = captureStructureSummary(page).length ? captureStructureSummary(page) : htmlStructureSummary(html)
  if (!nodes.length) {
    return `<div class="html-structure-empty"><strong>没有解析到结构节点</strong><p>当前 HTML 可以在截图模式查看，但没有可展示的语义结构。</p></div>`
  }
  return `<div class="html-structure-panel"><h2>${escapeHtml(title)} · ${nodes.length} 个结构节点</h2><ol>${nodes.map((node, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><strong>&lt;${escapeHtml(node.tag)}&gt;</strong><em>${escapeHtml([node.text, node.className && `.${node.className}`, node.size].filter(Boolean).join(' · ') || '无文本')}</em></li>`).join('')}</ol></div>`
}

function renderCoverStage({ page = {}, device = 'desktop', zoom = 1, scale = true } = {}) {
  const width = stageWidthFor(page.viewport || {}, device)
  const height = Number(page.viewport?.height) || 900
  const transform = scale ? `transform:scale(${zoom});transform-origin:top left;` : ''
  if (!page.coverImage) {
    return `<section class="stage capture-cover-stage empty-cover-stage" data-device="${escapeHtml(device)}" style="width:${width}px;min-height:${height}px;${transform}"><div class="capture-empty-state"><strong>暂无原网页截图</strong><p>当前资产没有保存截图，只能查看右侧 HTML 还原结果。</p></div></section>`
  }
  return `<section class="stage capture-cover-stage" data-device="${escapeHtml(device)}" style="width:${width}px;min-height:${height}px;${transform}"><img class="capture-cover-layer" src="${escapeHtml(page.coverImage)}" alt="${escapeHtml(page.title || '原网页截图')}" /></section>`
}

function renderLoadingPane(loadingView = {}) {
  const steps = Array.isArray(loadingView.steps) ? loadingView.steps : CAPTURE_LOADING_STEPS
  const currentStepId = loadingView.currentStep?.id || steps[0]?.id || ''
  return `<div class="html-preview-loading">
    <span class="loading-spinner-large"></span>
    <strong>HTML 还原生成中</strong>
    <p>系统正在把快照结构、截图和样式转成可预览的静态 HTML，完成后这里会自动展示页面。</p>
    <div class="capture-loading-meta"><span>${escapeHtml(loadingView.estimatedLabel || '预计 45-90 秒')}</span><span>${escapeHtml(loadingView.elapsedLabel || '已用 0 秒')}</span></div>
    <div class="capture-loading-copy"><span class="typewriter-text">${escapeHtml(loadingView.typedCopy || CAPTURE_LOADING_COPY[0])}</span></div>
    <div class="capture-loading-steps">${steps.map((step) => `<div class="capture-loading-step ${step.id === currentStepId ? 'active' : ''}"><i></i><div><b>${escapeHtml(step.title)}</b><span>${escapeHtml(step.detail)}</span></div></div>`).join('')}</div>
  </div>`
}

function renderHtmlStage({ page = {}, html = '', mode = 'screenshot', device = 'desktop', zoom = 1 } = {}) {
  const width = stageWidthFor(page.viewport || {}, device)
  const height = Number(page.viewport?.height) || 900
  const htmlFrame = `<iframe class="html-preview-frame" title="${escapeHtml(page.title || 'HTML 还原页面')}" srcdoc="${iframeSrcdoc(html)}"></iframe>`
  const structure = renderHtmlStructure(html, page.title || 'HTML 结构', page)
  const content = mode === 'structure'
    ? structure
    : mode === 'compare'
      ? `<div class="compare-scale-frame" style="width:calc(${width}px * 2 + 24px);transform:scale(${zoom});transform-origin:top left;"><div class="compare-grid html-compare-grid"><div class="compare-pane html-pane"><span>HTML 还原页面</span><section class="stage html-stage-inner" data-device="${escapeHtml(device)}" style="width:${width}px;min-height:${height}px;">${htmlFrame}</section></div><div class="compare-pane screenshot-pane"><span>原网页截图</span>${renderCoverStage({ page, device, zoom, scale: false })}</div></div></div>`
      : htmlFrame
  const stageWidth = mode === 'compare' ? `calc((${width}px * 2 + 24px) * ${zoom})` : `${width}px`
  const stageHeight = mode === 'compare' ? `calc((${height}px + 28px) * ${zoom})` : `${height}px`
  const transform = mode === 'compare' ? '' : `transform:scale(${zoom});transform-origin:top left;`
  return `<section class="stage html-stage" data-device="${escapeHtml(device)}" style="width:${stageWidth};min-height:${stageHeight};${transform}">${content}</section>`
}

function hasRenderableMedia(html = '') {
  return /<(img|video|canvas|iframe)\b[^>]*(src|data-src|poster)=["'][^"']+["']/i.test(html)
}

function isEmptyGeneratedShell(html = '') {
  const source = String(html || '').trim()
  if (!source) return true
  const hasEmptyStage = /<section[^>]*class=["'][^"']*\bstage\b[^"']*["'][^>]*>\s*<\/section>/i.test(source)
  if (hasEmptyStage && !hasRenderableMedia(source)) return true
  return !visibleTextFromHtml(source) && !hasRenderableMedia(source)
}

function collectTreeSamples(node = {}, samples = []) {
  if (samples.length >= 4 || !node) return samples
  const text = String(node.text || node.placeholder || node.alt || '').trim()
  if (text) samples.push(text)
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => collectTreeSamples(child, samples))
  }
  return samples
}

function renderableNodesForPreview(nodes = [], hasCover = false) {
  if (!hasCover) return nodes
  return nodes.filter((node) => ['text', 'image', 'control', 'svg'].includes(node.type))
}

const PREVIEW_DEVICES = {
  desktop: { width: 1440, label: 'Desktop' },
  tablet: { width: 1024, label: 'Tablet' },
  mobile: { width: 390, label: 'Mobile' }
}

function normalizePreviewOptions(options = {}) {
  const modeMap = { html: 'screenshot', screenshot: 'screenshot', structure: 'structure', compare: 'compare' }
  const mode = modeMap[options.mode] || 'screenshot'
  const device = PREVIEW_DEVICES[options.device] ? options.device : 'desktop'
  const zoom = Number(options.zoom)
  return {
    mode,
    device,
    zoom: Number.isFinite(zoom) ? Math.min(2, Math.max(0.25, zoom)) : 1
  }
}

function stageWidthFor(viewport = {}, device = 'desktop') {
  return PREVIEW_DEVICES[device]?.width || Number(viewport.width) || 1440
}

function renderStage({ pageData = {}, page = {}, mode = 'screenshot', device = 'desktop', zoom = 1 } = {}) {
  const viewport = pageData.viewport || { width: 1440, height: 900 }
  const width = stageWidthFor(viewport, device)
  const height = Number(viewport.height) || 900
  const nodes = Array.isArray(pageData.nodes) ? pageData.nodes : []
  const canUseCover = Boolean(page.coverImage)
  const showCover = canUseCover && ['screenshot', 'compare'].includes(mode)
  const showStructure = mode === 'structure' || mode === 'compare' || !showCover
  const previewNodes = renderableNodesForPreview(nodes, canUseCover)
  const coverLayer = showCover
    ? `<img class="capture-cover-layer" src="${escapeHtml(page.coverImage)}" alt="${escapeHtml(pageData.title || page.title || '采集截图')}" />`
    : ''
  const structureMarkup = showStructure
    ? (
        pageData.designTree && !canUseCover
          ? renderTreeNode(pageData.designTree)
          : previewNodes.map(renderNode).join('') || `<div class="capture-empty-state"><strong>页面没有可渲染节点</strong><p>源码包里没有可还原的节点数据，请重新采集或生成页面。</p></div>`
      )
    : ''
  return `<section class="stage" data-device="${escapeHtml(device)}" style="width:${width}px;min-height:${height}px;transform:scale(${zoom});transform-origin:top left;">${coverLayer}${structureMarkup}</section>`
}

function renderStaticHtmlFromPageData(pageData = {}, page = {}) {
  const viewport = pageData.viewport || { width: 1440, height: 900 }
  const width = Number(viewport.width) || 1440
  const height = Number(viewport.height) || 900
  const nodes = Array.isArray(pageData.nodes) ? pageData.nodes : []
  const markup = pageData.designTree
    ? renderTreeNode(pageData.designTree)
    : nodes.map(renderNode).join('')
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(pageData.title || page.title || 'HTML 还原页面')}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: ${escapeHtml(pageData.pageBackground || '#fff')}; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; color: #222529; }
    main { position: relative; width: ${width}px; min-height: ${height}px; margin: 0 auto; overflow: hidden; background: ${escapeHtml(pageData.pageBackground || '#fff')}; }
    .tree-node { box-sizing: border-box; }
    main > [style*="position:absolute"], main > [style*="position: absolute"] { position: absolute !important; }
  </style>
</head>
<body>
  <main>${markup || `<section style="padding:48px;"><h1>${escapeHtml(pageData.title || page.title || 'HTML 还原页面')}</h1><p>当前资产没有可还原节点，请重新生成。</p></section>`}</main>
</body>
</html>`
}

export function restoredPagePreviewSummary(page = {}) {
  const pageData = extractPageData(page.files || [])
  if (page.html && page.html.trim() && !isEmptyGeneratedShell(page.html)) {
    return {
      status: 'html',
      title: page.title || '还原页面预览',
      sourceUrl: page.sourceUrl || '',
      nodeCount: pageData?.nodes?.length || 0,
      samples: [],
      hasCover: Boolean(page.coverImage),
      message: '已加载 1:1 HTML 还原页面'
    }
  }
  if (pageData) {
    const nodes = Array.isArray(pageData.nodes) ? pageData.nodes : []
    const samples = pageData.designTree
      ? collectTreeSamples(pageData.designTree)
      : nodes
        .map((node) => String(node.text || node.placeholder || node.alt || '').trim())
        .filter(Boolean)
        .slice(0, 4)
    return {
      status: nodes.length || pageData.designTree ? 'ready' : 'empty',
      title: pageData.title || page.title || '还原页面预览',
      sourceUrl: pageData.sourceUrl || page.sourceUrl || '',
      nodeCount: pageData.designTree ? Math.max(nodes.length, 1) : nodes.length,
      samples,
      hasCover: Boolean(page.coverImage),
      message: nodes.length || pageData.designTree
        ? '已从源码包解析出可渲染页面数据'
        : '源码包存在 pageData，但没有可见节点'
    }
  }
  if (page.coverImage) {
    return {
      status: 'cover',
      title: page.title || '还原页面预览',
      sourceUrl: page.sourceUrl || '',
      nodeCount: 0,
      samples: [],
      hasCover: true,
      message: '源码数据不可渲染，当前展示采集截图兜底'
    }
  }
  return {
    status: 'failed',
    title: page.title || '还原页面预览',
    sourceUrl: page.sourceUrl || '',
    nodeCount: 0,
    samples: [],
    hasCover: false,
    message: '没有可渲染 HTML、pageData 或采集截图'
  }
}

export function restoredPagePreviewHtml(page = {}, options = {}) {
  const pageData = extractPageData(page.files || [])
  const preview = normalizePreviewOptions(options)
  if (options.loading) {
    const stageWidth = stageWidthFor(page.viewport || {}, preview.device)
    const stageHeight = Number(page.viewport?.height) || 900
    const loadingView = options.loadingView || captureLoadingExperience(0, {})
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(page.title || 'HTML 还原生成中')}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f6f7f9; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; color: #222529; }
    main { width: 100%; min-height: 100vh; overflow: auto; padding: 24px; }
    .stage { position: relative; width: ${stageWidth}px; min-height: ${stageHeight}px; margin: 0 auto; background: #fff; overflow: hidden; box-shadow: 0 18px 42px rgba(17,24,39,.08); }
    .capture-cover-layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: top center; background: #fff; }
    .compare-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; min-width: max-content; }
    .html-compare-grid { width: calc(${stageWidth}px * 2 + 24px); }
    .compare-pane { display: grid; gap: 10px; align-content: start; }
    .compare-pane > span { color: #4c535c; font-size: 12px; font-weight: 700; }
    .html-preview-loading { min-height: ${stageHeight}px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 48px 24px; text-align: center; background: #fff; }
    .html-preview-loading p { max-width: 430px; margin: 0; color: #7f8792; line-height: 1.7; }
    .loading-spinner-large { width: 34px; height: 34px; border: 3px solid #d6dade; border-top-color: #222529; border-radius: 999px; animation: spin .8s linear infinite; }
    .capture-loading-meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
    .capture-loading-meta span { border-radius: 999px; background: #f6f7f9; padding: 5px 10px; color: #5d6570; font-size: 12px; font-weight: 700; }
    .capture-loading-copy { min-height: 24px; color: #222529; font-weight: 700; }
    .typewriter-text { display: inline-block; max-width: min(560px, 76vw); overflow: hidden; white-space: nowrap; border-right: 2px solid #222529; animation: typewriter 2.2s steps(24, end), caret .8s step-end infinite; }
    .capture-loading-steps { width: min(760px, 100%); display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 8px; }
    .capture-loading-step { min-width: 0; display: flex; gap: 10px; text-align: left; border: 1px solid #e8eaec; border-radius: 8px; padding: 12px; background: #f7f8fa; color: #7f8792; }
    .capture-loading-step i { width: 9px; height: 9px; flex: 0 0 auto; margin-top: 5px; border-radius: 999px; background: #c9ced6; }
    .capture-loading-step b { display: block; margin-bottom: 3px; color: #4c535c; font-size: 13px; }
    .capture-loading-step span { display: block; color: #8b94a0; font-size: 12px; line-height: 1.45; }
    .capture-loading-step.active { border-color: rgba(255,173,51,.42); background: #fff8ec; color: #8a5200; }
    .capture-loading-step.active i { background: #f6a609; box-shadow: 0 0 0 4px rgba(246,166,9,.16); }
    .capture-empty-state { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(560px, calc(100% - 48px)); border: 1px solid #e8eaec; border-radius: 8px; background: #fff; padding: 24px; color: #222529; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes caret { 50% { border-color: transparent; } }
    @keyframes typewriter { from { max-width: 0; } to { max-width: min(560px, 76vw); } }
  </style>
</head>
<body data-preview-mode="${escapeHtml(preview.mode)}" data-preview-device="${escapeHtml(preview.device)}" data-preview-zoom="${escapeHtml(preview.zoom)}" data-preview-loading="true">
  <main><section class="stage html-stage" data-device="${escapeHtml(preview.device)}" style="width:calc((${stageWidth}px * 2 + 24px) * ${preview.zoom});min-height:calc((${stageHeight}px + 28px) * ${preview.zoom});"><div class="compare-scale-frame" style="width:calc(${stageWidth}px * 2 + 24px);transform:scale(${preview.zoom});transform-origin:top left;"><div class="compare-grid html-compare-grid"><div class="compare-pane screenshot-pane"><span>原网页截图</span>${renderCoverStage({ page, device: preview.device, zoom: preview.zoom, scale: false })}</div><div class="compare-pane html-pane"><span>HTML 还原页面</span><section class="stage html-stage-inner" data-device="${escapeHtml(preview.device)}" style="width:${stageWidth}px;min-height:${stageHeight}px;">${renderLoadingPane(loadingView)}</section></div></div></div></section></main>
</body>
</html>`
  }
  if (page.html && page.html.trim() && !isEmptyGeneratedShell(page.html)) {
    const stageWidth = stageWidthFor(page.viewport || {}, preview.device)
    const stageHeight = Number(page.viewport?.height) || 900
    const singleStage = renderHtmlStage({ page, html: page.html, ...preview })
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(page.title || 'HTML 还原页面')}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f6f7f9; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; color: #222529; }
    main { width: 100%; min-height: 100vh; overflow: auto; padding: 24px; }
    .stage { position: relative; width: ${stageWidth}px; min-height: ${stageHeight}px; margin: 0 auto; background: #fff; overflow: hidden; box-shadow: 0 18px 42px rgba(17,24,39,.08); }
    .html-preview-frame { display: block; width: 100%; min-height: ${stageHeight}px; border: 0; background: #fff; }
    .compare-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; min-width: max-content; }
    .html-compare-grid { width: calc(${stageWidth}px * 2 + 24px); }
    .compare-pane { display: grid; gap: 10px; align-content: start; }
    .compare-pane > span { color: #4c535c; font-size: 12px; font-weight: 700; }
    ${preview.mode === 'structure' ? `.html-structure-panel { min-height: ${stageHeight}px; padding: 28px; background: #fff; }
    .html-structure-panel h2 { margin: 0 0 18px; font-size: 20px; }
    .html-structure-panel ol { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .html-structure-panel li { display: grid; grid-template-columns: 42px 120px minmax(0, 1fr); gap: 12px; align-items: center; border: 1px solid #e8eaec; border-radius: 8px; padding: 10px 12px; }
    .html-structure-panel span { color: #9da3ac; font-weight: 700; }
    .html-structure-panel strong { color: #222529; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .html-structure-panel em { min-width: 0; color: #4c535c; font-style: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .html-structure-empty { display: grid; place-items: center; min-height: ${stageHeight}px; padding: 28px; text-align: center; color: #7f8792; }
    .html-structure-empty strong { display: block; margin-bottom: 8px; color: #222529; font-size: 18px; }` : ''}
  </style>
</head>
<body data-preview-mode="${escapeHtml(preview.mode)}" data-preview-device="${escapeHtml(preview.device)}" data-preview-zoom="${escapeHtml(preview.zoom)}">
  <main>${singleStage}</main>
</body>
</html>`
  }
  if (pageData) {
    const viewport = pageData.viewport || { width: 1440, height: 900 }
    const stageWidth = stageWidthFor(viewport, preview.device)
    const stageHeight = Number(viewport.height) || 900
    const singleStage = renderStage({ pageData, page, ...preview })
    const compareMarkup = preview.mode === 'compare'
      ? `<div class="compare-grid">
          <div class="compare-pane screenshot-pane"><span>截图</span>${renderStage({ pageData, page, mode: 'screenshot', device: preview.device, zoom: preview.zoom })}</div>
          <div class="compare-pane structure-pane"><span>结构</span>${renderStage({ pageData, page, mode: 'structure', device: preview.device, zoom: preview.zoom })}</div>
        </div>`
      : singleStage
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(pageData.title || page.title || '还原页面预览')}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f6f7f9; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
    main { width: 100%; min-height: 100vh; overflow: auto; padding: 24px; }
    .stage { position: relative; width: ${stageWidth}px; min-height: ${stageHeight}px; margin: 0 auto; background: ${pageData.pageBackground || '#fff'}; overflow: hidden; box-shadow: 0 18px 42px rgba(17,24,39,.08); }
    .capture-cover-layer { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; object-fit: contain; object-position: top center; background: #fff; }
    .tree-node { box-sizing: border-box; }
    .tree-image { display: block; }
    .stage > :not(.capture-cover-layer) { position: relative; z-index: 1; }
    .stage > [style*="position:absolute"], .stage > [style*="position: absolute"] { position: absolute !important; }
    .capture-empty-state { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(560px, calc(100% - 48px)); border: 1px solid #e8eaec; border-radius: 8px; background: #fff; padding: 24px; box-shadow: 0 18px 42px rgba(17,24,39,.08); color: #222529; }
    .capture-empty-state strong { display: block; margin-bottom: 10px; font-size: 20px; }
    .capture-empty-state p { margin: 0; color: #7f8792; line-height: 1.7; }
    .compare-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; min-width: max-content; }
    .compare-pane { display: grid; gap: 10px; align-content: start; }
    .compare-pane > span { color: #4c535c; font-size: 12px; font-weight: 700; }
  </style>
</head>
<body data-preview-mode="${escapeHtml(preview.mode)}" data-preview-device="${escapeHtml(preview.device)}" data-preview-zoom="${escapeHtml(preview.zoom)}">
  <main>${compareMarkup}</main>
</body>
</html>`
  }
  if (page.coverImage) {
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(page.title || '还原页面预览')}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f6f7f9; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; color: #222529; }
    main { min-height: 100vh; padding: 32px; display: grid; place-items: center; }
    figure { width: min(1180px, 100%); margin: 0; border: 1px solid #e8eaec; border-radius: 10px; background: #fff; box-shadow: 0 18px 52px rgba(17,24,39,.08); overflow: hidden; }
    img { display: block; width: 100%; height: auto; background: #fff; }
    figcaption { display: flex; justify-content: space-between; gap: 16px; padding: 14px 16px; color: #7f8792; font-size: 13px; border-top: 1px solid #eef0f2; }
    strong { color: #222529; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <figure>
      <img src="${escapeHtml(page.coverImage)}" alt="${escapeHtml(page.title || '采集截图')}" />
      <figcaption><strong>${escapeHtml(page.title || '采集截图')}</strong><span>源码没有可渲染节点，已展示采集截图兜底。</span></figcaption>
    </figure>
  </main>
</body>
</html>`
  }
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>无法打开页面预览</title></head>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:PingFang SC,Microsoft YaHei,Arial,sans-serif;color:#222529;background:#fff;">
  <main style="max-width:520px;padding:24px;border:1px solid #e8eaec;border-radius:8px;">
    <h1 style="margin:0 0 10px;font-size:22px;">无法打开页面预览</h1>
    <p style="margin:0;color:#7f8792;line-height:1.7;">当前还原页面没有保存 HTML，也没有可解析的 pageData 文件。请重新生成 1:1 还原页面。</p>
  </main>
</body>
</html>`
}

export function createRestoredPageAsset({ projectId = '', captureResult = {}, html = '', files = [], visualVerification = null } = {}) {
  const page = captureResult.pages?.[0] || {}
  const createdAt = captureResult.raw?.capturedAt || new Date().toISOString()
  const title = captureResult.title || page.title || captureResult.url || '未命名还原页面'
  const normalizedFiles = Array.isArray(files) && files.length
    ? files
    : [{ path: 'index.html', content: html || restoredPagePreviewHtml({ title, html, coverImage: page.screenshot || captureResult.screenshot || '' }) }]
  const htmlFile = normalizedFiles.find((file) => file.path === 'index.html' && file.content)?.content || ''
  const rawHtml = html || htmlFile || ''
  const codeFormat = normalizedFiles.some((file) => /^src\/App\.vue$/.test(file.path || '')) ? 'vue' : 'html'
  const tags = [
    '图片转代码',
    rawHtml ? 'html' : '',
    codeFormat === 'vue' ? 'vue' : ''
  ].filter(Boolean)
  return {
    id: crypto.randomUUID(),
    projectId,
    title,
    restoreKind: captureResult.raw?.captureKind || 'image-to-code',
    tags,
    codeFormat,
    sourceUrl: captureResult.url || page.url || '',
    coverImage: page.screenshot || captureResult.screenshot || '',
    createdAt,
    html: rawHtml,
    files: normalizedFiles,
    captureResult,
    visualVerification,
    summary: {
      pages: captureResult.pages?.length || 0,
      components: captureResult.components?.length || 0,
      assets: captureResult.assets?.length || 0,
      layoutNodes: captureResult.layoutNodes?.length || captureResult.raw?.layoutNodeCount || 0
    }
  }
}

export function captureActionState(status = 'idle') {
  const loading = status === 'loading'
  return {
    loading,
    disabled: loading,
    captureLabel: loading ? '快照生成中' : '生成网页快照'
  }
}

const CAPTURE_LOADING_STEPS = [
  { id: 'dom', title: '读取页面 DOM', detail: '梳理页面结构、层级和可见文本' },
  { id: 'screenshot', title: '采集截图资产', detail: '截取页面画面，记录首屏和关键素材' },
  { id: 'components', title: '识别组件样本', detail: '提取按钮、卡片、导航和表单结构' },
  { id: 'interactions', title: '整理交互节点', detail: '记录可点击区域、跳转入口和状态线索' },
  { id: 'waiting', title: '等待快照返回', detail: '目标页面资源较多，系统仍在等待后台返回' }
]

const CAPTURE_LOADING_COPY = [
  '正在把页面拆成结构、样式和素材三份小抄。',
  '先抓骨架，再看皮肤，最后确认哪里可以点。',
  '正在读取 DOM 线索，尽量不漏掉藏在角落里的按钮。',
  '截图和结构正在对齐，后面还原页面会用到它们。',
  '页面资源有点多，正在耐心等后台把包递回来。'
]

function formatElapsed(seconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  if (safeSeconds < 60) return `已用 ${safeSeconds} 秒`
  const minutes = Math.floor(safeSeconds / 60)
  const rest = safeSeconds % 60
  return rest ? `已用 ${minutes} 分 ${rest} 秒` : `已用 ${minutes} 分钟`
}

function formatEstimate(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  if (!safeSeconds) return ''
  if (safeSeconds <= 60) return `预计 ${safeSeconds} 秒`
  const minutes = Math.floor(safeSeconds / 60)
  const rest = safeSeconds % 60
  return rest ? `预计 ${minutes} 分 ${rest} 秒` : `预计 ${minutes} 分钟`
}

export function captureLoadingExperience(elapsedSeconds = 0, timing = {}) {
  const elapsed = Math.max(0, Math.floor(Number(elapsedSeconds) || 0))
  const normalizedTiming = timing && typeof timing === 'object' ? timing : {}
  const stepIndex = elapsed >= 90
    ? CAPTURE_LOADING_STEPS.length - 1
    : Math.min(Math.floor(elapsed / 18), CAPTURE_LOADING_STEPS.length - 2)
  const copyIndex = Math.floor(elapsed / 6) % CAPTURE_LOADING_COPY.length
  const typedCopy = CAPTURE_LOADING_COPY[copyIndex]
  const backendEstimate = formatEstimate(normalizedTiming.estimatedSeconds)
  return {
    steps: CAPTURE_LOADING_STEPS,
    currentStep: CAPTURE_LOADING_STEPS[stepIndex],
    typedCopy,
    estimatedLabel: elapsed >= 90 ? '页面资源较多，仍在等待返回' : backendEstimate || '预计 45-90 秒',
    elapsedLabel: formatElapsed(elapsed)
  }
}
