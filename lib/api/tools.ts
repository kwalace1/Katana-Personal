/**
 * Server-side Katana AI tool executors — run with the end-user's JWT so RLS applies.
 * Results are JSON strings for the LLM only (never sent raw to the browser).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const MAX_ROWS = 20
const MAX_TASKS_IN_PROJECT = 40

const STRIP_KEYS = new Set([
  'organization_id',
  'user_id',
  'created_by',
  'assignee_employee_id',
  'reviewer_id',
  'anonymous_id',
  'password',
  'token',
])

export interface ToolUserContext {
  userId: string
  email: string
}

export function createUserScopedSupabase(
  supabaseUrl: string,
  anonKey: string,
  jwt: string,
): SupabaseClient {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function sanitizeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v
  if (Array.isArray(v)) return v.map(sanitizeValue)
  if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
    const o = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(o)) {
      if (STRIP_KEYS.has(k)) continue
      out[k] = sanitizeValue(val)
    }
    return out
  }
  return v
}

function sanitizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => sanitizeValue(r) as Record<string, unknown>)
}

export async function executeKatanaTool(
  supabase: SupabaseClient,
  ctx: ToolUserContext,
  name: string,
  argsJson: string,
): Promise<string> {
  let args: Record<string, unknown> = {}
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {}
  } catch {
    return JSON.stringify({ error: 'Invalid tool arguments JSON' })
  }

  try {
    switch (name) {
      case 'search_employees':
        return await toolSearchEmployees(supabase, String(args.query ?? ''))
      case 'get_employee_details':
        return await toolGetEmployeeDetails(supabase, String(args.employee_id ?? ''))
      case 'list_projects':
        return await toolListProjects(supabase, args.status_filter != null ? String(args.status_filter) : undefined)
      case 'get_project_details':
        return await toolGetProjectDetails(supabase, String(args.project_id ?? ''))
      case 'search_customers':
        return await toolSearchCustomers(supabase, args.query != null ? String(args.query) : undefined)
      case 'get_customer_details':
        return await toolGetCustomerDetails(supabase, String(args.client_id ?? ''))
      case 'list_jobs':
        return await toolListJobs(supabase)
      case 'get_inventory_summary':
        return await toolInventorySummary(supabase)
      case 'search_inventory':
        return await toolSearchInventory(supabase, String(args.query ?? ''))
      case 'list_open_purchase_orders':
        return await toolListOpenPurchaseOrders(supabase)
      case 'list_low_stock_items':
        return await toolListLowStockItems(supabase)
      case 'list_my_tasks':
        return await toolListMyTasks(supabase, ctx)
      case 'list_my_hr_goals':
        return await toolListMyHrGoals(supabase, ctx)
      case 'list_overdue_tasks':
        return await toolListOverdueTasks(supabase)
      case 'get_org_metrics':
        return await toolGetOrgMetrics(supabase)
      case 'search_technicians':
        return await toolSearchTechnicians(supabase, args.query != null ? String(args.query) : undefined)
      case 'list_wfm_jobs':
        return await toolListWFMJobs(supabase, args.status_filter != null ? String(args.status_filter) : undefined)
      case 'search_kyi_companies':
        return await toolSearchKYICompanies(supabase, args.query != null ? String(args.query) : undefined)
      case 'get_kyi_company_raise_summary':
        return await toolGetKyiCompanyRaiseSummary(
          supabase,
          args.company_id != null ? Number(args.company_id) : NaN,
        )
      case 'get_customer_portfolio_summary':
        return await toolGetCustomerPortfolioSummary(supabase)
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (e) {
    return JSON.stringify({
      error: e instanceof Error ? e.message : 'Tool execution failed',
    })
  }
}

async function toolSearchEmployees(supabase: SupabaseClient, query: string): Promise<string> {
  const q = query.trim()
  const sel =
    'id, name, position, department, status, email, hire_date, performance_score, location, bio, manager_id'
  if (!q) {
    const { data, error, count } = await supabase
      .from('hr_employees')
      .select(sel, { count: 'exact' })
      .order('name', { ascending: true })
      .limit(50)
    if (error) return JSON.stringify({ error: error.message })
    const rows = (data ?? []) as Record<string, unknown>[]
    return JSON.stringify({
      employees: sanitizeRows(rows),
      total_count: typeof count === 'number' ? count : rows.length,
      list_truncated: typeof count === 'number' ? count > rows.length : false,
    })
  }
  const p = `%${q.replace(/%/g, '')}%`
  const [byName, byEmail, byDept, byPos] = await Promise.all([
    supabase.from('hr_employees').select(sel).ilike('name', p).limit(MAX_ROWS),
    supabase.from('hr_employees').select(sel).ilike('email', p).limit(MAX_ROWS),
    supabase.from('hr_employees').select(sel).ilike('department', p).limit(MAX_ROWS),
    supabase.from('hr_employees').select(sel).ilike('position', p).limit(MAX_ROWS),
  ])
  const err = byName.error || byEmail.error || byDept.error || byPos.error
  if (err) return JSON.stringify({ error: err.message })
  const map = new Map<string, Record<string, unknown>>()
  for (const arr of [byName.data, byEmail.data, byDept.data, byPos.data]) {
    for (const row of arr ?? []) {
      const id = (row as { id: string }).id
      if (id) map.set(id, row as Record<string, unknown>)
    }
  }
  const merged = [...map.values()].slice(0, MAX_ROWS)
  return JSON.stringify({ employees: sanitizeRows(merged) })
}

async function toolGetEmployeeDetails(supabase: SupabaseClient, employeeId: string): Promise<string> {
  if (!employeeId) return JSON.stringify({ error: 'employee_id required' })
  const { data: emp, error: e1 } = await supabase
    .from('hr_employees')
    .select(
      'id, name, position, department, status, email, phone, hire_date, next_review_date, last_review_date, performance_score, location, timezone, bio',
    )
    .eq('id', employeeId)
    .maybeSingle()
  if (e1) return JSON.stringify({ error: e1.message })
  if (!emp) return JSON.stringify({ error: 'Employee not found or not accessible' })

  const { data: reviews } = await supabase
    .from('hr_performance_reviews')
    .select('review_period, review_type, review_date, collaboration, accountability, trustworthy, leadership, strengths, improvements, goals, trend, status')
    .eq('employee_id', employeeId)
    .order('review_date', { ascending: false })
    .limit(5)

  const { data: goals } = await supabase
    .from('hr_goals')
    .select('goal, category, progress, status, due_date, description, created_date')
    .eq('employee_id', employeeId)
    .order('due_date', { ascending: true })
    .limit(15)

  return JSON.stringify({
    employee: sanitizeValue(emp),
    recent_reviews: sanitizeRows((reviews ?? []) as Record<string, unknown>[]),
    goals: sanitizeRows((goals ?? []) as Record<string, unknown>[]),
  })
}

async function toolListProjects(supabase: SupabaseClient, statusFilter?: string): Promise<string> {
  let q = supabase
    .from('projects')
    .select('id, name, status, progress, deadline, total_tasks, completed_tasks, starred', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS)
  if (statusFilter?.trim()) {
    q = q.ilike('status', statusFilter.trim())
  }
  const { data, error, count } = await q
  if (error) return JSON.stringify({ error: error.message })
  const rows = (data ?? []) as Record<string, unknown>[]
  return JSON.stringify({
    projects: sanitizeRows(rows),
    total_count: typeof count === 'number' ? count : rows.length,
    list_truncated: typeof count === 'number' ? count > rows.length : false,
  })
}

async function toolGetProjectDetails(supabase: SupabaseClient, projectId: string): Promise<string> {
  if (!projectId) return JSON.stringify({ error: 'project_id required' })
  const { data: project, error: pe } = await supabase
    .from('projects')
    .select(
      'id, name, status, progress, deadline, total_tasks, completed_tasks, starred, owner_name, created_by_name',
    )
    .eq('id', projectId)
    .maybeSingle()
  if (pe) return JSON.stringify({ error: pe.message })
  if (!project) return JSON.stringify({ error: 'Project not found or not accessible' })

  const { data: tasks } = await supabase
    .from('tasks')
    .select(
      'title, status, priority, deadline, assignee_name, progress, description',
    )
    .eq('project_id', projectId)
    .order('order_index', { ascending: true })
    .limit(MAX_TASKS_IN_PROJECT)

  const { data: milestones } = await supabase
    .from('milestones')
    .select('name, status, date, description')
    .eq('project_id', projectId)
    .limit(20)

  return JSON.stringify({
    project: sanitizeValue(project),
    tasks: sanitizeRows((tasks ?? []) as Record<string, unknown>[]),
    milestones: sanitizeRows((milestones ?? []) as Record<string, unknown>[]),
  })
}

async function toolSearchCustomers(supabase: SupabaseClient, query?: string): Promise<string> {
  const sel =
    'id, name, status, health_score, nps_score, engagement_score, last_contact_date, industry, churn_risk, churn_trend, arr, renewal_date, portal_logins, feature_usage, support_tickets'
  const t = query?.trim()
  if (!t) {
    const { data, error, count } = await supabase
      .from('cs_clients')
      .select(sel, { count: 'exact' })
      .order('name', { ascending: true })
      .limit(MAX_ROWS)
    if (error) return JSON.stringify({ error: error.message })
    const rows = (data ?? []) as Record<string, unknown>[]
    return JSON.stringify({
      customers: sanitizeRows(rows),
      total_count: typeof count === 'number' ? count : rows.length,
      list_truncated: typeof count === 'number' ? count > rows.length : false,
    })
  }
  const p = `%${t.replace(/%/g, '')}%`
  const [byName, byInd, byStat] = await Promise.all([
    supabase.from('cs_clients').select(sel).ilike('name', p).limit(MAX_ROWS),
    supabase.from('cs_clients').select(sel).ilike('industry', p).limit(MAX_ROWS),
    supabase.from('cs_clients').select(sel).ilike('status', p).limit(MAX_ROWS),
  ])
  const err = byName.error || byInd.error || byStat.error
  if (err) return JSON.stringify({ error: err.message })
  const map = new Map<string, Record<string, unknown>>()
  for (const arr of [byName.data, byInd.data, byStat.data]) {
    for (const row of arr ?? []) {
      const id = (row as { id: string }).id
      if (id) map.set(id, row as Record<string, unknown>)
    }
  }
  return JSON.stringify({ customers: sanitizeRows([...map.values()].slice(0, MAX_ROWS)) })
}

async function toolGetCustomerDetails(supabase: SupabaseClient, clientId: string): Promise<string> {
  if (!clientId) return JSON.stringify({ error: 'client_id required' })
  const { data: client, error } = await supabase
    .from('cs_clients')
    .select(
      'id, name, status, health_score, nps_score, engagement_score, last_contact_date, industry, churn_risk, churn_trend, arr, renewal_date, feature_usage, support_tickets, portal_logins',
    )
    .eq('id', clientId)
    .maybeSingle()
  if (error) return JSON.stringify({ error: error.message })
  if (!client) return JSON.stringify({ error: 'Customer not found or not accessible' })

  const { data: tasks } = await supabase
    .from('cs_tasks')
    .select('title, status, priority, due_date')
    .eq('client_id', clientId)
    .limit(15)

  const { data: interactions } = await supabase
    .from('cs_interactions')
    .select('type, subject, description, interaction_date')
    .eq('client_id', clientId)
    .order('interaction_date', { ascending: false })
    .limit(10)

  return JSON.stringify({
    customer: sanitizeValue(client),
    open_tasks: sanitizeRows((tasks ?? []) as Record<string, unknown>[]),
    recent_interactions: sanitizeRows((interactions ?? []) as Record<string, unknown>[]),
  })
}

/** PostgREST when `inventory_items` (or related) is missing from the DB. */
function isInventorySchemaError(err: { message?: string } | null | undefined): boolean {
  const m = err?.message ?? ''
  return /inventory_items|42P01|does not exist|schema cache|Could not find the table/i.test(m)
}

