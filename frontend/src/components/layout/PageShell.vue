<template>
  <section :class="pageClass">
    <div :class="contentClass">
      <slot />
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  name: {
    type: String,
    required: true
  }
})

const pageClass = `${props.name}-page`
const contentClass = `${props.name}-page__content`
</script>
