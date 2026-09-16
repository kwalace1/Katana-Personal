import { createClient } from '@supabase/supabase-js'

export type AccountDeleteEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceKey: string
}

export function readAccountDeleteEnv(): AccountDeleteEnv {
  return {
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  }
}

async function uidFromBearer(req: Request, env: AccountDeleteEnv): Promise<string | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !env.supabaseUrl || !env.supabaseAnonKey) return null
  const userClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await userClient.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

/** POST /api/account/delete — erase Together account for the signed-in user. */
export async function handleAccountDeleteRequest(
  req: Request,
  env: AccountDeleteEnv = readAccountDeleteEnv(),
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const uid = await uidFromBearer(req, env)
  if (!uid) return Response.json({ error: 'Sign in to delete your Together account.' }, { status: 401 })

  if (!env.supabaseServiceKey) {
    return Response.json({ error: 'Account deletion isn’t available in this build.', localOk: true }, { status: 503 })
  }

  const admin = createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const tables: Array<{ table: string; column: string }> = [
    { table: 'workspace_collections', column: 'user_id' },
    { table: 'workspace_meta', column: 'user_id' },
    { table: 'push_tokens', column: 'uid' },
    { table: 'notifications', column: 'uid' },
    { table: 'activity', column: 'uid' },
    { table: 'streaks', column: 'uid' },
    { table: 'together_posts', column: 'author_id' },
    { table: 'profiles', column: 'uid' },
  ]

  for (const { table, column } of tables) {
    const { error } = await admin.from(table).delete().eq(column, uid)
    if (error && !/schema cache|does not exist/i.test(error.message)) {
      return Response.json({ error: error.message }, { status: 502 })
    }
  }

  const { error: authError } = await admin.auth.admin.deleteUser(uid)
  if (authError) return Response.json({ error: authError.message }, { status: 502 })

  return Response.json({ ok: true })
}
