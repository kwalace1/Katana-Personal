/**
 * Private raise CRM for a single investor — tasks, docs/NDAs, activity, valuations.
 * Org-scoped only; never touches the shared ecosystem layer.
 */
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Star,
  Trash2,
  Calendar,
  MessageSquare,
  DollarSign,
  ListTodo,
  Upload,
  UserCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  createInvestorActivity,
  createInvestorDocument,
  createInvestorTask,
  createInvestorValuation,
  deleteInvestorActivity,
  deleteInvestorDocument,
  deleteInvestorTask,
  deleteInvestorValuation,
  listInvestorActivity,
  listInvestorDocuments,
  listInvestorTasks,
  listInvestorValuations,
  updateInvestorPrivateFields,
  updateInvestorTask,
  uploadInvestorDocumentFile,
  getInvestorDocumentDownloadUrl,
  listOrganizationTeamMembers,
  type KyiActivityType,
  type KyiInvestorActivity,
  type KyiInvestorDocument,
  type KyiInvestorTask,
  type KyiInvestorValuation,
  type KyiTeamMember,
} from '@/lib/kyi-private-crm'

const ACTIVITY_TYPES: { value: KyiActivityType; label: string }[] = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'intro', label: 'Intro' },
  { value: 'note', label: 'Note' },
  { value: 'other', label: 'Other' },
]

