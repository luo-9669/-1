import { createAgentProviderFromEnv, createAgentProviderFromModelSettings } from '../services/llm-provider.js'
import { getModelSettingsRaw, saveModelSettings } from '../services/workspace-store.js'

export const CICADA_LLM_MODEL_SETTINGS = {
  provider: 'codex-cli',
  apiKey: process.env.CICADA_LLM_API_KEY || process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.CODEX_WORKSPACE_DIR || process.cwd(),
  defaultModel: 'gpt-5.5',
  apiSurface: 'codex.exec',
  timeoutMs: 600000,
  fallback: 'deterministic',
  allowInsecureTLS: false,
  enabled: true
}

function isPlaceholderApiKey(apiKey = '') {
  return !String(apiKey || '').trim() || String(apiKey || '').trim() === 'PROXY_MANAGED'
}

export async function ensureCicadaModelSettings(store, { isTestRuntime = false } = {}) {
  if (isTestRuntime) return
  const settings = getModelSettingsRaw(store)
  if (settings?.enabled && settings?.provider === 'codex-cli' && settings?.defaultModel === CICADA_LLM_MODEL_SETTINGS.defaultModel) return
  if (settings?.enabled && settings?.provider && !isPlaceholderApiKey(settings?.apiKey) && settings?.baseUrl && settings?.apiSurface === CICADA_LLM_MODEL_SETTINGS.apiSurface) return
  if (isPlaceholderApiKey(CICADA_LLM_MODEL_SETTINGS.apiKey) && isPlaceholderApiKey(settings?.apiKey)) return
  const nextSettings = {
    ...CICADA_LLM_MODEL_SETTINGS,
    apiKey: isPlaceholderApiKey(CICADA_LLM_MODEL_SETTINGS.apiKey) ? settings?.apiKey || '' : CICADA_LLM_MODEL_SETTINGS.apiKey
  }
  const alreadyCicada = settings?.enabled &&
    settings?.provider === CICADA_LLM_MODEL_SETTINGS.provider &&
    settings?.baseUrl === CICADA_LLM_MODEL_SETTINGS.baseUrl &&
    settings?.defaultModel === CICADA_LLM_MODEL_SETTINGS.defaultModel &&
    settings?.apiSurface === CICADA_LLM_MODEL_SETTINGS.apiSurface &&
    Number(settings?.timeoutMs) === CICADA_LLM_MODEL_SETTINGS.timeoutMs &&
    Boolean(settings?.allowInsecureTLS) === CICADA_LLM_MODEL_SETTINGS.allowInsecureTLS
  if (alreadyCicada) return
  await saveModelSettings(store, nextSettings)
}

export function createDefaultWorkflowAgentProvider({ isTestRuntime = false, fetchImpl } = {}) {
  if (isTestRuntime) {
    return createAgentProviderFromEnv(process.env, fetchImpl || globalThis.fetch)
  }
  return createAgentProviderFromModelSettings(CICADA_LLM_MODEL_SETTINGS)
}
