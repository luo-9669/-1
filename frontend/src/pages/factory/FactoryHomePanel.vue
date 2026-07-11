<template>
  <section v-if="isFactoryHome" class="view-panel factory-view">
    <div v-if="showGeneratedPageFullPreview" class="preview-modal" role="dialog" aria-modal="true" aria-label="1:1 页面预览">
      <header>
        <div>
          <strong>1:1 页面预览</strong>
          <span>来自网页工厂生成结果</span>
        </div>
        <BaseButton type="button" @click="$emit('close-generated-page-full-preview')">关闭</BaseButton>
      </header>
      <iframe title="1:1 页面预览" :srcdoc="generatedPageHtml"></iframe>
    </div>

    <div v-if="showBlueprintDemoFullPreview" class="preview-modal" role="dialog" aria-modal="true" aria-label="蓝图 Demo 预览">
      <header>
        <div>
          <strong>1:1 Demo 预览</strong>
          <span>来自项目蓝图生成结果</span>
        </div>
        <BaseButton type="button" @click="$emit('close-blueprint-demo-full-preview')">关闭</BaseButton>
      </header>
      <iframe title="蓝图 Demo 预览" :srcdoc="blueprintDemoHtml"></iframe>
    </div>

    <section class="capture-entry-panel">
      <div class="agent-copy">
        <h3>{{ factoryHeroCopy.titleBefore }}<span>{{ factoryHeroCopy.highlight }}</span>{{ factoryHeroCopy.titleAfter }}</h3>
        <p>{{ factoryHeroCopy.subtitle }}</p>
      </div>

      <div class="tabbar">
        <BaseSegmentedTabs
          :model-value="factoryHomeTab"
          :items="factoryHomeTabItems"
          label="网页工厂创作模式"
          @change="$emit('update-factory-home-tab', $event)"
        />
      </div>

      <div v-if="factoryHomeTab === 'image-code'" class="agent-composer image-code-composer image-restore-composer">
        <div class="image-restore-dropzone">
          <label class="image-prompt-upload image-restore-upload-tile" aria-label="上传设计图">
            <img v-if="imageCodeForm.imageDataUrl" :src="imageCodeForm.imageDataUrl" alt="上传的设计图" />
            <span v-else>＋</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" @change="$emit('handle-image-code-file', $event)" />
          </label>
          <BaseTextarea v-model="imageCodeForm.prompt" placeholder="上传截图、设计稿或参考图，系统会先识别页面布局、视觉层级和组件结构，再生成静态 HTML。" />
        </div>
        <div class="image-restore-footer">
          <div class="composer-chip-menu">
            <button
              class="composer-chip-trigger"
              type="button"
              aria-haspopup="listbox"
              :aria-expanded="showImageTargetMenu"
              @click="$emit('toggle-image-target-menu')"
            >
              {{ imageCodeTargetLabel }}
              <span>⌄</span>
            </button>
            <div v-if="showImageTargetMenu" class="composer-floating-menu" role="listbox" aria-label="生成目标">
              <button
                v-for="option in imageCodeTargetOptions"
                :key="option.value"
                type="button"
                role="option"
                :aria-selected="imageCodeForm.target === option.value"
                :class="{ active: imageCodeForm.target === option.value }"
                @click="$emit('select-image-code-target', option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <div class="image-restore-actions">
            <BaseButton variant="primary" type="button" :disabled="imageCodeStatus.status === 'loading' || !imageCodeForm.imageDataUrl" @click="$emit('generate-from-image')">
              <span v-if="imageCodeStatus.status === 'loading'" class="button-spinner"></span>
              {{ imageCodeStatus.status === 'loading' ? '生成中' : '生成页面代码' }}
            </BaseButton>
          </div>
        </div>
      </div>

      <div v-if="factoryHomeTab === 'style-transfer'" class="agent-composer style-transfer-composer">
        <BaseTextarea v-model="styleForm.notes" placeholder="描述想转换成什么风格，例如更像 Notion、Linear、Apple 官网，或保留布局只换视觉语言。" />
        <select class="composer-chip-select" v-model="styleForm.stylePreset" aria-label="风格预设">
          <option value="clean">清爽工具型</option>
          <option value="editorial">内容编辑型</option>
          <option value="commerce">商业转化型</option>
          <option value="dark">暗色沉浸型</option>
        </select>
        <div class="composer-actions">
          <BaseButton variant="primary" type="button" :disabled="styleStatus.status === 'loading'" @click="$emit('transform-style')">
            <span v-if="styleStatus.status === 'loading'" class="button-spinner"></span>
            {{ styleStatus.status === 'loading' ? '转换中' : '执行风格转换' }}
          </BaseButton>
        </div>
      </div>

      <div v-if="factoryHomeTab === 'url-code'" class="agent-composer">
        <BaseTextarea v-model="captureForm.url" placeholder="粘贴网页地址，例如 https://example.com/creation" @keydown.enter.exact.prevent="$emit('start-capture', $event)" />
        <select class="composer-chip-select" v-model="captureForm.scope" aria-label="采集范围">
          <option value="single">单页面</option>
          <option value="site">整站入口</option>
        </select>
        <div class="composer-chip-menu capture-method-menu">
          <button
            class="composer-chip-trigger"
            type="button"
            aria-haspopup="listbox"
            :aria-expanded="showCaptureMethodMenu"
            @click="$emit('toggle-capture-method-menu')"
          >
            {{ captureMethodLabel }}
            <span>⌄</span>
          </button>
          <div v-if="showCaptureMethodMenu" class="composer-floating-menu" role="listbox" aria-label="采集方式">
            <button
              v-for="option in captureMethodOptions"
              :key="option.id"
              type="button"
              role="option"
              :aria-selected="selectedCaptureRecoveryFlowId === option.id"
              :class="{ active: selectedCaptureRecoveryFlowId === option.id }"
              @click="$emit('select-capture-method', option.id)"
            >
              {{ option.shortLabel }}
            </button>
          </div>
        </div>
        <div class="composer-actions">
          <a
            class="primary action-link"
            :class="{ disabled: captureAction.disabled }"
            :href="captureDetailHref"
            target="_blank"
            rel="noopener noreferrer"
            :aria-disabled="captureAction.disabled"
            @click="$emit('start-capture', $event)"
          >
            <span v-if="captureAction.loading" class="button-spinner"></span>
            {{ captureAction.loading ? '采集中' : '采集网页' }}
          </a>
        </div>
        <section v-if="selectedCaptureRecoveryFlowId === 'remote-browser'" class="capture-browser-auth-panel" aria-label="授权浏览器手动登录">
          <div>
            <strong>授权浏览器</strong>
            <span>打开隔离浏览器后，请在下方预览里自行完成登录、验证码或扫码，再开始采集。</span>
          </div>
          <BaseButton type="button" :disabled="browserSessionStatus.status === 'loading'" @click="$emit('open-manual-browser-authorization')">
            <span v-if="browserSessionStatus.status === 'loading'" class="button-spinner"></span>
            {{ captureForm.sessionId ? '重新打开授权浏览器' : '打开授权浏览器' }}
          </BaseButton>
          <BaseButton variant="primary" type="button" :disabled="captureAction.loading || !captureForm.sessionId" @click="$emit('capture-after-manual-browser-login')">
            <span v-if="captureAction.loading" class="button-spinner"></span>
            {{ captureAction.loading ? '采集中' : '我已登录，开始采集' }}
          </BaseButton>
          <small>{{ browserSessionStatus.message || '登录态只用于当前项目和当前采集任务。' }}</small>
        </section>
      </div>
    </section>

    <section class="restored-assets-section">
      <div class="panel-head">
        <div>
          <h3>还原资产</h3>
        </div>
      </div>
      <div v-if="currentRestoredPages.length" class="restored-page-grid">
        <a
          v-for="page in currentRestoredPages"
          :key="page.id"
          class="restored-page-card"
          :href="previewTaskUrl(page.id)"
          target="_blank"
          rel="noopener noreferrer"
          @click.prevent="$emit('open-restored-page-standalone', page.id)"
        >
          <div class="restored-page-cover">
            <iframe v-if="restoredPageHasHtml(page)"
              :src="restoredPagePreviewFrameSrc(page)"
              title="还原页面封面"
              tabindex="-1"
              @load="$emit('restored-page-frame-load', page, $event)"
            ></iframe>
            <img v-else-if="page.coverImage" :src="page.coverImage" :alt="page.title" />
            <div v-else class="snapshot-cover-empty">暂无预览</div>
            <button
              class="restored-card-delete"
              type="button"
              aria-label="删除资产"
              title="删除资产"
              @click.stop.prevent="$emit('delete-restored-page', page)"
            >
              <Trash2 aria-hidden="true" />
            </button>
            <div class="restored-card-action">
              <span>查看详情</span>
            </div>
          </div>
          <div>
            <strong>{{ page.title }}</strong>
            <small>{{ formatRestoredPageTime(page) }}</small>
            <div class="restored-page-tags" aria-label="资产标签">
              <span v-for="tag in restoredPageTags(page)" :key="tag">{{ tag }}</span>
            </div>
          </div>
        </a>
      </div>
      <div v-else class="materials-empty">
        <strong>暂无还原资产</strong>
        <p>先在 URL 转代码里输入 URL，采集网页后再生成高保真 HTML 页面。</p>
        <BaseButton variant="primary" type="button" :disabled="captureAction.loading" @click="$emit('handle-restored-empty-capture-action')">
          <span v-if="captureAction.loading" class="button-spinner"></span>
          {{ captureAction.loading ? '采集中' : '去采集网页' }}
        </BaseButton>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { BaseButton, BaseSegmentedTabs, BaseTextarea } from '../../components/base'

