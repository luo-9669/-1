<template>
  <section v-if="materialsTab === 'requirements'" class="requirements-workspace">
    <div class="module-command-bar">
      <div class="module-command-tabs requirements-source-tabs">
        <BaseSecondaryTabs
          :model-value="requirementSourceTab"
          :items="requirementSourceTabItems"
          label="需求来源"
          @change="$emit('update-requirement-source-tab', $event)"
        />
      </div>
      <div class="module-command-actions materials-toolbar-actions">
        <input
          ref="requirementFileInput"
          class="hidden-file-input"
          type="file"
          multiple
          accept=".pdf,.docx,.md,.txt,.xlsx,.csv,.json"
          @change="handleRequirementFileChange"
        />
        <BaseButton type="button" @click="$emit('toggle-material-batch-mode')">
          {{ materialBatchMode ? '退出管理' : '批量管理' }}
        </BaseButton>
        <BaseButton variant="primary" type="button" @click="triggerRequirementFileUpload">上传需求文件</BaseButton>
      </div>
    </div>
    <RequirementDocumentsTable
      v-if="filteredRequirementDocumentRows.length"
      :rows="filteredRequirementDocumentRows"
      :material-batch-mode="materialBatchMode"
      :current-selected-material-ids="currentSelectedMaterialIds"
      @toggle-material-selection="$emit('toggle-material-selection', $event)"
      @open-material-detail="$emit('open-material-detail', $event)"
      @open-requirement-knowledge-deposit="$emit('open-requirement-knowledge-deposit', $event)"
      @delete-requirement-document="$emit('delete-requirement-document', $event)"
    />
    <section v-else class="panel materials-empty">
      <h3>{{ currentMaterialMeta.title }}</h3>
      <p>{{ currentMaterialMeta.empty }}</p>
      <BaseButton variant="primary" type="button" @click="triggerRequirementFileUpload">上传需求文件</BaseButton>
    </section>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { BaseButton, BaseSecondaryTabs } from '../../components/base'
import RequirementDocumentsTable from './RequirementDocumentsTable.vue'

const props = defineProps({
  materialsTab: { type: String, default: 'requirements' },
  materialBatchMode: { type: Boolean, default: false },
  requirementSourceTabs: { type: Array, default: () => [] },
  requirementSourceTab: { type: String, default: '' },
  filteredRequirementDocumentRows: { type: Array, default: () => [] },
  currentSelectedMaterialIds: { type: Array, default: () => [] },
  currentMaterialMeta: { type: Object, required: true }
})

const emit = defineEmits([
  'import-material-files',
  'toggle-material-batch-mode',
  'open-material-create',
  'update-requirement-source-tab',
  'toggle-material-selection',
  'open-material-detail',
  'open-requirement-knowledge-deposit',
  'delete-requirement-document'
])

const requirementFileInput = ref(null)
const requirementSourceTabItems = computed(() => props.requirementSourceTabs.map((tab) => ({
  value: tab.key,
  label: tab.label,
  disabled: tab.disabled
})))

function triggerRequirementFileUpload() {
  requirementFileInput.value?.click()
}

function handleRequirementFileChange(event) {
  emit('import-material-files', event)
}
</script>
