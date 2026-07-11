<template>
  <section class="view-panel diagram-workbench-page">
    <header class="diagram-header">
      <div>
        <p class="eyebrow">Diagram Workbench</p>
        <h3>结构图生成工作台</h3>
        <p>后端负责结构化生成和校验，前端负责预览、复制和交付。</p>
      </div>
      <button class="primary" type="button" :disabled="status === 'loading'" @click="submit">
        {{ status === 'loading' ? '生成中...' : '生成结构图' }}
      </button>
    </header>

    <section class="diagram-grid">
      <form class="diagram-panel diagram-form" @submit.prevent="submit">
        <label>
          业务类型
          <select v-model="form.businessType">
            <option value="tea_shop_mini_program">茶饮小程序</option>
            <option value="custom_application">通用业务应用</option>
          </select>
        </label>
        <label>
          生成模式
          <select v-model="form.generationMode">
            <option value="template">稳定模板</option>
            <option value="ai">AI 结构化增强</option>
          </select>
        </label>
        <label>
          需求描述
          <textarea v-model="form.description" rows="10" placeholder="描述页面、流程、弹窗、公共能力和异常状态"></textarea>
        </label>
        <div class="diagram-action-row">
          <button type="button" @click="fillTeaShop">茶饮示例</button>
          <button class="primary" type="submit" :disabled="status === 'loading'">生成</button>
        </div>
        <p v-if="message" class="diagram-message" :data-status="status">{{ message }}</p>
      </form>

      <section class="diagram-panel diagram-ascii-preview">
        <div class="diagram-panel-head">
          <div>
            <span>ASCII 结构层</span>
            <strong>聊天 / 草稿复制 · 纯文本结构</strong>
          </div>
          <button type="button" :disabled="!result" @click="copyText(result?.ascii?.structure || '')">复制</button>
        </div>
        <pre>{{ result?.ascii?.structure || '生成后显示页面树、子页、弹窗、数据来源和接口归属。' }}</pre>
        <div class="diagram-panel-head diagram-panel-head-inline">
          <div>
            <span>模型推荐方案</span>
            <strong>页面类型 / 布局选择 / 推荐原因</strong>
          </div>
          <button type="button" :disabled="!result" @click="copyText(result?.ascii?.layoutDecisions || '')">复制</button>
        </div>
        <pre>{{ result?.ascii?.layoutDecisions || '生成后显示模型推荐布局：瀑布流、卡片流、信息流、左右分栏、表单流或结算流，并说明推荐原因。' }}</pre>
        <div class="diagram-panel-head diagram-panel-head-inline">
          <div>
            <span>ASCII 框架层</span>
            <strong>页面线框图 / 可直接复制到 PRD</strong>
          </div>
          <button type="button" :disabled="!result" @click="copyText(result?.ascii?.frames || '')">复制</button>
        </div>
        <pre>{{ result?.ascii?.frames || '生成后显示纯文本线框：顶部固定导航、scroll-view、底部Tab、左右分栏和弹窗框架。' }}</pre>
      </section>
    </section>

    <section class="diagram-panel diagram-workbench-detail">
      <nav class="diagram-detail-tabs" aria-label="结构图详情">
        <button
          v-for="tab in detailTabs"
          :key="tab.value"
          type="button"
          :class="{ active: activeDetailTab === tab.value }"
          @click="activeDetailTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </nav>

      <section v-if="activeDetailTab === 'overview'" class="diagram-detail-grid">
        <aside class="diagram-page-list">
          <button
            v-for="page in pageOptions"
            :key="page"
            type="button"
            :class="{ active: activePage === page }"
            @click="activePage = page"
          >
            {{ page }}
          </button>
        </aside>
        <div class="diagram-detail-content">
          <h4>{{ activePage || '页面总览' }}</h4>
          <div class="diagram-summary-grid">
            <article>
              <span>页面结构</span>
              <p>子页：{{ joinList(activeTabNode?.children) }}</p>
              <p>弹窗：{{ joinList(activeTabNode?.modals) }}</p>
              <p>公共能力：{{ joinList(result?.data?.structureTree?.globalCapabilities) }}</p>
            </article>
            <article>
              <span>页面状态</span>
              <p>{{ joinList(activeFrame?.states) }}</p>
            </article>
            <article>
              <span>接口数据</span>
              <p>接口数量：{{ activeApiData.length }} 个</p>
              <p>{{ joinList(activeFrame?.apiOwnership) }}</p>
            </article>
            <article>
              <span>数据来源</span>
              <p>{{ joinList(activeFrame?.dataSources) }}</p>
            </article>
          </div>
          <div class="diagram-two-column">
            <article>
              <strong>前端负责</strong>
              <p v-for="item in activeFrame?.frontendTasks || []" :key="item">{{ item }}</p>
            </article>
            <article>
              <strong>后端提供</strong>
              <p v-for="item in activeFrame?.backendTasks || []" :key="item">{{ item }}</p>
            </article>
          </div>
        </div>
      </section>

      <section v-else-if="activeDetailTab === 'decision'" class="diagram-detail-content">
        <h4>{{ activePage }} · 模型推荐方案</h4>
        <div class="diagram-summary-grid">
          <article>
            <span>页面类型</span>
            <p>{{ activeLayoutDecision?.pageType || '暂无' }}</p>
          </article>
          <article>
            <span>推荐布局</span>
            <p>{{ activeLayoutDecision?.layoutType || '暂无' }}</p>
          </article>
          <article>
            <span>推荐原因</span>
            <p>{{ joinList(activeLayoutDecision?.reasons) }}</p>
          </article>
          <article>
            <span>交付说明</span>
            <p>推荐方案会进入 ASCII 框架层，方便复制到 PRD 并交给设计、前端和后端对齐。</p>
          </article>
        </div>
        <div class="diagram-card-list">
          <article v-for="module in activeLayoutDecision?.modules || []" :key="`${activePage}-${module.name}`">
            <strong>{{ module.name }} · {{ module.layout }}</strong>
            <p>卡片结构：{{ module.cardPattern || '暂无' }}</p>
            <p>组件：{{ joinList(module.components) }}</p>
            <p>交互：{{ joinList(module.interactions) }}</p>
          </article>
          <article v-if="!activeLayoutDecision">
            <strong>暂无推荐方案</strong>
            <p>生成后显示页面类型、推荐布局、推荐原因和模块卡片结构。</p>
          </article>
        </div>
      </section>

      <section v-else-if="activeDetailTab === 'layout'" class="diagram-detail-content">
        <h4>{{ activePage }} · 布局细节</h4>
        <div class="diagram-summary-grid">
          <article>
            <span>顶部 Fixed</span>
            <p>{{ joinList(activeFrame?.topFixed) }}</p>
          </article>
          <article>
            <span>Scroll 主体</span>
            <p>{{ joinList(activeFrame?.scrollModules) }}</p>
          </article>
          <article>
            <span>底部 Fixed</span>
            <p>{{ joinList(activeFrame?.bottomFixed) }}</p>
          </article>
          <article>
            <span>顶层浮层</span>
            <p>{{ joinList(activeFrame?.overlays) }}</p>
          </article>
        </div>
        <article v-for="region in activeLayout?.regions || []" :key="region.region" class="diagram-region-card">
          <strong>{{ region.label || region.region }}</strong>
          <p>布局提示：{{ joinList(activeFrame?.layoutHints) }}</p>
          <div class="diagram-slot-grid">
            <span v-for="slot in region.slots || []" :key="`${region.region}-${slot.position}-${slot.name}`">
              <b>{{ slot.position }}</b>
              <em>{{ slot.type }} · {{ slot.name }}</em>
              <small>交互：{{ slot.behavior || '暂无' }}</small>
              <small>状态：{{ slot.state || '默认' }}</small>
              <small>数据依赖：{{ slot.dataDependency || '暂无' }}</small>
              <small>校验：{{ slot.validation || '暂无' }}</small>
              <small>{{ slot.frontendOwner || '前端负责渲染与交互' }}</small>
              <small>{{ slot.backendOwner || '后端负责数据与错误码' }}</small>
            </span>
          </div>
        </article>
      </section>

      <section v-else-if="activeDetailTab === 'visual'" class="diagram-detail-content">
        <h4>{{ activePage }} · 视觉层</h4>
        <div class="diagram-summary-grid">
          <article>
            <span>风格基调</span>
            <p>{{ activeVisual?.styleTone || '暂无' }}</p>
          </article>
          <article>
            <span>视觉层级</span>
            <p>{{ joinList(activeVisual?.hierarchy) }}</p>
          </article>
          <article>
            <span>色彩 Token</span>
            <p>{{ joinList(activeVisual?.colorTokens) }}</p>
          </article>
          <article>
            <span>字体层级</span>
            <p>{{ joinList(activeVisual?.typography) }}</p>
          </article>
        </div>
        <div class="diagram-two-column">
          <article>
            <strong>视觉规范</strong>
            <p v-for="item in activeVisual?.spacing || []" :key="item">{{ item }}</p>
          </article>
          <article>
            <strong>可访问性/状态表达</strong>
            <p v-for="item in activeVisual?.accessibility || []" :key="item">{{ item }}</p>
          </article>
        </div>
        <div class="diagram-card-list">
          <article v-for="component in activeVisual?.components || []" :key="component.name">
            <strong>{{ component.name }} · {{ component.type }}</strong>
            <p>{{ component.visual }}</p>
            <small>状态样式：{{ joinList(component.stateStyles) }}</small>
            <small>布局位置：{{ component.layoutNote || '按页面框架层对应区域放置' }}</small>
          </article>
        </div>
      </section>

      <section v-else-if="activeDetailTab === 'flows'" class="diagram-detail-content">
        <h4>跳转流程</h4>
        <div class="diagram-card-list">
          <article v-for="flow in result?.data?.flowTransitions || []" :key="`${flow.from}-${flow.to}-${flow.trigger}`">
            <strong>{{ flow.from }} → {{ flow.to }}</strong>
            <p>触发：{{ flow.trigger }}</p>
            <p>前置：{{ flow.precondition }}</p>
            <p>成功：{{ flow.successFeedback }}</p>
            <p>失败：{{ flow.failureFeedback }}</p>
            <p>前端动作：路由跳转、loading、Toast、页面数据刷新。</p>
            <p>后端动作：校验权限/库存/状态，返回业务错误码。</p>
          </article>
        </div>
      </section>

      <section v-else-if="activeDetailTab === 'interactions'" class="diagram-detail-content">
        <h4>{{ activePage }} · 交互说明</h4>
        <div class="diagram-card-list">
          <article v-for="item in activeInteractions" :key="`${item.trigger}-${item.rule}`">
            <strong>{{ item.trigger }}</strong>
            <p>规则：{{ item.rule }}</p>
            <p>反馈：{{ item.feedback }}</p>
            <p>影响组件：{{ joinList(item.affectedComponents) }}</p>
            <p>相关接口：{{ item.relatedApi || '暂无' }}</p>
            <p>异常处理：{{ joinList(item.edgeCases) }}</p>
          </article>
        </div>
      </section>

      <section v-else-if="activeDetailTab === 'apiData'" class="diagram-detail-grid">
        <aside class="diagram-page-list">
          <button
            v-for="item in activeApiData"
            :key="`${item.method}-${item.endpoint}`"
            type="button"
            :class="{ active: selectedApiKey === apiKey(item) }"
            @click="selectedApiKey = apiKey(item)"
          >
            {{ item.method }} {{ item.endpoint }}
          </button>
        </aside>
        <div class="diagram-detail-content">
          <h4>接口数据</h4>
          <div class="diagram-card-list compact">
            <article v-for="item in activeApiData" :key="`summary-${item.method}-${item.endpoint}`">
              <strong>{{ item.method }} {{ item.endpoint }}</strong>
              <p>{{ item.sourceName }} · {{ item.frontendUsage || joinList(item.usedBy) }}</p>
              <small>后端：{{ item.backendLogic || '提供字段、权限和错误码' }}</small>
            </article>
          </div>
          <template v-if="selectedApi">
            <p>接口名称：{{ selectedApi.sourceName }}</p>
            <p>归属：{{ selectedApi.owner }}</p>
            <p>页面：{{ selectedApi.page }}</p>
            <p>使用位置：{{ selectedApi.usedBy?.join(' / ') || '暂无' }}</p>
            <p>字段：{{ selectedApi.fields?.join(' / ') || '暂无' }}</p>
            <div class="diagram-two-column">
              <article>
                <strong>请求参数</strong>
                <p v-for="item in selectedApi.requestParams || []" :key="item">{{ item }}</p>
              </article>
              <article>
                <strong>响应字段</strong>
                <p v-for="item in selectedApi.responseFields || []" :key="item">{{ item }}</p>
              </article>
            </div>
            <div class="diagram-two-column">
              <article>
                <strong>错误码/异常处理</strong>
                <p v-for="item in selectedApi.errorCodes || []" :key="item">{{ item }}</p>
              </article>
              <article>
                <strong>缓存与降级</strong>
                <p>{{ selectedApi.cachePolicy || '暂无' }}</p>
                <p>{{ selectedApi.fallback }}</p>
              </article>
            </div>
            <p>前端使用：{{ selectedApi.frontendUsage || joinList(selectedApi.usedBy) }}</p>
            <p>后端逻辑：{{ selectedApi.backendLogic || '暂无' }}</p>
            <p>失败降级：{{ selectedApi.fallback }}</p>
          </template>
          <p v-else>生成后点击左侧接口查看字段、归属和降级策略。</p>
        </div>
      </section>

      <section v-else class="diagram-output-grid">
        <section class="diagram-panel nested">
          <div class="diagram-panel-head">
            <div><span>标准 JSON</span><strong>{{ result?.data?.projectName || '待生成' }} · {{ sourceLabel }}</strong></div>
            <button type="button" :disabled="!result" @click="copyText(jsonOutput)">复制</button>
          </div>
          <pre>{{ jsonOutput }}</pre>
        </section>
        <section class="diagram-panel nested">
          <div class="diagram-panel-head">
            <div><span>ASCII 框架层</span><strong>纯文本线框</strong></div>
            <button type="button" :disabled="!result" @click="copyText(result?.ascii?.frames || '')">复制</button>
          </div>
          <pre>{{ result?.ascii?.frames || '生成后显示顶部固定导航、滚动容器、底部Tab、左右分栏和弹窗附加框架。' }}</pre>
        </section>
        <section class="diagram-panel nested">
          <div class="diagram-panel-head">
            <div><span>Mermaid 结构层</span><strong>PRD / 飞书 / PPT</strong></div>
            <button type="button" :disabled="!result" @click="copyText(result?.mermaid?.structure || '')">复制</button>
          </div>
          <pre>{{ result?.mermaid?.structure || 'graph TD' }}</pre>
        </section>
        <section class="diagram-panel nested">
          <div class="diagram-panel-head">
            <div><span>Mermaid 框架层</span><strong>正式图表源码</strong></div>
            <button type="button" :disabled="!result" @click="copyText(result?.mermaid?.frames || '')">复制</button>
          </div>
          <pre>{{ result?.mermaid?.frames || 'graph TD' }}</pre>
        </section>
      </section>
    </section>

    <section class="diagram-review-grid">
      <section class="diagram-panel">
        <div class="diagram-panel-head">
          <div>
            <span>质量检查</span>
            <strong>{{ result?.warnings?.length || 0 }} 条</strong>
          </div>
        </div>
        <ul class="diagram-list">
          <li v-for="warning in result?.warnings || []" :key="`${warning.page}-${warning.message}`">
            <b>{{ warning.severity }}</b>
            <span>{{ warning.page }}：{{ warning.message }}</span>
          </li>
          <li v-if="!result">生成后显示结构完整性、异常状态和页面分层检查。</li>
        </ul>
      </section>

      <section class="diagram-panel">
        <div class="diagram-panel-head">
          <div>
            <span>前后端分工</span>
            <strong>交付边界</strong>
          </div>
        </div>
        <div class="handoff-grid">
          <article v-for="(items, role) in result?.handoff || defaultHandoff" :key="role">
            <strong>{{ handoffLabel(role) }}</strong>
            <p v-for="item in items" :key="item">{{ item }}</p>
          </article>
        </div>
      </section>
    </section>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { generateDiagram } from '../../services/diagrams'

