<template>
  <div v-if="message && status !== 'idle'" class="notice" :class="[status, { floating }]">
    <span>{{ message }}</span>
    <button v-if="status === 'failed'" type="button" aria-label="关闭提示" @click="$emit('close')">关闭</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  result: {
    type: Object,
    default: () => ({})
  },
  floating: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const source = computed(() => props.result?.value || props.result || {})
const status = computed(() => source.value.status || 'idle')
const message = computed(() => source.value.message || '')
</script>
