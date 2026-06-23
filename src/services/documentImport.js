import JSZip from 'jszip'

export function decodeXmlEntities(text) {
  return String(text || '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}

export function normalizeExtractedText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 12000)
}

export async function extractDocxText(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const documentXml = await zip.file('word/document.xml')?.async('string')
  if (!documentXml) return ''
  const text = documentXml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
  return normalizeExtractedText(decodeXmlEntities(text))
}

export async function extractXlsxText(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string')
  const sharedStrings = sharedStringsXml
    ? Array.from(sharedStringsXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((match) => decodeXmlEntities(match[1]))
    : []
  const sheetFiles = Object.keys(zip.files).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
  const rows = []
  for (const path of sheetFiles.slice(0, 8)) {
    const xml = await zip.file(path)?.async('string')
    if (!xml) continue
    const cells = Array.from(xml.matchAll(/<c[^>]*(?:t="s")?[^>]*>[\s\S]*?<v>([\s\S]*?)<\/v>[\s\S]*?<\/c>/g))
      .map((match) => sharedStrings[Number(match[1])] || match[1])
      .filter(Boolean)
    if (cells.length) rows.push(cells.join(' / '))
  }
  return normalizeExtractedText(rows.join('\n'))
}

export async function extractDocumentText(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'txt' || extension === 'md') {
    return normalizeExtractedText(await file.text())
  }
  if (extension === 'docx') {
    return extractDocxText(await file.arrayBuffer())
  }
  if (extension === 'xlsx') {
    return extractXlsxText(await file.arrayBuffer())
  }
  if (extension === 'pdf') {
    return `PDF 文件已上传：${file.name}\n当前前端已保存文件信息；如需提取正文，需要接入 PDF 解析服务。`
  }
  if (typeof file.text === 'function') {
    return normalizeExtractedText(await file.text())
  }
  throw new Error(`不支持的文件类型：${extension || '未知'}`)
}

export async function importLocalDocuments(files = [], { projectId = '', type = 'knowledge' } = {}) {
  const results = []
  for (const file of files) {
    try {
      const content = await extractDocumentText(file)
      results.push({
        ok: true,
        item: {
          id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          projectId,
          title: file.name,
          meta: `${type === 'requirements' ? '需求文档' : type === 'competitors' ? '竞品资料' : '知识库'} · 本地导入`,
          status: type === 'requirements' ? '待设计' : content ? '已导入' : '待解析',
          notes: `文件类型：${file.type || file.name.split('.').pop()?.toUpperCase() || 'FILE'}`,
          content,
          requirementSource: type === 'requirements' ? 'product' : undefined,
          knowledgeStatus: type === 'requirements' ? 'pending' : undefined,
          uploadedAt: new Date().toISOString()
        }
      })
    } catch (error) {
      results.push({
        ok: false,
        name: file.name,
        error: error.message || '未知错误'
      })
    }
  }
  return results
}