const props = defineProps({
  apiConfig: {
    type: Object,
    default: () => ({})
  }
})

const form = reactive({
  businessType: 'tea_shop_mini_program',
  generationMode: 'template',
  description: '做一个茶饮点单小程序：首页、点餐、购物车、订单、我的，支持门店选择、规格选择、购物车、优惠券、支付、取餐码和退款。'
})
const status = ref('idle')
const message = ref('')
const result = ref(null)
const activeDetailTab = ref('overview')
const activePage = ref('首页')
const selectedApiKey = ref('')
const defaultHandoff = {
  product: ['提供页面范围、主流程、异常状态和验收标准'],
  frontend: ['负责展示、预览、复制、导出和节点编辑'],
  backend: ['负责结构化生成、JSON Schema、模板和质量检查']
}

const jsonOutput = computed(() => result.value ? JSON.stringify(result.value.data, null, 2) : '{\n  "projectName": "待生成"\n}')
const detailTabs = [
  { value: 'overview', label: '页面总览' },
  { value: 'decision', label: '推荐方案' },
  { value: 'layout', label: '布局细节' },
  { value: 'visual', label: '视觉层' },
  { value: 'flows', label: '跳转流程' },
  { value: 'interactions', label: '交互说明' },
  { value: 'apiData', label: '接口数据' },
  { value: 'source', label: '源码输出' }
]
const sourceLabel = computed(() => {
  const labels = {
    template: '模板生成',
    provider: 'AI生成',
    fallback: 'AI回退模板'
  }
  return labels[result.value?.meta?.source] || '未生成'
})
const pageOptions = computed(() =>
  result.value?.data?.pageFrames?.map((frame) => frame.page).filter(Boolean) || []
)
const activeTabNode = computed(() =>
  result.value?.data?.structureTree?.tabs?.find((tab) => tab.name === activePage.value) || null
)
const activeFrame = computed(() =>
  result.value?.data?.pageFrames?.find((frame) => frame.page === activePage.value) || null
)
const activeLayout = computed(() =>
  result.value?.data?.layoutBlueprints?.find((item) => item.page === activePage.value) || null
)
const activeLayoutDecision = computed(() =>
  result.value?.data?.layoutDecisions?.find((item) => item.page === activePage.value) || null
)
const activeVisual = computed(() =>
  result.value?.data?.visualSpecs?.find((item) => item.page === activePage.value) || null
)
const activeApiData = computed(() =>
  (result.value?.data?.apiData || []).filter((item) => item.page === activePage.value)
)
const activeInteractionSpec = computed(() =>
  result.value?.data?.interactionSpecs?.find((item) => item.page === activePage.value) || null
)
const activeInteractions = computed(() => activeInteractionSpec.value?.interactions || [])
const selectedApi = computed(() =>
  activeApiData.value.find((item) => apiKey(item) === selectedApiKey.value) || activeApiData.value[0] || null
)

