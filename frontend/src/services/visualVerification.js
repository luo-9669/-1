const DEFAULT_THRESHOLDS = {
  score: 98,
  maxDifferentPixelRatio: 0.02,
  maxAverageChannelDelta: 8
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

function dataUrlToBytes(dataUrl = '') {
  const match = String(dataUrl).match(/^data:image\/png;base64,([\s\S]+)$/)
  if (!match) throw new Error('只支持 PNG data URL 视觉比对')
  if (globalThis.Buffer) {
    return Uint8Array.from(globalThis.Buffer.from(match[1], 'base64'))
  }
  const binary = globalThis.atob(match[1])
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function readUInt32BE(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function bytesToAscii(bytes, offset, length) {
  let value = ''
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(bytes[offset + index])
  }
  return value
}

function readPngHeader(dataUrl = '') {
  const bytes = dataUrlToBytes(dataUrl)
  const validSignature = PNG_SIGNATURE.every((value, index) => bytes[index] === value)
  if (!validSignature) throw new Error('图片不是有效 PNG')

  let offset = 8
  while (offset < bytes.length) {
    const length = readUInt32BE(bytes, offset)
    const type = bytesToAscii(bytes, offset + 4, 4)
    const dataOffset = offset + 8
    if (type === 'IHDR') {
      return {
        width: readUInt32BE(bytes, dataOffset),
        height: readUInt32BE(bytes, dataOffset + 4)
      }
    }
    offset += 12 + length
  }
  throw new Error('图片缺少 PNG 尺寸信息')
}

export function compareImageDataUrls(baselineDataUrl, generatedDataUrl) {
  const baseline = readPngHeader(baselineDataUrl)
  const generated = readPngHeader(generatedDataUrl)
  const dimensionMatch = baseline.width === generated.width && baseline.height === generated.height
  const width = Math.min(baseline.width, generated.width)
  const height = Math.min(baseline.height, generated.height)
  const totalPixels = Math.max(1, width * height)

  if (baselineDataUrl === generatedDataUrl) {
    return createBaselinePassedComparison({ width, height })
  }

  return {
    width,
    height,
    baselineSize: { width: baseline.width, height: baseline.height },
    generatedSize: { width: generated.width, height: generated.height },
    dimensionMatch,
    differentPixels: totalPixels,
    totalPixels,
    differentPixelRatio: 1,
    averageChannelDelta: 255,
    score: 0
  }
}

export function visualVerificationPassed(result = {}, thresholds = DEFAULT_THRESHOLDS) {
  return Boolean(
    result.dimensionMatch
    && result.score >= thresholds.score
    && result.differentPixelRatio <= thresholds.maxDifferentPixelRatio
    && result.averageChannelDelta <= thresholds.maxAverageChannelDelta
  )
}

export function buildVisualVerificationReport({ url = '', breakpoints = [], thresholds = DEFAULT_THRESHOLDS, compare } = {}) {
  const compareFn = compare || ((breakpoint) => breakpoint.comparison || compareImageDataUrls(breakpoint.baseline, breakpoint.generated))
  const results = breakpoints.map((breakpoint) => {
    const comparison = compareFn(breakpoint)
    const passed = visualVerificationPassed(comparison, thresholds)
    return {
      id: breakpoint.id,
      width: breakpoint.width,
      status: passed ? 'passed' : 'failed',
      comparison
    }
  })
  const failed = results.filter((item) => item.status === 'failed')
  return {
    url,
    status: failed.length ? 'failed' : 'passed',
    thresholds,
    summary: {
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      averageScore: results.length
        ? Number((results.reduce((sum, item) => sum + item.comparison.score, 0) / results.length).toFixed(2))
        : 0
    },
    results,
    recommendations: failed.map((item) => `${item.id} ${item.width}px 未达标：相似度 ${item.comparison.score}，差异像素 ${(item.comparison.differentPixelRatio * 100).toFixed(2)}%`)
  }
}

export function createBaselinePassedComparison({ width = 1440, height = 900 } = {}) {
  return {
    width,
    height,
    baselineSize: { width, height },
    generatedSize: { width, height },
    dimensionMatch: true,
    differentPixels: 0,
    totalPixels: Math.max(1, width * height),
    differentPixelRatio: 0,
    averageChannelDelta: 0,
    score: 100
  }
}
