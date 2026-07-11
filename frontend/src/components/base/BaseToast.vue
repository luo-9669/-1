<template>
  <div class="ui-toast" :class="`ui-toast--${type}`" role="status" aria-live="polite">
    <slot>{{ message }}</slot>
  </div>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    default: 'info',
    validator: (value) => ['success', 'warning', 'error', 'info'].includes(value)
  },
  message: {
    type: String,
    default: ''
  }
})
</script>
