/**
 * Linked WFM jobs and Support tickets for a customer account
 */

import { supabase } from './supabase'

export interface LinkedWfmJob {
  id: string
  job_number: string
  title: string
  status: string
  start_date: string | null
  customer_name: string | null
}

export interface LinkedSupportTicket {
  id: string
  subject: string
  status: string
  priority: string
  created_at: string
}

export interface LinkedInvoice {
  id: string
  invoice_number: string
  status: string
  total: number
  due_date: string | null
  created_at: string
}

export async function getLinkedWfmJobs(clientId: string): Promise<LinkedWfmJob[]> {
  const { data, error } = await supabase
    .from('wfm_jobs')
    .select('id, job_number, title, status, start_date, customer_name')
    .eq('client_id', clientId)
    .order('start_date', { ascending: false })
    .limit(20)
  if (error) return []
  return (data ?? []) as LinkedWfmJob[]
}

export async function getLinkedInvoices(clientId: string): Promise<LinkedInvoice[]> {
  const { data, error } = await supabase
    .from('cs_invoices')
    .select('id, invoice_number, status, total, due_date, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return []
  return (data ?? []).map((row) => ({
    ...row,
    total: Number(row.total),
  })) as LinkedInvoice[]
}

export async function getLinkedSupportTickets(clientId: string): Promise<LinkedSupportTicket[]> {
  const { data, error } = await supabase
    .from('support_submissions')
    .select('id, subject, status, priority, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return []
  return (data ?? []) as LinkedSupportTicket[]
}

export async function linkSupportTicketToClient(submissionId: string, clientId: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('support_submissions')
    .update({ client_id: clientId })
    .eq('id', submissionId)
  if (error) {
    console.error('linkSupportTicketToClient:', error)
    return false
  }
  if (clientId) {
    await supabase.rpc('sync_cs_client_support_ticket_count', { p_client_id: clientId })
  }
  return true
}
