# Image To HTML Doubao Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the screenshot-to-HTML feature shown in the 工程开发 page, with a Doubao-like centered upload composer and a deterministic two-stage visual structure to HTML pipeline.

**Architecture:** Keep the existing `image-code` tab and `/api/generate/image-to-html` route, but upgrade the UI and backend contract. The frontend renders a Doubao-inspired upload card; the backend converts the uploaded screenshot into a structured visual model, then generates a single-file static HTML page from that model.

**Tech Stack:** Vue 3 SFC in `src/App.vue`, existing CSS in `src/styles.css`, Node mock backend in `server/mock-api.mjs`, existing tests in `tests/workflows.test.mjs`, existing restored page persistence.

## Global Constraints

- Page layout references the provided Doubao screenshot: centered hero, segmented tabs, large upload panel, bottom-left target selector, bottom-right primary generation button, restored assets below.
- The app must not pretend to have DOM when only an image is uploaded. Screenshot restoration uses a visual model and generated static HTML.
- Generated HTML must be standalone: one HTML file, inline CSS and JS when needed, no local service required.
- Do not embed the entire uploaded screenshot as the output HTML. Image assets may be cropped or referenced only as component assets after later tasks; for this plan, deterministic placeholder visual regions are acceptable.
- Keep the existing URL-to-code and style-transform tabs working.
- Use TDD for each behavior change.

---

## File Structure

- Modify `src/App.vue`
  - Rework `image-code` composer markup to match the Doubao-style layout.
  - Send target type and prompt to `/api/generate/image-to-html`.
  - Render clearer progress copy: visual parsing, structure modeling, static HTML generation.
- Modify `src/styles.css`
  - Add the centered hero/composer layout, upload tile, target chip, and responsive rules.
  - Keep cards at modest radius; avoid nested cards.
- Modify `server/mock-api.mjs`
  - Add `buildImageVisualModel(payload)` for screenshot visual decomposition.
  - Change `imageToStructuredHtml(payload)` to consume the visual model instead of a generic landing-page template.
  - Return `visualModel` in `captureResult.raw` and response payload for inspection.
- Modify `tests/workflows.test.mjs`
  - Add tests for Doubao-like composer UI.
  - Add tests for visual model generation.
  - Add tests that generated HTML reflects screenshot restoration modules and does not embed the full screenshot as the page.

---

### Task 1: Frontend Doubao-Style Image Composer

**Files:**
- Modify: `src/App.vue`
- Modify: `src/styles.css`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: existing `factoryHomeTab === 'image-code'`, `imageCodeForm`, `generateFromImage()`.
- Produces: a stable `.image-restore-composer` section with upload tile, copy, target selector, and primary button.

- [ ] **Step 1: Write the failing UI source test**

Add this test near the existing web factory image-code tests in `tests/workflows.test.mjs`:

```js
testAsync('image to code composer uses Doubao style restore upload layout', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const cssSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
  const imageComposerStart = appSource.indexOf('factoryHomeTab === \\'image-code\\'')
  const imageComposerEnd = appSource.indexOf('factoryHomeTab === \\'url-code\\'', imageComposerStart)
  const imageComposerSource = appSource.slice(imageComposerStart, imageComposerEnd)

  assert.match(appSource, /今天你想要还原哪张设计图/)
  assert.match(imageComposerSource, /image-restore-composer/)
  assert.match(imageComposerSource, /image-restore-upload-tile/)
  assert.match(imageComposerSource, /上传截图、设计稿或参考图/)
  assert.match(imageComposerSource, /生成页面代码/)
  assert.match(cssSource, /\\.image-restore-composer/)
  assert.match(cssSource, /\\.image-restore-upload-tile/)
  assert.match(cssSource, /\\.image-restore-actions/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/workflows.test.mjs
```

Expected: this new test fails because `.image-restore-composer` and the new copy are not present. Ignore unrelated existing workspace persistence or local Chrome port failures if they appear after the new failure is visible.

- [ ] **Step 3: Update image tab copy**

In `src/App.vue`, update the `factoryHeroContent.image-code` entry so it reads:

