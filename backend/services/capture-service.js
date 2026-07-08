import { randomUUID } from 'node:crypto'
import {
  captureQualityGate,
  captureRestoreReadiness
} from './capture-quality-gate.js'

function blockedVisualVerification(captureResult = {}, recommendations = []) {
  return {
    url: captureResult?.url || '',
    status: 'blocked',
    thresholds: {},
    summary: { total: 0, passed: 0, failed: 0, averageScore: 0 },
    results: [],
    recommendations
  }
}

function requireDependency(deps = {}, name = '') {
  if (typeof deps[name] === 'function') return deps[name]
  const error = new Error(`Capture service dependency is not configured: ${name}`)
  error.code = 'CAPTURE_SERVICE_DEPENDENCY_NOT_CONFIGURED'
  throw error
}

function buildRestoredPageAsset(payload = {}, html = '', visualVerification = null) {
  const captureResult = payload.captureResult || {}
  return {
    projectId: payload.projectId || captureResult.projectId || 'project-flow',
    codeFormat: 'html',
    title: captureResult.title || captureResult.url || '高保真 HTML 还原页面',
    sourceUrl: captureResult.url || '',
    html,
    files: [
      { path: 'index.html', content: html }
    ],
    coverImage: captureResult.pages?.[0]?.screenshot || captureResult.screenshot || '',
    visualVerification,
    captureResult
  }
}

export async function generatePageFromCapturePayload(payload = {}, deps = {}) {
  const generatedPageHtml = requireDependency(deps, 'generatedPageHtml')
  const verifyGeneratedPage = requireDependency(deps, 'verifyGeneratedPage')
  const captureResult = payload.captureResult || {}
  const readiness = captureRestoreReadiness(captureResult)

  if (payload.restoreMode !== 'pixel' && !readiness.canRestore) {
    return {
      taskId: randomUUID(),
      status: 'blocked',
      html: '',
      summary: '采集质量不足，已阻止生成 1:1 HTML。',
      message: readiness.reason,
      readiness,
      visualVerification: blockedVisualVerification(captureResult, readiness.actions)
    }
  }

  const qualityGate = captureQualityGate(captureResult)
  if (payload.restoreMode !== 'pixel' && !qualityGate.passed) {
    return {
      taskId: randomUUID(),
      status: 'blocked',
      html: '',
      summary: '采集质量门禁未通过，已阻止生成正式还原资产。',
      message: qualityGate.reasons[0] || '采集质量不足，不能生成正式还原资产。',
      readiness,
      qualityGate,
      diagnosticReport: {
        title: captureResult?.title || captureResult?.url || '采集质量诊断',
        sourceUrl: captureResult?.url || '',
        reasons: qualityGate.reasons,
        actions: qualityGate.actions,
        metrics: qualityGate.metrics
      },
      visualVerification: blockedVisualVerification(captureResult, qualityGate.actions)
    }
  }

  const html = generatedPageHtml(captureResult, payload.palette, payload.designRules, {
    restoreMode: payload.restoreMode || 'dom'
  })
  const visualVerification = await verifyGeneratedPage(captureResult, html)
  const usedSingleFile = payload.restoreMode !== 'pixel' && Boolean(captureResult?.singleFileHtml)
  const usedStaticHtml = payload.restoreMode !== 'pixel' && !usedSingleFile && Boolean(captureResult?.staticHtml)
  const restoredPage = typeof deps.persistRestoredPage === 'function'
    ? await deps.persistRestoredPage(buildRestoredPageAsset(payload, html, visualVerification))
    : null

  return {
    taskId: randomUUID(),
    html,
    summary: usedSingleFile
      ? '已使用 SingleFile 生成高保真静态 HTML。'
      : usedStaticHtml
        ? '已使用授权浏览器当前页 HTML 生成高保真静态页面。'
        : '页面已根据采集结果生成，可直接预览。',
    visualVerification,
    restoredPage
  }
}
