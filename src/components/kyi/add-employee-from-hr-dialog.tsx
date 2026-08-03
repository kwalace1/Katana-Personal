import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, User, MapPin, Briefcase } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import * as hrApi from '@/lib/hr-api'
import type { Employee as HREmployee } from '@/lib/hr-api'
import { createInvestor, type KYIInvestor } from '@/lib/kyi-api'

interface AddEmployeeFromHrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: number
  companyEmployees: KYIInvestor[]
  onAdded?: () => void
}

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function AddEmployeeFromHrDialog({
  open,
  onOpenChange,
  companyId,
  companyEmployees,
  onAdded,
}: AddEmployeeFromHrDialogProps) {
  const { toast } = useToast()
  const [hrEmployees, setHrEmployees] = useState<HREmployee[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [segmentType, setSegmentType] = useState('current_investor')

  const linkedEmails = useMemo(() => {
    const set = new Set<string>()
    for (const row of companyEmployees) {
      const e = normalizeEmail(row.email)
      if (e) set.add(e)
    }
    return set
  }, [companyEmployees])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedId(null)
      setSegmentType('current_investor')
      return
    }
    let cancelled = false
    setLoading(true)
    hrApi
      .getAllEmployees()
      .then((rows) => {
        if (!cancelled) setHrEmployees(rows)
      })
      .catch(() => {
        if (!cancelled) {
          toast({
            title: 'Could not load HR employees',
            description: 'Check your connection or open HR to add people first.',
            variant: 'destructive',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, toast])

  const availableEmployees = useMemo(() => {
    return hrEmployees.filter((emp) => {
      if (emp.status === 'Inactive') return false
      const email = normalizeEmail(emp.email)
      if (email && linkedEmails.has(email)) return false
      return true
    })
  }, [hrEmployees, linkedEmails])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return availableEmployees
    return availableEmployees.filter((emp) => {
      const hay = [emp.name, emp.email, emp.department, emp.position, emp.location]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [availableEmployees, search])

  const selected = useMemo(
    () => hrEmployees.find((e) => e.id === selectedId) ?? null,
    [hrEmployees, selectedId],
  )

  const handleAdd = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await createInvestor({
        company_id: companyId,
        full_name: selected.name,
        email: selected.email || undefined,
        phone: selected.phone || undefined,
        location: selected.location || undefined,
        title: selected.position || undefined,
        industry: selected.department || undefined,
        user_role_classification: 'employee',
        segment_type: segmentType,
      })
      toast({ title: 'Employee linked', description: `${selected.name} was added from HR.` })
      onOpenChange(false)
      onAdded?.()
    } catch (e) {
      toast({
        title: 'Could not add employee',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add employee from HR</DialogTitle>
          <DialogDescription>
            Select someone from your HR employee roster. Their profile is pulled from HR — you cannot enter details manually here.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2 flex-1 min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search HR employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Segment</Label>
            <Select value={segmentType} onValueChange={setSegmentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_investor">Current</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="geo_target">Geo target</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg min-h-[200px] max-h-[280px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading HR employees...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground space-y-2">
                <p>
                  {availableEmployees.length === 0 && hrEmployees.length > 0
                    ? 'Everyone in HR is already on this company roster.'
                    : 'No HR employees found. Add people in HR first, then link them here.'}
                </p>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link to="/hr">Open HR</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((emp) => {
                  const isSelected = selectedId === emp.id
                  return (
                    <li key={emp.id}>
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-3 hover:bg-muted/60 transition-colors ${
                          isSelected ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => setSelectedId(emp.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {emp.position}
                              {emp.department ? ` · ${emp.department}` : ''}
                            </p>
                            {emp.email && (
                              <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {emp.status}
                          </Badge>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {selected && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                From HR (read-only)
              </p>
              <p className="font-medium">{selected.name}</p>
              {selected.position && (
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Briefcase className="h-3 w-3" />
                  {selected.position}
                </p>
              )}
              {selected.location && (
                <p className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {selected.location}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selected || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Add to company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
