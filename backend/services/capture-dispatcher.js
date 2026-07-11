export function createCaptureDispatcher(deps = {}) {
  const {
    analyzeCaptureUrl,
    matchCaptureTemplate,
    compileCaptureTask,
    classifyCaptureDiagnostics,
    captureRunner
  } = deps

  return {
    async execute(payload = {}) {
      const analysis = analyzeCaptureUrl({
        url: payload.url,
        authMode: payload.authMode
      })
      const templateMatch = matchCaptureTemplate({
        analysis,
        authMode: payload.authMode
      })
      const compiledTask = compileCaptureTask({
        payload,
        analysis,
        templateMatch
      })
      const captureResult = await captureRunner.makeCaptureResult({
        ...payload,
        url: compiledTask.source.url,
        authMode: compiledTask.auth.mode,
        relay: {
          templateId: compiledTask.templateId,
          matchReason: compiledTask.relay?.matchReason || '',
          compiledTask,
          analysis
        }
      })
      const classified = classifyCaptureDiagnostics({
        compiledTask,
        captureResult
      })

      return {
        ...captureResult,
        status: classified.status === 'blocked' ? 'blocked' : captureResult.status,
        templateId: compiledTask.templateId,
        diagnostics: classified.diagnostics,
        recoveryActions: classified.recoveryActions,
        relay: {
          analysis,
          compiledTask,
          matchReason: compiledTask.relay?.matchReason || ''
        }
      }
    }
  }
}
