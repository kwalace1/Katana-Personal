import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Archive,
  Briefcase,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Star,
  UserCheck,
  Users,
} from 'lucide-react'
import {
  getTalentPoolEntries,
  getJobsForMatching,
  updateTalentPoolEntry,
  removeTalentPoolEntry,
  type TalentPoolEntry,
  type TalentPoolStatus,
  type Job,
} from '@/lib/recruitment-db'
import { scoreTalentPoolEntry } from '@/lib/recruitment-matching'

export function TalentPoolPanel() {
  const [entries, setEntries] = useState<TalentPoolEntry[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<TalentPoolStatus | 'all'>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [matchJobId, setMatchJobId] = useState<string>('all')
  const [selected, setSelected] = useState<TalentPoolEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editAvailability, setEditAvailability] = useState('')
  const [editTags, setEditTags] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pool, jobList] = await Promise.all([
        getTalentPoolEntries(statusFilter),
        getJobsForMatching(),
      ])
      setEntries(pool)
      setJobs(jobList.filter((j) => j.is_active !== false && j.is_active !== 'false'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onUpdate = () => void load()
    window.addEventListener('talentPoolUpdated', onUpdate)
    return () => window.removeEventListener('talentPoolUpdated', onUpdate)
  }, [load])

  const jobsById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return entries.filter((e) => {
      if (!q) return true
      const hay = [
        e.firstName,
        e.lastName,
        e.email,
        e.sourceJobTitle,
        e.sourceDepartment,
        e.resumeProfile?.skills,
        e.recruiterNotes,
        e.tags.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [entries, searchQuery])

  const matchJob = matchJobId !== 'all' ? jobsById.get(matchJobId) ?? null : null

  const openDetails = (entry: TalentPoolEntry) => {
    setSelected(entry)
    setEditNotes(entry.recruiterNotes ?? '')
    setEditAvailability(entry.availabilityNotes ?? '')
    setEditTags(entry.tags.join(', '))
  }

  const handleSaveDetails = async () => {
    if (!selected) return
    setSaving(true)
    const tags = editTags
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean)
    await updateTalentPoolEntry(selected.id, {
      recruiterNotes: editNotes,
      availabilityNotes: editAvailability,
      tags,
    })
    setSaving(false)
    setSelected(null)
    await load()
  }

  const handleStatus = async (entry: TalentPoolEntry, status: TalentPoolStatus) => {
    await updateTalentPoolEntry(entry.id, { poolStatus: status })
    await load()
  }

  const handleRemove = async (entry: TalentPoolEntry) => {
    if (!window.confirm(`Remove ${entry.firstName} ${entry.lastName} from the talent pool?`)) return
    await removeTalentPoolEntry(entry.id)
    if (selected?.id === entry.id) setSelected(null)
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Talent Pool
          </h3>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Interviewed candidates who were not hired for a role but may fit future openings.
            Their contact info and resume profile are kept here for easy re-engagement.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, skills, role, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as TalentPoolStatus | 'all')}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="hired">Hired elsewhere</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={matchJobId} onValueChange={setMatchJobId}>
              <SelectTrigger className="w-full md:w-[240px]">
                <SelectValue placeholder="Match vs open role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles (no match %)</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No talent pool candidates yet</p>
            <p className="text-sm mt-2 max-w-md mx-auto">
              After interviewing someone, mark them rejected and choose &quot;Save to talent pool&quot;
              — or use the button on their application card.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((entry) => {
            const score = matchJob ? scoreTalentPoolEntry(entry, matchJob) : null
            return (
              <Card key={entry.id} className="hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">
                        {entry.firstName} {entry.lastName}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Interviewed for {entry.sourceJobTitle ?? 'Unknown role'}
                        {entry.sourceDepartment ? ` • ${entry.sourceDepartment}` : ''}
                        {entry.addedAt && (
                          <span className="block text-xs mt-1">
                            Added {new Date(entry.addedAt).toLocaleDateString()}
                            {entry.addedByName ? ` by ${entry.addedByName}` : ''}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{entry.poolStatus}</Badge>
                      {entry.rating != null && entry.rating > 0 && (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: Math.min(5, entry.rating) }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          ))}
                        </div>
                      )}
                      {score != null && (
                        <Badge
                          variant="outline"
                          className={
                            score >= 75
                              ? 'border-green-500 text-green-700 bg-green-500/10'
                              : score >= 50
                                ? 'border-amber-500 text-amber-700 bg-amber-500/10'
                                : ''
                          }
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          {score}% vs {matchJob?.title}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {entry.resumeProfile?.skills && (
                    <p className="text-sm">
                      <span className="font-medium">Skills:</span>{' '}
                      <span className="text-muted-foreground">{entry.resumeProfile.skills}</span>
                    </p>
                  )}
                  {entry.resumeProfile?.experience && (
                    <p className="text-sm">
                      <span className="font-medium">Experience:</span>{' '}
                      <span className="text-muted-foreground">{entry.resumeProfile.experience}</span>
                    </p>
                  )}
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {entry.recruiterNotes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{entry.recruiterNotes}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => openDetails(entry)}>
                      View / edit
                    </Button>
                    {entry.poolStatus === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatus(entry, 'contacted')}
                      >
                        Mark contacted
                      </Button>
                    )}
                    {entry.poolStatus !== 'archived' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatus(entry, 'archived')}
                      >
                        <Archive className="h-3 w-3 mr-1" />
                        Archive
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(entry)}>
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.firstName} {selected.lastName}
                </DialogTitle>
                <DialogDescription>
                  {selected.anonymousId && <span className="mr-2">{selected.anonymousId}</span>}
                  <Briefcase className="inline h-3 w-3 mr-1" />
                  {selected.sourceJobTitle}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {selected.email}
                  </div>
                  {selected.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {selected.phone}
                    </div>
                  )}
                  {selected.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {selected.location}
                    </div>
                  )}
                </div>

                {selected.interviewNotes && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Interview notes (from application)</Label>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.interviewNotes}</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="pool-notes">Recruiter notes</Label>
                  <Textarea
                    id="pool-notes"
                    className="mt-1"
                    rows={3}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Why keep them? Strengths, roles to consider, follow-up date..."
                  />
                </div>
                <div>
                  <Label htmlFor="pool-availability">Availability</Label>
                  <Input
                    id="pool-availability"
                    className="mt-1"
                    value={editAvailability}
                    onChange={(e) => setEditAvailability(e.target.value)}
                    placeholder="e.g. Available July 2026, remote OK"
                  />
                </div>
                <div>
                  <Label htmlFor="pool-tags">Tags (comma-separated)</Label>
                  <Input
                    id="pool-tags"
                    className="mt-1"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="backend, senior, philadelphia"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveDetails} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