function inventoryUnavailablePayload(): Record<string, unknown> {
  return {
    inventory_unavailable: true,
    total_active_items: 0,
    items: [],
    low_stock_count: 0,
    low_stock_sample: [],
    note: 'Inventory is not available from the database for this deployment (the inventory_items table is missing or not exposed). Tell the user to open Katana Inventory in the app, or ask an admin to provision inventory tables.',
  }
}

async function toolListJobs(supabase: SupabaseClient): Promise<string> {
  const { data, error, count } = await supabase
    .from('job_postings')
    .select('id, title, department, location, type, level, salary, posted_date, is_active', { count: 'exact' })
    .eq('is_active', true)
    .order('posted_date', { ascending: false })
    .limit(MAX_ROWS)
  if (error) return JSON.stringify({ error: error.message })
  const rows = (data ?? []) as Record<string, unknown>[]
  return JSON.stringify({
    jobs: sanitizeRows(rows),
    total_count: typeof count === 'number' ? count : rows.length,
    list_truncated: typeof count === 'number' ? count > rows.length : false,
  })
}

async function toolInventorySummary(supabase: SupabaseClient): Promise<string> {
  const countRes = await supabase
    .from('inventory_items')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
  if (countRes.error) {
    if (isInventorySchemaError(countRes.error)) return JSON.stringify(inventoryUnavailablePayload())
    return JSON.stringify({ error: countRes.error.message })
  }
  const totalActive = countRes.count ?? 0

  const scanLimit = Math.min(2500, Math.max(500, totalActive))
  const { data: items, error } = await supabase
    .from('inventory_items')
    .select('id, product_name, sku, on_hand_qty, min_qty, status, is_active')
    .eq('is_active', true)
    .limit(scanLimit)
  if (error) {
    if (isInventorySchemaError(error)) return JSON.stringify(inventoryUnavailablePayload())
    return JSON.stringify({ error: error.message })
  }
  const rows = (items ?? []) as {
    on_hand_qty?: number
    min_qty?: number
    product_name?: string
    status?: string
  }[]
  const lowStock = rows.filter(
    (r) =>
      typeof r.on_hand_qty === 'number' &&
      typeof r.min_qty === 'number' &&
      r.min_qty > 0 &&
      r.on_hand_qty <= r.min_qty,
  )
  const scanned = rows.length
  const lowPartial = totalActive > scanned && lowStock.length > 0
  return JSON.stringify({
    total_active_items: totalActive,
    low_stock_count: lowStock.length,
    low_stock_count_note: lowPartial
      ? `Low-stock count is from the first ${scanned} active items only; total active is ${totalActive}.`
      : undefined,
    low_stock_sample: lowStock.slice(0, 10).map((r) => ({
      product_name: r.product_name,
      on_hand_qty: r.on_hand_qty,
      min_qty: r.min_qty,
      status: r.status,
    })),
  })
}

