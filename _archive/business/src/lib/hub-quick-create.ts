import * as ProjectData from '@/lib/project-data-supabase'
import * as CSApi from '@/lib/customer-success-api'
import * as HRApi from '@/lib/hr-api'
import * as InventoryApi from '@/lib/inventory-api'
import * as WfmApi from '@/lib/wfm-api'
import { MODULE_PATH, type ModuleId } from '@/lib/module-access'
import { dateKeyDaysFromNow, getTodayDateKey } from '@/lib/due-date-utils'

export type HubQuickCreateType = 'project' | 'task' | 'client' | 'inventory' | 'job' | 'employee'

export interface HubQuickCreateInput {
  type: HubQuickCreateType
  title: string
  projectId?: string
  email?: string
  sku?: string
}

export type HubQuickCreateResult =
  | { ok: true; href: string; message: string }
  | { ok: false; error: string }

const CREATE_MODULE: Record<HubQuickCreateType, ModuleId> = {
  project: 'projects',
  task: 'projects',
  client: 'customer-success',
  inventory: 'inventory',
  job: 'workforce',
  employee: 'hr',
}

export function getQuickCreateModuleId(type: HubQuickCreateType): ModuleId {
  return CREATE_MODULE[type]
}

function defaultDeadline(daysFromNow = 30): string {
  return dateKeyDaysFromNow(daysFromNow)
}

function slugSku(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12)
  return `${base || 'ITEM'}-${Date.now().toString(36).toUpperCase()}`
}

export async function quickCreateHubItem(input: HubQuickCreateInput): Promise<HubQuickCreateResult> {
  const title = input.title.trim()
  if (!title) {
    return { ok: false, error: 'Please enter a title or name.' }
  }

  try {
    switch (input.type) {
      case 'project': {
        const projectId = await ProjectData.createProject({
          name: title,
          status: 'active',
          deadline: defaultDeadline(),
        })
        if (!projectId) {
          return { ok: false, error: 'Could not create project. Check your connection and try again.' }
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
        }
        return {
          ok: true,
          href: `/projects/${projectId}`,
          message: `Project "${title}" created.`,
        }
      }
      case 'task': {
        if (!input.projectId?.trim()) {
          return { ok: false, error: 'Select a project for the new task.' }
        }
        const task = await ProjectData.addTask(input.projectId, {
          title,
          status: 'todo',
          priority: 'medium',
          assignee: { name: 'Unassigned', avatar: '/placeholder.svg?height=32&width=32' },
          deadline: defaultDeadline(),
          progress: 0,
          description: '',
        })
        if (!task) {
          return { ok: false, error: 'Could not create task. Check your connection and try again.' }
        }
        return {
          ok: true,
          href: `/projects/${input.projectId}`,
          message: `Task "${title}" added to project.`,
        }
      }
      case 'client': {
        const client = await CSApi.createClient({
          name: title,
          industry: '',
          arr: 0,
          renewal_date: dateKeyDaysFromNow(365),
          last_contact_date: new Date().toISOString(),
          nps_score: 7,
          engagement_score: 50,
          feature_usage: 'Medium',
          csm_id: null,
          portal_logins: 0,
          support_tickets: 0,
          health_score: 0,
          status: 'healthy',
          churn_risk: 0,
          churn_trend: 'stable',
          account_type: 'business',
          lifecycle_stage: 'customer',
          email: null,
          phone: null,
          website: null,
          address_line1: null,
          city: null,
          state: null,
          postal_code: null,
          country: '',
        })
        if (!client) {
          return { ok: false, error: 'Could not create customer. Check your connection and try again.' }
        }
        return {
          ok: true,
          href: MODULE_PATH['customer-success'],
          message: `Customer "${title}" created.`,
        }
      }
      case 'inventory': {
        const sku = (input.sku?.trim() || slugSku(title)).slice(0, 64)
        const item = await InventoryApi.createInventoryItem({
          sku,
          product_name: title,
          location: 'Main',
          on_hand_qty: 0,
          min_qty: 0,
          reorder_qty: 0,
          unit_cost: 0,
          allocated: 0,
          supplier_id: null,
          supplier_name: null,
          status: 'out-of-stock',
          barcode: null,
          image_url: null,
          category: null,
          description: null,
          last_movement_at: null,
          is_active: true,
        })
        if (!item) {
          return { ok: false, error: 'Could not create inventory item. Check your connection and try again.' }
        }
        return {
          ok: true,
          href: MODULE_PATH.inventory,
          message: `Inventory item "${title}" created (SKU ${sku}).`,
        }
      }
      case 'job': {
        const today = getTodayDateKey()
        const job = await WfmApi.createJob({
          title,
          description: null,
          customer_name: null,
          client_id: null,
          customer_phone: null,
          customer_email: null,
          location: null,
          location_address: null,
          status: 'assigned',
          priority: 'medium',
          technician_id: null,
          start_date: today,
          end_date: today,
          start_time: null,
          end_time: null,
          estimated_hours: null,
          actual_hours: null,
          notes: null,
          completion_notes: null,
          is_active: true,
          project_id: null,
          task_id: null,
          invoice_id: null,
        })
        if (!job) {
          return { ok: false, error: 'Could not create workforce job. Check your connection and try again.' }
        }
        return {
          ok: true,
          href: MODULE_PATH.workforce,
          message: `Workforce job "${title}" created (${job.job_number}).`,
        }
      }
      case 'employee': {
        const email = input.email?.trim()
        if (!email) {
          return { ok: false, error: 'Employee email is required.' }
        }
        const employee = await HRApi.createEmployee({
          name: title,
          email,
          position: 'Team Member',
          department: '',
          status: 'Active',
          phone: '',
          hire_date: getTodayDateKey(),
          photo_url: null,
          module_access: [],
        })
        if (!employee) {
          return { ok: false, error: 'Could not create employee. Check your connection and try again.' }
        }
        void HRApi.logEmployeeAdded(employee.name, employee.id)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('employeeAdded', { detail: employee }))
        }
        return {
          ok: true,
          href: MODULE_PATH.hr,
          message: `Employee "${title}" added to HR.`,
        }
      }
      default:
        return { ok: false, error: 'Unsupported create type.' }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong.'
    return { ok: false, error: message }
  }
}