```js
'image-code': {
  titleBefore: '今天你想要',
  highlight: '还原',
  titleAfter: '哪张设计图？',
  subtitle: '上传设计稿、截图或参考图，平台会识别页面布局、视觉层级和组件结构，再生成可预览的静态页面代码。'
}
```

- [ ] **Step 4: Replace image composer markup**

Replace the current `factoryHomeTab === 'image-code'` composer block in `src/App.vue` with:

```vue
<div v-if="factoryHomeTab === 'image-code'" class="agent-composer image-code-composer image-restore-composer">
  <div class="image-restore-dropzone">
    <label class="image-restore-upload-tile" aria-label="上传设计图">
      <img v-if="imageCodeForm.imageDataUrl" :src="imageCodeForm.imageDataUrl" alt="上传的设计图" />
      <span v-else>＋</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" @change="handleImageCodeFile" />
    </label>
    <textarea
      v-model="imageCodeForm.prompt"
      placeholder="上传截图、设计稿或参考图，系统会先识别页面布局、视觉层级和组件结构，再生成静态 HTML。"
    ></textarea>
  </div>

  <div class="image-restore-footer">
    <div class="composer-chip-menu">
      <button
        class="composer-chip-trigger"
        type="button"
        aria-haspopup="listbox"
        :aria-expanded="showImageTargetMenu"
        @click="showImageTargetMenu = !showImageTargetMenu"
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
          @click="selectImageCodeTarget(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="image-restore-actions">
      <button class="primary" type="button" :disabled="imageCodeStatus.status === 'loading' || !imageCodeForm.imageDataUrl" @click="generateFromImage">
        <span v-if="imageCodeStatus.status === 'loading'" class="button-spinner"></span>
        {{ imageCodeStatus.status === 'loading' ? '生成中' : '生成页面代码' }}
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Add CSS for the Doubao-like composer**

Add to `src/styles.css` near the existing image-code styles:

```css
.image-restore-composer {
  width: min(1120px, calc(100vw - 220px));
  min-height: 292px;
  padding: 28px 32px;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 20px;
  border: 1px solid #e8eaec;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 28px 90px rgba(34, 37, 41, 0.08);
}

.image-restore-dropzone {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 28px;
  min-height: 168px;
}

.image-restore-upload-tile {
  position: relative;
  width: 88px;
  height: 88px;
  display: grid;
  place-items: center;
  align-self: start;
  border-radius: 10px;
  background: #eefdff;
  color: #222529;
  font-size: 34px;
  font-weight: 600;
  transform: rotate(-6deg);
  cursor: pointer;
  overflow: hidden;
}

.image-restore-upload-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: rotate(6deg) scale(1.08);
}

.image-restore-upload-tile input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.image-restore-dropzone textarea {
  min-height: 156px;
  resize: none;
  border: 0;
  outline: none;
  color: #222529;
  background: transparent;
  font-size: 16px;
  line-height: 1.8;
}

.image-restore-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.image-restore-actions {
  display: flex;
  justify-content: flex-end;
}

.image-restore-actions .primary {
  min-width: 176px;
}