async function toolSearchInventory(supabase: SupabaseClient, query: string): Promise<string> {
  const t = query.trim()
  const sel = 'product_name, sku, on_hand_qty, min_qty, location, category, status'
  if (!t) {
    const { data, error, count } = await supabase
      .from('inventory_items')
      .select(sel, { count: 'exact' })
      .eq('is_active', true)
      .order('product_name', { ascending: true })
      .limit(MAX_ROWS)
    if (error) {
      if (isInventorySchemaError(error)) return JSON.stringify(inventoryUnavailablePayload())
      return JSON.stringify({ error: error.message })
    }
    const rows = (data ?? []) as Record<string, unknown>[]
    return JSON.stringify({
      items: sanitizeRows(rows),
      total_active_count: typeof count === 'number' ? count : rows.length,
      list_truncated: typeof count === 'number' ? count > rows.length : false,
    })
  }
  const p = `%${t.replace(/%/g, '')}%`
  const [a, b, c] = await Promise.all([
    supabase.from('inventory_items').select(sel).eq('is_active', true).ilike('product_name', p).limit(MAX_ROWS),
    supabase.from('inventory_items').select(sel).eq('is_active', true).ilike('sku', p).limit(MAX_ROWS),
    supabase.from('inventory_items').select(sel).eq('is_active', true).ilike('category', p).limit(MAX_ROWS),
  ])
  const err = a.error || b.error || c.error
  if (err) {
    if (isInventorySchemaError(err)) return JSON.stringify(inventoryUnavailablePayload())
    return JSON.stringify({ error: err.message })
  }
  const map = new Map<string, Record<string, unknown>>()
  const key = (r: Record<string, unknown>) => `${r.product_name}|${r.sku}`
  for (const arr of [a.data, b.data, c.data]) {
    for (const row of arr ?? []) {
      map.set(key(row as Record<string, unknown>), row as Record<string, unknown>)
    }
  }
  return JSON.stringify({ items: sanitizeRows([...map.values()].slice(0, MAX_ROWS)) })
}

