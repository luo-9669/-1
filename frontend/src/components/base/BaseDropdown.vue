<template>
  <div class="ui-dropdown" @click.stop>
    <button
      class="ui-button"
      :class="buttonClass"
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :disabled="disabled"
      v-bind="$attrs"
      @click="toggle"
      @keydown.escape="close"
    >
      <slot v-if="$slots.trigger" name="trigger" />
      <span v-else class="ui-dropdown__label">{{ label }}</span>
      <ChevronDown class="ui-icon" aria-hidden="true" :stroke-width="2" />
    </button>
    <div v-if="isOpen" class="ui-dropdown__menu" :class="menuClass" role="listbox">
      <button
        v-for="item in items"
        :key="item.value"
        class="ui-dropdown__item"
        type="button"
        role="option"
        :aria-selected="item.value === modelValue"
        :disabled="disabled || item.disabled"
        @click="selectItem(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

defineOptions({ inheritAttrs: false })

const emit = defineEmits(['update:modelValue', 'update:open', 'change', 'toggle', 'close'])

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  open: {
    type: Boolean,
    default: undefined
  },
  label: {
    type: String,
    default: '筛选'
  },
  items: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  },
  buttonClass: {
    type: [String, Array, Object],
    default: ''
  },
  menuClass: {
    type: [String, Array, Object],
    default: ''
  }
})

const open = ref(false)
const isControlled = computed(() => props.open !== undefined)
const isOpen = computed(() => isControlled.value ? props.open : open.value)

function setOpen(nextOpen) {
  if (!isControlled.value) open.value = nextOpen
  emit('update:open', nextOpen)
  if (!nextOpen) emit('close')
}

function toggle() {
  if (props.disabled) return
  const nextOpen = !isOpen.value
  setOpen(nextOpen)
  emit('toggle', nextOpen)
}

function close() {
  if (isOpen.value) setOpen(false)
}

function selectItem(item) {
  if (props.disabled || item.disabled) return
  emit('update:modelValue', item.value)
  emit('change', item.value)
  close()
}

function onWindowClick(event) {
  if (!event.target.closest?.('.ui-dropdown')) close()
}

window.addEventListener('click', onWindowClick)
onBeforeUnmount(() => window.removeEventListener('click', onWindowClick))
</script>
