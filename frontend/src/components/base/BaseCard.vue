<template>
  <section class="ui-card" :class="{ 'is-hoverable': hoverable, 'is-selected': selected }">
    <slot></slot>
  </section>
</template>

<script setup>
defineProps({
  hoverable: {
    type: Boolean,
    default: false
  },
  selected: {
    type: Boolean,
    default: false
  }
})
</script>
