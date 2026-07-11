<template>
  <!-- class="assets-page" class="assets-page__content" -->
  <PageShell name="assets">
    <section class="view-panel assets-view">
      <section class="panel asset-list-panel">
        <ListHeader title="资产库" :count="currentAssets.length" />
        <div class="asset-list">
          <button
            v-for="asset in currentAssets"
            :key="asset.id"
            :class="{ active: selectedAsset?.id === asset.id }"
            type="button"
            @click="$emit('update:selected-asset-id', asset.id)"
          >
            <strong>{{ asset.title }}</strong>
            <span>{{ asset.meta }} · {{ asset.status }}</span>
          </button>
        </div>
      </section>

      <section class="panel asset-detail-panel">
        <template v-if="selectedAsset">
          <div class="panel-head">
            <div>
              <h3>{{ selectedAsset.title }}</h3>
              <p>{{ selectedAsset.meta }} · {{ selectedAsset.status }}</p>
            </div>
            <div v-if="selectedAsset.blueprint" class="actions">
              <BaseButton type="button" @click="$emit('import-blueprint-asset-to-knowledge', selectedAsset)">导入知识库</BaseButton>
            </div>
          </div>
          <section v-if="selectedAsset.blueprint" class="blueprint-profile-grid asset-blueprint-preview">
            <div>
              <span>产品定位</span>
              <strong>{{ selectedAsset.blueprint.profile.positioning }}</strong>
            </div>
            <div>
              <span>交互路径</span>
              <strong>{{ selectedAsset.blueprint.interactionTree.title }}</strong>
            </div>
            <div>
              <span>Demo 页面</span>
              <strong>{{ selectedAsset.blueprint.demoScreens.length }} 个页面</strong>
            </div>
          </section>
          <section v-if="selectedAsset.designSource" class="snapshot-asset-preview">
            <div class="snapshot-cover">
              <img v-if="selectedAsset.designSource.coverImage" :src="selectedAsset.designSource.coverImage" :alt="selectedAsset.title" />
              <div v-else class="snapshot-cover-empty">暂无截图</div>
            </div>
            <div class="snapshot-asset-facts">
              <div>
                <span>来源</span>
                <strong>{{ selectedAsset.designSource.origin === 'package' ? '网页快照包' : 'URL 网页快照' }}</strong>
              </div>
              <div>
                <span>DOM 节点</span>
                <strong>{{ selectedAsset.designSource.summary.layoutNodes }}</strong>
              </div>
              <div>
                <span>组件样本</span>
                <strong>{{ selectedAsset.designSource.summary.components }}</strong>
              </div>
              <div>
                <span>图片资源</span>
                <strong>{{ selectedAsset.designSource.summary.assets }}</strong>
              </div>
              <div>
                <span>授权方式</span>
                <strong>{{ selectedAsset.designSource.rawRef.authMode }}</strong>
              </div>
              <div>
                <span>快照类型</span>
                <strong>{{ selectedAsset.designSource.rawRef.captureKind }}</strong>
              </div>
            </div>
            <div class="actions">
              <BaseButton type="button" @click="$emit('open-factory')">回到网页工厂</BaseButton>
              <BaseButton variant="primary" type="button" @click="$emit('open-restored-assets')">查看还原资产</BaseButton>
            </div>
          </section>
          <pre class="code-block tall">{{ selectedAsset.content }}</pre>
          <div class="asset-meta-grid">
            <div>
              <strong>版本</strong>
              <span>{{ selectedAsset.versions?.length || 1 }}</span>
            </div>
            <div>
              <strong>运行链路</strong>
              <span>{{ selectedAsset.hiddenRunRecords?.length || 0 }} 条</span>
            </div>
          </div>
          <details class="run-record-details">
            <summary>查看运行链路</summary>
            <DataList :items="selectedAsset.hiddenRunRecords || []" empty="暂无运行链路" />
          </details>
        </template>
        <template v-else>
          <h3>暂无资产</h3>
          <p>完成诊断或流程后，结果会保存到这里。</p>
        </template>
      </section>
    </section>
  </PageShell>
</template>

<script setup>
import DataList from '../../components/DataList.vue'
import ListHeader from '../../components/ListHeader.vue'
import { BaseButton } from '../../components/base'
import PageShell from '../../components/layout/PageShell.vue'

defineProps({
  currentAssets: { type: Array, default: () => [] },
  selectedAsset: { type: Object, default: null }
})

defineEmits([
  'update:selected-asset-id',
  'import-blueprint-asset-to-knowledge',
  'open-factory',
  'open-restored-assets'
])
</script>
