import { describe, it, expect } from 'vitest'
import {
  getTaskAssignees,
  primaryAssigneeFromList,
  formatAssigneeSummary,
  isTaskAssignedTo,
  assigneesChanged,
  serializeTaskAssigneesForDb,
  encodeAssigneesAvatarFallback,
  parseAssigneesAvatarFallback,
  buildAssigneeDbPayload,
} from './task-assignees'

describe('task-assignees', () => {
  it('reads legacy single assignee when assignees array is empty', () => {
    const assignees = getTaskAssignees({
      assignee: { name: 'Alex Kim', avatar: '/a.png' },
      assigneeEmployeeId: 'emp-1',
    })
    expect(assignees).toHaveLength(1)
    expect(assignees[0].name).toBe('Alex Kim')
  })

  it('prefers assignees array when present', () => {
    const assignees = getTaskAssignees({
      assignee: { name: 'Legacy', avatar: '' },
      assigneeEmployeeId: null,
      assignees: [
        { employeeId: '1', name: 'One', avatar: '' },
        { employeeId: '2', name: 'Two', avatar: '' },
      ],
    })
    expect(assignees).toHaveLength(2)
    expect(formatAssigneeSummary({ assignees })).toBe('One, Two')
  })

  it('detects assignee list changes', () => {
    const before = {
      assignees: [{ employeeId: '1', name: 'One', avatar: '' }],
      assignee: { name: 'One', avatar: '' },
      assigneeEmployeeId: '1',
    }
    const after = {
      assignees: [
        { employeeId: '1', name: 'One', avatar: '' },
        { employeeId: '2', name: 'Two', avatar: '' },
      ],
      assignee: { name: 'One', avatar: '' },
      assigneeEmployeeId: '1',
    }
    expect(assigneesChanged(before, after)).toBe(true)
  })

  it('matches any assignee on a task', () => {
    const task = {
      assignees: [
        { employeeId: '1', name: 'One', avatar: '' },
        { employeeId: '2', name: 'Two', avatar: '' },
      ],
      assignee: { name: 'One', avatar: '' },
      assigneeEmployeeId: '1',
    }
    expect(isTaskAssignedTo(task, { employeeId: '2' })).toBe(true)
    expect(isTaskAssignedTo(task, { name: 'Two' })).toBe(true)
    expect(isTaskAssignedTo(task, { employeeId: '9' })).toBe(false)
  })

  it('dedupes serialized assignees', () => {
    const list = serializeTaskAssigneesForDb([
      { employeeId: '1', name: 'One', avatar: '' },
      { employeeId: '1', name: 'One', avatar: '' },
    ])
    expect(list).toHaveLength(1)
    expect(primaryAssigneeFromList(list).assignee.name).toBe('One')
  })

  it('round-trips multi-assignee avatar fallback when assignees column is unavailable', () => {
    const assignees = [
      { employeeId: '1', name: 'Emmanuel Thomas', avatar: '/e.png' },
      { employeeId: '2', name: 'Alex Kim', avatar: '/a.png' },
    ]
    const encoded = encodeAssigneesAvatarFallback(assignees)
    const parsed = parseAssigneesAvatarFallback(encoded)
    expect(parsed).toHaveLength(2)
    expect(getTaskAssignees({
      assignees: [],
      assignee: { name: 'Emmanuel Thomas', avatar: encoded },
      assigneeEmployeeId: '1',
    }).map((a) => a.name)).toEqual(['Emmanuel Thomas', 'Alex Kim'])
  })

  it('uses first assignee avatar when assignees column is available', () => {
    const payload = buildAssigneeDbPayload([
      { employeeId: '1', name: 'One', avatar: '/one.png' },
      { employeeId: '2', name: 'Two', avatar: '/two.png' },
    ])
    expect(payload.assignees).toHaveLength(2)
    expect(payload.assignee_avatar).toBe('/one.png')
  })
})
