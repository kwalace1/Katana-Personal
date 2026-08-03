/**
 * Cross-module integrations for Katana Workforce (Phase C)
 * Customers → Work, Time → Finance, Inventory on completion, Projects links
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import { createJob, getJob, updateJob, getTimesheets, getTechnician, type Job } from './wfm-api'
import { createInvoice } from './customer-crm-api'
import type { LineItem } from './customer-crm-api'
import { performCheckOut, getInventoryItem } from './inventory-api'
import { workforceTabPath } from './wfm-deep-links'
import { getTodayDateKey } from './due-date-utils'

export interface WfmJobPart {
  id: string
  job_id: string
  item_id: string
  quantity: number
  checked_out: boolean
  notes: string | null
  created_at: string
  updated_at: string
  item_name?: string
  item_sku?: string
}

export interface CreateWorkOrderInput {
  clientId: string
  title: string
  description?: string
  customerName?: string | null
  startDate?: string
  endDate?: string
  projectId?: string | null
  taskId?: string | null
}

export interface DraftInvoiceResult {
  ok: boolean
  invoiceId?: string
  invoiceNumber?: string
  href?: string
  error?: string
}

export interface JobPartsCheckoutResult {
  checkedOut: number
  errors: string[]
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Create a workforce work item from CRM / customer context */
export async function createWorkOrderFromClient(input: CreateWorkOrderInput): Promise<Job | null> {
  const today = input.startDate ?? getTodayDateKey()
  return createJob({
    title: input.title,
    description: input.description ?? null,
    client_id: input.clientId,
    customer_name: input.customerName ?? null,
    customer_phone: null,
    customer_email: null,
    location: null,
    location_address: null,
    status: 'assigned',
    priority: 'medium',
    technician_id: null,
    start_date: today,
    end_date: input.endDate ?? addDays(7),
    start_time: null,
    end_time: null,
    estimated_hours: null,
    actual_hours: null,
    notes: null,
    completion_notes: null,
    is_active: true,
    project_id: input.projectId ?? null,
    task_id: input.taskId ?? null,
    invoice_id: null,
  })
}

/** Draft a CRM invoice from approved/logged time on a job */
export async function createDraftInvoiceFromJob(
  jobId: string,
  options?: { hourlyRate?: number; includePending?: boolean },
): Promise<DraftInvoiceResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase not configured' }
  }

  const job = await getJob(jobId)
  if (!job) return { ok: false, error: 'Job not found' }
  if (!job.client_id) {
    return { ok: false, error: 'Link a customer before creating an invoice' }
  }
  if (job.invoice_id) {
    return {
      ok: true,
      invoiceId: job.invoice_id,
      href: `/customer-success?tab=commerce`,
      error: 'Invoice already linked to this work item',
    }
  }

  const timesheets = await getTimesheets(undefined, jobId)
  const eligible = timesheets.filter((t) => {
    if (!t.total_hours || t.total_hours <= 0) return false
    if (options?.includePending) return true
    return t.status === 'approved'
  })

  if (eligible.length === 0) {
    return {
      ok: false,
      error: options?.includePending
        ? 'No billable hours logged on this work item'
        : 'Approve timesheets first, or enable include pending hours',
    }
  }

  const defaultRate = options?.hourlyRate ?? 85
  const lineItems: LineItem[] = []

  for (const ts of eligible) {
    const hours = ts.total_hours ?? 0
    const tech = ts.technician_id ? await getTechnician(ts.technician_id) : null
    const rate = tech?.hourly_rate ?? defaultRate
    const desc = `${job.title} — ${tech?.name ?? 'Team member'} (${hours.toFixed(1)}h)`
    lineItems.push({
      description: desc,
      quantity: hours,
      unit_price: rate,
      total: Math.round(hours * rate * 100) / 100,
    })
  }

  const subtotal = lineItems.reduce((s, l) => s + l.total, 0)
  const tax = Math.round(subtotal * 0 * 100) / 100
  const total = subtotal + tax

  const invoice = await createInvoice({
    client_id: job.client_id,
    quote_id: null,
    status: 'draft',
    subtotal,
    tax,
    total,
    due_date: addDays(30),
    paid_date: null,
    line_items: lineItems,
    notes: `Draft from workforce ${job.job_number}. Work: ${workforceTabPath('work', 'list', job.id)}`,
    template_id: null,
    document_settings: {},
  })

  if (!invoice) {
    return { ok: false, error: 'Could not create invoice' }
  }

  await updateJob(jobId, { invoice_id: invoice.id })

  return {
    ok: true,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    href: `/customer-success?tab=commerce`,
  }
}