function fillTeaShop() {
  form.businessType = 'tea_shop_mini_program'
  form.generationMode = 'template'
  form.description = '做一个茶饮点单小程序：首页、点餐、购物车、订单、我的，支持门店选择、搜索、自提外卖切换、规格选择、优惠券、支付、取餐码、退款和会员积分。'
}

function handoffLabel(role) {
  const labels = {
    product: '产品',
    ui: 'UI/交互',
    frontend: '前端',
    backend: '后端',
    testing: '测试'
  }
  return labels[role] || role
}

function apiKey(item = {}) {
  return `${item.method || 'GET'} ${item.endpoint || ''}`
}

function joinList(items = []) {
  const list = Array.isArray(items) ? items : [items]
  return list.filter(Boolean).join(' / ') || '暂无'
}

async function copyText(text = '') {
  if (!text) return
  await navigator.clipboard?.writeText(text)
  message.value = '已复制到剪贴板'
  status.value = 'success'
}

async function submit() {
  status.value = 'loading'
  message.value = '正在生成结构化数据、ASCII 和 Mermaid...'
  const response = await generateDiagram({
    apiConfig: props.apiConfig,
    payload: {
      businessType: form.businessType,
      generationMode: form.generationMode,
      description: form.description
    }
  })
  if (!response.ok) {
    status.value = 'failed'
    message.value = response.message || '生成失败'
    return
  }
  result.value = response.data
  activePage.value = response.data?.data?.pageFrames?.[0]?.page || '首页'
  selectedApiKey.value = ''
  status.value = 'success'
  message.value = '生成完成，可复制 JSON、ASCII 或 Mermaid。'
}
</script>
