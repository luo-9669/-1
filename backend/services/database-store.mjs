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
