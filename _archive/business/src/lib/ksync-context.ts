import { getModuleIdByPath, MODULES, type ModuleId } from '@/lib/module-access'

export interface KSyncPageContext {
  moduleId: ModuleId | null
  moduleLabel: string
  agentName: string
  /** Short proactive line shown in the nudge card */
  nudge: string
  /** Do not render the floating widget on this route */
  hidden: boolean
}

const MODULE_LABEL: Record<ModuleId, string> = Object.fromEntries(
  MODULES.map((m) => [m.id, m.label]),
) as Record<ModuleId, string>

const MODULE_AGENT_NAME: Record<ModuleId, string> = {
  hub: 'Hub Agent',
  projects: 'PM Agent',
  inventory: 'Inventory Agent',
  'customer-success': 'Customer Agent',
  workforce: 'WFM Agent',
  hr: 'HR Agent',
  employee: 'Employee Agent',
  careers: 'Careers Agent',
  manufacturing: 'Facilities Agent',
  automation: 'Automation Agent',
  kyi: 'KYI Agent',
  comms: 'Comms Agent',
  agents: 'Hub Agent',
  support: 'Support Agent',
  finance: 'Finance Agent',
  esign: 'E-Sign Agent',
}

const MODULE_NUDGES: Record<ModuleId, string> = {
  hub: 'Need a snapshot of your organization? Hub Agent can show you what\'s happening across all modules.',
  projects: 'Working on projects? PM Agent knows tasks, deadlines, and team assignments.',
  inventory: 'Managing stock? Inventory Agent can find items, check levels, and highlight what needs reordering.',
  'customer-success': 'Tracking customers? Customer Agent knows accounts, health scores, and milestones.',
  workforce: 'Managing field work? WFM Agent can show technicians, job status, and assignments.',
  hr: 'In HR? HR Agent can help with people, departments, and org structure.',
  employee: 'Need help in the portal? Employee Agent can guide you through goals, performance, and self-service.',
  careers: 'Looking at open positions? Careers Agent can list all active postings with full details.',
  manufacturing: 'In manufacturing? Facilities Agent can explain workflows and how to navigate this module.',
  automation: 'Need policy or SOP answers? Upload docs in Automation, then ask me to search them.',
  kyi: 'Running a cap raise? KYI Agent can help with targeted investors, warm-path leads, and outreach.',
  comms: '',
  agents: '',
  support: 'Need to report a bug or share feedback? Support Agent can help you submit and track requests.',
  finance:
    'Working on your books? Finance Agent can help you understand transactions, categories, and month-end close.',
  esign:
    'Need signatures? E-Sign Agent can help you create requests, place fields, and track who still needs to sign.',
}

const SETTINGS_CONTEXT: KSyncPageContext = {
  moduleId: null,
  moduleLabel: 'Settings',
  agentName: 'Hub Agent',
  nudge: 'Configuring your org? Hub Agent can explain settings and access controls.',
  hidden: false,
}

const DEFAULT_CONTEXT: KSyncPageContext = {
  moduleId: null,
  moduleLabel: 'Katana',
  agentName: 'Hub Agent',
  nudge: 'Ask Hub Agent anything about your organization or where to go in Katana.',
  hidden: false,
}

/** Routes where the floating widget is redundant or distracting */
const HIDDEN_PREFIXES = ['/automation', '/comms', '/agents', '/manufacturing']

export function getKSyncContext(pathname: string): KSyncPageContext {
  const normalized = pathname.replace(/\/$/, '') || '/'

  if (HIDDEN_PREFIXES.some((p) => normalized === p || normalized.startsWith(`${p}/`))) {
    return { ...DEFAULT_CONTEXT, hidden: true }
  }

  if (normalized.startsWith('/settings')) {
    return SETTINGS_CONTEXT
  }

  const moduleId = getModuleIdByPath(normalized)
  if (!moduleId) {
    return DEFAULT_CONTEXT
  }

  return {
    moduleId,
    moduleLabel: MODULE_LABEL[moduleId],
    agentName: MODULE_AGENT_NAME[moduleId],
    nudge: MODULE_NUDGES[moduleId],
    hidden: false,
  }
}
