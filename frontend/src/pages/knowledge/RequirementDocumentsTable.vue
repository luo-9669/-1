<template>
  <BaseDataTable class="requirements-table-panel" table-class="requirements-table" min-width="1080px">
    <thead>
      <tr>
        <th v-if="materialBatchMode">选择</th>
        <th>需求文件</th>
        <th>需求来源</th>
        <th>状态</th>
        <th>知识状态</th>
        <th>上传时间</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in rows"
        :key="row.id"
        :class="{ selected: currentSelectedMaterialIds.includes(row.id) }"
      >
        <td v-if="materialBatchMode">
          <input
            type="checkbox"
            :checked="currentSelectedMaterialIds.includes(row.id)"
            @change="emit('toggle-material-selection', row.id)"
          />
        </td>
        <td>
          <button type="button" class="requirements-file-link" @click="emit('open-material-detail', row.raw)">
            <strong>{{ row.title }}</strong>
            <span>{{ row.meta }}</span>
          </button>
        </td>
        <td><span class="requirements-source-badge">{{ row.sourceLabel }}</span></td>
        <td><span class="requirements-status-pill">{{ row.statusLabel }}</span></td>
        <td>
          <span class="requirements-knowledge-pill" :class="{ done: row.knowledgeStatus === 'converted' }">
            {{ row.knowledgeStatusLabel }}
          </span>
        </td>
        <td>{{ row.uploadedAtLabel }}</td>
        <td>
          <div class="requirements-row-actions">
            <button type="button" @click="emit('open-material-detail', row.raw)">查看</button>
            <button type="button" @click="emit('open-requirement-knowledge-deposit', row.raw)">沉淀到知识库</button>
            <button type="button" class="danger" @click="emit('delete-requirement-document', row.raw)">删除</button>
          </div>
        </td>
      </tr>
    </tbody>
  </BaseDataTable>
</template>

<script setup>
import { BaseDataTable } from '../../components/base'

defineProps({
  rows: { type: Array, default: () => [] },
  materialBatchMode: { type: Boolean, default: false },
  currentSelectedMaterialIds: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'toggle-material-selection',
  'open-material-detail',
  'open-requirement-knowledge-deposit',
  'delete-requirement-document'
])
</script>