async function toolListOpenPurchaseOrders(supabase: SupabaseClient): Promise<string> {
  const { data, error, count } = await supabase
    .from('purchase_orders')
    .select(
      'id, po_number, supplier_name, status, total, created_date, expected_date, notes',
      { count: 'exact' },
    )
    .in('status', ['open', 'pending', 'draft'])
    .order('created_date', { ascending: false })
    .limit(MAX_ROWS)

  if (error) {
    if (isInventorySchemaError(error)) return JSON.stringify(inventoryUnavailablePayload())
    return JSON.stringify({ error: error.message })
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  return JSON.stringify({
    purchase_orders: sanitizeRows(rows),
    open_po_count: typeof count === 'number' ? count : rows.length,
    list_truncated: typeof count === 'number' ? count > rows.length : false,
  })
}

async function toolListLowStockItems(supabase: SupabaseClient): Promise<string> {
  const { data, error, count } = await supabase
    .from('inventory_items')
    .select(
      'id, sku, product_name, on_hand_qty, min_qty, reorder_qty, unit_cost, supplier_name, status, location',
      { count: 'exact' },
    )
    .eq('is_active', true)
    .in('status', ['low-stock', 'out-of-stock'])
    .order('on_hand_qty', { ascending: true })
    .limit(MAX_ROWS)

  if (error) {
    if (isInventorySchemaError(error)) return JSON.stringify(inventoryUnavailablePayload())
    return JSON.stringify({ error: error.message })
  }

  const rows = (data ?? []) as {
    sku?: string
    product_name?: string
    on_hand_qty?: number
    min_qty?: number
    reorder_qty?: number
    unit_cost?: number
    supplier_name?: string | null
    status?: string
  }[]

  const bySupplier = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = (row.supplier_name?.trim() || 'Unassigned supplier').toLowerCase()
    if (!bySupplier.has(key)) bySupplier.set(key, [])
    bySupplier.get(key)!.push(row)
  }

  const reorder_groups = [...bySupplier.entries()].map(([_, items]) => {
    const supplierName = items[0]?.supplier_name?.trim() || 'Unassigned supplier'
    const suggestedTotal = items.reduce((sum, item) => {
      const qty = Math.max(item.reorder_qty || (item.min_qty ?? 0) * 2 || 1, 1)
      return sum + qty * (item.unit_cost ?? 0)
    }, 0)
    return {
      supplier_name: supplierName,
      item_count: items.length,
      suggested_po_total: Math.round(suggestedTotal * 100) / 100,
      items: items.slice(0, 8).map((item) => ({
        sku: item.sku,
        product_name: item.product_name,
        on_hand_qty: item.on_hand_qty,
        min_qty: item.min_qty,
        status: item.status,
      })),
    }
  })

  return JSON.stringify({
    low_stock_count: typeof count === 'number' ? count : rows.length,
    list_truncated: typeof count === 'number' ? count > rows.length : false,
    reorder_groups: reorder_groups.slice(0, 10),
    note: 'Use reorder_groups to suggest draft POs grouped by supplier. Link user to Purchase Orders or Inventory hub for actions.',
  })
}

