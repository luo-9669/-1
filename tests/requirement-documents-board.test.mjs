import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('requirement documents render the table list in normal and batch management modes', async () => {
  const componentSource = await readFile(new URL('../frontend/src/pages/knowledge/RequirementDocumentsPanel.vue', import.meta.url), 'utf8')
  const tableSource = await readFile(new URL('../frontend/src/pages/knowledge/RequirementDocumentsTable.vue', import.meta.url), 'utf8')

  assert.match(componentSource, /import RequirementDocumentsTable from '\.\/RequirementDocumentsTable\.vue'/)
  assert.match(componentSource, /<RequirementDocumentsTable/)
  assert.match(componentSource, /:rows="filteredRequirementDocumentRows"/)
  assert.match(componentSource, /:material-batch-mode="materialBatchMode"/)
  assert.match(componentSource, /:current-selected-material-ids="currentSelectedMaterialIds"/)
  assert.match(componentSource, /@toggle-material-selection="\$emit\('toggle-material-selection', \$event\)"/)
  assert.match(componentSource, /@open-material-detail="\$emit\('open-material-detail', \$event\)"/)
  assert.match(componentSource, /@open-requirement-knowledge-deposit="\$emit\('open-requirement-knowledge-deposit', \$event\)"/)
  assert.match(componentSource, /@delete-requirement-document="\$emit\('delete-requirement-document', \$event\)"/)
  assert.doesNotMatch(componentSource, /<table class="requirements-table">/)

  assert.match(tableSource, /BaseDataTable/)
  assert.match(tableSource, /class="requirements-table-panel"/)
  assert.match(tableSource, /table-class="requirements-table"/)
  assert.match(tableSource, /min-width="1080px"/)
  assert.doesNotMatch(tableSource, /<section class="requirements-table-panel">\s*<table class="requirements-table">/)
  assert.match(tableSource, /<th v-if="materialBatchMode">选择<\/th>/)
  assert.match(tableSource, /<td v-if="materialBatchMode">/)
  assert.match(tableSource, /v-for="row in rows"/)
  assert.match(tableSource, /currentSelectedMaterialIds\.includes\(row\.id\)/)
  assert.match(tableSource, /emit\('toggle-material-selection', row\.id\)/)
  assert.match(tableSource, /emit\('open-material-detail', row\.raw\)/)
  assert.match(tableSource, /emit\('open-requirement-knowledge-deposit', row\.raw\)/)
  assert.match(tableSource, /emit\('delete-requirement-document', row\.raw\)/)

  assert.doesNotMatch(componentSource, /class="requirements-board"/)
  assert.doesNotMatch(componentSource, /requirements-persona-dock/)
  assert.doesNotMatch(componentSource, /requirementPersonaItems/)
})
