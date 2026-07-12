import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
}

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const frontendDistDir = join(projectRoot, 'frontend/dist')

export async function tryServeStaticFile(req, res, urlPath) {
  // 只处理 GET 请求
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false
  }

  // 不处理 /api 路径
  if (urlPath.startsWith('/api/')) {
    return false
  }

  // 确定要提供的文件路径
  let filePath
  if (urlPath === '/' || urlPath === '') {
    filePath = join(frontendDistDir, 'index.html')
  } else {
    filePath = join(frontendDistDir, urlPath)
  }

  try {
    const stats = await stat(filePath)
    if (!stats.isFile()) {
      // 如果路径不是文件，尝试提供 index.html（SPA 路由支持）
      if (!extname(urlPath)) {
        filePath = join(frontendDistDir, 'index.html')
        await stat(filePath)
      } else {
        return false
      }
    }

    const ext = extname(filePath)
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size
      })
      res.end()
      return true
    }

    const content = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': 'public, max-age=3600'
    })
    res.end(content)
    return true
  } catch {
    // 文件不存在，返回 false 让调用者继续处理
    return false
  }
}

export function getFrontendDistDir() {
  return frontendDistDir
}
