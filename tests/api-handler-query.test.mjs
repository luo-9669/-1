import assert from 'node:assert/strict'
import test from 'node:test'

import { createApiRequestHandler } from '../backend/server/api-handler.mjs'
import { createRouteMatcher } from '../backend/server/route-matcher.mjs'

function mockRequest({ method = 'GET', url = '/', body = '', headers = {} } = {}) {
  return {
    method,
    url,
    headers: { host: 'local.test', ...headers },
    async *[Symbol.asyncIterator]() {
      if (body) yield Buffer.from(body)
    }
  }
}

function mockResponse() {
  const response = {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode
      this.headers = headers
    },
    write(chunk = '') {
      this.body += String(chunk)
    },
    end(chunk = '') {
      this.body += String(chunk)
    }
  }
  return response
}

test('api handler passes query params into delete route payloads', async () => {
  let receivedPayload = null
  const routes = {
    'DELETE /api/competitors/:id': async (payload) => {
      receivedPayload = payload
      return { ok: true }
    }
  }
  const handler = createApiRequestHandler({
    matchRoute: createRouteMatcher(routes),
    sseEvent: () => ''
  })
  const response = mockResponse()

  await handler(mockRequest({
    method: 'DELETE',
    url: '/api/competitors/competitor-1?projectId=project-1'
  }), response)

  assert.equal(response.statusCode, 200)
  assert.deepEqual(receivedPayload, {
    id: 'competitor-1',
    projectId: 'project-1'
  })
})

test('api handler allows credentialed browser requests from the request origin', async () => {
  const routes = {
    'GET /api/auth/me': async () => ({ authenticated: false, user: null })
  }
  const handler = createApiRequestHandler({
    matchRoute: createRouteMatcher(routes),
    sseEvent: () => ''
  })
  const response = mockResponse()

  await handler(mockRequest({
    method: 'GET',
    url: '/api/auth/me',
    headers: { origin: 'https://liuchengtong.coze.site' }
  }), response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['Access-Control-Allow-Origin'], 'https://liuchengtong.coze.site')
  assert.equal(response.headers['Access-Control-Allow-Credentials'], 'true')
})
