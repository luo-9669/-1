<template>
  <button
    class="ui-button"
    :class="[
      `ui-button--${variant}`,
      {
        'is-loading': loading,
        'is-disabled': disabled || loading
      }
    ]"
    :type="type"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <span v-if="loading" class="ui-button__spinner" aria-hidden="true"></span>
    <slot name="icon"></slot>
    <slot></slot>
    <slot name="suffix"></slot>
  </button>
</template>

<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'primary', 'brand', 'ai', 'text'].includes(value)
  },
  type: {
    type: String,
    default: 'button'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})
</script>
