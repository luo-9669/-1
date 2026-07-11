import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('knowledge entries render as a requirements-style table with pagination', async () => {
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(knowledgeHubSource, /knowledgeHubSection === 'entries'/)
  assert.match(knowledgeHubSource, /paginatedKnowledgeEntryRows/)
  assert.match(knowledgeHubSource, /knowledgeEntryPagination/)
  assert.match(knowledgeHubSource, /KNOWLEDGE_ENTRY_PAGE_SIZE = 20/)
  assert.match(knowledgeHubSource, /BaseDataTable/)
  assert.match(knowledgeHubSource, /table-class="requirements-table knowledge-entry-table"/)
  assert.match(knowledgeHubSource, /min-width="1080px"/)
  assert.doesNotMatch(knowledgeHubSource, /<table class="requirements-table knowledge-entry-table">/)
  assert.match(knowledgeHubSource, /知识条目/)
  assert.match(knowledgeHubSource, /知识类型/)
  assert.match(knowledgeHubSource, /角色/)
  assert.match(knowledgeHubSource, /可信状态/)
  assert.match(knowledgeHubSource, /证据/)
  assert.match(knowledgeHubSource, /上一页/)
  assert.match(knowledgeHubSource, /下一页/)
  assert.match(knowledgeHubSource, /setKnowledgeEntryPage/)
  assert.match(knowledgeHubSource, /open-knowledge-entry-detail/)
  assert.doesNotMatch(knowledgeHubSource, /knowledge-entry-card/)
  assert.doesNotMatch(knowledgeHubSource, /knowledge-entry-grid/)

  assert.match(styles, /\.knowledge-entry-table-panel/)
  assert.match(styles, /\.knowledge-entry-table/)
  assert.match(styles, /\.knowledge-entry-pagination/)
  assert.doesNotMatch(styles, /\.knowledge-entry-grid/)
  assert.doesNotMatch(styles, /\.knowledge-entry-card/)
})
