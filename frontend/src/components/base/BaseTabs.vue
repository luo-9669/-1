<template>
  <div class="ui-tabs" role="tablist" :aria-label="label">
    <button
      v-for="item in items"
      :key="item.value"
      class="ui-tab"
      :class="{ 'is-active': item.value === modelValue }"
      type="button"
      role="tab"
      :aria-selected="item.value === modelValue"
      :disabled="item.disabled"
      @click="selectItem(item)"
      @keydown.left.prevent="focusSibling(item.value, -1)"
      @keydown.right.prevent="focusSibling(item.value, 1)"
    >
      <template v-if="item.description">
        <strong>{{ item.label }}</strong>
        <span>{{ item.description }}</span>
      </template>
      <template v-else>
        {{ item.label }}
      </template>
    </button>
  </div>
</template>

<script setup>
const emit = defineEmits(['update:modelValue', 'change'])

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  items: {
    type: Array,
    default: () => []
  },
  label: {
    type: String,
    default: '标签页'
  }
})

function selectItem(item) {
  if (item.disabled) return
  emit('update:modelValue', item.value)
  emit('change', item.value)
}

function focusSibling(value, direction) {
  const enabledItems = props.items.filter((item) => !item.disabled)
  const currentIndex = enabledItems.findIndex((item) => item.value === value)
  if (currentIndex < 0) return
  const nextIndex = (currentIndex + direction + enabledItems.length) % enabledItems.length
  selectItem(enabledItems[nextIndex])
}
</script>
