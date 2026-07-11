<template>
  <button
    class="ui-icon-button"
    :type="type"
    :aria-label="label"
    :disabled="disabled"
    :class="{ 'is-disabled': disabled }"
    v-bind="$attrs"
  >
    <component :is="icon" v-if="icon" class="ui-icon" aria-hidden="true" :stroke-width="2" />
    <slot v-else></slot>
  </button>
</template>

<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  icon: {
    type: [Object, Function],
    default: null
  },
  label: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'button'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})
</script>
