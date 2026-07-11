import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { chromium } from 'playwright-core'
import {
  buildWebsiteKnowledgeBatchImport,
  buildWebsiteKnowledgeImport,
  parseWebsiteHtml
} from '../../frontend/src/services/websiteKnowledge.js'

const execFileAsync = promisify(execFile)

function isNetworkIdleNavigationTimeout(error) {
  const message = String(error?.message || '')
  return message.includes('Timeout') && message.includes('networkidle')
}

export async function renderWebsiteHtml(url, options = {}) {
  let browser
  const defaultHeaders = options.defaultHeaders || {}
  const launchBrowser = options.launchBrowser || (() => chromium.launch({
    headless: true,
    executablePath: options.chromeExecutable
  }))
  try {
    browser = await launchBrowser()
    const page = await browser.newPage({
      userAgent: defaultHeaders['User-Agent']
    })
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
    } catch (error) {
      if (!isNetworkIdleNavigationTimeout(error)) throw error
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {})
      await page.waitForTimeout(800).catch(() => {})
    }
    return await page.content()
  } finally {
    await browser?.close()
  }
}

function htmlHasUsefulBody(html = '') {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return body.length > 160
}

function normalizeWebsiteUrl(url = '') {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.search = ''
    return parsed.href
  } catch {
    return url
  }
}

function sameOriginUrls(urls = [], sourceUrl = '', limit = 5) {
  let origin = ''
  try {
    origin = new URL(sourceUrl).origin
  } catch {
    return []
  }
  const seen = new Set()
  return urls
    .map((url) => normalizeWebsiteUrl(url))
    .filter((url) => {
      try {
        const parsed = new URL(url)
        if (parsed.origin !== origin) return false
        if (seen.has(parsed.href)) return false
        seen.add(parsed.href)
        return true
      } catch {
        return false
      }
    })
    .slice(0, limit)
}

function sitemapUrlFor(sourceUrl = '') {
  try {
    return new URL('/sitemap.xml', sourceUrl).href
  } catch {
    return ''
  }
}

function extractSitemapUrls(xml = '') {
  return Array.from(String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean)
}

function prototypeHotspotRect(index = 0, count = 1) {
  const width = count > 1 ? 32 : 44
  return {
    x: Math.min(72, 8 + index * (width + 4)),
    y: 78,
    width,
    height: 8
  }
}

export function createWebsiteImportService(options = {}) {
  const defaultHeaders = options.defaultHeaders || {}
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const execFileImpl = options.execFileAsync || execFileAsync
  const captureRunner = options.captureRunner

  async function fetchWebsiteHtml(url) {
    if (!/^https?:\/\//.test(url || '')) {
      throw new Error('请输入有效的 http 或 https 网站地址')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetchImpl(url, {
        headers: defaultHeaders,
        signal: controller.signal
      })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok) {
        throw new Error(`目标网站返回 ${response.status}`)
      }
      if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new Error(`目标地址不是 HTML 页面：${contentType}`)
      }
      return await response.text()
    } catch (error) {
      try {
        const { stdout } = await execFileImpl('curl', [
          '-L',
          '--fail',
          '--silent',
          '--show-error',
          '--max-time',
          '12',
          '-H',
          `User-Agent: ${defaultHeaders['User-Agent']}`,
          '-H',
          `Accept: ${defaultHeaders.Accept}`,
          url
        ], { maxBuffer: 8 * 1024 * 1024 })
        return stdout
      } catch {
        throw error
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async function fetchUsefulWebsiteHtml(url = '') {
    let html = await fetchWebsiteHtml(url)
    if (!htmlHasUsefulBody(html)) {
      html = await renderWebsiteHtml(url, {
        chromeExecutable: options.chromeExecutable,
        defaultHeaders,
        launchBrowser: options.launchBrowser
      })
    }
    return html
  }

  async function buildWebsiteImportPages(payload = {}) {
    const sourceUrl = payload.url || ''
    const sourceHtml = payload.html || await fetchUsefulWebsiteHtml(sourceUrl)
    if (payload.scope === 'sitemap') {
      let sitemapUrls = []
      try {
        sitemapUrls = extractSitemapUrls(await fetchWebsiteHtml(sitemapUrlFor(sourceUrl)))
      } catch {
        sitemapUrls = []
      }
      const urls = sameOriginUrls([sourceUrl, ...sitemapUrls], sourceUrl)
      const pages = []
      for (const url of urls) {
        pages.push({
          url,
          html: url === normalizeWebsiteUrl(sourceUrl) ? sourceHtml : await fetchUsefulWebsiteHtml(url)
        })
      }
      return pages.length ? pages : [{ url: sourceUrl, html: sourceHtml }]
    }
    if (payload.scope === 'same-domain') {
      const parsed = parseWebsiteHtml({ ...payload, html: sourceHtml })
      const urls = sameOriginUrls([sourceUrl, ...parsed.links.map((link) => link.href)], sourceUrl)
      const pages = []
      for (const url of urls) {
        pages.push({
          url,
          html: url === normalizeWebsiteUrl(sourceUrl) ? sourceHtml : await fetchUsefulWebsiteHtml(url)
        })
      }
      return pages.length ? pages : [{ url: sourceUrl, html: sourceHtml }]
    }
    return [{ url: sourceUrl, html: sourceHtml }]
  }

  async function parseWebsiteKnowledge(payload) {
    if (payload.scope === 'same-domain' || payload.scope === 'sitemap') {
      return buildWebsiteKnowledgeBatchImport({
        ...payload,
        pages: await buildWebsiteImportPages(payload)
      })
    }
    const html = payload.html || await fetchUsefulWebsiteHtml(payload.url)
    return buildWebsiteKnowledgeImport({ ...payload, html })
  }

  async function captureWebsitePrototype(payload = {}) {
    if (!captureRunner?.makeCaptureResult) {
      throw new Error('网站原型采集服务未配置 captureRunner')
    }
    const pages = Array.isArray(payload.pages) && payload.pages.length
      ? payload.pages
      : [{ url: payload.url, title: payload.url }]
    const normalizedPages = []
    for (const page of pages.slice(0, 8)) {
      const capture = await captureRunner.makeCaptureResult({
        projectId: payload.projectId,
        url: page.url,
        scope: payload.scope,
        authMode: payload.authMode || 'public'
      })
      const sameRunLinks = (capture.links || [])
        .filter((link) => pages.some((target) => normalizeWebsiteUrl(target.url) === normalizeWebsiteUrl(link.href)))
      normalizedPages.push({
        id: page.id || '',
        url: normalizeWebsiteUrl(capture.url || page.url),
        title: capture.title || page.title || page.url,
        summary: capture.description || capture.pages?.[0]?.summary || '',
        screenshot: capture.pages?.[0]?.screenshot || capture.screenshot || '',
        viewport: capture.viewport || { width: 1440, height: 900 },
        links: sameRunLinks.map((link, index) => ({
          label: link.text || link.label || link.href,
          href: normalizeWebsiteUrl(link.href),
          rect: link.rect || prototypeHotspotRect(index, sameRunLinks.length)
        }))
      })
    }
    return {
      source: 'backend-url-capture',
      pages: normalizedPages
    }
  }

  return {
    fetchWebsiteHtml,
    buildWebsiteImportPages,
    parseWebsiteKnowledge,
    captureWebsitePrototype
  }
}
