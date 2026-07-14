import assert from 'node:assert/strict'
import test from 'node:test'
import { extractDocumentText } from './documentImport.js'

test('PDF files are left empty for backend parsing instead of returning placeholder text', async () => {
  const file = new File(['%PDF-1.7 mock'], 'sample.pdf', { type: 'application/pdf' })

  const text = await extractDocumentText(file)

  assert.equal(text, '')
})

test('legacy Word documents are left empty for backend parsing', async () => {
  const file = new File(['mock-doc-binary'], 'sample.doc', { type: 'application/msword' })

  const text = await extractDocumentText(file)

  assert.equal(text, '')
})

test('markdown long extension imports as text', async () => {
  const file = new File(['# 标题\n\n正文'], 'sample.markdown', { type: 'text/markdown' })

  const text = await extractDocumentText(file)

  assert.equal(text, '# 标题\n\n正文')
})
