<template>
  <div class="ui-progress" role="progressbar" :aria-valuenow="value" aria-valuemin="0" aria-valuemax="100">
    <div class="ui-progress__bar" :style="{ width: `${normalizedValue}%` }"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: Number,
    default: 0
  }
})

const normalizedValue = computed(() => Math.min(100, Math.max(0, props.value)))
</script>
