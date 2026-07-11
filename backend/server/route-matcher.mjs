function matchParameterizedRoute(routes, method, pathname) {
  const requestSegments = pathname.split('/').filter(Boolean)
  for (const [routeKey, routeHandler] of Object.entries(routes)) {
    const [routeMethod, routePath] = routeKey.split(' ')
    if (routeMethod !== method || !routePath?.includes(':')) continue
    const routeSegments = routePath.split('/').filter(Boolean)
    if (routeSegments.length !== requestSegments.length) continue
    const params = {}
    let matched = true
    for (let index = 0; index < routeSegments.length; index += 1) {
      const routeSegment = routeSegments[index]
      const requestSegment = requestSegments[index]
      if (routeSegment.startsWith(':')) {
        params[routeSegment.slice(1)] = decodeURIComponent(requestSegment)
        continue
      }
      if (routeSegment !== requestSegment) {
        matched = false
        break
      }
    }
    if (matched) {
      return (payload, req, routeContext) => routeHandler({
        ...payload,
        ...params
      }, req, routeContext)
    }
  }
  return null
}

export function createRouteMatcher(routes) {
  return function matchRoute(method, pathname) {
    const exact = routes[`${method} ${pathname}`]
    if (exact) return exact
    if (method === 'POST' && pathname === '/api/workspace/materials/import-website') {
      return routes['POST /api/workspace/materials/import-website']
    }
    if (method === 'DELETE' && /^\/api\/workspace\/materials\/[^/]+$/.test(pathname)) {
      return (payload, req, url) => routes['DELETE /api/workspace/materials/:id']({
        ...payload,
        id: decodeURIComponent(url.pathname.split('/').pop())
      })
    }
    if (method === 'PATCH' && /^\/api\/workspace\/materials\/[^/]+$/.test(pathname)) {
      return (payload, req, url) => routes['PATCH /api/workspace/materials/:id']({
        ...payload,
        id: decodeURIComponent(url.pathname.split('/').pop())
      })
    }
    if (method === 'PUT' && /^\/api\/workspace\/skills\/[^/]+$/.test(pathname)) {
      return (payload, req, url) => routes['PUT /api/workspace/skills/:id']({
        ...payload,
        id: decodeURIComponent(url.pathname.split('/').pop())
      })
    }
    const captureTaskMatch = pathname.match(/^\/api\/capture\/tasks\/([^/]+)\/result$/)
    if (method === 'GET' && captureTaskMatch) {
      return (payload) => routes['GET /api/capture/tasks/:taskId/result']({
        ...payload,
        taskId: decodeURIComponent(captureTaskMatch[1])
      })
    }
    const generateTaskRegenerateMatch = pathname.match(/^\/api\/generate\/tasks\/([^/]+)\/regenerate$/)
    if (method === 'POST' && generateTaskRegenerateMatch) {
      return (payload) => routes['POST /api/generate/tasks/:taskId/regenerate']({
        ...payload,
        taskId: decodeURIComponent(generateTaskRegenerateMatch[1])
      })
    }
    const adminRecordMatch = pathname.match(/^\/api\/admin\/records\/([^/]+)(?:\/([^/]+))?$/)
    if (adminRecordMatch) {
      const collection = decodeURIComponent(adminRecordMatch[1])
      const id = adminRecordMatch[2] ? decodeURIComponent(adminRecordMatch[2]) : ''
      if (method === 'POST' && id === 'batch-delete') {
        return (payload) => routes['POST /api/admin/records/:collection/batch-delete']({ ...payload, collection })
      }
      if (method === 'GET' && !id) {
        return (payload) => routes['GET /api/admin/records/:collection']({ ...payload, collection })
      }
      if (method === 'POST' && !id) {
        return (payload) => routes['POST /api/admin/records/:collection']({ ...payload, collection })
      }
      if (method === 'PATCH' && id) {
        return (payload) => routes['PATCH /api/admin/records/:collection/:id']({ ...payload, collection, id })
      }
      if (method === 'DELETE' && id) {
        return (payload) => routes['DELETE /api/admin/records/:collection/:id']({ ...payload, collection, id })
      }
    }
    const restoredPageMatch = pathname.match(/^\/api\/workspace\/restored-pages\/([^/]+)(?:\/(preview|frame|source|download))?$/)
    if (method === 'GET' && restoredPageMatch) {
      const routeKey = restoredPageMatch[2]
        ? `GET /api/workspace/restored-pages/:id/${restoredPageMatch[2]}`
        : 'GET /api/workspace/restored-pages/:id'
      return (payload) => routes[routeKey]({
        ...payload,
        id: decodeURIComponent(restoredPageMatch[1])
      })
    }
    if (method === 'DELETE' && restoredPageMatch && !restoredPageMatch[2]) {
      return (payload) => routes['DELETE /api/workspace/restored-pages/:id']({
        ...payload,
        id: decodeURIComponent(restoredPageMatch[1])
      })
    }
    const workflowRunMatch = pathname.match(/^\/api\/workspace\/workflow-runs\/([^/]+)\/(generate|regenerate|accept|messages(?:\/stream|\/cancel)?|complete-step)$/)
    if (method === 'POST' && workflowRunMatch) {
      return (payload, req, routeContext) => routes[`POST /api/workspace/workflow-runs/:id/${workflowRunMatch[2]}`]({
        ...payload,
        id: decodeURIComponent(workflowRunMatch[1])
      }, req, routeContext)
    }
    const workflowRunDetailMatch = pathname.match(/^\/api\/workspace\/workflow-runs\/([^/]+)$/)
    if (method === 'GET' && workflowRunDetailMatch) {
      return (payload) => routes['GET /api/workspace/workflow-runs/:id']({
        ...payload,
        id: decodeURIComponent(workflowRunDetailMatch[1])
      })
    }
    if (method === 'DELETE' && workflowRunDetailMatch) {
      return (payload) => routes['DELETE /api/workspace/workflow-runs/:id']({
        ...payload,
        id: decodeURIComponent(workflowRunDetailMatch[1])
      })
    }
    const workflowStepMatch = pathname.match(/^\/api\/workflows\/runs\/([^/]+)\/steps\/([^/]+)\/(generate|regenerate|accept|messages(?:\/stream|\/cancel)?)$/)
    if (method === 'POST' && workflowStepMatch) {
      return (payload, req, routeContext) => routes[`POST /api/workflows/runs/:runId/steps/:stepId/${workflowStepMatch[3]}`]({
        ...payload,
        runId: decodeURIComponent(workflowStepMatch[1]),
        stepId: decodeURIComponent(workflowStepMatch[2])
      }, req, routeContext)
    }
    const workflowCompleteMatch = pathname.match(/^\/api\/workflows\/runs\/([^/]+)\/complete$/)
    if (method === 'POST' && workflowCompleteMatch) {
      return (payload) => routes['POST /api/workflows/runs/:runId/complete']({
        ...payload,
        runId: decodeURIComponent(workflowCompleteMatch[1])
      })
    }
    return matchParameterizedRoute(routes, method, pathname)
  }
}
