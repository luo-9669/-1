import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export async function downloadZip(projectName, files) {
  const zip = new JSZip()
  files.forEach((file) => {
    zip.file(file.path, file.content, file.encoding === 'base64' ? { base64: true } : undefined)
  })
  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, `${projectName}.zip`)
}

export function createReactViteFiles({ title = 'Generated Vue Site', palette = {} } = {}) {
  return createVueViteFiles({ title: title.replace('React', 'Vue'), palette })
}

export function createVueViteFiles({ title = 'Generated Vue Preview', palette = {} } = {}) {
  const primary = palette.primary || '#246bfe'
  const background = palette.background || '#f7f9fc'
  const text = palette.text || '#172033'

  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { '@vitejs/plugin-vue': 'latest', vite: 'latest', vue: 'latest' },
        devDependencies: {}
      }, null, 2)
    },
    {
      path: 'index.html',
      content: '<div id="app"></div><script type="module" src="/src/main.js"></script>\n'
    },
    {
      path: 'src/main.js',
      content: "import { createApp } from 'vue'\nimport App from './App.vue'\nimport './styles.css'\n\ncreateApp(App).mount('#app')\n"
    },
    {
      path: 'src/App.vue',
      content: `<template>\n  <main class="page">\n    <section class="workspace">\n      <p class="eyebrow">UX preview</p>\n      <h1>${title}</h1>\n      <div class="grid">\n        <article v-for="item in items" :key="item.title">\n          <strong>{{ item.title }}</strong>\n          <span>{{ item.desc }}</span>\n        </article>\n      </div>\n    </section>\n  </main>\n</template>\n\n<script setup>\nconst items = [\n  { title: '方案结构', desc: '根据 UX Skill 输出的信息架构生成。' },\n  { title: '关键流程', desc: '保留可预览页面和交互说明。' },\n  { title: '风格参考', desc: '接入代码生成服务后会读取项目代码与颜色库。' }\n]\n</script>\n`
    },
    {
      path: 'src/styles.css',
      content: `:root { color: ${text}; background: ${background}; font-family: Inter, system-ui, sans-serif; }\nbody { margin: 0; }\n.page { min-height: 100vh; background: ${background}; padding: 56px; box-sizing: border-box; }\n.workspace { max-width: 1080px; margin: 0 auto; }\n.eyebrow { color: ${primary}; font-weight: 800; }\nh1 { font-size: 48px; margin: 12px 0 32px; letter-spacing: 0; }\n.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }\narticle { background: #fff; border: 1px solid #e3e7ef; border-radius: 8px; padding: 22px; }\nstrong { display: block; margin-bottom: 12px; }\nspan { color: #687386; line-height: 1.7; }\n@media (max-width: 760px) { .page { padding: 24px; } .grid { grid-template-columns: 1fr; } h1 { font-size: 34px; } }\n`
    }
  ]
}
