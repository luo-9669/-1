import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  buildPrototypeFlowTree,
  enrichPrototypeDemoHotspots,
  enrichPrototypeFlowScreenshots,
  selectBestPrototypeDemoAsset,
  selectCompletePrototypeFlowAsset
} from '../frontend/src/services/prototypeDemo.js'

test('knowledge flow screenshots stay fully visible in fixed-size cards and can be enlarged', async () => {
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(knowledgeHubSource, /class="prototype-screen-viewport"/)
  assert.match(knowledgeHubSource, /openKnowledgeFlowImagePreview\(\{ \.\.\.node\.page, title: node\.title, screenshotUrl: knowledgeWorkflowNodeImageUrl\(node\) \}\)/)
  assert.match(knowledgeHubSource, /knowledge-flow-image-preview-modal/)
  assert.match(knowledgeHubSource, /selectedKnowledgePrototypeScreenLiveUrl/)
  assert.match(knowledgeHubSource, /打开真实预览/)
  assert.match(knowledgeHubSource, /knowledge-flow-tree-panel/)
  assert.match(knowledgeHubSource, /\$emit\('select-knowledge-flow', flow\.id\)/)
  assert.match(knowledgeHubSource, /flowPathLabel\(flow\)/)
  assert.doesNotMatch(knowledgeHubSource, /page\.actions\.map\(\(action\) => `\$\{action\.label\}/)
  assert.match(knowledgeHubSource, /放大/)
  assert.match(knowledgeHubSource, /closeKnowledgeFlowImagePreview/)
  assert.match(knowledgeHubSource, /function getKnowledgeHotspotStyle\(rect = \{\}\)/)
  assert.match(knowledgeHubSource, /function getPrototypeViewportStyle\(screen = \{\}\)/)
  assert.match(knowledgeHubSource, /class="prototype-image-frame"/)
  assert.match(knowledgeHubSource, /:style="getPrototypeViewportStyle\(node\.page \|\| \{\}\)"/)
  assert.match(knowledgeHubSource, /:style="getPrototypeViewportStyle\(selectedKnowledgePrototypeScreen\)"/)
  assert.match(knowledgeHubSource, /Math\.min\(clampPercent\(rect\.width, 8\), 100 - left\)/)
  assert.match(knowledgeHubSource, /:style="getKnowledgeHotspotStyle\(hotspot\.rect\)"/)
  assert.doesNotMatch(knowledgeHubSource, /<template>\s*<span\s+v-for="hotspot in page\.actions"/)
  assert.doesNotMatch(knowledgeHubSource, /prototype-hotspot-frame-label/)

  assert.match(styles, /\.prototype-screen\s*\{[\s\S]*?aspect-ratio:\s*16\s*\/\s*9/)
  assert.match(styles, /\.prototype-screen\s*\{[\s\S]*?overflow:\s*hidden/)
  assert.match(styles, /\.prototype-screen-viewport\s*\{[\s\S]*?place-items:\s*center/)
  assert.match(styles, /\.prototype-image-frame\s*\{[\s\S]*?aspect-ratio:\s*var\(--prototype-aspect-ratio/)
  assert.match(styles, /\.prototype-image-frame\s*>\s*img\s*\{[\s\S]*?max-width:\s*100%[\s\S]*?max-height:\s*100%[\s\S]*?object-fit:\s*contain/)
  assert.match(styles, /\.knowledge-workflow-node-media \.prototype-image-frame\s*>\s*img\s*\{[\s\S]*?object-fit:\s*contain/)
  assert.match(styles, /\.image-restore-upload-tile\.image-prompt-upload img\s*\{[\s\S]*?object-fit:\s*contain/)
  assert.doesNotMatch(styles, /\.prototype-image-frame\s*>\s*img\s*\{[\s\S]*?object-fit:\s*fill/)
  assert.doesNotMatch(styles, /\.knowledge-workflow-node-media \.prototype-image-frame\s*>\s*img\s*\{[\s\S]*?object-fit:\s*fill/)
  assert.match(styles, /\.knowledge-flow-layout\s*\{[\s\S]*?grid-template-columns:\s*280px minmax\(0, 1fr\)/)
  assert.match(styles, /\.knowledge-flow-tree-item\.active\s*\{[\s\S]*?border-color:\s*#222529/)
  assert.match(styles, /\.prototype-screen \.prototype-hotspot-frame\s*\{[\s\S]*?max-width:\s*100%/)
  assert.match(styles, /\.prototype-hotspot-frame\s*\{[\s\S]*?opacity:\s*0/)
  assert.match(styles, /\.prototype-hotspot-button\s*\{[\s\S]*?pointer-events:\s*auto/)
  assert.doesNotMatch(styles, /\.prototype-image-frame:hover\s+\.prototype-hotspot-frame/)
  assert.doesNotMatch(styles, /\.prototype-image-frame:focus-within\s+\.prototype-hotspot-frame/)
  assert.doesNotMatch(styles, /\.prototype-hotspot-button:hover\s*\{[^}]*opacity:\s*1/)
  assert.match(styles, /\.knowledge-flow-image-preview-modal\s*\{[\s\S]*?position:\s*fixed/)
  assert.match(styles, /\.knowledge-flow-image-preview-modal img\s*\{[\s\S]*?object-fit:\s*contain/)
})

test('knowledge flow uses workflow-like canvas chrome and structure hierarchy navigation', async () => {
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(knowledgeHubSource, /knowledge-flow-canvas-shell/)
  assert.match(knowledgeHubSource, /workflow-canvas-shell/)
  assert.match(knowledgeHubSource, /knowledge-flow-structure-panel/)
  assert.match(knowledgeHubSource, /workflow-canvas-zoom-controls/)
  assert.match(knowledgeHubSource, /workflow-canvas-viewport/)
  assert.match(knowledgeHubSource, /workflow-canvas-scrollarea/)
  assert.match(knowledgeHubSource, /workflow-canvas-surface/)
  assert.match(knowledgeHubSource, /workflow-canvas-edges/)
  assert.match(knowledgeHubSource, /canvas-node-card/)
  assert.match(knowledgeHubSource, /handleKnowledgeCanvasWheel/)
  assert.match(knowledgeHubSource, /handleKnowledgeCanvasKeydown/)
  assert.match(knowledgeHubSource, /knowledge-flow-mode-switch/)
  assert.match(knowledgeHubSource, />画布模式</)
  assert.match(knowledgeHubSource, />工作流模式</)
  assert.doesNotMatch(knowledgeHubSource, /<strong>流程图<\/strong>\s*<span>用页面原型卡片串联用户路径、页面跳转和交互状态。<\/span>/)
  assert.doesNotMatch(knowledgeHubSource, /aria-label="缩小流程图"/)

  assert.match(styles, /\.knowledge-flow-canvas-shell\s*\{[\s\S]*?grid-template-columns:\s*280px minmax\(0, 1fr\)/)
  assert.match(styles, /\.knowledge-flow-canvas-shell\.workflow-canvas-shell\s*\{[\s\S]*?grid-template-columns:\s*280px minmax\(0, 1fr\)/)
  assert.match(styles, /\.knowledge-flow-canvas-viewport\.workflow-canvas-viewport/)
  assert.match(styles, /\.knowledge-flow-canvas-surface\.workflow-canvas-surface/)
})

test('knowledge workflow mode can select a canvas card and add draft nodes in four directions', async () => {
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(knowledgeHubSource, /selectedKnowledgeWorkflowNodeId/)
  assert.match(knowledgeHubSource, /knowledgeWorkflowDraftNodes/)
  assert.match(knowledgeHubSource, /knowledgeWorkflowCanvasNodes/)
  assert.match(knowledgeHubSource, /knowledgeWorkflowCanvasEdges/)
  assert.match(knowledgeHubSource, /knowledgeWorkflowEdgePath/)
  assert.match(knowledgeHubSource, /getKnowledgeWorkflowNodeStyle/)
  assert.match(knowledgeHubSource, /direction:\s*node\.direction/)
  assert.match(knowledgeHubSource, /edge\.direction === 'left'/)
  assert.match(knowledgeHubSource, /edge\.direction === 'top'/)
  assert.match(knowledgeHubSource, /knowledge-workflow-add-handles/)
  assert.match(knowledgeHubSource, /addKnowledgeWorkflowDraftNode\(node, 'top'\)/)
  assert.match(knowledgeHubSource, /addKnowledgeWorkflowDraftNode\(node, 'right'\)/)
  assert.match(knowledgeHubSource, /addKnowledgeWorkflowDraftNode\(node, 'bottom'\)/)
  assert.match(knowledgeHubSource, /addKnowledgeWorkflowDraftNode\(node, 'left'\)/)
  assert.match(knowledgeHubSource, /v-for="node in knowledgeWorkflowCanvasNodes"/)
  assert.match(knowledgeHubSource, /新流程节点/)

  assert.doesNotMatch(styles, /\.knowledge-flow-board\.is-workflow-mode\s*\{[\s\S]*?display:\s*grid/)
  assert.match(styles, /\.knowledge-flow-node-card\.canvas-node-card\s*\{[\s\S]*?width:\s*320px/)
  assert.match(styles, /\.knowledge-workflow-add-handles\s*\{[\s\S]*?pointer-events:\s*none/)
  assert.match(styles, /\.knowledge-workflow-add-button\.is-top/)
  assert.match(styles, /\.knowledge-workflow-draft-card\s*\{[\s\S]*?border-style:\s*dashed/)
})

test('knowledge workflow nodes can be locally edited with image, title, delete, and drag controls', async () => {
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(knowledgeHubSource, /knowledgeWorkflowNodeOverrides/)
  assert.match(knowledgeHubSource, /knowledgeWorkflowDeletedNodeIds/)
  assert.match(knowledgeHubSource, /handleKnowledgeWorkflowImageUpload\(node, \$event\)/)
  assert.match(knowledgeHubSource, /emit\('upload-knowledge-prototype-screenshot', node\.page, \{ dataUrl, fileName: file\.name \|\| '' \}\)/)
  assert.match(knowledgeHubSource, /if \(node\.kind === 'page' && node\.page\?\.id\) \{[\s\S]*?emit\('upload-knowledge-prototype-screenshot'[\s\S]*?return[\s\S]*?\}/)
  assert.match(knowledgeHubSource, /emit\('upload-knowledge-prototype-screenshot', \{ id: node\.id, title: node\.title \|\| '新流程节点', actions: \[\], summary: node\.summary \|\| '' \}, \{ dataUrl, fileName: file\.name \|\| '' \}\)/)
  assert.match(knowledgeHubSource, /updateKnowledgeWorkflowNodeTitle\(node, \$event\.target\.value\)/)
  assert.match(knowledgeHubSource, /deleteKnowledgeWorkflowNode\(node\)/)
  assert.match(knowledgeHubSource, /startKnowledgeWorkflowNodeDrag\(\$event, node\)/)
  assert.match(knowledgeHubSource, /moveKnowledgeWorkflowNode\(state\.nodeId, nextX, nextY\)/)
  assert.match(knowledgeHubSource, /knowledgeWorkflowNodeImageUrl\(node\)/)
  assert.match(knowledgeHubSource, /knowledge-workflow-title-input/)
  assert.match(knowledgeHubSource, /knowledge-workflow-upload-control/)
  assert.match(knowledgeHubSource, /knowledge-workflow-delete-button/)
  assert.match(knowledgeHubSource, /可拖动/)
  assert.doesNotMatch(knowledgeHubSource, /同步上传截图/)
  assert.doesNotMatch(knowledgeHubSource, /class="prototype-screen-upload"[\s\S]*?node\.page\?\.screenshotUrl/)

  assert.match(styles, /\.knowledge-workflow-node-media\s*\{[\s\S]*?min-height:\s*180px/)
  assert.match(styles, /\.knowledge-workflow-title-input\s*\{[\s\S]*?font-size:\s*15px/)
  assert.match(styles, /\.knowledge-workflow-node-actions\s*\{[\s\S]*?display:\s*flex/)
  assert.match(styles, /\.knowledge-flow-node-card\.is-dragging\s*\{[\s\S]*?cursor:\s*grabbing/)
})

test('knowledge flow hierarchy keeps labels readable without stacked active states', async () => {
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(knowledgeHubSource, /selectedKnowledgeFlowStructureNodeId/)
  assert.match(knowledgeHubSource, /visualDepth:\s*Math\.min\(3, Math\.max\(0, depth\)\)/)
  assert.match(knowledgeHubSource, /'--depth': node\.visualDepth \|\| 0/)
  assert.match(knowledgeHubSource, /active: isKnowledgeFlowStructureNodeCurrent\(node\)/)
  assert.match(knowledgeHubSource, /'is-related-flow': isKnowledgeFlowStructureNodeRelated\(node\)/)
  assert.doesNotMatch(knowledgeHubSource, /active: isKnowledgeFlowStructureNodeActive\(node\)/)

  assert.match(styles, /\.knowledge-flow-structure-item\s*\{[\s\S]*?width:\s*calc\(100% - \(var\(--depth, 0\) \* 16px\)\)/)
  assert.match(styles, /\.knowledge-flow-structure-item\s*\{[\s\S]*?min-height:\s*44px/)
  assert.match(styles, /\.knowledge-flow-structure-item strong\s*\{[\s\S]*?font-size:\s*13px[\s\S]*?white-space:\s*normal/)
  assert.doesNotMatch(styles, /\.knowledge-flow-structure-item small/)
  assert.doesNotMatch(styles, /\.knowledge-flow-structure-item span/)
  assert.match(styles, /\.knowledge-flow-structure-item\.is-related-flow\s*\{[\s\S]*?box-shadow:\s*inset 3px 0 0 #cbd5e1/)
})

test('knowledge flow sidebar renders project-provided hierarchy and expands inline', async () => {
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../frontend/src/styles.css', import.meta.url), 'utf8')

  assert.match(knowledgeHubSource, /knowledgeFlowRootStructureTree/)
  assert.match(knowledgeHubSource, /normalizeKnowledgeFlowRootStructureNodes/)
  assert.match(knowledgeHubSource, /props\.knowledgePrototypeFlowTree\.roots/)
  assert.match(knowledgeHubSource, /flattenExpandedKnowledgeFlowTreeNodes\(knowledgeFlowRootStructureTree\.value/)
  assert.match(knowledgeHubSource, /isKnowledgeFlowTreeNodeExpanded\(node\)/)
  assert.match(knowledgeHubSource, /toggleKnowledgeFlowStructureNode\(node\)/)
  assert.match(knowledgeHubSource, /<strong>\{\{ node\.title \}\}<\/strong>/)
  assert.doesNotMatch(knowledgeHubSource, /node\.visualDepth === 0 \? '一级流程' :/)
  assert.doesNotMatch(knowledgeHubSource, /流程层级/)
  assert.doesNotMatch(knowledgeHubSource, /flowStructureNodeMeta\(node\)/)
  assert.doesNotMatch(knowledgeHubSource, /buildKnowledgeFlowPrimaryStructureTree/)
  assert.doesNotMatch(knowledgeHubSource, /primaryFlowGroupForNode/)
  assert.doesNotMatch(knowledgeHubSource, /flow-primary-group/)
  assert.doesNotMatch(knowledgeHubSource, /\['登录注册', '首页', '我的'\]/)
  assert.doesNotMatch(knowledgeHubSource, /const flowNodes = flattenKnowledgeFlowTreeNodes\(sourceFlowRoots\)/)
  assert.doesNotMatch(knowledgeHubSource, /\.\.\.\(node\.children \|\| \[\]\)\.flatMap\(\(child\) => \[child\.id, child\.title, child\.meta, child\.route, child\.url\]\)/)

  assert.match(styles, /\.knowledge-flow-structure-item\s*\{[^}]*box-sizing:\s*border-box/)
  assert.match(styles, /\.knowledge-flow-structure-panel\s*\{[^}]*display:\s*flex/)
  assert.match(styles, /\.knowledge-flow-structure-panel\s*\{[^}]*gap:\s*6px/)
  assert.match(styles, /\.knowledge-flow-structure-item\s*\{[^}]*min-height:\s*44px/)
  assert.doesNotMatch(styles, /\.knowledge-flow-structure-panel\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/)
})

test('knowledge flow canvas follows the selected hierarchy node instead of always rendering every page', async () => {
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')
  const appSource = await readFile(new URL('../frontend/src/App.vue', import.meta.url), 'utf8')

  assert.match(knowledgeHubSource, /selectedKnowledgeFlowStructureNode/)
  assert.match(knowledgeHubSource, /knowledgeFlowCanvasPages/)
  assert.match(knowledgeHubSource, /collectKnowledgeFlowNodeScreenIds/)
  assert.match(knowledgeHubSource, /collectKnowledgeFlowNodeFlowIds/)
  assert.match(knowledgeHubSource, /v-for="node in knowledgeWorkflowCanvasNodes"/)
  assert.match(knowledgeHubSource, /props\.knowledgePrototypePages/)
  assert.match(knowledgeHubSource, /knowledgeFlowCanvasPages\.value/)
  assert.doesNotMatch(knowledgeHubSource, /const pageNodes = props\.knowledgePrototypePages\s*\n\s*\.filter/)
  assert.match(appSource, /const sourceScreens = currentKnowledgeFlowDemo\.value\.screens \|\| \[\]/)
  assert.match(appSource, /knowledgePrototypeFlowTree\.value\.flows[\s\S]*?flatMap\(\(flow\) => flow\.steps \|\| \[\]\)/)
  assert.doesNotMatch(appSource, /const selectedScreenIds = new Set\(selectedKnowledgeFlow\.value\?\.screenIds \|\| \[\]\)/)
})

test('knowledge flow canvas auto layout keeps nodes apart before local drag overrides apply', async () => {
  const knowledgeHubSource = await readFile(new URL('../frontend/src/pages/knowledge/KnowledgeHubPanel.vue', import.meta.url), 'utf8')

  assert.match(knowledgeHubSource, /getKnowledgeWorkflowAutoLayoutPosition/)
  assert.match(knowledgeHubSource, /const row = Math\.floor\(index \/ KNOWLEDGE_WORKFLOW_COLUMNS\)/)
  assert.match(knowledgeHubSource, /const column = index % KNOWLEDGE_WORKFLOW_COLUMNS/)
  assert.match(knowledgeHubSource, /KNOWLEDGE_WORKFLOW_NODE_GAP_X = 520/)
  assert.match(knowledgeHubSource, /KNOWLEDGE_WORKFLOW_NODE_GAP_Y = 460/)
  assert.match(knowledgeHubSource, /override\.isManualPosition/)
})

test('knowledge prototype player prefers screenshot-backed runtime demos over empty legacy demos', () => {
  const emptyLegacyDemo = {
    id: 'asset-empty-latest',
    type: 'prototype-demo',
    title: '空截图 Demo',
    updatedAt: '2026-07-05T09:00:00.000Z',
    prototypeDemo: {
      screens: [
        { id: 'empty-home', title: '首页' },
        { id: 'empty-detail', title: '详情' }
      ],
      transitions: [
        { id: 'empty-transition', from: 'empty-home', to: 'empty-detail', label: '打开' }
      ]
    }
  }
  const runtimeDemo = {
    id: 'asset-runtime-demo',
    type: 'prototype-demo',
    title: '真实运行 Demo',
    updatedAt: '2026-07-05T08:00:00.000Z',
    prototypeDemo: {
      screens: [
        {
          id: 'runtime-home',
          title: '真实首页',
          screenshotUrl: 'data:image/png;base64,aG9tZQ==',
          hotspots: [
            { id: 'try-sample', label: 'Try Sample', targetScreenId: 'runtime-filled' }
          ]
        },
        {
          id: 'runtime-filled',
          title: '样例已填充',
          screenshotUrl: 'data:image/png;base64,ZmlsbGVk'
        }
      ],
      transitions: [
        { id: 'runtime-transition', from: 'runtime-home', to: 'runtime-filled', label: 'Try Sample' }
      ]
    }
  }

  assert.equal(selectBestPrototypeDemoAsset([emptyLegacyDemo, runtimeDemo])?.id, 'asset-runtime-demo')
})

test('knowledge flow map prefers the most complete project flow over the smaller runtime playback demo', () => {
  const runtimePlaybackDemo = {
    id: 'asset-runtime-demo',
    type: 'prototype-demo',
    updatedAt: '2026-07-05T09:00:00.000Z',
    prototypeDemo: {
      screens: Array.from({ length: 10 }, (_, index) => ({
        id: `runtime-${index}`,
        screenshotUrl: 'data:image/png;base64,aG9tZQ=='
      })),
      transitions: Array.from({ length: 56 }, (_, index) => ({ id: `runtime-transition-${index}` }))
    }
  }
  const staticProjectFlow = {
    id: 'asset-static-complete-flow',
    type: 'prototype-demo',
    updatedAt: '2026-07-05T08:00:00.000Z',
    prototypeDemo: {
      screens: Array.from({ length: 57 }, (_, index) => ({ id: `route-${index}` })),
      transitions: Array.from({ length: 593 }, (_, index) => ({ id: `route-transition-${index}` }))
    }
  }

  assert.equal(
    selectCompletePrototypeFlowAsset([runtimePlaybackDemo, staticProjectFlow])?.id,
    'asset-static-complete-flow'
  )
})

test('knowledge flow map backfills matching runtime screenshots without dropping complete flow nodes', () => {
  const fullFlowDemo = {
    screens: [
      {
        id: 'tool-ai-video-podcast-generator',
        title: 'AI Video Podcast Generator',
        url: 'http://127.0.0.1:3000/tools/ai-video-podcast-generator'
      },
      {
        id: 'tool-missing-shot',
        title: 'Missing Shot',
        url: 'http://127.0.0.1:3000/tools/missing-shot'
      }
    ],
    transitions: [{ id: 'a-b', from: 'tool-ai-video-podcast-generator', to: 'tool-missing-shot' }]
  }
  const runtimeDemo = {
    screens: [
      {
        id: 'tools-ai-video-podcast-generator',
        title: 'AI Video Podcast Generator · 初始输入',
        url: 'http://127.0.0.1:4319/tools/ai-video-podcast-generator',
        screenshotUrl: 'data:image/png;base64,cnVudGltZQ=='
      }
    ]
  }

  const enriched = enrichPrototypeFlowScreenshots(fullFlowDemo, [runtimeDemo])

  assert.equal(enriched.screens.length, 2)
  assert.equal(enriched.screens[0].screenshotUrl, 'data:image/png;base64,cnVudGltZQ==')
  assert.equal(enriched.screens[0].screenshotStorage, 'runtime-screenshot-backfill')
  assert.equal(enriched.screens[1].screenshotUrl || '', '')
})

test('knowledge prototype demo merges static flow hotspots into matching runtime screenshots', () => {
  const runtimeDemo = {
    screens: [
      {
        id: 'tools-ai-podcast-hosts',
        title: 'AI Podcast Hosts',
        url: 'http://127.0.0.1:4319/tools/ai-podcast-hosts',
        screenshotUrl: 'data:image/png;base64,aG9zdHM=',
        hotspots: [
          { id: 'try-sample', label: 'Try Sample', targetScreenId: 'tools-ai-podcast-hosts', rect: { x: 60, y: 60, width: 10, height: 5 } }
        ]
      },
      {
        id: 'tools-ai-video-podcast-generator',
        title: 'AI Video Podcast Generator',
        url: 'http://127.0.0.1:4319/tools/ai-video-podcast-generator',
        screenshotUrl: 'data:image/png;base64,dmlkZW8='
      }
    ],
    transitions: []
  }
  const completeFlowDemo = {
    screens: [
      {
        id: 'tool-ai-podcast-hosts',
        title: 'AI Podcast Hosts',
        url: 'http://127.0.0.1:3000/tools/ai-podcast-hosts',
        hotspots: [
          { id: 'side-nav-video', label: 'AI Video Podcast Generator', targetScreenId: 'tool-ai-video-podcast-generator', rect: { x: 6, y: 10, width: 15, height: 8 } },
          { id: 'try-sample', label: 'Try Sample', targetScreenId: 'tool-ai-podcast-hosts', rect: { x: 60, y: 60, width: 10, height: 5 } }
        ]
      }
    ]
  }

  const enriched = enrichPrototypeDemoHotspots(runtimeDemo, [completeFlowDemo])
  const hosts = enriched.screens.find((screen) => screen.id === 'tools-ai-podcast-hosts')

  assert.equal(hosts.hotspots.length, 2)
  assert.equal(hosts.hotspots.find((hotspot) => hotspot.id === 'side-nav-video')?.targetScreenId, 'tools-ai-video-podcast-generator')
  assert.equal(hosts.hotspots.filter((hotspot) => hotspot.id === 'try-sample').length, 1)
})

test('knowledge prototype demo supplements tool sidebar navigation hotspots from project flow routes', () => {
  const runtimeDemo = {
    screens: [
      {
        id: 'tools-ai-podcast-hosts',
        title: 'AI Podcast Hosts',
        url: 'http://127.0.0.1:4319/tools/ai-podcast-hosts',
        screenshotUrl: 'data:image/png;base64,aG9zdHM=',
        hotspots: [
          { id: 'existing-video', label: 'AI Video Podcast Generator', targetScreenId: 'tools-ai-video-podcast-generator', rect: { x: 6.2, y: 9.5, width: 14.4, height: 7.8 } }
        ]
      },
      {
        id: 'tools-ai-video-podcast-generator',
        title: 'AI Video Podcast Generator',
        url: 'http://127.0.0.1:4319/tools/ai-video-podcast-generator',
        screenshotUrl: 'data:image/png;base64,dmlkZW8='
      }
    ]
  }
  const completeFlowDemo = {
    screens: [
      { id: 'tool-podcast-script-generator', title: 'Podcast Script Generator', route: '/tools/podcast-script-generator' },
      { id: 'tool-true-crime-podcast-generator', title: 'True Crime Podcast Generator', route: '/tools/true-crime-podcast-generator' },
      { id: 'tool-url-to-podcast', title: 'URL to Podcast', route: '/tools/url-to-podcast' }
    ]
  }

  const enriched = enrichPrototypeDemoHotspots(runtimeDemo, [completeFlowDemo])
  const hosts = enriched.screens.find((screen) => screen.id === 'tools-ai-podcast-hosts')

  assert.ok(hosts.hotspots.some((hotspot) => hotspot.label === 'True Crime Podcast Generator'))
  assert.ok(hosts.hotspots.some((hotspot) => hotspot.label === 'URL to Podcast'))
  assert.equal(hosts.hotspots.filter((hotspot) => hotspot.label === 'AI Video Podcast Generator').length, 1)
})

test('knowledge flow tree prefers project-provided hierarchy before fallback inference', () => {
  const demo = {
    screens: [
      {
        id: 'editor',
        title: 'Editor',
        hierarchy: ['Product Area', 'Scenario', 'Task', 'Page State'],
        hotspots: [
          {
            id: 'generate',
            label: 'Generate',
            targetScreenId: 'result',
            hierarchy: ['Product Area', 'Scenario', 'Task', 'Page State', 'Generate Action']
          }
        ]
      },
      {
        id: 'result',
        title: 'Result',
        hierarchy: ['Product Area', 'Scenario', 'Task', 'Result State']
      }
    ],
    transitions: [
      { id: 'editor-result', from: 'editor', to: 'result', label: 'Generate' }
    ]
  }

  const tree = buildPrototypeFlowTree(demo)

  assert.equal(tree.roots[0].title, 'Product Area')
  assert.equal(tree.roots[0].children[0].title, 'Scenario')
  assert.equal(tree.roots[0].children[0].children[0].title, 'Task')
  assert.equal(tree.selectedFlow?.title, 'Generate Action')
  assert.deepEqual(tree.selectedFlow?.screenIds, ['editor', 'result'])
  assert.equal(tree.selectedFlow?.steps[0].actionLabel, 'Generate')
})

test('knowledge flow tree fallback uses neutral project route segments without hardcoded business buckets', () => {
  const demo = {
    screens: [
      {
        id: 'tool-a',
        title: 'Tool A',
        route: '/workspace/tools/tool-a',
        hotspots: [{ id: 'next', label: 'Next', targetScreenId: 'tool-b' }]
      },
      {
        id: 'tool-b',
        title: 'Tool B',
        route: '/workspace/tools/tool-b'
      }
    ],
    transitions: [{ id: 'a-b', from: 'tool-a', to: 'tool-b', label: 'Next' }]
  }

  const tree = buildPrototypeFlowTree(demo)
  const titles = JSON.stringify(tree.roots)

  assert.match(titles, /workspace/)
  assert.match(titles, /tools/)
  assert.match(titles, /Tool A/)
  assert.doesNotMatch(titles, /创作工具|作品库|账号支付|生成 Podcast/)
  assert.deepEqual(tree.flows[0].screenIds, ['tool-a', 'tool-b'])
})
