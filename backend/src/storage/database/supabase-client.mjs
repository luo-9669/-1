/**
 * Supabase Client - Coze 内置数据库客户端封装
 * 
 * 【Coze 端改动 - Codex 请注意】
 * 本文件封装了 Coze 内置 Supabase 数据库的连接逻辑。
 * 
 * 环境变量（Coze 平台自动注入）：
 * - COZE_SUPABASE_URL: Supabase 项目 URL
 * - COZE_SUPABASE_ANON_KEY: Supabase 匿名 Key
 * 
 * 使用方式：
 *   import { getSupabaseClient, isSupabaseAvailable } from './supabase-client.mjs';
 *   
 *   if (await isSupabaseAvailable()) {
 *     const supabase = await getSupabaseClient();
 *     const { data } = await supabase.from('workspace_state').select('*');
 *   }
 * 
 * 依赖：@supabase/supabase-js（已添加到 backend/package.json）
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

let envLoaded = false;

async function loadEnv() {
  if (envLoaded || (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY)) {
    return;
  }

  try {
    try {
      // Try dotenv if available
      const dotenv = await import('dotenv');
      dotenv.config();
      if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
        envLoaded = true;
        return;
      }
    } catch {
      // dotenv not available
    }

    // Try Coze workload identity
    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }

    envLoaded = true;
  } catch {
    // Silently fail
  }
}

async function getSupabaseCredentials() {
  await loadEnv();

  const url = process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('COZE_SUPABASE_URL is not set');
  }
  if (!anonKey) {
    throw new Error('COZE_SUPABASE_ANON_KEY is not set');
  }

  return { url, anonKey };
}

function getSupabaseServiceRoleKey() {
  loadEnv();
  return process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
}

async function getSupabaseClient(token) {
  await loadEnv();
  const { url, anonKey } = getSupabaseCredentials();

  let key;
  if (token) {
    key = anonKey;
  } else {
    const serviceRoleKey = getSupabaseServiceRoleKey();
    key = serviceRoleKey ?? anonKey;
  }

  const globalOptions = {};
  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }

  return createClient(url, key, {
    global: globalOptions,
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function isSupabaseAvailable() {
  try {
    await loadEnv();
    return !!(process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY);
  } catch {
    return false;
  }
}

export { loadEnv, getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient, isSupabaseAvailable };
