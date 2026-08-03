import { useState } from 'react'
import { ChevronsUpDown, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EmployeeAvatar } from '@/components/ui/employee-avatar'
import type { TeamMember } from '@/lib/project-data'
import {
  formatAssigneeSummary,
  getTaskAssignees,
  teamMemberToAssignee,
  type TaskAssignee,
} from '@/lib/task-assignees'
import { cn } from '@/lib/utils'

interface TaskAssigneePickerProps {
  teamMembers: TeamMember[]
  value: TaskAssignee[]
  onChange: (next: TaskAssignee[]) => void
  id?: string
  disabled?: boolean
}

function memberKey(member: TeamMember): string {
  return member.hrEmployeeId?.trim() || member.name
}

function isMemberSelected(value: TaskAssignee[], member: TeamMember): boolean {
  const key = memberKey(member)
  return value.some((a) => (a.employeeId?.trim() || a.name) === key)
}

export function TaskAssigneePicker({
  teamMembers,
  value,
  onChange,
  id,
  disabled,
}: TaskAssigneePickerProps) {
  const [open, setOpen] = useState(false)

  const toggleMember = (member: TeamMember) => {
    const key = memberKey(member)
    if (isMemberSelected(value, member)) {
      onChange(value.filter((a) => (a.employeeId?.trim() || a.name) !== key))
      return
    }
    onChange([...value, teamMemberToAssignee(member)])
  }

  const summaryTask = {
    assignees: value,
    assignee: value[0]
      ? { name: value[0].name, avatar: value[0].avatar }
      : { name: 'Unassigned', avatar: '/placeholder.svg?height=32&width=32' },
    assigneeEmployeeId: value[0]?.employeeId ?? null,
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-auto min-h-10 w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2 truncate text-left">
            <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
            {formatAssigneeSummary(summaryTask)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="max-h-64 overflow-y-auto p-2">
          {teamMembers.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              Add team members to this project to assign tasks.
            </p>
          ) : (
            teamMembers.map((member) => {
              const checked = isMemberSelected(value, member)
              return (
                <label
                  key={member.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/70',
                    checked && 'bg-muted/50'
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleMember(member)}
                  />
                  <EmployeeAvatar name={member.name} photoUrl={member.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{member.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{member.role}</div>
                  </div>
                </label>
              )
            })
          )}
        </div>
        {value.length > 0 ? (
          <div className="border-t px-3 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full"
              onClick={() => onChange([])}
            >
              Clear assignees
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

interface TaskAssigneeDisplayProps {
  task: Pick<import('@/lib/project-data').Task, 'assignees' | 'assignee' | 'assigneeEmployeeId'>
  size?: 'sm' | 'md'
  showNames?: boolean
  className?: string
}

export function TaskAssigneeDisplay({
  task,
  size = 'sm',
  showNames = true,
  className,
}: TaskAssigneeDisplayProps) {
  const assignees = getTaskAssignees(task)

  if (!assignees.length) {
    return <span className={cn('text-xs text-muted-foreground', className)}>Unassigned</span>
  }

  const avatarSize = size === 'sm' ? 'sm' : 'md'
  const visible = assignees.slice(0, 3)
  const overflow = assignees.length - visible.length

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <div className="flex -space-x-2">
        {visible.map((person) => (
          <EmployeeAvatar
            key={`${person.employeeId ?? person.name}`}
            name={person.name}
            photoUrl={
              person.avatar && person.avatar !== '/placeholder.svg?height=32&width=32'
                ? person.avatar
                : undefined
            }
            size={avatarSize}
            className="ring-2 ring-background"
          />
        ))}
      </div>
      {showNames ? (
        <span className="truncate text-xs text-muted-foreground">
          {formatAssigneeSummary({ assignees, assignee: task.assignee, assigneeEmployeeId: task.assigneeEmployeeId })}
          {overflow > 0 && visible.length >= 3 ? ` (+${overflow})` : ''}
        </span>
      ) : null}
    </div>
  )
}