async function toolListMyTasks(supabase: SupabaseClient, ctx: ToolUserContext): Promise<string> {
  const email = (ctx.email ?? '').trim()
  if (!email) return JSON.stringify({ tasks: [], note: 'No email on session' })

  // Resolve login email → employee name so we can match the assignee_name string field on tasks
  const { data: emp } = await supabase
    .from('hr_employees')
    .select('id, name')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()

  const assigneeName = (emp as { name?: string } | null)?.name
  if (!assigneeName) {
    return JSON.stringify({
      tasks: [],
      note: 'No HR employee profile found matching your login email. Tasks may be assigned under a different name — try searching by project instead.',
    })
  }

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('title, status, priority, deadline, progress, description, project_id')
    .ilike('assignee_name', assigneeName)
    .not('status', 'in', '("done","completed","cancelled")')
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(50)

  if (error) return JSON.stringify({ error: error.message })

  const trows = (tasks ?? []) as { project_id?: string }[]

  // Enrich with project names
  const pids = [...new Set(trows.map((t) => t.project_id).filter(Boolean))] as string[]
  let projectNames: Record<string, string> = {}
  if (pids.length) {
    const { data: projects } = await supabase.from('projects').select('id, name').in('id', pids)
    projectNames = Object.fromEntries(
      ((projects ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]),
    )
  }

  const enriched = trows.map((t) => ({
    ...(sanitizeValue(t) as Record<string, unknown>),
    project_name: t.project_id ? projectNames[t.project_id] ?? 'Unknown project' : null,
  }))

  return JSON.stringify({
    matched_employee_name: assigneeName,
    open_task_count: enriched.length,
    tasks: sanitizeRows(enriched as Record<string, unknown>[]),
  })
}

async function toolListMyHrGoals(supabase: SupabaseClient, ctx: ToolUserContext): Promise<string> {
  const email = (ctx.email ?? '').trim()
  if (!email) return JSON.stringify({ goals: [], note: 'No email on session' })

  const { data: emp, error: e1 } = await supabase
    .from('hr_employees')
    .select('id, name')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()
  if (e1) return JSON.stringify({ error: e1.message })
  if (!emp) return JSON.stringify({ goals: [], note: 'No HR employee profile matches your sign-in email' })

  const { data: goals, error: e2 } = await supabase
    .from('hr_goals')
    .select('goal, category, progress, status, due_date, description, created_date')
    .eq('employee_id', (emp as { id: string }).id)
    .order('due_date', { ascending: true })
    .limit(25)
  if (e2) return JSON.stringify({ error: e2.message })
  return JSON.stringify({
    matched_employee_name: (emp as { name?: string }).name,
    goals: sanitizeRows((goals ?? []) as Record<string, unknown>[]),
  })
}

async function toolListOverdueTasks(supabase: SupabaseClient): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('title, status, priority, deadline, assignee_name, project_id')
    .lt('deadline', today)
    .not('status', 'in', '("done","completed","cancelled")')
    .order('deadline', { ascending: true })
    .limit(40)
  if (error) return JSON.stringify({ error: error.message })
  // Secondary safety filter for case variants the DB filter may miss
  const trows = ((tasks ?? []) as { project_id?: string; status?: string }[]).filter((t) => {
    const s = String(t.status ?? '')
    return !/^(done|completed|cancelled)$/i.test(s)
  })
  const pids = [...new Set(trows.map((t) => t.project_id).filter(Boolean))] as string[]
  let names: Record<string, string> = {}
  if (pids.length) {
    const { data: projects } = await supabase.from('projects').select('id, name').in('id', pids)
    names = Object.fromEntries((projects ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))
  }
  const enriched = trows.map((t) => ({
    ...(sanitizeValue(t) as Record<string, unknown>),
    project_name: t.project_id ? names[t.project_id] ?? 'Unknown project' : null,
  }))
  return JSON.stringify({ overdue_tasks: enriched })
}