const props = defineProps({
  isFactoryHome: { type: Boolean, default: false },
  showGeneratedPageFullPreview: { type: Boolean, default: false },
  showBlueprintDemoFullPreview: { type: Boolean, default: false },
  generatedPageHtml: { type: String, default: '' },
  blueprintDemoHtml: { type: String, default: '' },
  factoryHeroCopy: { type: Object, required: true },
  factoryHomeTab: { type: String, default: 'image-code' },
  factoryHomeTabs: { type: Array, default: () => [] },
  imageCodeForm: { type: Object, required: true },
  imageCodeStatus: { type: Object, required: true },
  showImageTargetMenu: { type: Boolean, default: false },
  imageCodeTargetLabel: { type: String, default: '' },
  imageCodeTargetOptions: { type: Array, default: () => [] },
  styleForm: { type: Object, required: true },
  styleStatus: { type: Object, required: true },
  captureForm: { type: Object, required: true },
  showCaptureMethodMenu: { type: Boolean, default: false },
  captureMethodLabel: { type: String, default: '' },
  captureMethodOptions: { type: Array, default: () => [] },
  selectedCaptureRecoveryFlowId: { type: String, default: '' },
  captureAction: { type: Object, required: true },
  captureDetailHref: { type: String, default: '#' },
  browserSessionStatus: { type: Object, required: true },
  currentRestoredPages: { type: Array, default: () => [] },
  previewTaskUrl: { type: Function, required: true },
  restoredPagePreviewFrameSrc: { type: Function, required: true },
  formatRestoredPageTime: { type: Function, required: true },
  restoredPageTags: { type: Function, required: true }
})

const factoryHomeTabItems = computed(() =>
  props.factoryHomeTabs.map((tab) => ({
    value: tab.key,
    label: tab.label
  }))
)

function restoredPageHasHtml(page = {}) {
  return Boolean(
    page.hasHtml ||
    page.html ||
    page.files?.some((file) =>
      (file?.path === 'index.html' || file?.path === 'src/pageData.js') &&
      String(file?.content || '').trim()
    )
  )
}

defineEmits([
  'close-generated-page-full-preview',
  'close-blueprint-demo-full-preview',
  'update-factory-home-tab',
  'handle-image-code-file',
  'toggle-image-target-menu',
  'select-image-code-target',
  'generate-from-image',
  'transform-style',
  'start-capture',
  'toggle-capture-method-menu',
  'select-capture-method',
  'open-manual-browser-authorization',
  'capture-after-manual-browser-login',
  'open-restored-page-standalone',
  'restored-page-frame-load',
  'delete-restored-page',
  'handle-restored-empty-capture-action'
])
</script>
