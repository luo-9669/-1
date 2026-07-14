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

function extensionFromName(name = '') {
  return String(name || '').split('.').pop()?.toLowerCase() || ''
}

function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function buildDocumentPreview(file, arrayBuffer = null) {
  const extension = extensionFromName(file.name)
  if (!['doc', 'docx', 'pdf'].includes(extension)) return null
  const buffer = arrayBuffer || await file.arrayBuffer()
  const mimeType = file.type || (extension === 'doc'
    ? 'application/msword'
    : extension === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf')
  return {
    format: extension,
    fileName: file.name,
    mimeType,
    dataUrl: `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`
  }
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
  const extension = extensionFromName(file.name)
  if (extension === 'txt' || extension === 'md' || extension === 'markdown') {
    return normalizeExtractedText(await file.text())
  }
  if (extension === 'docx') {
    return extractDocxText(await file.arrayBuffer())
  }
  if (extension === 'xlsx') {
    return extractXlsxText(await file.arrayBuffer())
  }
  if (extension === 'doc' || extension === 'pdf') {
    return ''
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
      const extension = extensionFromName(file.name)
      const binaryBuffer = ['doc', 'docx', 'pdf'].includes(extension) ? await file.arrayBuffer() : null
      let content = ''
      try {
        content = extension === 'docx'
          ? await extractDocxText(binaryBuffer)
          : await extractDocumentText(file)
      } catch (error) {
        if (extension !== 'doc' && extension !== 'docx' && extension !== 'pdf') throw error
      }
      const preview = await buildDocumentPreview(file, binaryBuffer)
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
          preview,
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
