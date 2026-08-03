import * as ProjectData from '@/lib/project-data-supabase'
import * as CSApi from '@/lib/customer-success-api'
import * as HRApi from '@/lib/hr-api'
import * as InventoryApi from '@/lib/inventory-api'
import * as WfmApi from '@/lib/wfm-api'
import * as SupportApi from '@/lib/support-api'
import * as KyiApi from '@/lib/kyi-api'
import { getAllJobs } from '@/lib/recruitment-db'
import { MODULE_PATH, VISIBLE_MODULES, type ModuleId } from '@/lib/module-access'

export type HubSearchResultType =
  | 'project'
  | 'task'
  | 'client'
  | 'employee'
  | 'inventory'
  | 'job'
  | 'support'
  | 'kyi-company'
  | 'job-posting'

export interface HubSearchResult {
  id: string
  type: HubSearchResultType
  moduleId: ModuleId
  moduleLabel: string
  title: string
  subtitle?: string
  href: string
}

const MODULE_LABEL: Record<ModuleId, string> = Object.fromEntries(
  VISIBLE_MODULES.map((m) => [m.id, m.label])
) as Record<ModuleId, string>

function canSearchModule(moduleId: ModuleId, allowedModules: ModuleId[]): boolean {
  return allowedModules.includes(moduleId)
}

function matchesQuery(text: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return false
  return (text ?? '').toLowerCase().includes(q)
}

function pushResult(
  results: HubSearchResult[],
  seen: Set<string>,
  result: HubSearchResult
): void {
  const key = `${result.type}:${result.id}`
  if (seen.has(key)) return
  seen.add(key)
  results.push(result)
}

