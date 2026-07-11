import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PYTHON_APP_DIR = path.join(__dirname, 'competitor-analysis-engine', 'python', '竞品监控系统')
const REPORT_STORAGE_DIR = path.join(__dirname, '..', 'storage', 'competitor-analysis')
const SAFE_FAILURE_MESSAGE = '竞品分析暂时无法完成，请检查 Python 依赖或稍后重试。'
const MODEL_FALLBACK_FAILURE_MESSAGE = '当前后端模型暂时无法生成竞品分析，请检查模型配置后重试。'

function normalizeKind(value = '') {
  return ['daily', 'weekly', 'flow', 'framework'].includes(value) ? value : 'daily'
}

function kindLabel(kind = '') {
  if (kind === 'weekly') return '周报生成'
  if (kind === 'flow') return '交互流程'
  if (kind === 'framework') return '完整框架'
  return '每日生成'
}

function safeSegment(value = '', fallback = 'default') {
  const segment = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return segment || fallback
}

function safeText(value = '', fallback = '') {
  const text = String(value || '').trim()
  const unsafe = /raw|debug|worker|payload|stack|token|sourceUrl|html|textContent|api[_-]?key|traceback/i
  return text && !unsafe.test(text) ? text : fallback
}

function isUnsafeReportLine(line = '') {
  return /^\s*(raw|debug|worker|payload|stack|token|sourceUrl|textContent|api[_-]?key|traceback)\s*[:=]/i.test(line)
}

function isUnsafeFenceStart(line = '') {
  return /^\s*```\s*(html|json|javascript|js|python|py|traceback|debug|raw)\b/i.test(line)
}

export function sanitizeCompetitorAnalysisMarkdown(value = '', fallback = '') {
  const text = String(value || '').trim()
  if (!text) return fallback
  const lines = text.split(/\r?\n/)
  const kept = []
  let skipFence = false
  for (const line of lines) {
    if (skipFence) {
      if (/^\s*```/.test(line)) skipFence = false
      continue
    }
    if (isUnsafeFenceStart(line)) {
      skipFence = true
      continue
    }
    if (isUnsafeReportLine(line)) continue
    kept.push(line)
  }
  const sanitized = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return sanitized || fallback
}

function buildArgs(input = {}, outputDir = '') {
  const kind = normalizeKind(input.kind)
  const args = ['main.py', kind, '--output', outputDir]
  if (kind === 'flow') {
    args.push('--competitor', String(input.competitor || input.competitorName || '').trim() || '未命名竞品')
    args.push('--feature', String(input.feature || '').trim() || '未指定功能')
  }
  if (kind === 'framework') {
    args.push('--url', String(input.productUrl || '').trim())
    if (String(input.productName || '').trim()) args.push('--name', String(input.productName).trim())
  }
  return args
}

function runPython(args = [], env = {}) {
  return new Promise((resolve) => {
    const child = spawn('python3', args, {
      cwd: PYTHON_APP_DIR,
      env: {
        ...process.env,
        ...env,
        PYTHONUNBUFFERED: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
    child.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: error.message })
    })
  })
}

async function collectFiles(dir = '', ext = '') {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => [])
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
    .map((entry) => path.join(entry.parentPath || dir, entry.name))
}

async function latestFileText(outputDir = '', ext = '') {
  const files = await collectFiles(outputDir, ext)
  let latest = null
  for (const file of files) {
    const stat = await import('node:fs/promises').then((fs) => fs.stat(file)).catch(() => null)
    if (!stat) continue
    if (!latest || stat.mtimeMs > latest.mtimeMs) latest = { file, mtimeMs: stat.mtimeMs }
  }
  return latest ? readFile(latest.file, 'utf8') : ''
}

function latestReportPath(projectId = '') {
  return path.join(REPORT_STORAGE_DIR, `${safeSegment(projectId)}.json`)
}

function recordsPath(projectId = '') {
  return path.join(REPORT_STORAGE_DIR, `${safeSegment(projectId)}.records.json`)
}

function normalizeNameList(value = []) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  }
  const text = String(value || '').trim()
  return text ? [text] : []
}

function normalizeIdList(value = []) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function normalizeTextList(value = []) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function uniqueTextList(value = []) {
  return [...new Set(normalizeNameList(value))]
}

function uniquePlainTextList(value = []) {
  return [...new Set(normalizeTextList(value))]
}

