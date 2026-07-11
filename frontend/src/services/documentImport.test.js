import assert from 'node:assert/strict'
import test from 'node:test'
import { extractDocumentText } from './documentImport.js'

test('PDF files are left empty for backend parsing instead of returning placeholder text', async () => {
  const file = new File(['%PDF-1.7 mock'], 'sample.pdf', { type: 'application/pdf' })

  const text = await extractDocumentText(file)

  assert.equal(text, '')
})
