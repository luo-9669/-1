<template>
  <div v-if="items.length" class="data-list">
    <article v-for="item in items" :key="item.id">
      <div>
        <strong>{{ item.title }}</strong>
        <p>{{ item.meta || item.notes || '' }}</p>
      </div>
      <span>{{ item.status || '已保存' }}</span>
    </article>
  </div>
  <div v-else class="empty">{{ empty }}</div>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => []
  },
  empty: {
    type: String,
    default: ''
  }
})
</script>
