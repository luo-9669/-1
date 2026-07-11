import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { join } from 'node:path'

const appVue = readFileSync(join(process.cwd(), 'frontend/src/App.vue'), 'utf8')

test('chat-only workflow stages use dialogue-style agent state without default trace timeline', () => {
  assert.match(
    appVue,
    /const usesDialogueStyleAgent\s*=\s*isDialogueSkillRun\s*\|\|\s*workflowAgentIsChatOnlyScope\(targetScopeId\)/,
    'sendWorkflowAgentMessage should treat the first chat-only workflow stages like dialogue runs'
  )

  assert.doesNotMatch(
    appVue,
    /const skipKnowledgeRetrieval\s*=\s*isDialogueSkillRun\b/,
    'chat-only workflow stages should skip knowledge retrieval/status trace the same way dialogue runs do'
  )

  assert.match(
    appVue,
    /const suppressTrace\s*=\s*state\.activeWorkflowRun\?\.skillId\s*===\s*'dialogue-skill'\s*\|\|\s*workflowAgentIsChatOnlyScope\(scopeId\)/,
    'stream trace events should be suppressed for chat-only workflow stages'
  )

  assert.doesNotMatch(
    appVue,
    /state\.activeWorkflowRun\?\.skillId\s*===\s*'dialogue-skill'\s*&&\s*event\.type\s*===\s*'trace'/,
    'stream trace suppression must not be limited to dialogue-skill'
  )
})