/** Head-count style metrics for the user's organization (RLS-scoped). */
async function toolGetOrgMetrics(supabase: SupabaseClient): Promise<string> {
  const head = { count: 'exact' as const, head: true as const }
  const [emp, proj, cust, inv, goals, jobs, techs, wfmJobs, kyiLeads] = await Promise.all([
    supabase.from('hr_employees').select('id', head),
    supabase.from('projects').select('id', head),
    supabase.from('cs_clients').select('id', head),
    supabase.from('inventory_items').select('id', head).eq('is_active', true),
    supabase.from('hr_goals').select('id', head),
    supabase.from('job_postings').select('id', head).eq('is_active', true),
    supabase.from('wfm_technicians').select('id', head).eq('is_active', true),
    supabase.from('wfm_jobs').select('id', head).eq('is_active', true),
    supabase.from('kyi_investor_leads').select('id', head),
  ])
  const coreErr = emp.error || proj.error || cust.error
  if (coreErr) return JSON.stringify({ error: coreErr.message })
  return JSON.stringify({
    hr_employee_count: emp.count ?? 0,
    project_count: proj.count ?? 0,
    customer_count: cust.count ?? 0,
    active_inventory_item_count: inv.error ? null : (inv.count ?? 0),
    hr_goal_count: goals.error ? null : (goals.count ?? 0),
    active_job_posting_count: jobs.error ? null : (jobs.count ?? 0),
    wfm_technician_count: techs.error ? null : (techs.count ?? 0),
    active_wfm_job_count: wfmJobs.error ? null : (wfmJobs.count ?? 0),
    kyi_investor_lead_count: kyiLeads.error ? null : (kyiLeads.count ?? 0),
  })
}

const KYI_LEAD_SEL =
  'id, client_id, entity_type, display_name, city, state, country, zip_code, raw_score'

async function enrichKyiLeadRows(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const cidSet = new Set<number>()
  for (const r of rows) {
    const n = Number((r as { client_id?: unknown }).client_id)
    if (Number.isFinite(n)) cidSet.add(n)
  }
  const ids = [...cidSet]
  if (ids.length === 0) {
    return rows.map((r) => ({ ...r, company_name: null, industry: null }))
  }
  const { data: companies, error } = await supabase
    .from('kyi_companies')
    .select('id, name, industry')
    .in('id', ids)
  if (error || !companies?.length) {
    return rows.map((r) => ({ ...r, company_name: null, industry: null }))
  }
  const byId = new Map<number, { name: string; industry: string | null }>()
  for (const c of companies as { id: number; name: string; industry: string | null }[]) {
    byId.set(c.id, { name: c.name, industry: c.industry })
  }
  return rows.map((r) => {
    const cid = Number((r as { client_id?: unknown }).client_id)
    const co = Number.isFinite(cid) ? byId.get(cid) : undefined
    return {
      ...r,
      company_name: co?.name ?? null,
      industry: co?.industry ?? null,
    }
  })
}

async function toolSearchTechnicians(supabase: SupabaseClient, query?: string): Promise<string> {
  const sel = 'id, name, email, phone, role, status, skills, hourly_rate'
  const t = query?.trim()
  if (!t) {
    const { data, error, count } = await supabase
      .from('wfm_technicians')
      .select(sel, { count: 'exact' })
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(MAX_ROWS)
    if (error) return JSON.stringify({ error: error.message })
    const rows = (data ?? []) as Record<string, unknown>[]
    return JSON.stringify({
      technicians: sanitizeRows(rows),
      total_count: typeof count === 'number' ? count : rows.length,
      list_truncated: typeof count === 'number' ? count > rows.length : false,
    })
  }
  const p = `%${t.replace(/%/g, '')}%`
  const [byName, byRole] = await Promise.all([
    supabase.from('wfm_technicians').select(sel).eq('is_active', true).ilike('name', p).limit(MAX_ROWS),
    supabase.from('wfm_technicians').select(sel).eq('is_active', true).ilike('role', p).limit(MAX_ROWS),
  ])
  const err = byName.error || byRole.error
  if (err) return JSON.stringify({ error: err.message })
  const map = new Map<string, Record<string, unknown>>()
  for (const arr of [byName.data, byRole.data]) {
    for (const row of arr ?? []) {
      const id = (row as { id: string }).id
      if (id) map.set(id, row as Record<string, unknown>)
    }
  }
  const merged = [...map.values()].slice(0, MAX_ROWS)
  return JSON.stringify({ technicians: sanitizeRows(merged) })
}

async function toolListWFMJobs(supabase: SupabaseClient, statusFilter?: string): Promise<string> {
  const sel =
    'id, job_number, title, status, priority, start_date, end_date, customer_name, location_address, technician_id'
  let q = supabase
    .from('wfm_jobs')
    .select(sel, { count: 'exact' })
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(MAX_ROWS)
  if (statusFilter?.trim()) {
    q = q.ilike('status', statusFilter.trim())
  }
  const { data, error, count } = await q
  if (error) return JSON.stringify({ error: error.message })
  let rows = (data ?? []) as Record<string, unknown>[]

  // Resolve technician IDs to names so the LLM can report who is assigned
  const techIds = [...new Set(rows.map((r) => r.technician_id).filter(Boolean))] as string[]
  if (techIds.length > 0) {
    const { data: techs } = await supabase
      .from('wfm_technicians')
      .select('id, name')
      .in('id', techIds)
    const techMap = Object.fromEntries(
      ((techs ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]),
    )
    rows = rows.map(({ technician_id, ...rest }) => ({
      ...rest,
      technician_name: technician_id ? (techMap[technician_id as string] ?? null) : null,
    }))
  } else {
    rows = rows.map(({ technician_id, ...rest }) => ({ ...rest, technician_name: null }))
  }

  return JSON.stringify({
    wfm_jobs: sanitizeRows(rows),
    total_count: typeof count === 'number' ? count : rows.length,
    list_truncated: typeof count === 'number' ? count > rows.length : false,
  })
}

