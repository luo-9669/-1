import assert from 'node:assert/strict'
import test from 'node:test'

import { getSupabaseClient, isSupabaseAvailable } from './supabase-client.mjs'

test('supabase client initializes when Coze database env vars are present', async () => {
  const previousUrl = process.env.COZE_SUPABASE_URL
  const previousAnonKey = process.env.COZE_SUPABASE_ANON_KEY

  process.env.COZE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.COZE_SUPABASE_ANON_KEY = 'test-anon-key'

  try {
    assert.equal(await isSupabaseAvailable(), true)
    const client = await getSupabaseClient()
    assert.ok(client)
  } finally {
    if (previousUrl === undefined) delete process.env.COZE_SUPABASE_URL
    else process.env.COZE_SUPABASE_URL = previousUrl
    if (previousAnonKey === undefined) delete process.env.COZE_SUPABASE_ANON_KEY
    else process.env.COZE_SUPABASE_ANON_KEY = previousAnonKey
  }
})
