import { supabase } from './supabase'

async function authHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export interface PlaidStatusResponse {
  configured: boolean
  items: {
    id: string
    institution_name: string | null
    last_synced_at: string | null
    status: string
  }[]
}

export async function getPlaidStatus(): Promise<PlaidStatusResponse> {
  const headers = await authHeaders()
  const res = await fetch('/api/finance-plaid?action=status', { headers })
  if (!res.ok) throw new Error('Failed to load Plaid status')
  return res.json() as Promise<PlaidStatusResponse>
}

export async function fetchPlaidLinkToken(): Promise<string> {
  const headers = await authHeaders()
  const res = await fetch('/api/finance-plaid?action=link_token', { headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to create link token')
  return data.link_token as string
}

export async function exchangePlaidPublicToken(publicToken: string): Promise<{
  item_id: string
  accounts_linked: number
}> {
  const headers = await authHeaders()
  const res = await fetch('/api/finance-plaid?action=exchange', {
    method: 'POST',
    headers,
    body: JSON.stringify({ public_token: publicToken }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to link bank')
  return data
}

export async function syncPlaidTransactions(): Promise<{ added: number; skipped: number }> {
  const headers = await authHeaders()
  const res = await fetch('/api/finance-plaid?action=sync', {
    method: 'POST',
    headers,
    body: '{}',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Sync failed')
  return data
}
