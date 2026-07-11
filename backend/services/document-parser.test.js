import assert from 'node:assert/strict'
import test from 'node:test'
import { parseUploadedDocument } from './document-parser.js'

test('binary requirement materials are kept analyzable when text is unavailable', () => {
  const image = parseUploadedDocument({ name: 'product.png', type: 'image/png', content: '' })
  const pdf = parseUploadedDocument({ name: 'prd.pdf', type: 'application/pdf', content: '' })
  const word = parseUploadedDocument({ name: 'brief.doc', type: 'application/msword', content: '' })

  assert.equal(image.status, 'parsed')
  assert.equal(pdf.status, 'parsed')
  assert.equal(word.status, 'parsed')
  assert.match(image.text, /图片素材已上传/)
  assert.match(pdf.text, /PDF素材已上传/)
  assert.match(word.text, /Word素材已上传/)
})
