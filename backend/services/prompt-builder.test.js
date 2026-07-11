import assert from 'node:assert/strict'
import test from 'node:test'
import { getSkillDefinition } from './skill-registry.js'
import { buildSkillPrompt } from './prompt-builder.js'

test('none skill uses compact free-canvas prompt without heavyweight handoff requirements', () => {
  const skill = getSkillDefinition('none')
  const prompt = buildSkillPrompt({
    skill,
    skillId: 'none',
    input: '为 Media 面板设计三个 Tab：My Media、Stock、AI Generate。',
    documents: [
      {
        name: 'long-prd.md',
        text: 'A'.repeat(2000)
      }
    ]
  })

  assert.equal(prompt.responseSchema, 'smart-canvas')
  assert.match(prompt.systemPrompt, /不选择 Skill/)
  assert.match(prompt.systemPrompt, /最多 4 个 groups/)
  assert.match(prompt.systemPrompt, /最多 8 个 nodes/)
  assert.match(prompt.systemPrompt, /不要输出 designMarkdown/)
  assert.doesNotMatch(prompt.systemPrompt, /必须明确前端接管、后端接管、接口契约/)
  assert.doesNotMatch(prompt.systemPrompt, /必须逐项满足以下质量检查/)
  assert.ok(prompt.userPrompt.length < 1800)
  assert.ok(prompt.userPrompt.includes('A'.repeat(500)))
  assert.ok(!prompt.userPrompt.includes('A'.repeat(1200)))
})