function normalizePlainObject(value = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function dateString(value = '') {
  const text = String(value || '').trim()
  const direct = text.match(/\d{4}-\d{2}-\d{2}/)?.[0] || ''
  if (direct) return direct
  const date = value instanceof Date ? value : new Date(text)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function todayString(currentDateProvider = () => new Date()) {
  return dateString(currentDateProvider())
}

function entryPublishedToday(entry = {}, today = '') {
  const item = normalizePlainObject(entry)
  const published = dateString(item.published_date || item.publishedDate || item.date || item.discovered_at || item.discoveredAt)
  return Boolean(today && published && published === today)
}

function dateInRange(value = '', start = '', end = '') {
  const date = dateString(value)
  return Boolean(date && start && end && date >= start && date <= end)
}

function weeklyPeriod(data = {}, currentDateProvider = () => new Date()) {
  const end = dateString(data.period_end || data.periodEnd || data.report_date || data.reportDate || currentDateProvider())
  const explicitStart = dateString(data.period_start || data.periodStart)
  if (explicitStart) return { start: explicitStart, end }
  const endDate = new Date(`${end}T00:00:00.000Z`)
  if (Number.isNaN(endDate.getTime())) return { start: '', end }
  endDate.setUTCDate(endDate.getUTCDate() - 7)
  return { start: endDate.toISOString().slice(0, 10), end }
}

function parseJsonSafe(value = '') {
  const text = String(value || '').trim()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeModelSettings(value = {}) {
  const settings = normalizePlainObject(value)
  return {
    provider: String(settings.provider || '').trim(),
    apiKey: String(settings.apiKey || '').trim(),
    baseUrl: String(settings.baseUrl || '').trim(),
    defaultModel: String(settings.defaultModel || '').trim(),
    apiSurface: String(settings.apiSurface || '').trim(),
    timeoutMs: Number(settings.timeoutMs || 0),
    enabled: Boolean(settings.enabled)
  }
}

function resolvePythonModelEnv(input = {}, settings = {}) {
  const modelSettings = normalizeModelSettings(settings)
  const canUseOpenAICompatible = modelSettings.enabled && modelSettings.provider === 'openai-compatible'
  return {
    LLM_PROVIDER: input.llmProvider || (canUseOpenAICompatible ? 'openai' : process.env.LLM_PROVIDER || 'openai'),
    LLM_API_KEY: input.llmApiKey || (canUseOpenAICompatible ? modelSettings.apiKey : '') || process.env.LLM_API_KEY || '',
    OPENAI_BASE_URL: input.openaiBaseUrl || (canUseOpenAICompatible ? modelSettings.baseUrl : '') || process.env.OPENAI_BASE_URL || '',
    LLM_MODEL: input.llmName || (canUseOpenAICompatible ? modelSettings.defaultModel : '') || process.env.LLM_MODEL || ''
  }
}

function normalizeArtifactList(value = []) {
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

function decodeArtifactXmlValue(value = '') {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function labelsFromDiagramXml(value = '') {
  const text = String(value || '')
  return [...text.matchAll(/value="([^"]+)"/g)]
    .map((match) => decodeArtifactXmlValue(match[1]).trim())
    .filter(Boolean)
    .slice(0, 8)
}

function buildDiagramPreviewDataUrl(title = '', nodes = []) {
  const safeTitle = escapeArtifactXml(title || '流程图')
  const labels = (Array.isArray(nodes) ? nodes : []).map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
  const width = Math.max(760, labels.length * 168 + 80)
  const nodeMarkup = labels.map((label, index) => {
    const x = 40 + index * 168
    const safeLabel = escapeArtifactXml(label).slice(0, 28)
    const edge = index === 0 ? '' : `<path d="M${x - 36} 126 H${x - 8}" stroke="#667085" stroke-width="2" fill="none"/><path d="M${x - 8} 126 l-8 -5 v10 z" fill="#667085"/>`
    return `${edge}<rect x="${x}" y="92" width="132" height="68" rx="12" fill="#ffffff" stroke="#d0d5dd"/><text x="${x + 66}" y="132" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#1f2329">${safeLabel}</text>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="220" viewBox="0 0 ${width} 220"><rect width="${width}" height="220" fill="#f8fafc"/><text x="40" y="44" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#1f2329">${safeTitle}</text>${nodeMarkup}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function normalizeDiagramArtifact(value = '', fallbackTitle = '流程图') {
  if (!value) return ''
  if (typeof value === 'object') {
    const item = normalizePlainObject(value)
    const body = item.content || item.xml || item.code || ''
    const nodes = Array.isArray(item.nodes) ? item.nodes : labelsFromDiagramXml(body)
    return {
      title: safeText(item.title || item.name || fallbackTitle, fallbackTitle),
      fileName: item.fileName || diagramArtifactFileName(fallbackTitle),
      format: item.format || 'drawio',
      content: body,
      previewUrl: item.previewUrl || item.url || buildDiagramPreviewDataUrl(item.title || fallbackTitle, nodes),
      nodes
    }
  }
  const body = String(value || '')
  const nodes = labelsFromDiagramXml(body)
  return {
    title: fallbackTitle,
    fileName: diagramArtifactFileName(fallbackTitle),
    format: 'drawio',
    content: body,
    previewUrl: buildDiagramPreviewDataUrl(fallbackTitle, nodes),
    nodes
  }
}

function diagramArtifactFileName(title = '') {
  const text = String(title || '')
  if (text.includes('主')) return 'main-flow.drawio'
  if (text.includes('状态')) return 'state-diagram.drawio'
  return `${safeSegment(text, 'diagram')}.drawio`
}

function isFallbackFlowMarkdown(value = '') {
  return /LLM\s*不可用|搜索结果原始信息/.test(String(value || ''))
}

function normalizeInteractionArtifacts(record = {}) {
  const artifacts = normalizePlainObject(record.interactionArtifacts)
  const pageInteractionDocument = normalizePlainObject(record.pageInteractionDocument || artifacts.pageInteractionDocument)
  const documentMarkdown = safeText(artifacts.documentMarkdown || pageInteractionDocument.markdown || record.flowMarkdown, '')
  if (isFallbackFlowMarkdown(record.markdown || documentMarkdown)) {
    return {
      documentMarkdown,
      mainFlowFile: '',
      stateDiagramFile: '',
      lowFiWireframeImages: [],
      stateMatrix: [],
      transitions: [],
      evidenceStatus: safeText(artifacts.evidenceStatus || artifacts.evidence_status || 'not_found', 'not_found'),
      evidenceReason: safeText(artifacts.evidenceReason || artifacts.evidence_reason || '未生成阶段二规范产物。', '未生成阶段二规范产物。'),
      similarFeatures: normalizeArtifactList(artifacts.similarFeatures || artifacts.similar_features)
    }
  }
  return {
    documentMarkdown,
    mainFlowFile: normalizeDiagramArtifact(artifacts.mainFlowFile || artifacts.mainFlowDrawio || artifacts.mainFlowDiagram || pageInteractionDocument.mainFlowFile || pageInteractionDocument.mainFlowDrawio || '', '主流程图'),
    stateDiagramFile: normalizeDiagramArtifact(artifacts.stateDiagramFile || artifacts.stateDiagramDrawio || artifacts.stateDiagram || pageInteractionDocument.stateDiagramFile || pageInteractionDocument.stateDiagramDrawio || '', '状态图'),
    lowFiWireframeImages: normalizeArtifactList(artifacts.lowFiWireframeImages || artifacts.wireframeImages || pageInteractionDocument.lowFiWireframeImages),
    stateMatrix: normalizeArtifactList(artifacts.stateMatrix || pageInteractionDocument.stateMatrix),
    transitions: normalizeArtifactList(artifacts.transitions || artifacts.stateTransitions || pageInteractionDocument.transitions),
    evidenceStatus: safeText(artifacts.evidenceStatus || artifacts.evidence_status || '', ''),
    evidenceReason: safeText(artifacts.evidenceReason || artifacts.evidence_reason || '', ''),
    similarFeatures: normalizeArtifactList(artifacts.similarFeatures || artifacts.similar_features)
  }
}

function normalizeFeatureEvent(event = {}, fallback = {}) {
  const item = normalizePlainObject(event)
  const competitorName = safeText(item.competitorName || item.competitor || fallback.competitorName, '')
  const featureName = safeText(item.featureName || item.feature || item.name || item.summary || '', '')
  if (!competitorName || !featureName) return null
  const discoveredAt = safeText(item.discoveredAt || item.discovered_at || item.scanDate || item.scan_date || fallback.discoveredAt, '')
  const sourceUrls = uniquePlainTextList(item.sourceUrls || item.source_urls || item.urls || fallback.sourceUrls)
  const sourceEntries = normalizeEvidenceEntries(item.sourceEntries || item.source_entries || item.entries || fallback.sourceEntries)
  return {
    id: safeText(item.id, safeSegment(`${competitorName}-${featureName}-${discoveredAt || 'event'}`, `feature-event-${randomUUID()}`)),
    competitorName,
    featureName,
    discoveredAt,
    sourceUrls,
    sourceEntries,
    evidenceStatus: safeText(item.evidenceStatus || item.evidence_status || fallback.evidenceStatus, 'reported'),
    rawEvidence: safeText(item.rawEvidence || item.raw_evidence || item.summary || item.details || fallback.rawEvidence, '')
  }
}

function normalizeEvidenceEntries(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => {
      const item = normalizePlainObject(entry)
      const title = safeText(item.title || item.name, '')
      const url = safeText(item.url || item.href, '')
      const snippet = safeText(item.snippet || item.summary || item.description, '')
      const publishedDate = safeText(item.publishedDate || item.published_date || item.date, '')
      if (!title && !url && !snippet) return null
      return {
        title,
        url,
        snippet,
        publishedDate,
        source: safeText(item.source, '')
      }
    })
    .filter(Boolean)
    .slice(0, 12)
}

function normalizeFeatureEvents(value = [], fallback = {}) {
  const events = []
  const seen = new Set()
  for (const event of Array.isArray(value) ? value : []) {
    const normalized = normalizeFeatureEvent(event, fallback)
    if (!normalized) continue
    const key = `${normalized.competitorName}::${normalized.featureName}::${normalized.sourceUrls.join('|')}`
    if (seen.has(key)) continue
    seen.add(key)
    events.push(normalized)
  }
  return events
}

function normalizeMonitorEvidence(value = {}) {
  const item = normalizePlainObject(value)
  return {
    recordId: safeText(item.recordId || item.id, ''),
    kind: normalizeKind(item.kind),
    title: safeText(item.title, ''),
    markdown: sanitizeCompetitorAnalysisMarkdown(item.markdown || '', ''),
    summary: safeText(item.summary, '')
  }
}

function analysisRecordTitle(input = {}) {
  const names = normalizeNameList(input.competitorNames || input.competitor || input.productName)
  const subject = names.length ? names.join('、') : '未命名竞品'
  return `${kindLabel(normalizeKind(input.kind))}：${subject}`
}

function normalizeRecord(record = {}) {
  const kind = normalizeKind(record.kind)
  const createdAt = record.createdAt || new Date().toISOString()
  const updatedAt = record.updatedAt || createdAt
  return {
    id: String(record.id || `competitor-analysis-${randomUUID()}`),
    projectId: String(record.projectId || 'default'),
    kind,
    title: safeText(record.title, analysisRecordTitle(record)),
    status: ['pending', 'running', 'succeeded', 'failed'].includes(record.status) ? record.status : 'pending',
    statusLabel: safeText(record.statusLabel, '待分析'),
    competitorIds: normalizeIdList(record.competitorIds),
    competitorNames: normalizeNameList(record.competitorNames || record.competitor || record.productName),
    competitorName: safeText(record.competitorName || record.competitor, ''),
    productUrl: safeText(record.productUrl, ''),
    productUrls: normalizeTextList(record.productUrls),
    productName: safeText(record.productName, ''),
    feature: safeText(record.feature, ''),
    goal: safeText(record.goal, ''),
    summary: safeText(record.summary, ''),
    markdown: sanitizeCompetitorAnalysisMarkdown(record.markdown || '', ''),
    interactionArtifacts: normalizeInteractionArtifacts(record),
    featureEvents: normalizeFeatureEvents(record.featureEvents || record.feature_events),
    sourceFeatureEvent: normalizeFeatureEvent(record.sourceFeatureEvent || record.source_feature_event) || null,
    monitorEvidence: normalizeMonitorEvidence(record.monitorEvidence || record.monitor_evidence),
    durationMs: Number.isFinite(Number(record.durationMs)) ? Number(record.durationMs) : 0,
    createdAt,
    updatedAt
  }
}

async function readRecords(projectId = '') {
  try {
    const saved = JSON.parse(await readFile(recordsPath(projectId || 'default'), 'utf8'))
    return Array.isArray(saved.records) ? saved.records.map(normalizeRecord) : []
  } catch {
    return []
  }
}

async function writeRecords(projectId = '', records = []) {
  await mkdir(REPORT_STORAGE_DIR, { recursive: true })
  await writeFile(recordsPath(projectId || 'default'), JSON.stringify({
    records: records.map(normalizeRecord),
    savedAt: new Date().toISOString()
  }, null, 2))
}

async function upsertRecord(projectId = '', record = {}) {
  const records = await readRecords(projectId || record.projectId || 'default')
  const normalized = normalizeRecord({
    ...record,
    projectId: projectId || record.projectId || 'default',
    updatedAt: new Date().toISOString()
  })
  const index = records.findIndex((item) => item.id === normalized.id)
  if (index >= 0) records[index] = { ...records[index], ...normalized }
  else records.unshift(normalized)
  await writeRecords(normalized.projectId, records)
  return normalized
}

async function patchRecord(projectId = '', recordId = '', patch = {}) {
  if (!recordId) return null
  const records = await readRecords(projectId || 'default')
  const index = records.findIndex((item) => item.id === recordId)
  if (index < 0) return null
  const updated = normalizeRecord({
    ...records[index],
    ...patch,
    id: records[index].id,
    projectId: records[index].projectId,
    updatedAt: new Date().toISOString()
  })
  records[index] = updated
  await writeRecords(updated.projectId, records)
  return updated
}

async function persistLatestReport(projectId = '', data = {}) {
  await mkdir(REPORT_STORAGE_DIR, { recursive: true })
  await writeFile(latestReportPath(projectId), JSON.stringify({
    ...data,
    savedAt: new Date().toISOString()
  }, null, 2))
}

async function latestTempMarkdown() {
  const entries = await readdir(os.tmpdir(), { withFileTypes: true }).catch(() => [])
  let latest = null
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('liuchengtong-competitor-analysis-')) continue
    const dir = path.join(os.tmpdir(), entry.name)
    const files = await collectFiles(dir, '.md')
    for (const file of files) {
      const stat = await import('node:fs/promises').then((fs) => fs.stat(file)).catch(() => null)
      if (!stat) continue
      if (!latest || stat.mtimeMs > latest.mtimeMs) latest = { file, mtimeMs: stat.mtimeMs }
    }
  }
  return latest ? readFile(latest.file, 'utf8') : ''
}

function fallbackMarkdown(input = {}, reason = '') {
  const kind = normalizeKind(input.kind)
  const title = kindLabel(kind)
  const safeReason = safeText(reason, SAFE_FAILURE_MESSAGE)
  return [
    `# ${title}`,
    '',
    '## 当前状态',
    safeReason,
    '',
    '## 建议处理',
    '- 安装 Python 依赖后重新运行。',
    '- 如果需要联网搜索，请确认当前网络可访问目标站点。',
    '- 没有配置大模型时，系统会优先使用规则分析。'
  ].join('\n')
}

function requiredInputFailure(input = {}) {
  const kind = normalizeKind(input.kind)
  if (['daily', 'weekly'].includes(kind) && !selectedCompetitorsForPython(input).length) {
    return '请先选择要分析的竞品，系统不会再使用 Python 内置默认竞品池。'
  }
  if (kind === 'flow') {
    const competitor = String(input.competitor || input.competitorName || '').trim()
    const feature = String(input.feature || '').trim()
    if (!competitor) return '请先选择或填写要分析的竞品名称。'
    if (!feature) return '请填写要分析的功能名称，系统会基于该功能进行 Python 搜寻和证据校验。'
  }
  if (kind === 'framework' && !String(input.productUrl || '').trim()) {
    return '请填写产品官网地址，完整框架必须基于目标站点爬取结果生成。'
  }
  return ''
}

function selectedCompetitorsForPython(input = {}) {
  const directCompetitors = Array.isArray(input.competitors)
    ? input.competitors
      .map((item) => normalizePlainObject(item))
      .map((item) => ({
        name: String(item.name || item.competitorName || item.productName || '').trim(),
        url: String(item.url || item.websiteUrl || item.productUrl || '').trim(),
        description: String(item.description || '').trim()
      }))
      .filter((item) => item.name)
    : []
  if (directCompetitors.length) return directCompetitors

  const names = uniqueTextList(input.competitorNames || input.competitorName || input.competitor || input.productName)
  const urls = Array.isArray(input.productUrls)
    ? input.productUrls.map((item) => String(item || '').trim())
    : []
  const fallbackUrl = String(input.productUrl || input.websiteUrl || '').trim()

  return names.map((name, index) => ({
    name,
    url: urls[index] || fallbackUrl,
    description: String(input.goal || '').trim()
  }))
}

function competitorSearchKeywords(name = '') {
  const text = String(name || '').trim()
  return text
    ? [`${text} 新功能`, `${text} 更新`, `${text} AI`, `${text} changelog`]
    : []
}

async function writeSelectedCompetitorsConfig(input = {}, outputDir = '') {
  const kind = normalizeKind(input.kind)
  if (!['daily', 'weekly', 'flow'].includes(kind)) return ''
  const competitors = selectedCompetitorsForPython(input)
  if (!competitors.length) return ''
  const configPath = path.join(outputDir, 'selected-competitors.json')
  await writeFile(configPath, JSON.stringify({
    competitors: competitors.map((item) => ({
      name: item.name,
      url: item.url,
      tier: 'T1',
      keywords: competitorSearchKeywords(item.name),
      description: item.description || ''
    }))
  }, null, 2))
  return configPath
}

function competitorSubject(input = {}) {
  const names = normalizeNameList(input.competitorNames || input.competitorName || input.competitor || input.productName)
  return names.length ? names.join('、') : '未命名竞品'
}

function buildBackendModelReportPrompt(input = {}, pythonFailure = '') {
  const kind = normalizeKind(input.kind)
  const subject = competitorSubject(input)
  const evidence = input.analysisEvidence || ''
  const evidenceQuality = input.evidenceQuality || input.evidence_quality || 'none'
  const evidenceCountText = Number.isFinite(Number(input.evidenceCount ?? input.evidence_count))
    ? String(Number(input.evidenceCount ?? input.evidence_count))
    : '0'
  const lines = [
    `分析类型：${kindLabel(kind)}`,
    `竞品名称：${subject}`,
    input.productUrl ? `官网地址：${input.productUrl}` : '',
    input.feature ? `分析功能：${input.feature}` : '',
    input.goal ? `分析目标：${input.goal}` : '',
    `证据质量：${evidenceQuality}`,
    `证据数量：${evidenceCountText}`,
    '',
    '请基于以上信息生成一份中文 Markdown 竞品分析报告。要求：',
    '- 只输出 Markdown 正文，不要输出 JSON。',
    '- 只能基于证据材料做分析；证据里没有的信息必须标记为“待补采”，不能自行补全。',
    '- evidenceQuality=none 时不应生成结论；只能说明未找到证据和待补采动作。',
    '- evidenceQuality=partial 时可以整理已知线索，但标题、结论和流程都必须明确标注“证据不足/待补采/缺失项”。',
    '- evidenceQuality=full 时才允许输出完整分析结论。',
    '- 每个关键结论后写明依据，例如“依据：页面标题/导航/搜索结果/JSON 字段”。',
    '- 结论需要面向产品、交互、运营和研发协作，可直接作为详情页报告展示。',
    '- 内容不允许出现内部调试信息、密钥、堆栈、原始网页源码或执行过程。',
    '- 如果证据不足，请把报告重心放在“已知信息、缺口、补采动作”，不要写确定性结论。',
    '',
    evidence ? `证据材料：\n${evidence}` : '证据材料：\n未采集到足够证据；只能输出待补采清单和分析计划。'
  ]
  if (kind === 'weekly') {
    lines.push('- 周报需要包含本周重点、变化分类、影响判断、建议动作。')
  } else if (kind === 'flow') {
    lines.push('- 交互流程需要包含页面交互框架与说明、主流程、状态流转、低保真线框图描述、状态机明细。')
  } else if (kind === 'framework') {
    lines.push('- 完整框架需要包含产品定位、核心页面、关键任务链路、信息架构、状态与异常、可复用启发。')
  }
  if (pythonFailure) {
    lines.push('', `本地脚本未产出报告原因：${safeText(pythonFailure, '本地脚本暂不可用')}`)
  }
  return lines.filter(Boolean).join('\n')
}

function truncateEvidenceText(value = '', maxLength = 700) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function pushEvidenceLine(lines = [], label = '', value = '') {
  const text = truncateEvidenceText(value)
  if (text) lines.push(`- ${label}: ${text}`)
}

function collectPageEvidence(lines = [], pages = {}) {
  const entries = Array.isArray(pages)
    ? pages.map((page, index) => [page?.url || `page-${index + 1}`, page])
    : Object.entries(normalizePlainObject(pages))
  for (const [url, page] of entries.slice(0, 8)) {
    const item = normalizePlainObject(page)
    pushEvidenceLine(lines, '页面', `${item.title || ''} ${url || item.url || ''}`)
    pushEvidenceLine(lines, '页面正文摘要', item.content || item.summary || item.snippet || '')
    const features = Array.isArray(item.features) ? item.features.map((feature) => feature?.name || feature).filter(Boolean).join('、') : ''
    pushEvidenceLine(lines, '页面功能入口', features)
  }
}

function collectNavigationEvidence(lines = [], navItems = []) {
  const items = Array.isArray(navItems) ? navItems : []
  const labels = []
  const walk = (nodes = [], depth = 0) => {
    for (const node of nodes.slice(0, 12)) {
      const item = normalizePlainObject(node)
      if (item.name) labels.push(`${'  '.repeat(depth)}${item.name}${item.url ? ` (${item.url})` : ''}`)
      if (Array.isArray(item.children) && depth < 2) walk(item.children, depth + 1)
    }
  }
  walk(items)
  pushEvidenceLine(lines, '导航结构', labels.join(' / '))
}

function collectFeatureModuleEvidence(lines = [], features = [], label = '功能模块') {
  const items = Array.isArray(features) ? features : []
  for (const feature of items.slice(0, 12)) {
    const item = normalizePlainObject(feature)
    const name = item.name || item.module_id || ''
    const detail = [
      item.level,
      item.purpose || item.description,
      item.entry_path || item.url,
      Array.isArray(item.related_urls) ? item.related_urls.slice(0, 3).join(', ') : ''
    ].filter(Boolean).join(' | ')
    pushEvidenceLine(lines, label, `${name} ${detail}`)
  }
}

function collectChangeEvidence(lines = [], changes = []) {
  const items = Array.isArray(changes) ? changes : []
  for (const change of items.slice(0, 8)) {
    const item = normalizePlainObject(change)
    pushEvidenceLine(lines, '变化记录', `${item.competitor || ''} ${item.category || ''} ${item.summary || item.details || ''}`)
    if (Array.isArray(item.source_urls)) pushEvidenceLine(lines, '信息来源', item.source_urls.slice(0, 3).join(', '))
  }
}

function collectScanEvidence(lines = [], results = []) {
  const items = Array.isArray(results) ? results : []
  for (const result of items.slice(0, 6)) {
    const item = normalizePlainObject(result)
    pushEvidenceLine(lines, '扫描结果', `${item.competitor || ''} ${item.summary || ''}`)
    const entries = Array.isArray(item.entries) ? item.entries : []
    for (const entry of entries.slice(0, 3)) {
      pushEvidenceLine(lines, '搜索结果', `${entry?.title || ''} ${entry?.url || ''} ${entry?.snippet || ''}`)
    }
  }
}

function sourceUrlsFromEntries(entries = []) {
  return uniquePlainTextList((Array.isArray(entries) ? entries : [])
    .map((entry) => normalizePlainObject(entry).url)
    .filter(Boolean))
}

function normalizeEvidenceQuality(data = {}, kind = '') {
  const item = normalizePlainObject(data)
  const explicit = String(item.evidence_quality || item.evidenceQuality || '').trim().toLowerCase()
  if (['full', 'partial', 'none'].includes(explicit)) return explicit
  const status = String(item.evidence_status || item.evidenceStatus || '').trim().toLowerCase()
  if (status === 'exact') return 'full'
  if (status === 'similar') return 'partial'
  if (['not_found', 'unknown', 'none'].includes(status)) return 'none'
  const count = evidenceCount(data)
  if (!count) return 'none'
  return normalizeKind(kind) === 'framework' ? 'partial' : 'full'
}

function evidenceCount(data = {}) {
  const item = normalizePlainObject(data)
  const explicit = Number(item.evidence_count ?? item.evidenceCount)
  if (Number.isFinite(explicit) && explicit >= 0) return explicit
  if (Array.isArray(item.sources)) return item.sources.length
  if (Array.isArray(item.source_urls)) return item.source_urls.length
  if (Array.isArray(item.sourceUrls)) return item.sourceUrls.length
  if (Array.isArray(item.page_evidence)) return item.page_evidence.length
  if (Array.isArray(item.pageEvidence)) return item.pageEvidence.length
  return 0
}

function evidenceSources(data = {}) {
  const item = normalizePlainObject(data)
  if (Array.isArray(item.sources)) return item.sources.map((source) => normalizePlainObject(source)).filter((source) => source.url || source.title)
  const urls = Array.isArray(item.source_urls)
    ? item.source_urls
    : Array.isArray(item.sourceUrls)
      ? item.sourceUrls
      : []
  return urls.map((url) => ({ title: '', url: String(url || '').trim(), type: 'source' })).filter((source) => source.url)
}

function isFeatureChange(change = {}) {
  const item = normalizePlainObject(change)
  const text = [
    item.category,
    item.summary,
    item.details
  ].filter(Boolean).join(' ')
  return /功能更新|新功能|上线|发布|推出|新增|feature|launch|release/i.test(text)
}

function featureNameFromChange(change = {}) {
  const item = normalizePlainObject(change)
  const direct = safeText(item.featureName || item.feature || item.name, '')
  if (direct) return direct
  const summary = safeText(item.summary || item.details, '')
  if (!summary) return ''
  const patterns = [
    /上线[了\s“"']*([^，。；、\n]+?)(?:功能|能力|模块|$)/,
    /发布[了\s“"']*([^，。；、\n]+?)(?:功能|能力|模块|$)/,
    /推出[了\s“"']*([^，。；、\n]+?)(?:功能|能力|模块|$)/,
    /新增[了\s“"']*([^，。；、\n]+?)(?:功能|能力|模块|$)/
  ]
  for (const pattern of patterns) {
    const match = summary.match(pattern)
    if (match?.[1]) return safeText(match[1].replace(/[“”"']/g, '').trim(), summary)
  }
  return summary
}

function extractFeatureEventsFromAnalysisData(kind = '', data = {}, input = {}, options = {}) {
  const normalizedKind = normalizeKind(kind)
  if (!['daily', 'weekly'].includes(normalizedKind)) return []
  const events = []
  if (normalizedKind === 'daily') {
    const today = todayString(options.currentDateProvider)
    const results = Array.isArray(data.results) ? data.results : []
    for (const result of results) {
      const item = normalizePlainObject(result)
      const competitorName = safeText(item.competitor || item.competitorName, '')
      const scanDate = dateString(item.scan_date || item.scanDate || data.scan_date || '')
      if (today && scanDate && scanDate !== today) continue
      const entries = (Array.isArray(item.entries) ? item.entries : [])
        .map(normalizePlainObject)
        .filter((entry) => entryPublishedToday(entry, today))
      if (!entries.length) continue
      const sourceUrls = sourceUrlsFromEntries(entries)
      const features = normalizeTextList(item.new_features || item.newFeatures)
      for (const featureName of features) {
        events.push({
          competitorName,
          featureName,
          discoveredAt: today || item.scan_date || item.scanDate || data.scan_date || '',
          sourceUrls,
          sourceEntries: entries,
          evidenceStatus: item.has_new_features === false ? 'not_found' : 'today_reported',
          rawEvidence: item.summary || entries.map((entry) => normalizePlainObject(entry).snippet).filter(Boolean).join('；')
        })
      }
    }
  }
  if (normalizedKind === 'weekly') {
    const period = weeklyPeriod(data, options.currentDateProvider)
    const changes = Array.isArray(data.changes) ? data.changes : []
    for (const change of changes) {
      const item = normalizePlainObject(change)
      if (!dateInRange(item.discovered_at || item.discoveredAt || item.published_date || item.publishedDate || item.date, period.start, period.end)) continue
      if (!isFeatureChange(item)) continue
      events.push({
        competitorName: item.competitor || item.competitorName,
        featureName: featureNameFromChange(item),
        discoveredAt: item.discovered_at || item.discoveredAt || data.report_date || data.generated_at || '',
        sourceUrls: item.source_urls || item.sourceUrls,
        evidenceStatus: 'reported',
        rawEvidence: item.summary || item.details || ''
      })
    }
  }
  return normalizeFeatureEvents(events, {
    competitorName: competitorSubject(input),
    discoveredAt: data.report_date || data.scan_date || data.generated_at || ''
  })
}

function weeklyChangesInPeriod(data = {}, currentDateProvider = () => new Date()) {
  const period = weeklyPeriod(data, currentDateProvider)
  return (Array.isArray(data.changes) ? data.changes : [])
    .map(normalizePlainObject)
    .filter((change) => dateInRange(
      change.discovered_at || change.discoveredAt || change.published_date || change.publishedDate || change.date,
      period.start,
      period.end
    ))
}

function buildDailyNoFindingsMarkdown(input = {}, today = '') {
  const competitors = normalizeNameList(input.competitorNames || input.competitor || input.productName)
  const lines = [
    '# 竞品新功能扫描报告',
    '',
    `> 扫描日期：${today || dateString(new Date())}`,
    `> 扫描竞品数：${competitors.length || 0}`,
    '> 发现新功能：0 个竞品',
    '',
    '## ✅ 今日未发现明确的新功能',
    '',
    '未采集到发布日期为当天、且可作为新功能依据的有效信息。',
    '',
    '## 说明',
    '',
    '- 日报只展示当天明确证据；历史页面、无日期搜索结果和第三方泛化介绍不会作为今日新功能展示。',
    '- 如果需要继续确认，可补充官方 changelog、产品公告或截图证据后重新分析。'
  ]
  return lines.join('\n')
}

function buildDailyFeatureEventsMarkdown(events = [], input = {}, today = '') {
  const competitors = normalizeNameList(input.competitorNames || input.competitor || input.productName)
  const grouped = new Map()
  for (const event of events) {
    const key = event.competitorName || '未命名竞品'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(event)
  }
  const lines = [
    '# 竞品新功能扫描报告',
    '',
    `> 扫描日期：${today || dateString(new Date())}`,
    `> 扫描竞品数：${competitors.length || grouped.size}`,
    `> 发现新功能：${grouped.size} 个竞品`,
    '',
    '## 🆕 今日发现新功能',
    ''
  ]
  for (const [competitor, items] of grouped.entries()) {
    lines.push(`### ${competitor}`, '')
    for (const event of items) {
      lines.push(`- ${event.featureName}`)
      const urls = Array.isArray(event.sourceUrls) ? event.sourceUrls.slice(0, 3) : []
      if (urls.length) lines.push(`  - 信息来源：${urls.join('、')}`)
      if (event.rawEvidence) lines.push(`  - 依据：${event.rawEvidence}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

function buildWeeklyNoFindingsMarkdown(input = {}, data = {}, currentDateProvider = () => new Date()) {
  const period = weeklyPeriod(data, currentDateProvider)
  const competitors = normalizeNameList(input.competitorNames || input.competitor || input.productName)
  return [
    '# 竞品监控周报',
    '',
    `> 报告日期：${period.end || dateString(currentDateProvider())}`,
    `> 监控周期：${period.start || '未确认'} ~ ${period.end || '未确认'}`,
    '',
    '## 本周概览',
    '',
    '- 共监控到 **0** 条周期内明确变更',
    `- 监控竞品 **${competitors.length || 0}** 个`,
    '',
    '## 本周未发现明确的竞品变更',
    '',
    '未采集到发布日期或发现时间落在本周监控周期内、且可作为变更依据的有效信息。',
    '',
    '## 说明',
    '',
    '- 周报只展示监控周期内的明确证据；历史页面、无日期搜索结果和第三方泛化介绍不会作为本周变更展示。',
    '- 如果需要继续确认，可补充官方 changelog、产品公告或截图证据后重新分析。'
  ].join('\n')
}

function buildWeeklyChangesMarkdown(changes = [], input = {}, data = {}, currentDateProvider = () => new Date()) {
  if (!changes.length) return buildWeeklyNoFindingsMarkdown(input, data, currentDateProvider)
  const period = weeklyPeriod(data, currentDateProvider)
  const grouped = new Map()
  for (const change of changes) {
    const key = change.competitor || change.competitorName || '未命名竞品'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(change)
  }
  const lines = [
    '# 竞品监控周报',
    '',
    `> 报告日期：${period.end || dateString(currentDateProvider())}`,
    `> 监控周期：${period.start || '未确认'} ~ ${period.end || '未确认'}`,
    '',
    '## 本周概览',
    '',
    `- 共监控到 **${changes.length}** 条周期内明确变更`,
    `- 涉及 **${grouped.size}** 个竞品`,
    '',
    '## 竞品详情',
    ''
  ]
  for (const [competitor, items] of grouped.entries()) {
    lines.push(`### ${competitor}`, '')
    for (const change of items) {
      const category = change.category || '变更'
      const summary = safeText(change.summary, '未命名变更')
      lines.push(`#### [${category}] ${summary}`, '')
      if (change.details) lines.push(`${change.details}`, '')
      if (change.discovered_at || change.discoveredAt) lines.push(`- **发现时间**: ${change.discovered_at || change.discoveredAt}`)
      const urls = Array.isArray(change.source_urls) ? change.source_urls : Array.isArray(change.sourceUrls) ? change.sourceUrls : []
      if (urls.length) lines.push(`- **信息来源**: ${urls.slice(0, 3).join(', ')}`)
      lines.push('')
    }
  }
  return lines.join('\n').trim()
}

function buildAnalysisEvidence(jsonText = '', stdout = '') {
  const data = parseJsonSafe(jsonText)
  const lines = []
  if (data) {
    const quality = normalizeEvidenceQuality(data)
    const count = evidenceCount(data)
    pushEvidenceLine(lines, '产品名称', data.product_name || data.productName || data.competitor || '')
    pushEvidenceLine(lines, '产品地址', data.product_url || data.productUrl || data.base_url || '')
    pushEvidenceLine(lines, '流程概述', data.flow_description || data.summary || '')
    pushEvidenceLine(lines, '证据质量', quality)
    pushEvidenceLine(lines, '证据数量', String(count))
    pushEvidenceLine(lines, '功能证据状态', data.evidence_status || '')
    pushEvidenceLine(lines, '功能证据说明', data.evidence_reason || '')
    for (const source of evidenceSources(data).slice(0, 10)) {
      pushEvidenceLine(lines, '证据来源', `${source.title || ''} ${source.url || ''} ${source.snippet || ''}`)
    }
    pushEvidenceLine(lines, '原始证据摘要', data.raw_data || data.rawData || '')
    const structured = data.structured_data || data.structuredData
    if (structured && typeof structured === 'object') {
      pushEvidenceLine(lines, '结构化证据字段', Object.keys(structured).slice(0, 12).join('、'))
    }
    collectFeatureModuleEvidence(lines, data.similar_features, '相似功能线索')
    collectFlowStepEvidence(lines, data.steps)
    collectPageEvidence(lines, data.pages)
    collectPageEvidence(lines, data.page_evidence)
    collectNavigationEvidence(lines, data.navigation_tree)
    collectNavigationEvidence(lines, data.sitemap_navigation)
    collectFeatureModuleEvidence(lines, data.feature_modules, '框架功能模块')
    collectFeatureModuleEvidence(lines, data.crawler_features || data.features, '爬虫识别功能')
    collectChangeEvidence(lines, data.changes)
    collectScanEvidence(lines, data.results)
    if (Array.isArray(data.source_urls)) pushEvidenceLine(lines, '来源链接', data.source_urls.slice(0, 8).join(', '))
  }
  pushEvidenceLine(lines, '脚本输出摘要', stdout)
  return lines.slice(0, 60).join('\n')
}

function buildInputMonitorEvidence(input = {}) {
  const lines = []
  const event = normalizeFeatureEvent(input.sourceFeatureEvent || input.source_feature_event)
  if (event) {
    pushEvidenceLine(lines, '监控发现竞品', event.competitorName)
    pushEvidenceLine(lines, '监控发现功能', event.featureName)
    pushEvidenceLine(lines, '监控发现时间', event.discoveredAt)
    pushEvidenceLine(lines, '监控证据状态', event.evidenceStatus)
    pushEvidenceLine(lines, '监控原始摘要', event.rawEvidence)
    if (event.sourceUrls.length) pushEvidenceLine(lines, '监控来源链接', event.sourceUrls.slice(0, 8).join(', '))
    for (const entry of event.sourceEntries.slice(0, 6)) {
      pushEvidenceLine(lines, '监控来源条目', `${entry.title} ${entry.publishedDate || ''} ${entry.url || ''} ${entry.snippet || ''}`)
    }
  }
  const monitor = normalizeMonitorEvidence(input.monitorEvidence || input.monitor_evidence)
  pushEvidenceLine(lines, '来源监控报告', `${monitor.kind} ${monitor.title} ${monitor.recordId}`)
  pushEvidenceLine(lines, '来源监控报告摘要', monitor.summary)
  pushEvidenceLine(lines, '来源监控报告内容', monitor.markdown)
  return lines.join('\n')
}

function collectFlowStepEvidence(lines = [], steps = []) {
  const items = Array.isArray(steps) ? steps : []
  for (const step of items.slice(0, 10)) {
    const item = normalizePlainObject(step)
    pushEvidenceLine(lines, 'Python提取步骤', `${item.step_number || ''} ${item.description || ''} ${item.ui_element || ''} ${item.expected_result || ''}`)
  }
}

function escapeArtifactXml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function flowStepsFromMarkdown(markdown = '', input = {}) {
  const text = String(markdown || '')
  const arrowLine = text.split(/\r?\n/).find((line) => /->|→/.test(line)) || ''
  const fromArrow = arrowLine
    .split(/->|→/)
    .map((item) => item.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
  if (fromArrow.length >= 3) return fromArrow.slice(0, 8)
  const feature = input.feature || '目标功能'
  return ['进入功能入口', `配置${feature}`, '预览确认', '导出或完成']
}

function flowStepsFromData(data = {}) {
  const steps = Array.isArray(data?.steps) ? data.steps : []
  return steps
    .map((step, index) => {
      const item = normalizePlainObject(step)
      const description = String(item.description || '').trim()
      if (!description) return ''
      return description.length > 34 ? `${description.slice(0, 34)}...` : description
    })
    .filter(Boolean)
    .slice(0, 8)
}

function flowStatesFromMarkdown(markdown = '') {
  const text = String(markdown || '')
  const arrowLine = text.split(/\r?\n/).find((line) => /空状态|编辑中|预览中|已导出|状态/.test(line) && /->|→/.test(line)) || ''
  const states = arrowLine
    .split(/->|→/)
    .map((item) => item.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
  return states.length >= 3 ? states.slice(0, 8) : ['待开始', '编辑中', '预览中', '已完成']
}

function buildDrawioXml(title = '', nodes = []) {
  const cells = [
    '<mxCell id="0"/>',
    '<mxCell id="1" parent="0"/>'
  ]
  nodes.forEach((node, index) => {
    const id = `n${index + 1}`
    const x = 40 + index * 180
    cells.push(`<mxCell id="${id}" value="${escapeArtifactXml(node)}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f8f9fb;strokeColor=#d0d5dd;fontColor=#1f2329;" vertex="1" parent="1"><mxGeometry x="${x}" y="80" width="132" height="56" as="geometry"/></mxCell>`)
    if (index > 0) {
      cells.push(`<mxCell id="e${index}" edge="1" parent="1" source="n${index}" target="${id}" style="endArrow=block;html=1;rounded=0;strokeColor=#667085;"><mxGeometry relative="1" as="geometry"/></mxCell>`)
    }
  })
  return `<mxfile host="liuchengtong" modified="${new Date().toISOString()}"><diagram name="${escapeArtifactXml(title)}"><mxGraphModel><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`
}

function buildDiagramArtifact(title = '', nodes = []) {
  return {
    title,
    fileName: diagramArtifactFileName(title),
    format: 'drawio',
    content: buildDrawioXml(title, nodes),
    previewUrl: buildDiagramPreviewDataUrl(title, nodes),
    nodes: nodes.slice(0, 8)
  }
}

function buildLowFiWireframeDataUrl(input = {}, steps = []) {
  const title = escapeArtifactXml(`${input.competitorName || input.competitor || input.productName || '竞品'} ${input.feature || '功能'}低保真流程`)
  const cards = steps.slice(0, 4).map((step, index) => {
    const x = 52 + index * 172
    return [
      `<rect x="${x}" y="118" width="132" height="170" rx="10" fill="#ffffff" stroke="#d0d5dd"/>`,
      `<rect x="${x + 14}" y="138" width="104" height="14" rx="4" fill="#e4e7ec"/>`,
      `<rect x="${x + 14}" y="166" width="88" height="10" rx="4" fill="#eef2f6"/>`,
      `<rect x="${x + 14}" y="188" width="104" height="56" rx="8" fill="#f8f9fb" stroke="#e4e7ec"/>`,
      `<rect x="${x + 30}" y="258" width="72" height="18" rx="9" fill="#1f2329"/>`,
      `<text x="${x + 66}" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#475467">${escapeArtifactXml(step).slice(0, 18)}</text>`
    ].join('')
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="820" height="380" viewBox="0 0 820 380"><rect width="820" height="380" fill="#f8fafc"/><text x="40" y="48" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#1f2329">${title}</text>${cards}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function flowEvidenceStatus(data = {}) {
  const item = normalizePlainObject(data)
  const status = String(item.evidence_status || item.evidenceStatus || '').trim()
  if (status) return status
  const explicitQuality = String(item.evidence_quality || item.evidenceQuality || '').trim().toLowerCase()
  if (!explicitQuality) return ''
  const quality = normalizeEvidenceQuality(item, 'flow')
  if (quality === 'full') return 'exact'
  if (quality === 'partial') return 'similar'
  if (quality === 'none') return 'not_found'
  return ''
}

function flowEvidenceQuality(data = {}) {
  return normalizeEvidenceQuality(data, 'flow')
}

function buildUnsupportedFlowMarkdown(input = {}, data = {}) {
  const competitor = data.competitor || input.competitorName || input.competitor || '竞品'
  const feature = data.feature || input.feature || '目标功能'
  const status = flowEvidenceStatus(data)
  const quality = flowEvidenceQuality(data)
  const reason = data.flow_description || (status === 'similar'
    ? `未找到「${competitor}」明确提供「${feature}」功能的证据，仅发现相似功能线索。`
    : `未找到「${competitor}」提供「${feature}」功能的公开证据。`)
  const lines = [
    `# 交互流程分析：${competitor} - ${feature}`,
    '',
    '## 功能证据校验',
    '',
    `- 证据质量：${quality}`,
    `- 证据数量：${evidenceCount(data)}`,
    '',
    reason,
    '',
  ]
  const similar = Array.isArray(data.similar_features) ? data.similar_features : []
  if (similar.length) {
    lines.push('## 相似功能线索', '')
    for (const item of similar.slice(0, 8)) {
      lines.push(`- ${item.name || '相似功能'}${item.description ? `：${item.description}` : ''}${item.url ? `（${item.url}）` : ''}`)
    }
    lines.push('')
  }
  const urls = Array.isArray(data.source_urls) ? data.source_urls : []
  if (urls.length) {
    lines.push('## 信息来源', '')
    for (const url of urls.slice(0, 8)) lines.push(`- ${url}`)
  }
  if (quality === 'none') {
    lines.push('', '## 待补采动作', '', '- 重新确认官网、帮助中心、更新日志和公开搜索结果中是否存在目标功能。')
  }
  return lines.join('\n').trim()
}

function buildNoEvidenceAnalysisMarkdown(kind = '', input = {}, data = {}) {
  if (normalizeKind(kind) === 'flow') return buildUnsupportedFlowMarkdown(input, data)
  const title = kindLabel(kind)
  const subject = data.product_name || data.productName || input.productName || input.competitorName || input.competitor || '目标竞品'
  const url = data.product_url || data.productUrl || input.productUrl || ''
  const lines = [
    `# ${title}：${subject}`,
    '',
    '## 证据校验',
    '',
    '- 证据质量：none',
    `- 证据数量：${evidenceCount(data)}`,
    url ? `- 目标地址：${url}` : '',
    '',
    '未找到足够的公开页面、导航、功能入口或监控变更证据，不能生成完整分析结论。',
    '',
    '## 待补采动作',
    '',
    '- 重新抓取官网、帮助中心、更新日志、功能页和公开搜索结果。',
    '- 确认目标站点是否需要登录态、验证码或地区网络条件。',
    '- 补齐可引用来源后再进入大模型分析。'
  ]
  return lines.filter(Boolean).join('\n').trim()
}

function partialEvidenceMarkdownIsSafe(markdown = '') {
  return /证据不足|待补采|未找到|缺失|仅发现|相似功能/.test(String(markdown || ''))
}

function buildInteractionArtifactsFromData(kind = '', markdown = '', input = {}, data = {}) {
  if (normalizeKind(kind) !== 'flow') return undefined
  const status = flowEvidenceStatus(data)
  const quality = flowEvidenceQuality(data)
  if (status && status !== 'exact') {
    return {
      documentMarkdown: markdown || buildUnsupportedFlowMarkdown(input, data),
      mainFlowFile: '',
      stateDiagramFile: '',
      lowFiWireframeImages: [],
      stateMatrix: [],
      transitions: [],
      evidenceStatus: status,
      evidenceQuality: quality,
      evidenceCount: evidenceCount(data),
      sources: evidenceSources(data),
      evidenceReason: data.evidence_reason || '',
      similarFeatures: Array.isArray(data.similar_features) ? data.similar_features : []
    }
  }
  return {
    documentMarkdown: markdown,
    mainFlowFile: normalizeDiagramArtifact(data.mainFlowFile || data.main_flow_file || data.mainFlowDrawio || data.main_flow_drawio || '', '主流程图'),
    stateDiagramFile: normalizeDiagramArtifact(data.stateDiagramFile || data.state_diagram_file || data.stateDiagramDrawio || data.state_diagram_drawio || '', '状态图'),
    lowFiWireframeImages: normalizeArtifactList(data.lowFiWireframeImages || data.low_fi_wireframe_images),
    stateMatrix: normalizeArtifactList(data.stateMatrix || data.state_matrix),
    transitions: normalizeArtifactList(data.transitions || data.state_transitions),
    evidenceStatus: status || 'unknown',
    evidenceQuality: quality,
    evidenceCount: evidenceCount(data),
    sources: evidenceSources(data),
    evidenceReason: data.evidence_reason || ''
  }
}

export function createCompetitorAnalysisEngineService(options = {}) {
  const pythonRunner = typeof options.pythonRunner === 'function' ? options.pythonRunner : runPython
  const currentDateProvider = typeof options.currentDateProvider === 'function'
    ? options.currentDateProvider
    : () => new Date()
  const modelSettingsProvider = typeof options.modelSettingsProvider === 'function'
    ? options.modelSettingsProvider
    : async () => ({})
  const resolveAgentProvider = typeof options.resolveAgentProvider === 'function'
    ? options.resolveAgentProvider
    : null

  async function currentModelSettings(input = {}) {
    try {
      return normalizeModelSettings(await modelSettingsProvider(input))
    } catch {
      return normalizeModelSettings({})
    }
  }

  async function generateBackendModelReport(input = {}, settings = {}, reason = '') {
    if (!resolveAgentProvider || !settings.enabled) return null
    let provider = null
    try {
      provider = await resolveAgentProvider({
        purpose: 'competitor-analysis',
        modelSettings: settings
      })
    } catch {
      return null
    }
    if (!provider || typeof provider.generate !== 'function') return null
    const model = input.llmName || settings.defaultModel || 'gpt-5.5'
    try {
      const result = await provider.generate({
        model,
        responseFormat: 'markdown',
        actionType: 'competitor-analysis-report',
        scopeId: input.recordId || input.projectId || '',
        systemPrompt: '你是流程通后端的竞品分析报告模型，负责生成可直接展示的中文 Markdown 报告。',
        userPrompt: buildBackendModelReportPrompt(input, reason),
        timeoutMs: settings.timeoutMs,
        references: [],
        retrievedKnowledge: []
      })
      const markdown = sanitizeCompetitorAnalysisMarkdown(result?.content || '', '')
      if (!markdown) return null
      return {
        markdown,
        provider: result?.provider || provider.name || settings.provider || '',
        model: result?.model || model,
        usage: result?.usage || null
      }
    } catch {
      return null
    }
  }

  return {
    async listRecords(input = {}) {
      const records = await readRecords(input.projectId || 'default')
      const kind = input.kind ? normalizeKind(input.kind) : ''
      return {
        ok: true,
        records: (kind ? records.filter((item) => item.kind === kind) : records)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      }
    },
    async createRecord(input = {}) {
      const nowText = new Date().toISOString()
      const record = await upsertRecord(input.projectId || 'default', {
        id: input.id || `competitor-analysis-${randomUUID()}`,
        projectId: input.projectId || 'default',
        kind: normalizeKind(input.kind),
        title: input.title || analysisRecordTitle(input),
        status: 'pending',
        statusLabel: '待分析',
        competitorIds: input.competitorIds,
        competitorNames: input.competitorNames || input.competitor || input.productName,
        competitorName: input.competitorName || input.competitor,
        productUrl: input.productUrl,
        productUrls: input.productUrls,
        productName: input.productName,
        feature: input.feature,
        goal: input.goal,
        featureEvents: input.featureEvents || input.feature_events,
        sourceFeatureEvent: input.sourceFeatureEvent || input.source_feature_event,
        monitorEvidence: input.monitorEvidence || input.monitor_evidence,
        createdAt: nowText,
        updatedAt: nowText
      })
      return { ok: true, record }
    },
    async deleteRecord(input = {}) {
      const projectId = input.projectId || 'default'
      const recordId = String(input.recordId || input.id || '')
      if (!recordId) return { ok: false, message: '缺少记录 ID' }
      const records = await readRecords(projectId)
      const nextRecords = records.filter((item) => item.id !== recordId)
      await writeRecords(projectId, nextRecords)
      return {
        ok: true,
        deletedId: recordId,
        deleted: nextRecords.length !== records.length
      }
    },
    async latest(input = {}) {
      try {
        const saved = JSON.parse(await readFile(latestReportPath(input.projectId || 'default'), 'utf8'))
        return saved?.markdown ? saved : { ok: false, statusLabel: '等待分析', title: '分析报告', markdown: '' }
      } catch {}
      const markdown = await latestTempMarkdown()
      if (!markdown.trim()) {
        return { ok: false, statusLabel: '等待分析', title: '分析报告', markdown: '' }
      }
      return {
        ok: true,
        title: '最近分析结果',
        kind: normalizeKind(input.kind),
        statusLabel: '已恢复',
        summary: '已恢复本机最近一次竞品分析结果。',
        markdown: sanitizeCompetitorAnalysisMarkdown(markdown, ''),
        restoredFrom: 'local-temp'
      }
    },
    async run(input = {}) {
      const kind = normalizeKind(input.kind)
      const startedAt = Date.now()
      const projectId = input.projectId || 'default'
      const recordId = String(input.recordId || '')
      const inputFailure = requiredInputFailure({ ...input, kind })
      if (inputFailure) {
        const response = {
          ok: false,
          title: `${kindLabel(kind)}结果`,
          kind,
          statusLabel: '未完成',
          summary: inputFailure,
          markdown: fallbackMarkdown({ ...input, kind }, inputFailure),
          interactionArtifacts: kind === 'flow'
            ? {
                documentMarkdown: fallbackMarkdown({ ...input, kind }, inputFailure),
                mainFlowFile: '',
                stateDiagramFile: '',
                lowFiWireframeImages: [],
                stateMatrix: [],
                transitions: [],
                evidenceStatus: 'not_found',
                evidenceReason: inputFailure,
                similarFeatures: []
              }
            : undefined,
          jsonAvailable: false,
          durationMs: Date.now() - startedAt
        }
        if (recordId) {
          await patchRecord(projectId, recordId, {
            status: 'failed',
            statusLabel: response.statusLabel,
            title: response.title || analysisRecordTitle(input),
            summary: response.summary,
            markdown: response.markdown,
            interactionArtifacts: response.interactionArtifacts || input.interactionArtifacts,
            durationMs: response.durationMs
          })
        }
        return response
      }
      const modelSettings = await currentModelSettings(input)
      if (recordId) {
        await patchRecord(projectId, recordId, {
          status: 'running',
          statusLabel: '分析中'
        })
      }
      const outputDir = await mkdtemp(path.join(os.tmpdir(), 'liuchengtong-competitor-analysis-'))
      const modelEnv = resolvePythonModelEnv(input, modelSettings)
      const competitorsConfigPath = await writeSelectedCompetitorsConfig({ ...input, kind }, outputDir)
      const result = await pythonRunner(buildArgs({ ...input, kind }, outputDir), {
        OUTPUT_DIR: outputDir,
        SEARCH_ENGINE: input.searchEngine || process.env.SEARCH_ENGINE || 'duckduckgo',
        ...(competitorsConfigPath ? { COMPETITORS_CONFIG: competitorsConfigPath } : {}),
        ...modelEnv
      })
      const markdown = await latestFileText(outputDir, '.md')
      const jsonText = await latestFileText(outputDir, '.json')
      const analysisData = parseJsonSafe(jsonText) || {}
      const featureEvents = extractFeatureEventsFromAnalysisData(kind, analysisData, input, { currentDateProvider })
      const failureReason = safeText(result.stderr || result.stdout, SAFE_FAILURE_MESSAGE)
      const scriptOk = result.code === 0 && Boolean(markdown.trim())
      const analysisEvidence = [
        buildInputMonitorEvidence(input),
        buildAnalysisEvidence(jsonText, result.stdout)
      ].filter(Boolean).join('\n')
      const scriptFallbackMarkdown = isFallbackFlowMarkdown(markdown)
      const flowStatus = kind === 'flow' ? flowEvidenceStatus(analysisData) : ''
      const evidenceQuality = normalizeEvidenceQuality(analysisData, kind)
      const evidenceCountValue = evidenceCount(analysisData)
      const shouldUseEvidenceModel = kind === 'framework' && evidenceQuality !== 'none' && Boolean(analysisEvidence.trim()) && modelSettings.enabled
      const flowHasEvidenceResult = kind !== 'flow' || Boolean(flowStatus)
      const shouldBlockFlowModel = kind === 'flow' && evidenceQuality === 'none'
      const shouldUsePartialFlowModel = kind === 'flow' && scriptOk && evidenceQuality === 'partial' && Boolean(analysisEvidence.trim()) && modelSettings.enabled
      const shouldRewriteFallbackFlow = kind === 'flow' && scriptOk && scriptFallbackMarkdown && flowStatus === 'exact' && Boolean(analysisEvidence.trim()) && modelSettings.enabled
      const modelReport = (!shouldBlockFlowModel && (!scriptOk || shouldUseEvidenceModel || shouldRewriteFallbackFlow)) ? await generateBackendModelReport({
        ...input,
        analysisEvidence,
        evidenceQuality,
        evidenceCount: evidenceCountValue
      }, modelSettings, scriptOk ? '' : failureReason) : null
      const partialModelReport = (!modelReport && shouldUsePartialFlowModel) ? await generateBackendModelReport({
        ...input,
        analysisEvidence,
        evidenceQuality,
        evidenceCount: evidenceCountValue
      }, modelSettings, '') : null
      const rawModelReport = modelReport || partialModelReport
      const effectiveModelReport = evidenceQuality === 'partial' && rawModelReport?.markdown && !partialEvidenceMarkdownIsSafe(rawModelReport.markdown)
        ? null
        : rawModelReport
      const noEvidenceMarkdown = shouldBlockFlowModel || (kind === 'framework' && evidenceQuality === 'none')
        ? buildNoEvidenceAnalysisMarkdown(kind, input, analysisData)
        : ''
      const generatedMarkdown = noEvidenceMarkdown
        ? sanitizeCompetitorAnalysisMarkdown(noEvidenceMarkdown, '')
        : effectiveModelReport?.markdown
        ? sanitizeCompetitorAnalysisMarkdown(effectiveModelReport.markdown, '')
        : kind === 'daily'
          ? (featureEvents.length
            ? buildDailyFeatureEventsMarkdown(featureEvents, input, todayString(currentDateProvider))
            : buildDailyNoFindingsMarkdown(input, todayString(currentDateProvider)))
        : kind === 'weekly'
          ? buildWeeklyChangesMarkdown(weeklyChangesInPeriod(analysisData, currentDateProvider), input, analysisData, currentDateProvider)
        : scriptOk
          ? sanitizeCompetitorAnalysisMarkdown(markdown, '报告内容已生成，但包含暂不展示的内部信息。')
          : sanitizeCompetitorAnalysisMarkdown('', '')
      const ok = kind === 'flow'
        ? ((scriptOk || Boolean(effectiveModelReport) || shouldBlockFlowModel) && flowHasEvidenceResult && Boolean(generatedMarkdown))
        : (scriptOk || Boolean(generatedMarkdown))

      const response = {
        ok,
        title: `${kindLabel(kind)}结果`,
        kind,
        statusLabel: ok ? '已生成' : '未完成',
        summary: ok
          ? (effectiveModelReport ? '已使用当前后端模型基于采集证据生成分析报告。' : '分析报告已生成，可继续复制或沉淀。')
          : (failureReason || MODEL_FALLBACK_FAILURE_MESSAGE),
        markdown: ok ? generatedMarkdown : fallbackMarkdown(input, failureReason || MODEL_FALLBACK_FAILURE_MESSAGE),
        interactionArtifacts: buildInteractionArtifactsFromData(kind, generatedMarkdown, input, analysisData),
        featureEvents,
        jsonAvailable: Boolean(jsonText.trim()),
        durationMs: Date.now() - startedAt
      }
      if (response.markdown) await persistLatestReport(projectId, response)
      if (recordId) {
        await patchRecord(projectId, recordId, {
          status: ok ? 'succeeded' : 'failed',
          statusLabel: response.statusLabel,
          title: response.title || analysisRecordTitle(input),
          summary: response.summary,
          markdown: response.markdown,
          interactionArtifacts: response.interactionArtifacts || input.interactionArtifacts,
          featureEvents: response.featureEvents || input.featureEvents,
          sourceFeatureEvent: input.sourceFeatureEvent || input.source_feature_event,
          monitorEvidence: input.monitorEvidence || input.monitor_evidence,
          durationMs: response.durationMs
        })
      } else if (response.markdown) {
        await upsertRecord(projectId, {
          projectId,
          kind,
          title: response.title || analysisRecordTitle(input),
          status: ok ? 'succeeded' : 'failed',
          statusLabel: response.statusLabel,
          competitorIds: input.competitorIds,
          competitorNames: input.competitorNames || input.competitor || input.productName,
          competitorName: input.competitorName || input.competitor,
          productUrl: input.productUrl,
          productUrls: input.productUrls,
          productName: input.productName,
          feature: input.feature,
          goal: input.goal,
          summary: response.summary,
          markdown: response.markdown,
          interactionArtifacts: response.interactionArtifacts || input.interactionArtifacts,
          featureEvents: response.featureEvents || input.featureEvents,
          sourceFeatureEvent: input.sourceFeatureEvent || input.source_feature_event,
          monitorEvidence: input.monitorEvidence || input.monitor_evidence,
          durationMs: response.durationMs,
          createdAt: new Date().toISOString()
        })
      }
      return response
    }
  }
}