async function toolSearchKYICompanies(supabase: SupabaseClient, query?: string): Promise<string> {
  const t = query?.trim()
  if (!t) {
    const { data, error, count } = await supabase
      .from('kyi_investor_leads')
      .select(KYI_LEAD_SEL, { count: 'exact' })
      .order('display_name', { ascending: true })
      .limit(MAX_ROWS)
    if (error) return JSON.stringify({ error: error.message })
    const rows = (data ?? []) as Record<string, unknown>[]
    const enriched = sanitizeRows(await enrichKyiLeadRows(supabase, rows))
    return JSON.stringify({
      companies: enriched,
      total_count: typeof count === 'number' ? count : rows.length,
      list_truncated: typeof count === 'number' ? count > rows.length : false,
    })
  }
  const p = `%${t.replace(/%/g, '')}%`
  const [byDisplayName, byCity, byZip, byState, byCompaniesName, byCompaniesIndustry] = await Promise.all([
    supabase.from('kyi_investor_leads').select(KYI_LEAD_SEL).ilike('display_name', p).limit(MAX_ROWS),
    supabase.from('kyi_investor_leads').select(KYI_LEAD_SEL).ilike('city', p).limit(MAX_ROWS),
    supabase.from('kyi_investor_leads').select(KYI_LEAD_SEL).ilike('zip_code', p).limit(MAX_ROWS),
    supabase.from('kyi_investor_leads').select(KYI_LEAD_SEL).ilike('state', p).limit(MAX_ROWS),
    supabase.from('kyi_companies').select('id').ilike('name', p).limit(MAX_ROWS),
    supabase.from('kyi_companies').select('id').ilike('industry', p).limit(MAX_ROWS),
  ])
  const err =
    byDisplayName.error ||
    byCity.error ||
    byZip.error ||
    byState.error ||
    byCompaniesName.error ||
    byCompaniesIndustry.error
  if (err) return JSON.stringify({ error: err.message })

  const companyIds = new Set<number>()
  for (const arr of [byCompaniesName.data, byCompaniesIndustry.data]) {
    for (const row of arr ?? []) {
      const id = Number((row as { id?: unknown }).id)
      if (Number.isFinite(id)) companyIds.add(id)
    }
  }
  const cidList = [...companyIds].slice(0, MAX_ROWS)
  let leadsForCompanies: Record<string, unknown>[] = []
  if (cidList.length > 0) {
    const { data: lc, error: le } = await supabase
      .from('kyi_investor_leads')
      .select(KYI_LEAD_SEL)
      .in('client_id', cidList)
      .limit(MAX_ROWS)
    if (le) return JSON.stringify({ error: le.message })
    leadsForCompanies = (lc ?? []) as Record<string, unknown>[]
  }

  const map = new Map<number, Record<string, unknown>>()
  for (const arr of [byDisplayName.data, byCity.data, byZip.data, byState.data, leadsForCompanies]) {
    for (const row of arr ?? []) {
      const id = Number((row as { id?: unknown }).id)
      if (Number.isFinite(id)) map.set(id, row as Record<string, unknown>)
    }
  }
  const merged = [...map.values()].slice(0, MAX_ROWS)
  const enriched = sanitizeRows(await enrichKyiLeadRows(supabase, merged))
  return JSON.stringify({ companies: enriched })
}

