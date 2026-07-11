import http from 'node:http'

export function createMockApiHttpServer(handleApiRequest) {
  return http.createServer(handleApiRequest)
}

export function startHttpServer({ handleApiRequest, port, host = '0.0.0.0', onListen } = {}) {
  const server = createMockApiHttpServer(handleApiRequest)
  server.listen(port, host, () => {
    onListen?.(server)
  })
  return server
}
