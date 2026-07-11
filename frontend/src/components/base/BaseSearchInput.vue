<template>
  <label class="ui-search">
    <span class="ui-search__icon">
      <Search class="ui-icon" aria-hidden="true" :stroke-width="2" />
    </span>
    <input
      class="ui-search__input"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      type="search"
      @input="$emit('update:modelValue', $event.target.value)"
      @keydown.enter="$emit('submit')"
    />
    <span class="ui-search__actions">
      <button
        v-if="clearable && modelValue"
        class="ui-icon-button"
        type="button"
        aria-label="清空搜索"
        @click="$emit('update:modelValue', '')"
      >
        <X class="ui-icon" aria-hidden="true" :stroke-width="2" />
      </button>
      <button
        v-if="showUpload"
        class="ui-icon-button"
        type="button"
        aria-label="上传图片"
        @click="$emit('upload')"
      >
        <Camera class="ui-icon" aria-hidden="true" :stroke-width="2" />
      </button>
    </span>
  </label>
</template>

<script setup>
import { Camera, Search, X } from 'lucide-vue-next'

defineEmits(['update:modelValue', 'submit', 'upload'])

defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '搜索'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  clearable: {
    type: Boolean,
    default: true
  },
  showUpload: {
    type: Boolean,
    default: true
  }
})
</script>
