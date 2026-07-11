<template>
  <span class="badge" :class="status">{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: String,
    default: 'idle'
  }
})

const labels = {
  idle: '未开始',
  loading: '请求中',
  success: '成功',
  failed: '失败',
  unconfigured: '需补充'
}

const label = computed(() => labels[props.status] || props.status)
</script>