export function KyiInvestorPrivateCrm({
  investorId,
  internalRating,
  assignedTeamMember,
  onRatingChange,
  onAssigneeChange,
}: {
  investorId: number
  internalRating: number | null
  assignedTeamMember: string | null
  onRatingChange?: (rating: number | null) => void
  onAssigneeChange?: (userId: string | null) => void
}) {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<KyiInvestorTask[]>([])
  const [docs, setDocs] = useState<KyiInvestorDocument[]>([])
  const [activity, setActivity] = useState<KyiInvestorActivity[]>([])
  const [valuations, setValuations] = useState<KyiInvestorValuation[]>([])
  const [migrationMissing, setMigrationMissing] = useState(false)
  const [team, setTeam] = useState<KyiTeamMember[]>([])

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [taskAssignee, setTaskAssignee] = useState<string>('__none__')
  const [docTitle, setDocTitle] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [docNda, setDocNda] = useState(false)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [actType, setActType] = useState<KyiActivityType>('meeting')
  const [actSummary, setActSummary] = useState('')
  const [valLabel, setValLabel] = useState('Discussion')
  const [valAmount, setValAmount] = useState('')
  const [valPre, setValPre] = useState('')
  const [valNotes, setValNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [t, d, a, v, members] = await Promise.all([
        listInvestorTasks(investorId),
        listInvestorDocuments(investorId),
        listInvestorActivity(investorId),
        listInvestorValuations(investorId),
        listOrganizationTeamMembers().catch(() => [] as KyiTeamMember[]),
      ])
      setTasks(t)
      setDocs(d)
      setActivity(a)
      setValuations(v)
      setTeam(members)
      setMigrationMissing(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('does not exist') || msg.includes('schema cache')) {
        setMigrationMissing(true)
      } else {
        toast.error(msg || 'Failed to load private CRM')
      }
    } finally {
      setLoading(false)
    }
  }, [investorId])

  useEffect(() => {
    void reload()
  }, [reload])

  const setRating = async (n: number | null) => {
    try {
      await updateInvestorPrivateFields(investorId, { internal_rating: n })
      onRatingChange?.(n)
      toast.success(n ? `Rated ${n}/5` : 'Rating cleared')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save rating')
    }
  }

  const setAssignee = async (userId: string | null) => {
    try {
      await updateInvestorPrivateFields(investorId, { assigned_team_member: userId })
      onAssigneeChange?.(userId)
      toast.success(userId ? 'Assignee updated' : 'Assignee cleared')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save assignee')
    }
  }

  if (migrationMissing) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base">Private CRM not enabled yet</CardTitle>
          <CardDescription>
            Run <code className="text-xs">supabase-kyi-private-crm-migration.sql</code> in the
            Supabase SQL Editor to unlock tasks, documents, activity, and valuations. Your existing
            notes and Northstar data are unchanged.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading private raise workspace…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            Internal rating & owner
          </CardTitle>
          <CardDescription>Private to your organization — never shared to the ecosystem.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => void setRating(n)}
                className={`p-1.5 rounded-md transition-colors ${
                  (internalRating ?? 0) >= n
                    ? 'text-amber-400'
                    : 'text-muted-foreground/40 hover:text-muted-foreground'
                }`}
                aria-label={`Rate ${n}`}
              >
                <Star className={`w-5 h-5 ${(internalRating ?? 0) >= n ? 'fill-current' : ''}`} />
              </button>
            ))}
            {internalRating != null && (
              <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => void setRating(null)}>
                Clear
              </Button>
            )}
          </div>
          <div className="space-y-1.5 max-w-sm">
            <Label className="text-xs flex items-center gap-1.5">
              <UserCircle2 className="w-3.5 h-3.5" />
              Assigned team member
            </Label>
            <Select
              value={assignedTeamMember ?? '__none__'}
              onValueChange={(v) => void setAssignee(v === '__none__' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {team.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                    {m.email ? ` · ${m.email}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="w-4 h-4" />
              Follow-up tasks
            </CardTitle>
            <CardDescription>Assigned work for this relationship.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Task title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="flex-1"
                />
                <Input type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="sm:w-40" />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                  <SelectTrigger className="sm:flex-1">
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No assignee</SelectItem>
                    {team.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={busy || !taskTitle.trim()}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await createInvestorTask(investorId, {
                        title: taskTitle,
                        due_at: taskDue ? new Date(taskDue).toISOString() : null,
                        assigned_to: taskAssignee === '__none__' ? null : taskAssignee,
                      })
                      setTaskTitle('')
                      setTaskDue('')
                      setTaskAssignee('__none__')
                      await reload()
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No tasks yet.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-2 rounded-lg border p-2.5 text-sm"
                  >
                    <button
                      type="button"
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-500"
                      onClick={async () => {
                        await updateInvestorTask(t.id, {
                          status: t.status === 'done' ? 'open' : 'done',
                        })
                        await reload()
                      }}
                    >
                      <CheckCircle2
                        className={`w-4 h-4 ${t.status === 'done' ? 'text-emerald-500' : ''}`}
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={t.status === 'done' ? 'line-through text-muted-foreground' : ''}>
                        {t.title}
                      </p>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                        {t.due_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(t.due_at).toLocaleDateString()}
                          </span>
                        )}
                        {t.assigned_to && (
                          <span>
                            {team.find((m) => m.id === t.assigned_to)?.full_name ?? 'Assigned'}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        await deleteInvestorTask(t.id)
                        await reload()
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents & NDAs
            </CardTitle>
            <CardDescription>Upload files or paste links — stays private to your org.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Input placeholder="Document title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt,.csv"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
              <Input
                placeholder="Or paste URL (Drive, Dropbox, …)"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
              />
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="doc-nda" className="text-sm font-normal flex items-center gap-2 cursor-pointer">
                  <Switch id="doc-nda" checked={docNda} onCheckedChange={setDocNda} />
                  Mark as NDA
                </Label>
                <Button
                  size="sm"
                  disabled={busy || (!docTitle.trim() && !docFile)}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      if (docFile) {
                        await uploadInvestorDocumentFile(investorId, docFile, {
                          is_nda: docNda,
                          title: docTitle.trim() || docFile.name,
                        })
                      } else {
                        await createInvestorDocument(investorId, {
                          title: docTitle,
                          document_url: docUrl || undefined,
                          is_nda: docNda,
                        })
                      }
                      setDocTitle('')
                      setDocUrl('')
                      setDocFile(null)
                      setDocNda(false)
                      await reload()
                      toast.success('Document saved')
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {docFile ? 'Upload' : 'Add'}
                </Button>
              </div>
            </div>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No documents yet.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{d.title}</span>
                        {d.is_nda && <Badge variant="secondary" className="text-[10px]">NDA</Badge>}
                        {d.storage_path && (
                          <Badge variant="outline" className="text-[10px]">Stored</Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline truncate block text-left"
                        onClick={async () => {
                          const url = await getInvestorDocumentDownloadUrl(d)
                          if (url) window.open(url, '_blank', 'noopener,noreferrer')
                          else toast.error('No download URL available')
                        }}
                      >
                        Open / download
                      </button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        await deleteInvestorDocument(d.id)
                        await reload()
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Communication history
            </CardTitle>
            <CardDescription>Meetings, calls, emails, intros.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2">
              <Select value={actType} onValueChange={(v) => setActType(v as KyiActivityType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                rows={2}
                placeholder="What happened?"
                value={actSummary}
                onChange={(e) => setActSummary(e.target.value)}
              />
              <Button
                size="sm"
                className="self-end"
                disabled={busy || !actSummary.trim()}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await createInvestorActivity(investorId, {
                      activity_type: actType,
                      summary: actSummary,
                    })
                    setActSummary('')
                    await reload()
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Failed')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Log activity
              </Button>
            </div>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No activity logged.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {activity.map((a) => (
                  <li key={a.id} className="rounded-lg border p-2.5 text-sm space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {a.activity_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.occurred_at).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{a.summary}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive px-0"
                      onClick={async () => {
                        await deleteInvestorActivity(a.id)
                        await reload()
                      }}
                    >
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Valuations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Valuation discussions
            </CardTitle>
            <CardDescription>Deal terms stay private to your raise.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input value={valLabel} onChange={(e) => setValLabel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount discussed</Label>
                <Input
                  type="number"
                  placeholder="e.g. 2000000"
                  value={valAmount}
                  onChange={(e) => setValAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pre-money</Label>
                <Input
                  type="number"
                  value={valPre}
                  onChange={(e) => setValPre(e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Notes</Label>
                <Textarea rows={2} value={valNotes} onChange={(e) => setValNotes(e.target.value)} />
              </div>
            </div>
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await createInvestorValuation(investorId, {
                    label: valLabel,
                    amount_discussed: valAmount ? Number(valAmount) : null,
                    pre_money: valPre ? Number(valPre) : null,
                    notes: valNotes || undefined,
                  })
                  setValNotes('')
                  setValAmount('')
                  setValPre('')
                  await reload()
                  toast.success('Valuation logged')
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Failed')
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Log discussion
            </Button>
            {valuations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No valuation discussions yet.</p>
            ) : (
              <ul className="space-y-2">
                {valuations.map((v) => (
                  <li key={v.id} className="rounded-lg border p-2.5 text-sm space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{v.label}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await deleteInvestorValuation(v.id)
                          await reload()
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.discussed_at).toLocaleDateString()}
                      {v.amount_discussed != null &&
                        ` · ${v.currency} ${v.amount_discussed.toLocaleString()}`}
                      {v.pre_money != null && ` · Pre ${v.pre_money.toLocaleString()}`}
                      {v.post_money != null && ` · Post ${v.post_money.toLocaleString()}`}
                    </p>
                    {v.notes && <p className="text-sm whitespace-pre-wrap">{v.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
