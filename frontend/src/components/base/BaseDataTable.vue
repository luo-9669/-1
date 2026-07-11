<template>
  <section class="ui-data-table-panel" :style="panelStyle">
    <table class="ui-data-table" :class="tableClass">
      <slot />
    </table>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  tableClass: { type: [String, Array, Object], default: '' },
  minWidth: { type: String, default: '100%' }
})

const panelStyle = computed(() => ({
  '--ui-data-table-min-width': props.minWidth
}))
</script>

<style scoped>
.ui-data-table-panel {
  overflow: auto;
  border: 1px solid var(--color-n2);
  border-radius: var(--radius-middle);
  background: var(--color-n0);
}

.ui-data-table {
  width: 100%;
  min-width: var(--ui-data-table-min-width);
  border-collapse: collapse;
  table-layout: auto;
  color: var(--color-n6);
  font-size: 14px;
  line-height: 20px;
}

.ui-data-table :deep(th),
.ui-data-table :deep(td) {
  padding: 18px 20px;
  border-bottom: 1px solid var(--color-n2);
  color: var(--color-n6);
  font-size: 14px;
  line-height: 20px;
  text-align: left;
  vertical-align: middle;
}

.ui-data-table :deep(th) {
  background: var(--color-n1);
  color: var(--color-n4);
  font-weight: 700;
}

.ui-data-table :deep(tbody tr:last-child td) {
  border-bottom: 0;
}

.ui-data-table :deep(tbody tr:hover td) {
  background: var(--color-n1);
}
</style>
