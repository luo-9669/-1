<template>
  <!-- class="settings-page" class="settings-page__content" -->
  <PageShell name="settings">
    <section class="view-panel">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>API 配置</h3>
            <p>这些地址会保存在浏览器本地。未配置时页面显示待接入，不阻断产品流程。</p>
          </div>
        </div>
        <div class="settings-grid">
          <label v-for="item in apiFields" :key="item.key">
            {{ item.label }}
            <BaseInput v-model="apiConfig[item.key]" :placeholder="item.placeholder" />
          </label>
        </div>
        <div class="actions">
          <BaseButton variant="primary" type="button" @click="$emit('persist')">保存配置</BaseButton>
          <BaseButton type="button" @click="$emit('reset-api-config')">恢复本地默认接口</BaseButton>
          <BaseButton type="button" @click="$emit('test-api-config')">测试主服务</BaseButton>
        </div>
        <Notice :result="settingsStatus" />
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>后端模型配置</h3>
            <p>模型 key 只提交给后端保存，前端只显示脱敏状态。</p>
          </div>
          <span>{{ modelSettingsStatus.hasApiKey ? `已保存 ${modelSettingsStatus.apiKeyMasked}` : '未保存 key' }}</span>
        </div>
        <div class="settings-grid">
          <label>
            供应商
            <select v-model="modelSettingsForm.provider">
              <option value="openai-compatible">OpenAI Compatible</option>
              <option value="deterministic">Deterministic</option>
            </select>
          </label>
          <label>
            Base URL
            <BaseInput v-model="modelSettingsForm.baseUrl" placeholder="https://api.openai.com/v1" />
          </label>
          <label>
            默认模型
            <BaseInput v-model="modelSettingsForm.defaultModel" placeholder="gpt-5.5" />
          </label>
          <label>
            API Surface
            <select v-model="modelSettingsForm.apiSurface">
              <option value="responses">responses</option>
              <option value="chat.completions">chat.completions</option>
            </select>
          </label>
          <label>
            API Key
            <BaseInput v-model="modelSettingsForm.apiKey" type="password" placeholder="留空表示保留后端已保存 key" autocomplete="off" />
          </label>
          <label>
            超时 ms
            <BaseInput v-model="modelSettingsForm.timeoutMs" type="number" min="1000" step="1000" />
          </label>
        </div>
        <div class="actions">
          <label class="inline-check">
            <input v-model="modelSettingsForm.enabled" type="checkbox" />
            启用后端模型
          </label>
          <BaseButton type="button" @click="$emit('load-model-settings')">读取后端配置</BaseButton>
          <BaseButton variant="primary" type="button" @click="$emit('save-backend-model-settings')">保存到后端</BaseButton>
          <BaseButton type="button" @click="$emit('test-backend-model-settings')">测试模型</BaseButton>
          <BaseButton type="button" @click="$emit('run-backend-model-sample-analysis')">测试登录注册弹窗</BaseButton>
        </div>
        <div v-if="modelSettingsTestResult" class="validation-box">
          <strong>模型连通：{{ modelSettingsTestResult.status === 'success' ? '通过' : '失败' }}</strong>
          <span>{{ modelSettingsTestResult.provider }} · {{ modelSettingsTestResult.model }}</span>
          <span>Tokens：{{ modelSettingsTestTotalTokens }}</span>
          <span v-if="modelSettingsTestResult.validation && !modelSettingsTestResult.validation.ok">{{ modelSettingsTestResult.validation.error }}</span>
        </div>
        <div v-if="modelSettingsSampleResult" class="validation-box">
          <strong>样例分析：{{ modelSettingsSampleResult.analysis?.displaySkillName || '智能推荐 Skill' }}</strong>
          <span>意图：{{ modelSettingsSampleResult.analysis?.detectedIntent || 'auth-modal' }}</span>
          <span>画布节点：{{ modelSettingsSampleResult.analysis?.canvas?.nodes?.length || 0 }}</span>
          <span>生成状态：{{ modelSettingsSampleResult.analysis?.generation?.status || 'generated' }}</span>
        </div>
      </section>

      <section class="panel model-call-log-panel">
        <div class="panel-head">
          <div>
            <h3>模型调用日志</h3>
            <p>查看最近模型调用、fallback 原因、token 用量和耗时，用于排查输出质量。</p>
          </div>
          <BaseButton type="button" @click="$emit('load-model-call-logs')">刷新日志</BaseButton>
        </div>
        <div class="model-call-log-filters">
          <label>
            状态
            <select v-model="modelCallLogFilters.status" @change="$emit('load-model-call-logs')">
              <option value="">全部状态</option>
              <option value="success">success</option>
              <option value="fallback">fallback</option>
              <option value="error">error</option>
            </select>
          </label>
          <label>
            Skill
            <BaseInput v-model="modelCallLogFilters.skillId" placeholder="auth-page-generation" @keydown.enter="$emit('load-model-call-logs')" />
          </label>
          <label>
            项目
            <BaseInput v-model="modelCallLogFilters.projectId" placeholder="project-id" @keydown.enter="$emit('load-model-call-logs')" />
          </label>
          <label>
            需求范围
            <select v-model="modelCallLogFilters.demandScope" @change="$emit('load-model-call-logs')">
              <option value="">全部范围</option>
              <option value="project">project</option>
              <option value="non-project">non-project</option>
            </select>
          </label>
        </div>
        <div v-if="modelCallLogs.length" class="model-call-log-list">
          <article v-for="log in modelCallLogs" :key="log.id">
            <div>
              <strong>{{ log.skillId || log.resolvedSkillId || 'unknown-skill' }}</strong>
              <span>{{ log.provider || 'provider' }} · {{ log.model || 'model' }} · {{ log.status }}</span>
            </div>
            <div class="model-call-log-metrics">
              <span>tokens {{ log.usage?.totalTokens || 0 }}</span>
              <span>{{ log.durationMs || 0 }}ms</span>
              <span>{{ log.demandScope || 'scope' }}</span>
              <span>{{ log.projectId || 'no-project' }}</span>
              <span>{{ log.detectedIntent || 'intent' }}</span>
              <span>{{ log.createdAt || '暂无时间' }}</span>
            </div>
            <small v-if="log.inputPreview">inputPreview：{{ log.inputPreview }}</small>
            <small v-if="log.routingReason">routingReason：{{ log.routingReason }}</small>
            <small v-if="log.fallbackReason">fallbackReason：{{ log.fallbackReason }}</small>
          </article>
        </div>
        <div v-else class="materials-empty">
          <strong>暂无模型调用日志</strong>
          <p>启用后端模型并执行一次分析后，这里会展示调用状态、token 和 fallback 原因。</p>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h3>Skill 编排策略</h3>
            <p>由后端决定 Skill 的 prompt、输出 Schema、质量检查和兜底 Skill，前端只维护配置。</p>
          </div>
          <span>{{ skillOrchestrationForm.enabled ? '后端编排中' : '未启用' }}</span>
        </div>
        <div class="settings-grid">
          <label>
            Skill ID
            <BaseInput v-model="skillOrchestrationForm.skillId" placeholder="auth-page-generation" />
          </label>
          <label>
            输出 Schema
            <BaseInput v-model="skillOrchestrationForm.outputSchema" placeholder="auth-page" />
          </label>
          <label>
            兜底 Skill
            <BaseInput v-model="skillOrchestrationForm.fallbackSkillId" placeholder="demand-four-step" />
          </label>
          <label class="wide">
            Prompt Template
            <BaseTextarea v-model="skillOrchestrationForm.promptTemplate" placeholder="输入后端用于覆盖该 Skill 的提示词" />
          </label>
          <label class="wide">
            质量检查 qualityChecks
            <BaseTextarea v-model="skillOrchestrationForm.qualityChecksText" placeholder="每行一个质量检查项" />
          </label>
        </div>
        <div class="actions">
          <label class="inline-check">
            <input v-model="skillOrchestrationForm.enabled" type="checkbox" />
            启用后端 Skill 编排
          </label>
          <BaseButton type="button" @click="$emit('load-skill-orchestration-settings')">读取编排配置</BaseButton>
          <BaseButton variant="primary" type="button" @click="$emit('save-backend-skill-orchestration-settings')">保存编排策略</BaseButton>
        </div>
      </section>
    </section>
  </PageShell>
</template>

<script setup>
import PageShell from '../../components/layout/PageShell.vue'
import { BaseButton, BaseInput, BaseTextarea } from '../../components/base'

defineProps({
  apiConfig: { type: Object, required: true },
  apiFields: { type: Array, default: () => [] },
  settingsStatus: { type: Object, required: true },
  modelSettingsForm: { type: Object, required: true },
  modelSettingsStatus: { type: Object, required: true },
  modelSettingsTestResult: { type: Object, default: null },
  modelSettingsTestTotalTokens: { type: Number, default: 0 },
  modelSettingsSampleResult: { type: Object, default: null },
  modelCallLogs: { type: Array, default: () => [] },
  modelCallLogFilters: { type: Object, required: true },
  skillOrchestrationForm: { type: Object, required: true }
})

defineEmits([
  'persist',
  'reset-api-config',
  'test-api-config',
  'load-model-settings',
  'save-backend-model-settings',
  'test-backend-model-settings',
  'run-backend-model-sample-analysis',
  'load-model-call-logs',
  'load-skill-orchestration-settings',
  'save-backend-skill-orchestration-settings'
])
</script>
