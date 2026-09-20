import { getSupabase } from '@/lib/supabase'
import { urlBase64ToUint8Array } from '@/lib/web-notify'

export type PushPayload = {
  title: string
  body: string
  href?: string
  tag?: string
}

export function pushConfigured(): boolean {
  return Boolean((import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim())
}

/** Subscribe this browser to web push and return JSON subscription (or null). */
export async function subscribeToWebPush(): Promise<string | null> {
  const vapid = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim()
  if (!vapid || !('serviceWorker' in navigator) || !('PushManager' in window)) return null

  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    }))
  return JSON.stringify(sub.toJSON())
}

export async function sendPushToSelf(payload: PushPayload): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase()
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.access_token) {
    return { ok: false, error: 'Sign in to the cloud to use background push.' }
  }

  const res = await fetch('/api/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error || `Push failed (${res.status})` }
  }
  return { ok: true }
}

/** Fan-out a social notification to another user's push subscription (best-effort). */
export async function sendPushToUser(
  uid: string,
  payload: PushPayload,
): Promise<{ ok: boolean; delivered?: boolean; error?: string }> {
  if (!uid || !payload.title?.trim() || !payload.body?.trim()) {
    return { ok: false, error: 'uid, title, and body required' }
  }

  const supabase = getSupabase()
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.access_token) {
    return { ok: false, error: 'Not signed in' }
  }

  try {
    const res = await fetch('/api/push/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        uid,
        title: payload.title,
        body: payload.body,
        href: payload.href || '/social',
        tag: payload.tag || `social-${uid.slice(0, 8)}`,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      delivered?: boolean
      error?: string
    }
    if (!res.ok) {
      return { ok: false, error: data.error || `Notify failed (${res.status})` }
    }
    return { ok: true, delivered: data.delivered === true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Notify failed' }
  }
}

export type ScheduledNudge = PushPayload & {
  fire_at: string
  kind: string
}

/** Upsert the next server-delivered nudge (requires cloud sign-in). */
export async function schedulePushNudge(nudge: ScheduledNudge): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase()
  const session = (await supabase.auth.getSession()).data.session
  if (!session?.access_token) return { ok: false, error: 'Not signed in' }

  const res = await fetch('/api/push/schedule', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(nudge),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error || `Schedule failed (${res.status})` }
  }
  return { ok: true }
}
