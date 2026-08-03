import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, HelpCircle, User, Building2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildTargetedInvestorAddUrl, type AccessMapOverlap } from '@/lib/kyi-api'

interface AccessMapOverlapStripProps {
  companyId: number
  overlap: AccessMapOverlap
  open: boolean
  onOpenChange: (open: boolean) => void
  onHelpClick?: () => void
}

function OverlapRow({
  label,
  count,
  companyId,
  type,
}: {
  label: string
  count: number
  companyId: number
  type: 'person' | 'org'
}) {
  return (
    <li className="group flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-sm hover:border-amber-500/40 hover:bg-muted/50 transition-colors">
      {type === 'person' ? (
        <User className="w-3.5 h-3.5 shrink-0 text-blue-500" />
      ) : (
        <Building2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
      )}
      <span className="flex-1 min-w-0 truncate text-foreground" title={label}>
        {label}
      </span>
      <span className="text-[11px] tabular-nums text-amber-600 dark:text-amber-400 shrink-0">{count} networks</span>
      {type === 'person' && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
          asChild
        >
          <Link to={buildTargetedInvestorAddUrl(companyId, label)} title="Add to targeted investors">
            <UserPlus className="w-3.5 h-3.5" />
          </Link>
        </Button>
      )}
    </li>
  )
}

export function AccessMapOverlapStrip({
  companyId,
  overlap,
  open,
  onOpenChange,
  onHelpClick,
}: AccessMapOverlapStripProps) {
  const people = overlap.top_overlapping_people ?? []
  const orgs = overlap.top_overlapping_orgs ?? []
  const [previewExpanded, setPreviewExpanded] = useState(false)

  if (people.length === 0 && orgs.length === 0) return null

  const peopleCount = overlap.overlap_people_count ?? people.length
  const orgCount = overlap.overlap_org_count ?? orgs.length
  const overlapPct =
    overlap.overlap_percentage != null ? Math.round(overlap.overlap_percentage) : null

  return (
    <div className="shrink-0 border-b border-border bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="flex flex-1 min-w-0 items-center gap-2 text-left rounded-md hover:bg-muted/50 px-1 py-0.5 transition-colors"
          aria-expanded={open}
        >
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">Shared across investor networks</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {peopleCount} people · {orgCount} orgs
              {overlapPct != null ? ` · ${overlapPct}% overlap` : ''}
            </p>
          </div>
        </button>
        {onHelpClick && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            onClick={onHelpClick}
            title="What is overlap?"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
        )}
        {!open && people.length + orgs.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-muted-foreground shrink-0"
            onClick={() => setPreviewExpanded((v) => !v)}
          >
            {previewExpanded ? 'Hide preview' : 'Preview'}
          </Button>
        )}
      </div>

      {!open && previewExpanded && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
          {people.slice(0, 6).map((p) => (
            <span
              key={`p-${p.label}`}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-900 dark:text-amber-100"
            >
              {p.label}
              <span className="text-amber-400/80 tabular-nums">{p.count}</span>
            </span>
          ))}
          {orgs.slice(0, 4).map((o) => (
            <span
              key={`o-${o.label}`}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-900 dark:text-emerald-100"
            >
              {o.label}
              <span className="text-emerald-400/80 tabular-nums">{o.count}</span>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="px-3 pb-3 grid gap-3 sm:grid-cols-2 max-h-[min(28vh,220px)] overflow-y-auto">
          {people.length > 0 && (
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                People ({people.length})
              </p>
              <ul className="space-y-1">
                {people.slice(0, 12).map((p) => (
                  <OverlapRow
                    key={p.label}
                    label={p.label}
                    count={p.count}
                    companyId={companyId}
                    type="person"
                  />
                ))}
              </ul>
            </div>
          )}
          {orgs.length > 0 && (
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                Organizations ({orgs.length})
              </p>
              <ul className="space-y-1">
                {orgs.slice(0, 12).map((o) => (
                  <OverlapRow
                    key={o.label}
                    label={o.label}
                    count={o.count}
                    companyId={companyId}
                    type="org"
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
