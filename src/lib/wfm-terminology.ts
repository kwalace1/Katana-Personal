/** Workforce work profile — adapts labels without schema changes. */
export type WfmWorkProfile = 'field_service' | 'professional_services' | 'general'

export interface WfmTerminology {
  profile: WfmWorkProfile
  moduleSubtitle: string
  workItem: string
  workItemPlural: string
  workItemLower: string
  teamMember: string
  teamMemberPlural: string
  workerPortal: string
  managerPortal: string
  assignLabel: string
  newWorkItem: string
  locationLabel: string
  scheduleLabel: string
  showMapRoutes: boolean
  emphasizeLocation: boolean
}

const PROFILE_COPY: Record<WfmWorkProfile, Omit<WfmTerminology, 'profile'>> = {
  field_service: {
    moduleSubtitle: 'Schedule field work, assign technicians, and track time on site.',
    workItem: 'Job',
    workItemPlural: 'Jobs',
    workItemLower: 'job',
    teamMember: 'Technician',
    teamMemberPlural: 'Technicians',
    workerPortal: 'Technician Portal',
    managerPortal: 'Manager Console',
    assignLabel: 'Assign technician',
    newWorkItem: 'New job',
    locationLabel: 'Site address',
    scheduleLabel: 'Schedule',
    showMapRoutes: true,
    emphasizeLocation: true,
  },
  professional_services: {
    moduleSubtitle: 'Plan client work, assign your team, and capture billable time.',
    workItem: 'Engagement',
    workItemPlural: 'Engagements',
    workItemLower: 'engagement',
    teamMember: 'Team member',
    teamMemberPlural: 'Team members',
    workerPortal: 'My work',
    managerPortal: 'Manager console',
    assignLabel: 'Assign team member',
    newWorkItem: 'New engagement',
    locationLabel: 'Location (optional)',
    scheduleLabel: 'Calendar',
    showMapRoutes: false,
    emphasizeLocation: false,
  },
  general: {
    moduleSubtitle: 'Assign work, track progress, and keep your team aligned.',
    workItem: 'Work item',
    workItemPlural: 'Work items',
    workItemLower: 'work item',
    teamMember: 'Team member',
    teamMemberPlural: 'Team members',
    workerPortal: 'My work',
    managerPortal: 'Manager console',
    assignLabel: 'Assign team member',
    newWorkItem: 'New work item',
    locationLabel: 'Location (optional)',
    scheduleLabel: 'Schedule',
    showMapRoutes: false,
    emphasizeLocation: false,
  },
}

export const WFM_WORK_PROFILE_OPTIONS: { value: WfmWorkProfile; label: string; description: string }[] = [
  {
    value: 'field_service',
    label: 'Field service',
    description: 'Technicians, job sites, maps, and routes.',
  },
  {
    value: 'professional_services',
    label: 'Professional services',
    description: 'Client engagements, deliverables, and billable hours.',
  },
  {
    value: 'general',
    label: 'General / startup',
    description: 'Simple work tracking for any small team.',
  },
]

const FIELD_SERVICE_INDUSTRIES = [
  'field service',
  'hvac',
  'plumbing',
  'electrical',
  'construction',
  'landscaping',
  'cleaning',
  'repair',
  'installation',
  'maintenance',
  'facilities',
  'trades',
]

const PROFESSIONAL_INDUSTRIES = [
  'agency',
  'consulting',
  'legal',
  'accounting',
  'marketing',
  'design',
  'software',
  'professional',
  'services',
  'creative',
  'advisory',
]

export function isWfmWorkProfile(value: unknown): value is WfmWorkProfile {
  return value === 'field_service' || value === 'professional_services' || value === 'general'
}

/** Infer a sensible default from onboarding industry text. */
export function inferWfmWorkProfileFromIndustry(industry: string | null | undefined): WfmWorkProfile {
  const normalized = (industry ?? '').toLowerCase().trim()
  if (!normalized) return 'general'
  if (FIELD_SERVICE_INDUSTRIES.some((k) => normalized.includes(k))) return 'field_service'
  if (PROFESSIONAL_INDUSTRIES.some((k) => normalized.includes(k))) return 'professional_services'
  return 'general'
}

export function getWfmTerminology(profile: WfmWorkProfile): WfmTerminology {
  return { profile, ...PROFILE_COPY[profile] }
}
