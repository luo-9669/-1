<template>
  <Teleport to="body">
    <div v-if="modelValue" class="ui-modal" role="presentation" @click.self="close">
      <section class="ui-modal__panel" role="dialog" aria-modal="true" :aria-label="title">
        <header class="ui-modal__header">
          <h3>{{ title }}</h3>
          <button class="ui-icon-button" type="button" aria-label="关闭弹窗" @click="close">
            <X class="ui-icon" aria-hidden="true" :stroke-width="2" />
          </button>
        </header>
        <div class="ui-modal__body">
          <slot></slot>
        </div>
        <footer v-if="$slots.footer" class="ui-modal__footer">
          <slot name="footer"></slot>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { X } from 'lucide-vue-next'

const emit = defineEmits(['update:modelValue', 'close'])

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '弹窗'
  },
  closeOnEscape: {
    type: Boolean,
    default: true
  }
})

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onKeydown(event) {
  if (props.closeOnEscape && event.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
