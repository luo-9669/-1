import { inflateSync } from 'node:zlib'
import { visualVerificationPassed } from './visualVerification.js'

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function dataUrlToBuffer(dataUrl = '') {
  const match = String(dataUrl).match(/^data:image\/png;base64,([\s\S]+)$/)
  if (!match) throw new Error('只支持 PNG data URL 视觉比对')
  return Buffer.from(match[1], 'base64')
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  return pb <= pc ? b : c
}

function unfilterRow(row, previous, filter, channels) {
  for (let i = 0; i < row.length; i += 1) {
    const left = i >= channels ? row[i - channels] : 0
    const up = previous[i] || 0
    const upLeft = i >= channels ? previous[i - channels] || 0 : 0
    if (filter === 1) row[i] = (row[i] + left) & 255
    else if (filter === 2) row[i] = (row[i] + up) & 255
    else if (filter === 3) row[i] = (row[i] + Math.floor((left + up) / 2)) & 255
    else if (filter === 4) row[i] = (row[i] + paeth(left, up, upLeft)) & 255
    else if (filter !== 0) throw new Error(`不支持 PNG filter ${filter}`)
  }
}

function readPng(dataUrl = '') {
  const buffer = dataUrlToBuffer(dataUrl)
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('图片不是有效 PNG')
  let offset = 8
  let width = 0
  let height = 0
  let colorType = 0
  let bitDepth = 0
  const idat = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) throw new Error('仅支持 8-bit RGB/RGBA PNG')
  const channels = colorType === 6 ? 4 : 3
  const stride = width * channels
  const inflated = inflateSync(Buffer.concat(idat))
  const pixels = Buffer.alloc(width * height * 4)
  let sourceOffset = 0
  let previous = Buffer.alloc(stride)

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset]
    sourceOffset += 1
    const row = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + stride))
    sourceOffset += stride
    unfilterRow(row, previous, filter, channels)
    for (let x = 0; x < width; x += 1) {
      const source = x * channels
      const target = (y * width + x) * 4
      pixels[target] = row[source]
      pixels[target + 1] = row[source + 1]
      pixels[target + 2] = row[source + 2]
      pixels[target + 3] = channels === 4 ? row[source + 3] : 255
    }
    previous = row
  }

  return { width, height, pixels }
}

export function compareImageDataUrls(baselineDataUrl, generatedDataUrl) {
  const baseline = readPng(baselineDataUrl)
  const generated = readPng(generatedDataUrl)
  const dimensionMatch = baseline.width === generated.width && baseline.height === generated.height
  const width = generated.width
  const height = generated.height
  const totalPixels = Math.max(1, width * height)
  let differentPixels = 0
  let totalDelta = 0

  for (let y = 0; y < height; y += 1) {
    const baselineY = dimensionMatch
      ? y
      : Math.min(baseline.height - 1, Math.floor((y / Math.max(1, height)) * baseline.height))
    for (let x = 0; x < width; x += 1) {
      const baselineX = dimensionMatch
        ? x
        : Math.min(baseline.width - 1, Math.floor((x / Math.max(1, width)) * baseline.width))
      const a = (baselineY * baseline.width + baselineX) * 4
      const b = (y * generated.width + x) * 4
      const delta = Math.abs(baseline.pixels[a] - generated.pixels[b])
        + Math.abs(baseline.pixels[a + 1] - generated.pixels[b + 1])
        + Math.abs(baseline.pixels[a + 2] - generated.pixels[b + 2])
        + Math.abs(baseline.pixels[a + 3] - generated.pixels[b + 3])
      totalDelta += delta
      if (delta > 12) differentPixels += 1
    }
  }

  const averageChannelDelta = totalDelta / (totalPixels * 4)
  const differentPixelRatio = differentPixels / totalPixels
  const score = Math.max(0, Number((100 - differentPixelRatio * 100 - averageChannelDelta / 2).toFixed(2)))
  return {
    width,
    height,
    baselineSize: { width: baseline.width, height: baseline.height },
    generatedSize: { width: generated.width, height: generated.height },
    dimensionMatch,
    normalizedDimensions: !dimensionMatch,
    differentPixels,
    totalPixels,
    differentPixelRatio: Number(differentPixelRatio.toFixed(4)),
    averageChannelDelta: Number(averageChannelDelta.toFixed(2)),
    score,
    passed: visualVerificationPassed({ dimensionMatch, score, differentPixelRatio, averageChannelDelta })
  }
}
