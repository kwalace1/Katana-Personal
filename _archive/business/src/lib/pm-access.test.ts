import { describe, it, expect } from 'vitest'
import type { Project } from './project-data'
import {
  canEditProject,
  filterProjectsByScope,
  isUserInvolvedInProject,
  isUserOnProjectTeam,
} from './pm-access'

const baseProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Pilot',
  status: 'active',
  progress: 0,
  deadline: '2026-12-31',
  totalTasks: 1,
  completedTasks: 0,
  starred: false,
  tasks: [],
  team: [],
  files: [],
  activities: [],
  milestones: [],
  ...overrides,
})

describe('pm-access', () => {
  const ctx = {
    employeeId: 'emp-1',
    loginNames: ['emmanuel thomas'],
    loginEmails: ['emmanuel@example.com'],
    orgRole: 'member',
  }

  it('detects team membership by HR id or name', () => {
    const project = baseProject({
      team: [{ id: 't1', name: 'Emmanuel Thomas', role: 'developer', avatar: '', capacity: 40, hrEmployeeId: 'emp-1' }],
    })
    expect(isUserOnProjectTeam(project, ctx)).toBe(true)
  })

  it('includes assigned tasks in my projects', () => {
    const project = baseProject({
      tasks: [
        {
          id: 'task-1',
          title: 'Task',
          status: 'todo',
          priority: 'medium',
          assignee: { name: 'Emmanuel Thomas', avatar: '' },
          assigneeEmployeeId: 'emp-1',
          deadline: '2026-06-01',
          progress: 0,
        },
      ],
    })
    expect(isUserInvolvedInProject(project, ctx)).toBe(true)
    expect(isUserOnProjectTeam(project, ctx)).toBe(false)
  })

  it('filters to my projects only', () => {
    const mine = baseProject({ id: 'mine', team: [{ id: 't1', name: 'Emmanuel Thomas', role: 'dev', avatar: '', capacity: 40, hrEmployeeId: 'emp-1' }] })
    const other = baseProject({ id: 'other', name: 'Other' })
    const filtered = filterProjectsByScope([mine, other], 'mine', ctx)
    expect(filtered.map((p) => p.id)).toEqual(['mine'])
  })

  it('allows org admins to edit without team membership', () => {
    const project = baseProject({ name: 'Org project' })
    expect(canEditProject(project, { ...ctx, orgRole: 'admin' })).toBe(true)
  })

  it('blocks edit for non-team members', () => {
    const project = baseProject({ name: 'Org project' })
    expect(canEditProject(project, ctx)).toBe(false)
  })

  it('allows edit for team members', () => {
    const project = baseProject({
      team: [{ id: 't1', name: 'Emmanuel Thomas', role: 'developer', avatar: '', capacity: 40, hrEmployeeId: 'emp-1' }],
    })
    expect(canEditProject(project, ctx)).toBe(true)
  })

  it('allows edit for the project creator even when not yet on the team roster', () => {
    const project = baseProject({
      createdBy: { name: 'Emmanuel Thomas', avatar: '' },
    })
    expect(canEditProject(project, ctx)).toBe(true)
  })

  it('allows edit when the user is the assigned owner by name', () => {
    const project = baseProject({
      owner: { name: 'Emmanuel Thomas', avatar: '' },
    })
    expect(canEditProject(project, ctx)).toBe(true)
  })
})
