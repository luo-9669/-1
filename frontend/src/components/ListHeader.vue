<template>
  <div class="list-head">
    <h3>{{ title }}</h3>
    <span>{{ count }} 条</span>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  },
  count: {
    type: Number,
    default: 0
  }
})
</script>
