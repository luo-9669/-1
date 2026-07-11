import './env-loader.mjs'
import { createAgentProviderFromEnv, createAgentProviderFromModelSettings } from '../services/llm-provider.js'
import { getModelSettingsRaw, saveModelSettings } from '../services/workspace-store.js'

function boolEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim())
}

function numberEnv(value, fallback) {
  if (value === 0 || value === '0') return 0
  const number = Number(value || fallback)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

export function defaultWorkflowModelSettingsFromEnv(env = process.env, cwd = process.cwd()) {
  const explicitProvider = String(env.WORKFLOW_AGENT_PROVIDER || '').trim()
  const hasOpenAiKey = Boolean(String(env.OPENAI_API_KEY || '').trim())
  const provider = explicitProvider ||
    (hasOpenAiKey ? 'openai-compatible' : 'codex-cli')
  if (provider === 'openai-compatible') {
    return {
      provider,
      apiKey: env.OPENAI_API_KEY || '',
      baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      defaultModel: env.OPENAI_DEFAULT_MODEL || env.CODEX_DEFAULT_MODEL || 'gpt-5.5',
      apiSurface: env.OPENAI_API_SURFACE || 'responses',
      timeoutMs: numberEnv(env.OPENAI_TIMEOUT_MS || env.CODEX_TIMEOUT_MS, 600000),
      fallback: env.WORKFLOW_AGENT_FALLBACK || 'deterministic',
      allowInsecureTLS: boolEnv(env.OPENAI_ALLOW_INSECURE_TLS),
      enabled: true
    }
  }
  if (provider === 'codex-proxy') {
    return {
      provider,
      apiKey: '',
      baseUrl: '',
      defaultModel: env.OPENAI_DEFAULT_MODEL || env.CODEX_DEFAULT_MODEL || 'gpt-5.5',
      apiSurface: env.OPENAI_API_SURFACE || 'responses',
      timeoutMs: numberEnv(env.OPENAI_TIMEOUT_MS || env.CODEX_TIMEOUT_MS, 600000),
      fallback: env.WORKFLOW_AGENT_FALLBACK || 'deterministic',
      allowInsecureTLS: boolEnv(env.OPENAI_ALLOW_INSECURE_TLS),
      enabled: true
    }
  }
  if (provider === 'deterministic') {
    return {
      provider,
      apiKey: '',
      baseUrl: '',
      defaultModel: env.OPENAI_DEFAULT_MODEL || env.CODEX_DEFAULT_MODEL || 'gpt-5.5',
      apiSurface: 'responses',
      timeoutMs: numberEnv(env.OPENAI_TIMEOUT_MS || env.CODEX_TIMEOUT_MS, 600000),
      fallback: 'deterministic',
      allowInsecureTLS: false,
      enabled: false
    }
  }
  return {
    provider: 'codex-cli',
    apiKey: env.CICADA_LLM_API_KEY || env.OPENAI_API_KEY || '',
    baseUrl: env.CODEX_WORKSPACE_DIR || cwd,
    defaultModel: env.OPENAI_DEFAULT_MODEL || env.CODEX_DEFAULT_MODEL || 'gpt-5.5',
    apiSurface: 'codex.exec',
    timeoutMs: numberEnv(env.OPENAI_TIMEOUT_MS || env.CODEX_TIMEOUT_MS, 600000),
    fallback: env.WORKFLOW_AGENT_FALLBACK || 'deterministic',
    allowInsecureTLS: false,
    enabled: true
  }
}

export const CICADA_LLM_MODEL_SETTINGS = defaultWorkflowModelSettingsFromEnv()

function isPlaceholderApiKey(apiKey = '') {
  return !String(apiKey || '').trim() || String(apiKey || '').trim() === 'PROXY_MANAGED'
}

function hasUsableStoredSettings(settings = {}) {
  if (!settings?.provider) return false
  if (settings.provider === 'deterministic') return true
  if (!settings.enabled) return false
  if (settings.provider === 'codex-cli' || settings.provider === 'codex-proxy') return true
  if (settings.provider === 'openai-compatible') {
    return !isPlaceholderApiKey(settings.apiKey) && Boolean(settings.baseUrl)
  }
  return false
}

export async function ensureCicadaModelSettings(store, { isTestRuntime = false } = {}) {
  if (isTestRuntime) return
  const settings = getModelSettingsRaw(store)
  if (hasUsableStoredSettings(settings)) return
  const nextSettings = {
    ...CICADA_LLM_MODEL_SETTINGS,
    apiKey: isPlaceholderApiKey(CICADA_LLM_MODEL_SETTINGS.apiKey) ? settings?.apiKey || '' : CICADA_LLM_MODEL_SETTINGS.apiKey
  }
  const alreadyCicada = settings?.provider === nextSettings.provider &&
    settings?.baseUrl === nextSettings.baseUrl &&
    settings?.defaultModel === nextSettings.defaultModel &&
    settings?.apiSurface === nextSettings.apiSurface &&
    Number(settings?.timeoutMs) === nextSettings.timeoutMs &&
    Boolean(settings?.allowInsecureTLS) === nextSettings.allowInsecureTLS &&
    Boolean(settings?.enabled) === Boolean(nextSettings.enabled)
  if (alreadyCicada) return
  await saveModelSettings(store, nextSettings)
}

export function createDefaultWorkflowAgentProvider({ isTestRuntime = false, fetchImpl } = {}) {
  if (isTestRuntime) {
    return createAgentProviderFromEnv(process.env, fetchImpl || globalThis.fetch)
  }
  return createAgentProviderFromModelSettings(defaultWorkflowModelSettingsFromEnv())
}
