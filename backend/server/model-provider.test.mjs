import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultWorkflowModelSettingsFromEnv } from './model-provider.mjs'

test('default workflow model settings keep local Codex CLI when no deployment key is configured', () => {
  const settings = defaultWorkflowModelSettingsFromEnv({}, '/repo')

  assert.equal(settings.provider, 'codex-cli')
  assert.equal(settings.baseUrl, '/repo')
  assert.equal(settings.defaultModel, 'gpt-5.5')
  assert.equal(settings.apiSurface, 'codex.exec')
  assert.equal(settings.timeoutMs, 600000)
  assert.equal(settings.enabled, true)
})

test('default workflow model settings use OpenAI-compatible deployment env key when configured', () => {
  const settings = defaultWorkflowModelSettingsFromEnv({
    OPENAI_API_KEY: 'deploy-key',
    OPENAI_BASE_URL: 'https://model.example/v1',
    OPENAI_DEFAULT_MODEL: 'gpt-deploy',
    OPENAI_API_SURFACE: 'responses',
    OPENAI_TIMEOUT_MS: '0'
  }, '/repo')

  assert.equal(settings.provider, 'openai-compatible')
  assert.equal(settings.apiKey, 'deploy-key')
  assert.equal(settings.baseUrl, 'https://model.example/v1')
  assert.equal(settings.defaultModel, 'gpt-deploy')
  assert.equal(settings.apiSurface, 'responses')
  assert.equal(settings.timeoutMs, 0)
})

test('default workflow model settings can explicitly select Codex proxy for CC Switch linked upstream', () => {
  const settings = defaultWorkflowModelSettingsFromEnv({
    WORKFLOW_AGENT_PROVIDER: 'codex-proxy',
    CODEX_DEFAULT_MODEL: 'gpt-5.5',
    CODEX_TIMEOUT_MS: '600000'
  }, '/repo')

  assert.equal(settings.provider, 'codex-proxy')
  assert.equal(settings.defaultModel, 'gpt-5.5')
  assert.equal(settings.apiSurface, 'responses')
  assert.equal(settings.timeoutMs, 600000)
  assert.equal(settings.enabled, true)
})
