<template>
  <button
    class="ui-capsule-select"
    type="button"
    v-bind="$attrs"
  >
    <span v-if="label" class="ui-capsule-select__label">{{ label }}</span>
    <strong class="ui-capsule-select__value">{{ value }}</strong>
    <ChevronDown class="ui-icon ui-capsule-select__icon" aria-hidden="true" :stroke-width="2" />
  </button>
</template>

<script setup>
import { ChevronDown } from 'lucide-vue-next'

defineOptions({ inheritAttrs: false })

defineProps({
  label: {
    type: String,
    default: ''
  },
  value: {
    type: String,
    default: ''
  }
})
</script>
