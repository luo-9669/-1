function joinUrl(baseUrl, path) {
  if (!baseUrl) return path
  return `${String(baseUrl).replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`
}

export async function generateDiagram({ apiConfig = {}, payload = {}, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') {
    return { ok: false, status: 'unavailable', message: '当前环境不支持请求接口', data: null }
  }
  const apiBaseUrl = apiConfig.apiBaseUrl || ''
  try {
    const response = await fetchImpl(joinUrl(apiBaseUrl, '/api/diagrams/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const contentType = response.headers?.get?.('content-type') || ''
    const data = contentType.includes('application/json') ? await response.json() : await response.text()
    if (!response.ok) {
      return {
        ok: false,
        status: 'failed',
        message: data?.message || `生成失败：${response.status}`,
        data
      }
    }
    return { ok: true, status: 'success', message: '生成成功', data }
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      message: error.message || '生成接口请求失败',
      data: null
    }
  }
}
