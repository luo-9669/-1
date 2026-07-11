<template>
  <WorkflowCanvasPage v-bind="$attrs" :total-flow="totalFlow">
    <template #agent-workbench="slotProps">
      <slot name="agent-workbench" v-bind="slotProps" />
    </template>
  </WorkflowCanvasPage>
</template>

<script setup>
import { WorkflowCanvasPage } from '../../features/workflow'

defineProps({
  totalFlow: { type: Object, default: null }
})

// Total-flow render anchors live in the feature component:
// class="workflow-total-slice-rail"
// shouldShowRequirementSlices
// requirementSlices
// class="workflow-page-node-nav"
// pageNodesForActiveSlice
// focus-node
</script>
