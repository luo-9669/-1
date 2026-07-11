import assert from 'node:assert/strict'
import test from 'node:test'
import { exportBlueprintMarkdown } from '../frontend/src/services/projectBlueprint.js'

test('exports partial imported project blueprints without crashing knowledge rendering', () => {
  const markdown = exportBlueprintMarkdown({
    title: 'Jogg interaction blueprint',
    framework: { title: 'Jogg app', children: [{ title: 'Create flow' }] },
    demoScreens: [
      { id: 'home', title: 'Home', description: 'Open workspace', actions: [{ label: 'Create', to: 'editor' }] },
      { id: 'editor', title: 'Editor', description: 'Edit video' }
    ]
  })

  assert.match(markdown, /# Jogg interaction blueprint/)
  assert.match(markdown, /## 产品框架/)
  assert.match(markdown, /Create flow/)
  assert.match(markdown, /## 可交互 Demo/)
  assert.match(markdown, /点击 Create -> editor/)
})

test('exports interaction details for every demo page in markdown', () => {
  const markdown = exportBlueprintMarkdown({
    title: 'Full page interaction blueprint',
    demoScreens: [
      {
        id: 'home',
        title: 'Home',
        route: '/',
        description: 'Entry page',
        actions: [
          {
            id: 'home-next',
            label: 'Next',
            type: 'guardedNavigate',
            targetScreenId: 'studio',
            guard: 'login',
            rect: { x: 80, y: 70, width: 10, height: 6 }
          }
        ]
      },
      {
        id: 'pricing',
        title: 'Pricing',
        route: '/pricing',
        description: 'Plan selection page',
        actions: []
      },
      {
        id: 'login',
        title: 'Login',
        route: '/login',
        description: 'Authentication modal page'
      }
    ]
  })

  assert.match(markdown, /## 页面交互细节/)
  assert.match(markdown, /### Home/)
  assert.match(markdown, /\| 点击对象 \| 类型 \| 目标 \| 守卫\/条件 \| 点击区域 \| 说明 \|/)
  assert.match(markdown, /\| Next \| guardedNavigate \| studio \| login \| x=80%, y=70%, w=10%, h=6% \| Entry page \|/)
  assert.match(markdown, /### Pricing/)
  assert.match(markdown, /页面路径：`\/pricing`/)
  assert.match(markdown, /\| 暂无点击热区 \| - \| - \| - \| - \| Plan selection page \|/)
  assert.match(markdown, /### Login/)
  assert.match(markdown, /页面路径：`\/login`/)
  assert.match(markdown, /## 交互路径汇总/)
  assert.match(markdown, /- Home -- Next \/ guardedNavigate \/ login --> studio/)
  assert.match(markdown, /- Pricing：暂无可跳转交互/)
  assert.match(markdown, /- Login：暂无可跳转交互/)
})

test('appends full page interaction details to existing design markdown', () => {
  const markdown = exportBlueprintMarkdown({
    title: 'Legacy markdown blueprint',
    designMarkdown: '# Legacy markdown blueprint\n\n## 项目档案\n- old',
    demoScreens: [
      {
        id: 'home',
        title: 'Home',
        route: '/',
        actions: [{ label: 'Open Pricing', type: 'navigate', targetScreenId: 'pricing' }]
      },
      {
        id: 'pricing',
        title: 'Pricing',
        route: '/pricing',
        actions: []
      }
    ]
  })

  assert.match(markdown, /# Legacy markdown blueprint/)
  assert.match(markdown, /## 页面交互细节/)
  assert.match(markdown, /### Home/)
  assert.match(markdown, /### Pricing/)
  assert.match(markdown, /- Home -- Open Pricing \/ navigate \/ - --> pricing/)
  assert.match(markdown, /- Pricing：暂无可跳转交互/)
})
