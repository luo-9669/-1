<template>
  <!-- class="projects-page" class="projects-page__content" -->
  <PageShell name="projects">
    <section class="view-panel projects-view">
      <section v-if="!selectedProjectDetail" class="materials-toolbar">
        <div>
          <h3>项目</h3>
          <p>创建和切换项目，项目内资料、流程、资产和 Skill 会按当前项目隔离。</p>
        </div>
        <BaseButton variant="primary" type="button" @click="$emit('create-project')">新建项目</BaseButton>
      </section>
      <section v-if="!selectedProjectDetail" class="project-grid">
        <button
          v-for="project in projectDisplayList"
          :key="project.id"
          type="button"
          class="project-card"
          :class="{ active: project.id === currentProjectId }"
          @click="$emit('open-project-detail', project.id)"
        >
          <strong>{{ displayProjectName(project) }}</strong>
          <span>{{ project.domain || '未设置领域' }}</span>
          <p>{{ project.description || '暂无项目说明' }}</p>
        </button>
      </section>
      <section v-else class="project-detail-view">
        <div class="materials-toolbar">
          <div>
            <h3>{{ displayProjectName(selectedProjectDetail) }}</h3>
            <p>{{ selectedProjectDetail.domain || '未设置领域' }}</p>
          </div>
          <div class="actions">
            <BaseButton type="button" @click="$emit('close-project-detail')">返回列表</BaseButton>
            <BaseButton type="button" :disabled="!selectedProjectBlueprintAsset && !selectedProjectPreviewUrl" @click="$emit('open-selected-project-demo')">打开代码/网页预览</BaseButton>
            <BaseButton variant="primary" type="button" @click="$emit('select-project', selectedProjectDetail.id)">设为当前项目</BaseButton>
          </div>
        </div>
        <section class="panel project-detail-panel">
          <div>
            <strong>项目说明</strong>
            <p>{{ selectedProjectDetail.description || '暂无项目说明' }}</p>
          </div>
          <div>
            <strong>目标用户</strong>
            <p>{{ selectedProjectDetail.targetUsers || '未设置目标用户' }}</p>
          </div>
          <div>
            <strong>创建时间</strong>
            <p>{{ selectedProjectDetail.createdAt ? new Date(selectedProjectDetail.createdAt).toLocaleString() : '暂无' }}</p>
          </div>
        </section>
        <section class="project-stat-grid">
          <div v-for="item in selectedProjectStats" :key="item.label">
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </div>
        </section>
        <section v-if="selectedProjectBlueprintAsset?.blueprint" class="panel project-blueprint-summary">
          <div class="panel-head">
            <div>
              <h3>项目蓝图概览</h3>
              <p>{{ selectedProjectBlueprintAsset.blueprint.profile.positioning }}</p>
            </div>
            <BaseButton type="button" @click="$emit('open-selected-project-demo')">打开 Demo</BaseButton>
          </div>
          <div class="blueprint-profile-grid">
            <div>
              <span>目标人群</span>
              <strong>{{ selectedProjectBlueprintAsset.blueprint.profile.targetUsers }}</strong>
            </div>
            <div>
              <span>核心目标</span>
              <strong>{{ selectedProjectBlueprintAsset.blueprint.profile.primaryGoal }}</strong>
            </div>
            <div>
              <span>主要场景</span>
              <strong>{{ selectedProjectBlueprintAsset.blueprint.profile.coreScenarios.join(' / ') }}</strong>
            </div>
          </div>
        </section>
      </section>
    </section>
  </PageShell>
</template>

<script setup>
import { BaseButton } from '../../components/base'
import PageShell from '../../components/layout/PageShell.vue'

defineProps({
  projectDisplayList: { type: Array, default: () => [] },
  currentProjectId: { type: String, default: '' },
  selectedProjectDetail: { type: Object, default: null },
  selectedProjectStats: { type: Array, default: () => [] },
  selectedProjectBlueprintAsset: { type: Object, default: null },
  selectedProjectPreviewUrl: { type: String, default: '' },
  displayProjectName: { type: Function, required: true }
})

defineEmits([
  'create-project',
  'open-project-detail',
  'close-project-detail',
  'open-selected-project-demo',
  'select-project'
])
</script>
