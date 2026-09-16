import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export type PushSendPayload = {
  title: string
  body: string
  href?: string
  tag?: string
}

export type PushEnv = {
  vapidPublicKey: string
  vapidPrivateKey: string
  vapidSubject: string
  supabaseUrl: string
  supabaseServiceKey: string
  cronSecret?: string
}

export function readPushEnv(): PushEnv {
  return {
    vapidPublicKey: process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:katanatechnologysystems@gmail.com',
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    cronSecret: process.env.CRON_SECRET || '',
  }
}

export function pushServerConfigured(env: PushEnv = readPushEnv()): boolean {
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey && env.supabaseUrl && env.supabaseServiceKey)
}

function adminClient(env: PushEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function configureWebPush(env: PushEnv) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey)
}

async function sendToSubscription(subscriptionJson: string, payload: PushSendPayload, env: PushEnv) {
  configureWebPush(env)
  const subscription = JSON.parse(subscriptionJson) as webpush.PushSubscription
  await webpush.sendNotification(
    subscription,
    JSON.stringify({
      notification: { title: payload.title, body: payload.body },
      data: { href: payload.href || '/', tag: payload.tag || 'katana-push' },
    }),
  )
}

async function loadUserToken(uid: string, env: PushEnv): Promise<string | null> {
  const sb = adminClient(env)
  const { data, error } = await sb.from('push_tokens').select('token').eq('uid', uid).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.token) return null
  if (data.token.startsWith('web-opt-in:')) return null
  return data.token
}

async function verifyUserToken(req: Request, env: PushEnv): Promise<string | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !env.supabaseUrl) return null

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  if (!anonKey) return null

  const userClient = createClient(env.supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await userClient.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

export async function handlePushSendRequest(req: Request, env: PushEnv = readPushEnv()): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!pushServerConfigured(env)) {
    return Response.json({ error: 'Push not configured on server (VAPID + Supabase service key).' }, { status: 503 })
  }

  const uid = await verifyUserToken(req, env)
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let payload: PushSendPayload
  try {
    payload = (await req.json()) as PushSendPayload
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!payload.title?.trim() || !payload.body?.trim()) {
    return Response.json({ error: 'title and body required' }, { status: 400 })
  }

  const subscriptionJson = await loadUserToken(uid, env)
  if (!subscriptionJson) {
    return Response.json(
      { error: 'No push subscription — enable browser notifications while signed in.' },
      { status: 404 },
    )
  }

  try {
    await sendToSubscription(subscriptionJson, payload, env)
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Push delivery failed' },
      { status: 502 },
    )
  }
}

export type SchedulePayload = PushSendPayload & {
  fire_at: string
  kind?: string
}

export async function handlePushScheduleRequest(req: Request, env: PushEnv = readPushEnv()): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!pushServerConfigured(env)) {
    return Response.json({ error: 'Push schedule not configured' }, { status: 503 })
  }

  const uid = await verifyUserToken(req, env)
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: SchedulePayload
  try {
    body = (await req.json()) as SchedulePayload
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.title?.trim() || !body.body?.trim() || !body.fire_at) {
    return Response.json({ error: 'title, body, and fire_at required' }, { status: 400 })
  }

  const sb = adminClient(env)
  const row = {
    uid,
    kind: body.kind || 'orchestration',
    title: body.title,
    body: body.body,
    href: body.href || '/dashboard',
    tag: body.tag || 'katana-scheduled',
    fire_at: body.fire_at,
    sent_at: null as string | null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await sb.from('push_schedules').upsert(row, { onConflict: 'uid,kind' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function handlePushCronRequest(req: Request, env: PushEnv = readPushEnv()): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!pushServerConfigured(env)) {
    return Response.json({ error: 'Push cron not configured' }, { status: 503 })
  }

  const secret = req.headers.get('authorization')?.replace('Bearer ', '') || req.headers.get('x-cron-secret') || ''
  if (!env.cronSecret || secret !== env.cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = adminClient(env)
  const now = new Date().toISOString()
  const { data: due, error } = await sb
    .from('push_schedules')
    .select('uid, kind, title, body, href, tag')
    .is('sent_at', null)
    .lte('fire_at', now)
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  let sent = 0
  const errors: string[] = []

  for (const row of due || []) {
    try {
      const token = await loadUserToken(row.uid, env)
      if (!token) {
        await sb
          .from('push_schedules')
          .update({ sent_at: now, updated_at: now })
          .eq('uid', row.uid)
          .eq('kind', row.kind)
        continue
      }
      await sendToSubscription(
        token,
        { title: row.title, body: row.body, href: row.href, tag: row.tag },
        env,
      )
      await sb
        .from('push_schedules')
        .update({ sent_at: now, updated_at: now })
        .eq('uid', row.uid)
        .eq('kind', row.kind)
      sent++
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'send failed')
    }
  }

  return Response.json({ ok: true, sent, errors })
}
