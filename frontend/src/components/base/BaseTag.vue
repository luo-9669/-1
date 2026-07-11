<template>
  <span class="ui-tag" :class="`ui-tag--${variant}`">
    <slot></slot>
  </span>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'brand', 'ai', 'success', 'warning', 'error', 'info'].includes(value)
  }
})
</script>