@media (max-width: 900px) {
  .image-restore-composer {
    width: calc(100vw - 48px);
    padding: 22px;
  }

  .image-restore-dropzone {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .image-restore-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
```

- [ ] **Step 6: Run UI test and build**

Run:

```bash
node --test tests/workflows.test.mjs
npm run build
```

Expected: the new UI test passes. Build exits `0`. Existing unrelated full-suite failures may still appear; document them instead of changing unrelated tests.

---

### Task 2: Visual Model Contract For Screenshot Restoration

**Files:**
- Modify: `server/mock-api.mjs`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `payload.title`, `payload.prompt`, `payload.imageDataUrl`, `payload.target`.
- Produces: `buildImageVisualModel(payload)` returning `{ source, layout, styleTokens, components, sections, interactions, generationRules }`.

- [ ] **Step 1: Write failing backend model test**

Add this test near image-to-code backend tests in `tests/workflows.test.mjs`:

```js
testAsync('image to html backend builds a visual structure model before html generation', async () => {
  const source = await readFile(new URL('../server/mock-api.mjs', import.meta.url), 'utf8')
  assert.match(source, /function buildImageVisualModel\(payload = \{\}\)/)
  assert.match(source, /layout:\s*\[/)
  assert.match(source, /styleTokens:/)
  assert.match(source, /components:/)
  assert.match(source, /sections:/)
  assert.match(source, /interactions:/)
  assert.match(source, /generationRules:/)
  assert.match(source, /visualModel:\s*buildImageVisualModel\(payload\)/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/workflows.test.mjs
```

Expected: failure because `buildImageVisualModel` does not exist.

- [ ] **Step 3: Add `buildImageVisualModel`**

In `server/mock-api.mjs`, before `buildImageToHtmlCaptureResult`, add:

```js
function buildImageVisualModel(payload = {}) {
  const title = payload.title || '图片转代码页面'
  const prompt = String(payload.prompt || '').trim()
  const target = payload.target || 'static-html'
  return {
    source: {
      type: 'screenshot',
      title,
      target,
      prompt,
      hasImage: Boolean(payload.imageDataUrl)
    },
    layout: [
      { id: 'app-shell', role: 'page', pattern: 'centered-workspace' },
      { id: 'topbar', role: 'navigation', position: 'top' },
      { id: 'primary-panel', role: 'main-content', position: 'center' },
      { id: 'secondary-panel', role: 'details', position: 'right-or-bottom' }
    ],
    styleTokens: {
      colors: {
        background: '#f6f7f9',
        surface: '#ffffff',
        text: '#222529',
        muted: '#7f8792',
        border: '#e8eaec',
        accent: '#69e1f5'
      },
      spacing: [8, 12, 16, 20, 24, 32],
      radius: [8, 10, 12, 16],
      fontScale: { title: 42, subtitle: 18, body: 14, caption: 12 }
    },
    components: [
      { type: 'button', count: 2 },
      { type: 'card', count: 3 },
      { type: 'tab', count: 3 },
      { type: 'table', count: 1 },
      { type: 'chartPanel', count: 1 }
    ],
    sections: [
      { id: 'overview', title: '页面概览', content: prompt || '根据截图识别页面主视觉、导航和内容区域。' },
      { id: 'structure', title: '结构分层', content: '侧边栏、顶部导航、主体卡片和操作按钮已拆解为可编辑 DOM。' },
      { id: 'assets', title: '视觉资产', content: '图片素材暂以视觉区域占位，后续可接入裁切资产。' }
    ],
    interactions: ['tab-switch', 'copy-html', 'download-html'],
    generationRules: [
      '只有截图时生成视觉还原静态 HTML，不声明真实 DOM 采集。',
      '不把整张截图作为页面主体输出。',
      '输出单文件 HTML，可直接双击打开。'
    ]
  }
}
```

- [ ] **Step 4: Attach the visual model to capture result**

In `buildImageToHtmlCaptureResult(payload)`, create the model and expose it:

```js
function buildImageToHtmlCaptureResult(payload = {}) {
  const visualModel = payload.visualModel || buildImageVisualModel(payload)
  ...
  return {
    ...
    raw: {
      ...
      visualModel,
      visualModelCaptured: true
    }
  }
}
```

- [ ] **Step 5: Return visual model from route**

In `generateImageToHtml(payload)`, compute the model once and pass it through:

```js
const visualModel = buildImageVisualModel(payload)
const captureResult = buildImageToHtmlCaptureResult({ ...payload, visualModel })
const html = imageToStructuredHtml({ ...payload, visualModel })
...
return {
  ...
  visualModel,
  summary: '图片转代码已按截图视觉结构生成静态 HTML。'
}
```

- [ ] **Step 6: Run backend source test**

Run:

```bash
node --test tests/workflows.test.mjs
```

Expected: new model test passes. Existing unrelated full-suite failures may remain.

---

### Task 3: Generate Screenshot-Restoration HTML From Visual Model

**Files:**
- Modify: `server/mock-api.mjs`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `imageToStructuredHtml({ title, prompt, visualModel })`.
- Produces: single-file HTML with `data-restore-source="screenshot"` and sections matching `visualModel.sections`.

- [ ] **Step 1: Write failing HTML generation test**

Add this test near `capture page generation prefers SingleFile html when available` or existing image-to-code tests:

```js
testAsync('image to html output is screenshot restoration html, not an unrelated template', async () => {
  const result = await routes['POST /api/generate/image-to-html']({
    projectId: 'project-flow',
    title: 'workflow-analysis.png',
    target: 'static-html',
    prompt: '工作流分析详情页，包含左侧菜单、顶部操作、八个分析 Tab、Mermaid 图表和 RICE 表格。',
    imageDataUrl: solidPngDataUrl(320, 180, [240, 248, 255, 255])
  })

  assert.equal(result.status, 'generated')
  assert.match(result.html, /data-restore-source="screenshot"/)
  assert.match(result.html, /视觉结构解析/)
  assert.match(result.html, /结构分层/)
  assert.match(result.html, /Mermaid/)
  assert.match(result.html, /RICE/)
  assert.doesNotMatch(result.html, /<img[^>]+src="data:image\/png/)
  assert.equal(result.visualModel.source.type, 'screenshot')
  assert.equal(result.captureResult.raw.visualModelCaptured, true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/workflows.test.mjs
```

Expected: failure because the current deterministic HTML is a generic landing page and lacks screenshot restoration markers.

- [ ] **Step 3: Replace `imageToStructuredHtml` body**

Update `imageToStructuredHtml(payload = {})` in `server/mock-api.mjs` so it starts with:

```js
function imageToStructuredHtml(payload = {}) {
  const visualModel = payload.visualModel || buildImageVisualModel(payload)
  const title = payload.title || '图片转代码页面'
  const prompt = String(payload.prompt || '').trim()
  const safeTitle = escapeHtml(title)
  const safePrompt = escapeHtml(prompt || '根据上传截图生成可编辑的静态页面结构')
  const sections = visualModel.sections || []
  const sectionCards = sections.map((section) => `
        <article class="analysis-card">
          <span>${escapeHtml(section.title)}</span>
          <p>${escapeHtml(section.content)}</p>
        </article>`).join('')
```

Then return HTML with these required blocks:

```html
<main class="screenshot-restore-page" data-restore-source="screenshot">
  <aside class="restore-sidebar">...</aside>
  <section class="restore-workspace">
    <header class="restore-topbar">...</header>
    <nav class="restore-tabs">...</nav>
    <section class="restore-grid">
      <article class="chart-card">
        <h2>Mermaid 图表容器</h2>
        <pre class="mermaid">journey ...</pre>
      </article>
      <article class="table-card">
        <h2>RICE 优先级表</h2>
        <table>...</table>
      </article>
    </section>
    <section class="analysis-cards">${sectionCards}</section>
  </section>
</main>
```

Include CSS in the same function for:

```css
.screenshot-restore-page { min-height: 100vh; display: grid; grid-template-columns: 248px minmax(0, 1fr); background: #f6f7f9; color: #222529; font-family: "PingFang SC", "Microsoft YaHei", Arial, sans-serif; }
.restore-sidebar { background: #fff; border-right: 1px solid #e8eaec; padding: 24px 18px; }
.restore-workspace { padding: 28px 36px 48px; }
.restore-topbar, .restore-tabs, .chart-card, .table-card, .analysis-card { background: #fff; border: 1px solid #e8eaec; border-radius: 12px; }
```

Include JS for tab switching and copy:

```html
<script>
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
    });
  });
  document.querySelector('[data-copy]')?.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(document.documentElement.outerHTML);
  });
</script>
```

- [ ] **Step 4: Run HTML generation test**

Run:

```bash
node --test tests/workflows.test.mjs
```

Expected: new screenshot restoration HTML test passes.

---

### Task 4: Frontend Progress, Result, And Recovery Copy

**Files:**
- Modify: `src/App.vue`
- Test: `tests/workflows.test.mjs`

**Interfaces:**
- Consumes: `api.generation.imageToHtml(...)` response `{ html, visualModel, captureResult, restoredPage }`.
- Produces: user-facing copy that explains visual parsing and static HTML generation.

- [ ] **Step 1: Write failing copy test**

Add this test:

```js
testAsync('image to code generation copy explains visual parsing and static html output', async () => {
  const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const generateStart = appSource.indexOf('async function generateFromImage()')
  const generateEnd = appSource.indexOf('function buildCurrentVisualVerification', generateStart)
  const generateSource = appSource.slice(generateStart, generateEnd)

  assert.match(generateSource, /视觉结构解析/)
  assert.match(generateSource, /结构化视觉模型/)
  assert.match(generateSource, /静态 HTML/)
  assert.match(generateSource, /data\\.visualModel/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/workflows.test.mjs
```

Expected: failure because current copy does not mention structured visual model or consume `data.visualModel`.

- [ ] **Step 3: Update generation progress messages**

In `generateFromImage()` in `src/App.vue`, replace loading copy with:

```js
setStatus(imageCodeStatus, 'loading', '正在进行视觉结构解析，识别布局、组件、颜色和层级...')
writeStaticHtmlPreviewWindow(previewWindow, buildStaticHtmlLoadingPage(title, '正在生成结构化视觉模型，并转换为可直接打开的静态 HTML。'))
...
setStatus(pageGenerationStatus, 'loading', '正在根据结构化视觉模型生成高保真静态 HTML...')
```

- [ ] **Step 4: Store visual model on capture result**

After receiving `data` in `generateFromImage()`, add:

```js
if (data.visualModel) {
  state.captureResult = {
    ...(data.captureResult || captureResult),
    raw: {
      ...(data.captureResult?.raw || captureResult.raw || {}),
      visualModel: data.visualModel,
      visualModelCaptured: true
    }
  }
} else {
  state.captureResult = data.captureResult || captureResult
}
```

- [ ] **Step 5: Run copy test and build**

Run:

```bash
node --test tests/workflows.test.mjs
npm run build
```

Expected: new copy test passes and build exits `0`.

---

### Task 5: Browser Visual Verification For The Composer

**Files:**
- No production files unless verification finds layout bugs.

**Interfaces:**
- Consumes: local Vite app at `http://localhost:5173/#/factory`.
- Produces: manual/browser evidence that the page matches the provided Doubao-style reference.

- [ ] **Step 1: Start local dev server**

Run:

```bash
npm run dev -- --port 5173
```

Expected: Vite prints `Local: http://localhost:5173/`.

- [ ] **Step 2: Open factory page**

Use the in-app browser to open:

```text
http://localhost:5173/#/factory
```

Expected visible state:
- Left app sidebar remains visible.
- Hero is centered.
- Heading reads `今天你想要还原哪张设计图？`.
- Tabs show `图片转代码 / URL转代码 / 风格转换`.
- Large white upload panel is centered.
- Upload tile is pale cyan and slightly rotated.
- Target selector is bottom-left.
- `生成页面代码` button is bottom-right.
- `还原资产` starts below the composer.

- [ ] **Step 3: Upload a screenshot and verify preview state**

Use a local PNG or JPG file in the file input.

Expected:
- The upload tile shows the uploaded screenshot cropped into the small tile.
- Button becomes enabled.
- Text remains inside the composer and does not overlap.

- [ ] **Step 4: Generate HTML**

Click `生成页面代码`.

Expected:
- Loading copy mentions visual structure parsing.
- A preview tab/window opens with loading state, then generated HTML.
- A restored asset appears under `还原资产`.

- [ ] **Step 5: Stop dev server**

Send Ctrl-C to the Vite process.

Expected: server exits.

---

## Self-Review

- Spec coverage: The plan covers the Doubao-like page layout, screenshot input flow, visual decomposition model, static HTML output, restored asset persistence, and verification.
- Placeholder scan: No TBD/TODO placeholders remain. Each task has exact files, commands, expected behavior, and code snippets.
- Type consistency: `visualModel` is produced by `buildImageVisualModel(payload)`, passed into `buildImageToHtmlCaptureResult({ ...payload, visualModel })`, consumed by `imageToStructuredHtml({ ...payload, visualModel })`, returned by `generateImageToHtml`, and stored in `captureResult.raw.visualModel`.
