<template>
  <section class="view-panel design-system-page">
    <div class="materials-toolbar">
      <div>
        <h3>设计系统</h3>
        <p>基础组件用于新页面搭建，业务页面逐步迁移时优先复用这里的控件。</p>
      </div>
      <BaseSearchInput v-model="query" placeholder="搜索组件" />
    </div>

    <BaseTabs v-model="activeTab" :items="tabItems" />
    <BaseSegmentedTabs v-model="mode" :items="modeItems" label="展示模式" />

    <section class="panel">
      <div class="actions">
        <BaseButton variant="primary">黑色主按钮</BaseButton>
        <BaseButton variant="brand">品牌辅助按钮</BaseButton>
        <BaseIconButton label="刷新">
          <RefreshCw class="ui-icon" aria-hidden="true" />
        </BaseIconButton>
      </div>
      <BaseDropdown v-model="selectedOption" label="组件状态" :items="dropdownItems" />
      <div class="settings-grid">
        <label>
          基础输入
          <BaseInput v-model="inputValue" placeholder="输入内容" />
        </label>
        <label class="wide">
          多行输入
          <BaseTextarea v-model="textareaValue" placeholder="输入多行内容" />
        </label>
      </div>
      <BaseProgress :value="64" />
      <BaseToast type="success" message="组件库状态正常" />
      <BaseModal v-model="showModal" title="基础弹窗">
        <p>弹窗、下拉、提示、进度条都来自 components/base。</p>
      </BaseModal>
    </section>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import {
  BaseButton,
  BaseDropdown,
  BaseIconButton,
  BaseInput,
  BaseModal,
  BaseProgress,
  BaseSearchInput,
  BaseSegmentedTabs,
  BaseTabs,
  BaseTextarea,
  BaseToast
} from '../../components/base'

const query = ref('')
const activeTab = ref('components')
const mode = ref('basic')
const selectedOption = ref('ready')
const showModal = ref(false)
const inputValue = ref('')
const textareaValue = ref('')
const tabItems = [
  { value: 'components', label: '组件' },
  { value: 'tokens', label: 'Token' }
]
const modeItems = [
  { value: 'basic', label: '基础' },
  { value: 'advanced', label: '进阶' }
]
const dropdownItems = [
  { value: 'ready', label: '可用' },
  { value: 'migrating', label: '迁移中' }
]
</script>
