export function sseEvent(event, data = {}) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function createStreamPusher(routeContext = {}) {
  const events = []
  const writeEvent = typeof routeContext.writeEvent === 'function' ? routeContext.writeEvent : null
  return {
    push(event, data = {}) {
      const chunk = sseEvent(event, data)
      events.push(chunk)
      writeEvent?.(chunk)
    },
    body() {
      return events.join('')
    }
  }
}