export async function searchHub(
  query: string,
  allowedModules: ModuleId[]
): Promise<HubSearchResult[]> {
  const q = query.trim()
  if (!q) return []

  const results: HubSearchResult[] = []
  const seen = new Set<string>()

  const searches: Promise<void>[] = []

  if (canSearchModule('projects', allowedModules)) {
    searches.push(
      ProjectData.getAllProjects().then((projects) => {
        for (const project of projects) {
          if (matchesQuery(project.name, q)) {
            pushResult(results, seen, {
              id: project.id,
              type: 'project',
              moduleId: 'projects',
              moduleLabel: MODULE_LABEL.projects,
              title: project.name,
              subtitle: `Project · ${project.status}`,
              href: `/projects/${project.id}`,
            })
          }
          for (const task of project.tasks ?? []) {
            if (matchesQuery(task.title, q) || matchesQuery(task.assignee?.name, q)) {
              pushResult(results, seen, {
                id: task.id,
                type: 'task',
                moduleId: 'projects',
                moduleLabel: MODULE_LABEL.projects,
                title: task.title,
                subtitle: `Task in ${project.name}`,
                href: `/projects/${project.id}`,
              })
            }
          }
        }
      })
    )
  }

  if (canSearchModule('customer-success', allowedModules)) {
    searches.push(
      CSApi.getAllClients().then((clients) => {
        for (const client of clients) {
          if (
            matchesQuery(client.name, q) ||
            matchesQuery(client.industry, q) ||
            matchesQuery(client.status, q)
          ) {
            pushResult(results, seen, {
              id: client.id,
              type: 'client',
              moduleId: 'customer-success',
              moduleLabel: MODULE_LABEL['customer-success'],
              title: client.name,
              subtitle: client.industry ? `${client.industry} · Customer` : 'Customer',
              href: MODULE_PATH['customer-success'],
            })
          }
        }
      })
    )
  }

  if (canSearchModule('hr', allowedModules)) {
    searches.push(
      HRApi.getAllEmployees().then((employees) => {
        for (const employee of employees) {
          if (
            matchesQuery(employee.name, q) ||
            matchesQuery(employee.department, q) ||
            matchesQuery(employee.position, q) ||
            matchesQuery(employee.email, q)
          ) {
            pushResult(results, seen, {
              id: employee.id,
              type: 'employee',
              moduleId: 'hr',
              moduleLabel: MODULE_LABEL.hr,
              title: employee.name,
              subtitle: [employee.position, employee.department].filter(Boolean).join(' · ') || 'Employee',
              href: MODULE_PATH.hr,
            })
          }
        }
      })
    )
  }

  if (canSearchModule('inventory', allowedModules)) {
    searches.push(
      InventoryApi.getInventoryItems().then((items) => {
        for (const item of items) {
          if (
            matchesQuery(item.product_name, q) ||
            matchesQuery(item.sku, q) ||
            matchesQuery(item.category, q) ||
            matchesQuery(item.location, q)
          ) {
            pushResult(results, seen, {
              id: item.id,
              type: 'inventory',
              moduleId: 'inventory',
              moduleLabel: MODULE_LABEL.inventory,
              title: item.product_name,
              subtitle: `SKU ${item.sku}${item.location ? ` · ${item.location}` : ''}`,
              href: MODULE_PATH.inventory,
            })
          }
        }
      })
    )
  }

  if (canSearchModule('workforce', allowedModules)) {
    searches.push(
      WfmApi.getJobs().then((jobs) => {
        for (const job of jobs) {
          if (
            matchesQuery(job.title, q) ||
            matchesQuery(job.job_number, q) ||
            matchesQuery(job.customer_name, q) ||
            matchesQuery(job.location, q)
          ) {
            pushResult(results, seen, {
              id: job.id,
              type: 'job',
              moduleId: 'workforce',
              moduleLabel: MODULE_LABEL.workforce,
              title: job.title || job.job_number,
              subtitle: [job.job_number, job.customer_name].filter(Boolean).join(' · ') || 'Workforce job',
              href: MODULE_PATH.workforce,
            })
          }
        }
      })
    )
  }

  if (canSearchModule('support', allowedModules)) {
    searches.push(
      SupportApi.getAllSubmissions().then((submissions) => {
        for (const submission of submissions) {
          if (
            matchesQuery(submission.subject, q) ||
            matchesQuery(submission.description, q) ||
            matchesQuery(submission.submitter_name, q)
          ) {
            pushResult(results, seen, {
              id: submission.id,
              type: 'support',
              moduleId: 'support',
              moduleLabel: MODULE_LABEL.support,
              title: submission.subject,
              subtitle: `${submission.status} · Support`,
              href: MODULE_PATH.support,
            })
          }
        }
      })
    )
  }

  if (canSearchModule('kyi', allowedModules)) {
    searches.push(
      KyiApi.getCompanies().then((companies) => {
        for (const company of companies) {
          if (
            matchesQuery(company.name, q) ||
            matchesQuery(company.industry, q) ||
            matchesQuery(company.location, q)
          ) {
            pushResult(results, seen, {
              id: String(company.id),
              type: 'kyi-company',
              moduleId: 'kyi',
              moduleLabel: MODULE_LABEL.kyi,
              title: company.name,
              subtitle: [company.industry, company.location].filter(Boolean).join(' · ') || 'KYI company',
              href: MODULE_PATH.kyi,
            })
          }
        }
      })
    )
  }

  if (canSearchModule('careers', allowedModules) || canSearchModule('hr', allowedModules)) {
    searches.push(
      getAllJobs().then((jobs) => {
        for (const job of jobs) {
          if (
            matchesQuery(job.title, q) ||
            matchesQuery(job.department, q) ||
            matchesQuery(job.location, q)
          ) {
            pushResult(results, seen, {
              id: job.id,
              type: 'job-posting',
              moduleId: 'careers',
              moduleLabel: MODULE_LABEL.careers,
              title: job.title,
              subtitle: [job.department, job.location].filter(Boolean).join(' · ') || 'Job posting',
              href: MODULE_PATH.careers,
            })
          }
        }
      })
    )
  }

  await Promise.allSettled(searches)

  return results.sort((a, b) => a.title.localeCompare(b.title))
}
