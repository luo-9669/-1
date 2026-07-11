<template>
  <!-- class="diagnosis-page" class="diagnosis-page__content" -->
  <PageShell name="diagnosis">
    <section class="view-panel diagnosis-view">
      <section class="panel diagnosis-hero">
        <div class="panel-head">
          <div>
            <h3>项目诊断</h3>
            <p>先输入需求，系统会用默认通用 Skill 判断清晰度、读取当前资料，并推荐下一步流程。</p>
          </div>
          <StatusBadge :status="skillWorkbenchStatus.status" />
        </div>
        <BaseTextarea
          v-model="workbenchForm.input"
          placeholder="例如：现在 Skill 工作台全部堆在一个页面，用户不知道怎么从需求进入完整流程"
        />
        <div class="form-grid">
          <label>
            使用 Skill
            <select v-model="workbenchForm.selectedSkillId">
              <option v-for="skill in availableSkills" :key="skill.id" :value="skill.id">
                {{ skill.source === 'system' ? '系统 · ' : '我的 · ' }}{{ skill.name }}
              </option>
            </select>
          </label>
          <label>
            执行模式
            <select v-model="workbenchForm.mode">
              <option value="diagnose">先诊断</option>
              <option value="execute">直接执行所选 Skill</option>
            </select>
          </label>
        </div>
        <div class="actions">
          <BaseButton variant="primary" type="button" @click="$emit('run-workbench-skill')">执行诊断</BaseButton>
          <BaseButton type="button" @click="$emit('open-skill-center-for-creation')">新建我的 Skill</BaseButton>
        </div>
        <Notice :result="skillWorkbenchStatus" />
      </section>

      <section class="panel">
        <ListHeader title="推荐流程" :count="recommendedWorkflows.length" />
        <div class="recommendation-grid">
          <button
            v-for="workflow in recommendedWorkflows"
            :key="workflow.id"
            class="recommendation-card"
            type="button"
            @click="$emit('start-recommended-workflow', workflow.id)"
          >
            <strong>{{ workflow.name }}</strong>
            <span>{{ workflow.description }}</span>
            <small>开始流程</small>
          </button>
        </div>
      </section>

      <section class="panel">
        <ListHeader title="最近活动" :count="recentActivities.length" />
        <DataList :items="recentActivities" empty="暂无最近活动" />
      </section>
    </section>
  </PageShell>
</template>

<script setup>
import DataList from '../../components/DataList.vue'
import ListHeader from '../../components/ListHeader.vue'
import Notice from '../../components/Notice.vue'
import { BaseButton, BaseTextarea } from '../../components/base'
import PageShell from '../../components/layout/PageShell.vue'
import StatusBadge from '../../components/StatusBadge.vue'

defineProps({
  workbenchForm: { type: Object, required: true },
  availableSkills: { type: Array, default: () => [] },
  skillWorkbenchStatus: { type: Object, required: true },
  recommendedWorkflows: { type: Array, default: () => [] },
  recentActivities: { type: Array, default: () => [] }
})

defineEmits([
  'run-workbench-skill',
  'open-skill-center-for-creation',
  'start-recommended-workflow'
])
</script>
