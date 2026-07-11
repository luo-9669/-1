import assert from 'node:assert/strict'
import test from 'node:test'
import { runSkillGeneration } from './generation-runner.js'

function validSmartCanvasOutput() {
  return {
    intent: 'media-broll-panel',
    mode: 'free-canvas',
    canvasTitle: 'Media Broll 素材面板',
    canvasType: 'module-board',
    layoutRule: 'top-down',
    summary: '围绕三类素材分层管理和 Broll 使用闭环生成画布。',
    groups: [
      {
        groupId: 'media-tabs',
        groupName: '素材分层',
        groupDesc: '按素材来源拆分 Tab',
        nodes: [
          {
            nodeId: 'my-media',
            nodeType: 'module',
            nodeName: 'My Media',
            summary: '管理用户自有素材。',
            highlights: ['上传', '检索', '拖拽'],
            sections: [{ title: '能力', items: ['本地上传', '按文件名搜索'] }]
          }
        ]
      }
    ],
    edges: [],
    qualityReport: { passed: true, checks: [] }
  }
}

test('none skill retries once without maxOutputTokens when provider rejects token limit', async () => {
  const calls = []
  const provider = {
    name: 'openai-compatible',
    async generate(payload = {}) {
      calls.push(payload)
      if (payload.maxOutputTokens) throw new Error('openai_error')
      return {
        content: JSON.stringify(validSmartCanvasOutput()),
        usage: {},
        provider: 'openai-compatible',
        model: 'gpt-test'
      }
    }
  }

  const result = await runSkillGeneration({
    skillId: 'none',
    input: '为 Media 面板设计三个 Tab：My Media、Stock、AI Generate。',
    agentProvider: provider
  })

  assert.equal(result.status, 'generated')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].maxOutputTokens, 3200)
  assert.equal(calls[1].maxOutputTokens, undefined)
  assert.match(result.fallbackReason, /去掉输出 token 上限后重试成功/)
})

test('none skill retries once when model returns truncated JSON', async () => {
  const calls = []
  const provider = {
    name: 'openai-compatible',
    async generate(payload = {}) {
      calls.push(payload)
      if (calls.length === 1) {
        return {
          content: '{"intent":"media-broll-panel",',
          usage: {},
          provider: 'openai-compatible',
          model: 'gpt-test'
        }
      }
      return {
        content: JSON.stringify(validSmartCanvasOutput()),
        usage: {},
        provider: 'openai-compatible',
        model: 'gpt-test'
      }
    }
  }

  const result = await runSkillGeneration({
    skillId: 'none',
    input: '为 Media 面板设计三个 Tab：My Media、Stock、AI Generate。',
    agentProvider: provider
  })

  assert.equal(result.status, 'generated')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].maxOutputTokens, 3200)
  assert.equal(calls[1].maxOutputTokens, undefined)
  assert.match(result.fallbackReason, /JSON 解析失败/)
})
