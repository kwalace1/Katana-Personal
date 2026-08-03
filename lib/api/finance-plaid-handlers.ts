/**
 * Plaid server handlers — shared by Vercel API route and Vite dev middleware.
 * Tokens never touch the browser.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || ''
const PLAID_SECRET = process.env.PLAID_SECRET || ''
const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox') as 'sandbox' | 'development' | 'production'

const PLAID_HOSTS: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
}

export function isPlaidConfigured(): boolean {
  return Boolean(PLAID_CLIENT_ID && PLAID_SECRET)
}

function plaidBase(): string {
  return PLAID_HOSTS[PLAID_ENV] ?? PLAID_HOSTS.sandbox
}

async function plaidPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${plaidBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      ...body,
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    const msg = (data as { error_message?: string }).error_message ?? res.statusText
    throw new Error(msg)
  }
  return data as T
}

export async function authenticateFinancePlaid(
  req: Request,
): Promise<{ userId: string; orgId: string; token: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ') || !SUPABASE_URL) return null
  const token = authHeader.slice(7)

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  })
  if (!res.ok) return null
  const user = await res.json()
  if (!user?.id) return null

  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.id}&select=organization_id`,
    { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY } },
  )
  const profiles = await profileRes.json()
  const orgId = profiles?.[0]?.organization_id
  if (!orgId) return null

  return { userId: user.id, orgId, token }
}

function adminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Supabase service role not configured')
  return createClient(SUPABASE_URL, SERVICE_KEY)
}

export async function createLinkToken(userId: string, orgId: string): Promise<{ link_token: string }> {
  if (!isPlaidConfigured()) throw new Error('Plaid is not configured (PLAID_CLIENT_ID, PLAID_SECRET)')

  const data = await plaidPost<{ link_token: string }>('/link/token/create', {
    user: { client_user_id: `${orgId}:${userId}` },
    client_name: 'Katana Finance',
    products: ['transactions'],
    country_codes: ['US'],
    language: 'en',
  })
  return data
}

interface ExchangeResult {
  item_id: string
  access_token: string
}

export async function exchangePublicToken(
  orgId: string,
  userId: string,
  publicToken: string,
): Promise<{ item_id: string; accounts_linked: number }> {
  const exchanged = await plaidPost<ExchangeResult>('/item/public_token/exchange', {
    public_token: publicToken,
  })

  const itemMeta = await plaidPost<{
    item: { institution_id: string | null }
    institution: { name: string } | null
  }>('/item/get', { access_token: exchanged.access_token })

  const admin = adminClient()
  const { data: plaidItem, error } = await admin
    .from('fin_plaid_items')
    .upsert(
      {
        organization_id: orgId,
        item_id: exchanged.item_id,
        access_token: exchanged.access_token,
        institution_name: itemMeta.institution?.name ?? null,
        institution_id: itemMeta.item.institution_id,
        status: 'active',
        error_message: null,
        created_by_user_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,item_id' },
    )
    .select('*')
    .single()
  if (error) throw error

  const accountsRes = await plaidPost<{
    accounts: {
      account_id: string
      name: string
      mask: string | null
      subtype: string | null
      type: string
      balances: { current: number | null }
    }[]
  }>('/accounts/get', { access_token: exchanged.access_token })

  let linked = 0
  for (const acct of accountsRes.accounts) {
    if (acct.type !== 'depository' && acct.type !== 'credit') continue

    const kind =
      acct.type === 'credit'
        ? 'credit_card'
        : acct.subtype === 'savings'
          ? 'savings'
          : 'checking'

    const { data: existing } = await admin
      .from('fin_financial_accounts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('plaid_account_id', acct.account_id)
      .maybeSingle()

    if (existing) {
      await admin
        .from('fin_financial_accounts')
        .update({
          name: acct.name,
          mask: acct.mask,
          plaid_item_id: exchanged.item_id,
          plaid_item_uuid: plaidItem.id,
          opening_balance: acct.balances.current ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      const { data: coaRows } = await admin
        .from('fin_accounts')
        .select('id, account_type')
        .eq('organization_id', orgId)
        .in('account_type', kind === 'credit_card' ? ['credit_card'] : ['bank'])
        .limit(1)

      await admin.from('fin_financial_accounts').insert({
        organization_id: orgId,
        name: acct.name,
        institution: itemMeta.institution?.name ?? null,
        account_kind: kind,
        mask: acct.mask,
        coa_account_id: coaRows?.[0]?.id ?? null,
        opening_balance: acct.balances.current ?? 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
        plaid_item_id: exchanged.item_id,
        plaid_item_uuid: plaidItem.id,
        plaid_account_id: acct.account_id,
        is_active: true,
      })
    }
    linked += 1
  }

  await syncPlaidTransactions(orgId, plaidItem.id)

  return { item_id: exchanged.item_id, accounts_linked: linked }
}

export async function syncPlaidTransactions(
  orgId: string,
  plaidItemUuid: string,
): Promise<{ added: number; skipped: number }> {
  const admin = adminClient()
  const { data: item, error } = await admin
    .from('fin_plaid_items')
    .select('*')
    .eq('id', plaidItemUuid)
    .eq('organization_id', orgId)
    .single()
  if (error || !item) throw error ?? new Error('Plaid item not found')

  const { data: finAccounts } = await admin
    .from('fin_financial_accounts')
    .select('id, plaid_account_id')
    .eq('organization_id', orgId)
    .eq('plaid_item_uuid', plaidItemUuid)

  const accountByPlaidId = Object.fromEntries(
    (finAccounts ?? [])
      .filter((a) => a.plaid_account_id)
      .map((a) => [a.plaid_account_id as string, a.id as string]),
  )

  let cursor = item.transactions_cursor as string | null
  let added = 0
  let skipped = 0
  let hasMore = true

  while (hasMore) {
    const syncRes = await plaidPost<{
      added: {
        transaction_id: string
        account_id: string
        date: string
        name: string
        amount: number
      }[]
      has_more: boolean
      next_cursor: string
    }>('/transactions/sync', {
      access_token: item.access_token,
      cursor: cursor ?? undefined,
    })

    const batchId = crypto.randomUUID()
    for (const txn of syncRes.added) {
      const finAccountId = accountByPlaidId[txn.account_id]
      if (!finAccountId) continue

      const amount = -txn.amount
      const { data: dup } = await admin
        .from('fin_bank_transactions')
        .select('id')
        .eq('organization_id', orgId)
        .eq('plaid_transaction_id', txn.transaction_id)
        .maybeSingle()

      if (dup) {
        skipped += 1
        continue
      }

      const { error: insErr } = await admin.from('fin_bank_transactions').insert({
        organization_id: orgId,
        financial_account_id: finAccountId,
        transaction_date: txn.date,
        description: txn.name,
        amount,
        status: 'uncategorized',
        plaid_transaction_id: txn.transaction_id,
        import_batch_id: batchId,
      })
      if (!insErr) added += 1
    }

    cursor = syncRes.next_cursor
    hasMore = syncRes.has_more
  }

  await admin
    .from('fin_plaid_items')
    .update({
      transactions_cursor: cursor,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', plaidItemUuid)

  return { added, skipped }
}

export async function syncAllPlaidItems(orgId: string): Promise<{ added: number; skipped: number }> {
  const admin = adminClient()
  const { data: items } = await admin
    .from('fin_plaid_items')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'active')

  let added = 0
  let skipped = 0
  for (const item of items ?? []) {
    const result = await syncPlaidTransactions(orgId, item.id)
    added += result.added
    skipped += result.skipped
  }
  return { added, skipped }
}

export async function getPlaidStatus(orgId: string): Promise<{
  configured: boolean
  items: { id: string; institution_name: string | null; last_synced_at: string | null; status: string }[]
}> {
  if (!isPlaidConfigured()) return { configured: false, items: [] }
  if (!SERVICE_KEY) return { configured: true, items: [] }

  const admin = adminClient()
  const { data } = await admin
    .from('fin_plaid_items')
    .select('id, institution_name, last_synced_at, status')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  return {
    configured: true,
    items: (data ?? []).map((i) => ({
      id: i.id as string,
      institution_name: i.institution_name as string | null,
      last_synced_at: i.last_synced_at as string | null,
      status: i.status as string,
    })),
  }
}

export async function handleFinancePlaidRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') ?? 'status'
    const auth = await authenticateFinancePlaid(req)
    if (!auth) return json({ error: 'Unauthorized' }, 401)

    if (action === 'status') {
      const status = await getPlaidStatus(auth.orgId)
      return json(status)
    }

    if (!isPlaidConfigured()) {
      return json({ error: 'Plaid is not configured on the server' }, 503)
    }

    if (action === 'link_token') {
      const token = await createLinkToken(auth.userId, auth.orgId)
      return json(token)
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const body = await req.json().catch(() => ({})) as Record<string, string>

    if (action === 'exchange') {
      if (!body.public_token) return json({ error: 'public_token required' }, 400)
      const result = await exchangePublicToken(auth.orgId, auth.userId, body.public_token)
      return json(result)
    }

    if (action === 'sync') {
      const result = await syncAllPlaidItems(auth.orgId)
      return json(result)
    }

    if (action === 'sync_item' && body.plaid_item_id) {
      const result = await syncPlaidTransactions(auth.orgId, body.plaid_item_id)
      return json(result)
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Plaid request failed' }, 500)
  }
}