async function toolGetKyiCompanyRaiseSummary(
  supabase: SupabaseClient,
  companyId: number,
): Promise<string> {
  if (!Number.isFinite(companyId)) {
    return JSON.stringify({ error: 'company_id required (numeric KYI company id)' })
  }
  const { data: company, error: cErr } = await supabase
    .from('kyi_companies')
    .select('id, name, industry, raise_stage')
    .eq('id', companyId)
    .maybeSingle()
  if (cErr) return JSON.stringify({ error: cErr.message })
  if (!company) return JSON.stringify({ error: 'Company not found or not accessible' })

  const { data: targeted, error: tErr } = await supabase
    .from('kyi_investors')
    .select('id, full_name, outreach_status, email, phone, profile_url, updated_at, segment_type')
    .eq('company_id', companyId)
    .eq('segment_type', 'targeted_investor')
  if (tErr) return JSON.stringify({ error: tErr.message })

  const outreach_by_status: Record<string, number> = {
    new: 0,
    contacted: 0,
    meeting: 0,
    passed: 0,
  }
  const staleCutoff = Date.now() - 14 * 86400000
  let missing_contact_info = 0
  let stale_outreach = 0
  for (const row of targeted ?? []) {
    const st = String((row as { outreach_status?: string }).outreach_status ?? 'new')
    outreach_by_status[st] = (outreach_by_status[st] ?? 0) + 1
    if (!(row as { email?: string }).email && !(row as { phone?: string }).phone && !(row as { profile_url?: string }).profile_url) {
      missing_contact_info++
    }
    const updated = (row as { updated_at?: string }).updated_at
    if (st === 'new' && updated && new Date(updated).getTime() < staleCutoff) stale_outreach++
  }

  let last_lead_import_at: string | null = null
  try {
    const { data: meta } = await supabase
      .from('kyi_platform_metadata')
      .select('value')
      .eq('key', 'last_lead_import_at')
      .maybeSingle()
    const val = meta?.value as { at?: string } | string | null
    last_lead_import_at = typeof val === 'string' ? val : val?.at ?? null
  } catch {
    /* table may not exist */
  }

  return JSON.stringify({
    company_id: companyId,
    company_name: (company as { name: string }).name,
    industry: (company as { industry: string | null }).industry,
    raise_stage: (company as { raise_stage: string | null }).raise_stage,
    targeted_total: (targeted ?? []).length,
    outreach_by_status,
    missing_contact_info,
    stale_outreach,
    last_lead_import_at,
    note: 'Use KYI Contacts → Targeted for full list. Stale = status new with no update in 14+ days.',
  })
}

async function toolGetCustomerPortfolioSummary(supabase: SupabaseClient): Promise<string> {
  const sel =
    'id, name, status, health_score, nps_score, engagement_score, last_contact_date, churn_risk, arr, renewal_date, support_tickets, outreach_status, lifecycle_stage'
  const { data, error } = await supabase.from('cs_clients').select(sel).limit(500)
  if (error) return JSON.stringify({ error: error.message })

  const rows = (data ?? []) as Record<string, unknown>[]
  const customers = rows.filter(
    (r) => !r.lifecycle_stage || String(r.lifecycle_stage) === 'customer',
  )

  const outreach_by_status: Record<string, number> = {
    none: 0,
    planned: 0,
    contacted: 0,
    meeting: 0,
    completed: 0,
    at_risk: 0,
  }

  const now = Date.now()
  let at_risk_count = 0
  let renewals_within_90d = 0
  let renewals_within_30d = 0
  let stale_contact_30d = 0
  let arr_at_risk = 0
  let healthSum = 0
  const attention_samples: Record<string, unknown>[] = []

  for (const row of customers) {
    const status = String(row.status ?? '')
    const health = Number(row.health_score) || 0
    healthSum += health
    if (status === 'at-risk') {
      at_risk_count++
      arr_at_risk += Number(row.arr) || 0
    }

    const outreach = String(row.outreach_status ?? 'none')
    outreach_by_status[outreach] = (outreach_by_status[outreach] ?? 0) + 1

    const renewal = row.renewal_date ? new Date(String(row.renewal_date)).getTime() : NaN
    if (!isNaN(renewal)) {
      const days = Math.floor((renewal - now) / 86400000)
      if (days >= 0 && days <= 90) renewals_within_90d++
      if (days >= 0 && days <= 30) renewals_within_30d++
    }

    const lastContact = row.last_contact_date ? new Date(String(row.last_contact_date)).getTime() : NaN
    const daysSinceContact = isNaN(lastContact)
      ? 999
      : Math.floor((now - lastContact) / 86400000)
    if (daysSinceContact >= 30) stale_contact_30d++

    const tickets = Number(row.support_tickets) || 0
    const nps = Number(row.nps_score) || 0
    const needsAttention =
      status === 'at-risk' || daysSinceContact >= 30 || tickets >= 3 || nps <= 6
    if (needsAttention && attention_samples.length < 8) {
      attention_samples.push({
        id: row.id,
        name: row.name,
        status,
        health_score: health,
        churn_risk: row.churn_risk,
        renewal_date: row.renewal_date,
        arr: row.arr,
        days_since_contact: daysSinceContact >= 999 ? null : daysSinceContact,
        support_tickets: tickets,
      })
    }
  }

  return JSON.stringify({
    total_customers: customers.length,
    at_risk_count,
    renewals_within_90d,
    renewals_within_30d,
    stale_contact_30d,
    arr_at_risk,
    avg_health_score: customers.length ? Math.round(healthSum / customers.length) : 0,
    outreach_by_status,
    accounts_needing_attention_sample: sanitizeRows(attention_samples),
    note: 'Open Katana Customers → Intelligence for signal breakdown and ICP fit. Use search_customers for named lookups.',
  })
}
