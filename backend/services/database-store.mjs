/**
 * Database Store - Coze Supabase 数据库存储层
 * 
 * 【Coze 端改动 - Codex 请注意】
 * 本文件是 Coze 端新增的数据库存储层，用于线上持久化 workspace 数据。
 * 
 * 依赖：
 * - backend/src/storage/database/supabase-client.mjs（Supabase 客户端封装）
 * - 环境变量：COZE_SUPABASE_URL, COZE_SUPABASE_ANON_KEY（Coze 平台自动注入）
 * 
 * 数据库表结构：
 *   CREATE TABLE workspace_state (
 *     id TEXT PRIMARY KEY DEFAULT 'default',
 *     data JSONB NOT NULL DEFAULT '{}',
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 * 
 * 使用方式：
 * - workspace-store.js 在 load() 时调用 loadWorkspace()
 * - workspace-store.js 在 persistStore() 时调用 saveWorkspace(data)
 * - 如果数据库不可用，workspace-store.js 会自动回退到本地 JSON
 * 
 * 【Codex 改动建议】
 * 如果后续需要拆分表结构（users, projects, materials 等），请：
 * 1. 在本文件中新增对应的 CRUD 函数
 * 2. 修改 workspace-store.js 的 load/persistStore 逻辑
 * 3. 不要删除本文件，保持数据库模式作为线上的主存储
 */
import { getSupabaseClient, isSupabaseAvailable } from '../src/storage/database/supabase-client.mjs';

const TABLE_NAME = 'workspace_state';
const DEFAULT_ID = 'default';

/**
 * Load workspace state from database
 * @returns {Promise<object|null>} Workspace state data or null if not found
 */
async function loadWorkspace() {
  if (!await isSupabaseAvailable()) {
    return null;
  }

  try {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .select('data')
      .eq('id', DEFAULT_ID)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      throw error;
    }

    return data?.data || null;
  } catch (err) {
    console.error('[database-store] Failed to load workspace:', err.message);
    return null;
  }
}

/**
 * Save workspace state to database
 * @param {object} workspaceData - Workspace state data to save
 * @returns {Promise<boolean>} True if saved successfully
 */
async function saveWorkspace(workspaceData) {
  if (!await isSupabaseAvailable()) {
    return false;
  }

  try {
    const client = await getSupabaseClient();
    const { error } = await client
      .from(TABLE_NAME)
      .upsert({
        id: DEFAULT_ID,
        data: workspaceData,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (error) {
      throw error;
    }

    return true;
  } catch (err) {
    console.error('[database-store] Failed to save workspace:', err.message);
    return false;
  }
}

/**
 * Check if database storage is available
 * @returns {boolean}
 */
function isDatabaseAvailable() {
  return isSupabaseAvailable();
}

export { loadWorkspace, saveWorkspace, isDatabaseAvailable };