export async function getJobParts(jobId: string): Promise<WfmJobPart[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('wfm_job_parts')
    .select('*, item:inventory_items(product_name, sku)')
    .eq('job_id', jobId)
    .order('created_at')

  if (error) {
    console.error('getJobParts:', error)
    return []
  }

  return (data ?? []).map((row) => {
    const item = row.item as { product_name?: string; sku?: string } | null
    return {
      id: row.id,
      job_id: row.job_id,
      item_id: row.item_id,
      quantity: Number(row.quantity),
      checked_out: row.checked_out,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      item_name: item?.product_name,
      item_sku: item?.sku,
    }
  })
}

export async function addJobPart(
  jobId: string,
  itemId: string,
  quantity: number,
  notes?: string,
): Promise<WfmJobPart | null> {
  if (!isSupabaseConfigured) return null

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('wfm_job_parts')
    .insert({
      job_id: jobId,
      item_id: itemId,
      quantity,
      notes: notes ?? null,
      user_id: userId,
      organization_id: orgId,
    })
    .select('*, item:inventory_items(product_name, sku)')
    .single()

  if (error) {
    console.error('addJobPart:', error)
    return null
  }

  const item = data.item as { product_name?: string; sku?: string } | null
  return {
    id: data.id,
    job_id: data.job_id,
    item_id: data.item_id,
    quantity: Number(data.quantity),
    checked_out: data.checked_out,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at,
    item_name: item?.product_name,
    item_sku: item?.sku,
  }
}

export async function removeJobPart(partId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await supabase.from('wfm_job_parts').delete().eq('id', partId)
  return !error
}

/** Check out all unchecked parts when a job is marked completed */
export async function checkoutJobPartsOnCompletion(jobId: string): Promise<JobPartsCheckoutResult> {
  const parts = await getJobParts(jobId)
  const pending = parts.filter((p) => !p.checked_out)
  const result: JobPartsCheckoutResult = { checkedOut: 0, errors: [] }

  if (pending.length === 0) return result

  const job = await getJob(jobId)
  const jobLabel = job?.job_number ?? jobId

  for (const part of pending) {
    const item = await getInventoryItem(part.item_id)
    if (!item) {
      result.errors.push(`${part.item_name ?? part.item_id}: item not found`)
      continue
    }

    const checkout = await performCheckOut({
      itemId: part.item_id,
      quantity: part.quantity,
      options: {
        jobId,
        jobLabel,
        notes: `Work completion: ${job?.title ?? jobLabel}`,
        userName: 'Workforce',
      },
    })

    if (!checkout.success) {
      result.errors.push(`${item.product_name}: ${checkout.error ?? 'check-out failed'}`)
      continue
    }

    await supabase.from('wfm_job_parts').update({ checked_out: true }).eq('id', part.id)
    result.checkedOut++
  }

  return result
}

export async function linkJobToProjectTask(
  jobId: string,
  projectId: string | null,
  taskId: string | null,
): Promise<Job | null> {
  return updateJob(jobId, {
    project_id: projectId,
    task_id: taskId,
  })
}

export async function getJobsLinkedToProject(projectId: string): Promise<Job[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('wfm_jobs')
    .select('*, technician:wfm_technicians(*)')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('start_date', { ascending: false })
  if (error) return []
  return data ?? []
}
