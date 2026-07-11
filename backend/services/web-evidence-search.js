import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const DEFAULT_SEARCH_TIMEOUT_MS = 15000
const DEFAULT_RESULT_LIMIT = 6
const execFileAsync = promisify(execFile)

function cleanText(value = '', maxLength = 800) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function searchQueryFromDemand(input = '') {
  const text = cleanText(input, 120)
  if (!text) return 'AI 产品 UX 竞品 行业案例'
  return `${text} 竞品 行业案例 产品功能`
}

function resultUrlFromHref(href = '') {
  const raw = String(href || '')
    .replace(/&amp;/g, '&')
    .trim()
  if (!raw) return ''
  try {
    const url = new URL(raw, 'https://duckduckgo.com')
    const uddg = url.searchParams.get('uddg')
    return uddg ? decodeURIComponent(uddg) : url.href
  } catch {
    return raw
  }
}

export function parseDuckDuckGoResults(html = '', query = '') {
  const source = String(html || '')
  const results = []
  const resultPattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = resultPattern.exec(source)) && results.length < DEFAULT_RESULT_LIMIT) {
    const url = resultUrlFromHref(match[1])
    const title = cleanText(match[2], 180)
    const snippet = cleanText(match[3], 500)
    if (!url || !title) continue
    results.push({
      id: `web-${results.length + 1}`,
      title,
      url,
      snippet,
      sourceType: 'web-search',
      query,
      retrievedAt: new Date().toISOString()
    })
  }
  return results
}

export function parseBingResults(html = '', query = '') {
  const source = String(html || '')
  const results = []
  const resultPattern = /<li[^>]+class="[^"]*\bb_algo\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
  let match
  while ((match = resultPattern.exec(source)) && results.length < DEFAULT_RESULT_LIMIT) {
    const block = match[1] || ''
    const linkMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i)
    if (!linkMatch) continue
    const captionMatch = block.match(/<div[^>]+class="[^"]*\bb_caption\b[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)
    const url = resultUrlFromHref(linkMatch[1])
    const title = cleanText(linkMatch[2], 180)
    const snippet = cleanText(captionMatch?.[1] || '', 500)
    if (!url || !title) continue
    results.push({
      id: `web-${results.length + 1}`,
      title,
      url,
      snippet,
      sourceType: 'web-search',
      query,
      retrievedAt: new Date().toISOString()
    })
  }
  return results
}

async function fetchSearchHtml(url = '', options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const timeoutMs = options.timeoutMs || DEFAULT_SEARCH_TIMEOUT_MS
  if (typeof fetchImpl !== 'function') return fetchSearchHtmlWithCurl(url, timeoutMs)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) FlowUXEvidenceBot/1.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml'
      },
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`搜索请求失败：${response.status}`)
    return await response.text()
  } catch {
    return fetchSearchHtmlWithCurl(url, timeoutMs)
  } finally {
    clearTimeout(timer)
  }
}

async function fetchSearchHtmlWithCurl(url = '', timeoutMs = DEFAULT_SEARCH_TIMEOUT_MS) {
  try {
    const { stdout } = await execFileAsync('curl', [
      '-L',
      '--silent',
      '--show-error',
      '--max-time',
      String(Math.max(3, Math.ceil(timeoutMs / 1000))),
      '-A',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) FlowUXEvidenceBot/1.0 Safari/537.36',
      url
    ], {
      maxBuffer: 2 * 1024 * 1024
    })
    if (!String(stdout || '').trim()) throw new Error('搜索返回为空')
    return stdout
  } catch (error) {
    throw new Error(error?.message || '联网检索失败')
  }
}

async function searchEvidenceSources(query = '', options = {}) {
  const limit = options.limit || DEFAULT_RESULT_LIMIT
  const duckDuckGoUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  try {
    const duckDuckGoHtml = await fetchSearchHtml(duckDuckGoUrl, options)
    const duckDuckGoSources = parseDuckDuckGoResults(duckDuckGoHtml, query)
    if (duckDuckGoSources.length) return duckDuckGoSources.slice(0, limit)
  } catch {
    // Continue to Bing before declaring the evidence search failed.
  }

  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`
  const bingHtml = await fetchSearchHtml(bingUrl, options)
  return parseBingResults(bingHtml, query).slice(0, limit)
}

export async function buildAdvancedUxWebEvidencePack(payload = {}, options = {}) {
  const enabled = payload.webSearchEnabled !== false
  const now = new Date().toISOString()
  if (!enabled) {
    return {
      enabled: false,
      status: 'disabled',
      query: '',
      sources: [],
      facts: [],
      uncertainties: ['用户已关闭联网检索，本次不得写入外部竞品事实、行业链接或真实数据。'],
      generatedAt: now
    }
  }

  const query = searchQueryFromDemand(payload.input || payload.query || '')
  try {
    const sources = await searchEvidenceSources(query, options)
    return {
      enabled: true,
      status: sources.length ? 'ready' : 'empty',
      query,
      sources,
      facts: sources.map((item) => `${item.title}：${item.snippet}`).filter(Boolean),
      uncertainties: sources.length
        ? []
        : ['联网检索没有返回可用结果；外部事实只能标注为待验证，不得写成确定结论。'],
      generatedAt: now
    }
  } catch (error) {
    return {
      enabled: true,
      status: 'failed',
      query,
      sources: [],
      facts: [],
      uncertainties: [`联网检索失败：${error?.message || '未知错误'}。不得编造外部事实或链接。`],
      generatedAt: now
    }
  }
}
