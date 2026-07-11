function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function inlineMarkdownToHtml(value = '') {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function markdownTableToHtml(lines = []) {
  const tableRows = lines
    .map((line) => String(line || '').trim())
    .filter((line) => /^\|.*\|$/.test(line))
    .map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))
  if (!tableRows.length) return ''
  const [headers, divider, ...bodyRows] = tableRows
  const hasDivider = Array.isArray(divider) && divider.every((cell) => /^:?-{3,}:?$/.test(cell))
  const rows = hasDivider ? bodyRows : tableRows.slice(1)
  return [
    '<table>',
    headers?.length
      ? `<thead><tr>${headers.map((cell) => `<th>${inlineMarkdownToHtml(cell)}</th>`).join('')}</tr></thead>`
      : '',
    rows.length
      ? `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdownToHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`
      : '',
    '</table>'
  ].join('')
}

export function markdownToDocumentHtml(markdown = '', options = {}) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
  const html = []
  let index = 0
  while (index < lines.length) {
    const trimmed = String(lines[index] || '').trim()
    if (!trimmed) {
      index += 1
      continue
    }
    if (/^```/.test(trimmed)) {
      const codeLines = []
      index += 1
      while (index < lines.length && !/^```/.test(String(lines[index] || '').trim())) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      html.push(`<pre>${escapeHtml(codeLines.join('\n'))}</pre>`)
      continue
    }
    if (/^\|.*\|$/.test(trimmed)) {
      const tableLines = []
      while (index < lines.length && /^\|.*\|$/.test(String(lines[index] || '').trim())) {
        tableLines.push(lines[index])
        index += 1
      }
      html.push(markdownTableToHtml(tableLines))
      continue
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = Math.min(6, heading[1].length)
      html.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`)
      index += 1
      continue
    }
    if (/^[-*]\s+/.test(trimmed)) {
      const items = []
      while (index < lines.length && /^[-*]\s+/.test(String(lines[index] || '').trim())) {
        items.push(String(lines[index] || '').trim().replace(/^[-*]\s+/, ''))
        index += 1
      }
      html.push(`<ul>${items.map((item) => `<li>${inlineMarkdownToHtml(item)}</li>`).join('')}</ul>`)
      continue
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = []
      while (index < lines.length && /^\d+\.\s+/.test(String(lines[index] || '').trim())) {
        items.push(String(lines[index] || '').trim().replace(/^\d+\.\s+/, ''))
        index += 1
      }
      html.push(`<ol>${items.map((item) => `<li>${inlineMarkdownToHtml(item)}</li>`).join('')}</ol>`)
      continue
    }
    html.push(`<p>${inlineMarkdownToHtml(trimmed)}</p>`)
    index += 1
  }

  const title = options.title || options.fileName || 'Markdown 文档'
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #20242a; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif; font-size: 13px; line-height: 1.72; }
    main { max-width: 860px; margin: 0 auto; }
    h1, h2, h3, h4, h5, h6 { color: #111827; line-height: 1.32; page-break-after: avoid; }
    h1 { font-size: 24px; margin: 0 0 18px; }
    h2 { font-size: 20px; margin: 26px 0 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    h3 { font-size: 16px; margin: 20px 0 8px; }
    h4, h5, h6 { font-size: 14px; margin: 16px 0 6px; }
    p { margin: 0 0 10px; }
    ul, ol { margin: 0 0 12px 22px; padding: 0; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 16px; page-break-inside: avoid; }
    th, td { border: 1px solid #d8dee8; padding: 7px 9px; vertical-align: top; text-align: left; }
    th { background: #f5f7fb; font-weight: 700; }
    pre { white-space: pre-wrap; word-break: break-word; border: 1px solid #d8dee8; background: #f8fafc; border-radius: 6px; padding: 10px 12px; page-break-inside: avoid; }
    code { font-family: "SFMono-Regular", Consolas, monospace; background: #f3f4f6; padding: 1px 4px; border-radius: 4px; }
    .print-meta { color: #6b7280; margin: -8px 0 18px; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p class="print-meta">${escapeHtml(options.fileName || '')}</p>
    ${html.join('\n')}
  </main>
</body>
</html>`
}

export async function renderMarkdownPdf(payload = {}, options = {}) {
  const markdown = String(payload.markdown || '').trim()
  if (!markdown) {
    const error = new Error('Markdown 正文为空，无法生成 PDF')
    error.code = 'EMPTY_MARKDOWN'
    throw error
  }
  const chromium = options.chromium
  if (!chromium?.launch) {
    const error = new Error('当前后端未配置 PDF 渲染器')
    error.code = 'PDF_RENDERER_UNAVAILABLE'
    throw error
  }
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      ...(options.executablePath ? { executablePath: options.executablePath } : {})
    })
    const page = await browser.newPage()
    await page.setContent(markdownToDocumentHtml(markdown, {
      title: payload.title || payload.fileName || 'Markdown 文档',
      fileName: payload.fileName || ''
    }), { waitUntil: 'networkidle', timeout: 15000 })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    })
  } finally {
    await browser?.close()
  }
}
