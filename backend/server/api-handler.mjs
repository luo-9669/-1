import { tryServeStaticFile } from './static-file-server.mjs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
}

export function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS_HEADERS,
    ...extraHeaders
  })
  res.end(JSON.stringify(data, null, 2))
}

function routeResponseBody(data = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const { statusCode, headers, ...body } = data
  void statusCode
  void headers
  return body
}

export async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return { raw }
  }
}

export function createApiRequestHandler({ matchRoute, sseEvent }) {
  return async function handleApiRequest(req, res) {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {})
      return
    }

    const url = new URL(req.url, `http://${req.headers.host}`)
    const handler = matchRoute(req.method, url.pathname)
    if (!handler) {
      // 尝试提供静态文件服务
      const served = await tryServeStaticFile(req, res, url.pathname)
      if (served) return
      
      sendJson(res, 404, { message: `未找到接口：${req.method} ${url.pathname}` })
      return
    }

    try {
      const queryPayload = Object.fromEntries(url.searchParams.entries())
      const bodyPayload = req.method === 'GET' ? {} : await readBody(req)
      const payload = {
        ...queryPayload,
        ...bodyPayload
      }
      const wantsSse = req.method === 'POST' && url.pathname.endsWith('/stream')
      const routeContext = wantsSse
        ? {
            writeEvent: (chunk) => {
              res.write(chunk)
            }
          }
        : url
      if (wantsSse) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          ...CORS_HEADERS,
          'X-Accel-Buffering': 'no'
        })
        res.flushHeaders?.()
      }
      const data = await handler(payload, req, routeContext)
      if (wantsSse) {
        res.end()
        return
      }
      if (data?.contentType && Object.hasOwn(data, 'body')) {
        res.writeHead(data.statusCode || 200, {
          'Content-Type': data.contentType,
          ...CORS_HEADERS,
          ...(data.headers || {})
        })
        res.end(data.body)
        return
      }
      sendJson(res, data?.statusCode || 200, routeResponseBody(data), data?.headers || {})
    } catch (error) {
      if (req.method === 'POST' && url.pathname.endsWith('/stream')) {
        const errorData = {
          message: error.message || '本地流式 API 执行失败',
          code: error.code || 'STREAM_ROUTE_FAILED',
          recoveryActions: error.recoveryActions || ['重试', '检查后端服务日志']
        }
        res.write(sseEvent('error', errorData))
        res.write(sseEvent('done', { error: errorData }))
        res.end()
        return
      }
      sendJson(res, 500, { message: error.message || '本地 API 执行失败' })
    }
  }
}
