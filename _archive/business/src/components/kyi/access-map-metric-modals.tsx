import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Exact copy per ORBIT_IMPLEMENTATION_GUIDE.md §8 */
const METRIC_COPY: Record<
  string,
  { title: string; body: string }
> = {
  nodes: {
    title: 'What are Nodes?',
    body: 'Nodes are the individual points (circles) on the map. Purple = your investors, Blue = suggested people from public records, Green = organizations/firms. Total node count = Investors + Unique People + Unique Organizations.',
  },
  edges: {
    title: 'What are Edges?',
    body: "Edges are the lines connecting nodes. Investor→Person = this suggested person matches that investor's profile; Person→Organization = this person works at that firm. More edges = more interconnected network.",
  },
  unique_people: {
    title: 'What are Unique People?',
    body: "Total count of distinct individuals from public records that match your investors' profiles (FEC, SEC Form D, SEC 13F, Wikidata, news funding). Each person counted once.",
  },
  unique_orgs: {
    title: 'What are Unique Organizations?',
    body: 'Count of distinct companies/firms/institutions associated with suggested people (investment firms, corporations, financial institutions, advisory firms).',
  },
  overlap_people: {
    title: 'What are Overlap People?',
    body: 'Individuals who connect to two or more of your existing investors. Higher-value targets; multiple team members can facilitate an introduction. Example: "John Smith" matches both Kevin\'s and Nick\'s profile = overlap person.',
  },
  overlap_percentage: {
    title: 'What is Overlap Percentage?',
    body: 'Formula: (Overlap People + Overlap Orgs) ÷ (Total Unique) × 100. Higher % = overlapping networks (good for warm intros); lower % = more diverse reach.',
  },
  graph_density: {
    title: 'What is Graph Density?',
    body: 'Share of possible investor-to-investor connections that actually exist (shared firm or location). Higher values mean your roster is more tightly clustered.',
  },
}

interface MetricModalProps {
  metricKey: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MetricModal({ metricKey, open, onOpenChange }: MetricModalProps) {
  const copy = metricKey ? METRIC_COPY[metricKey] : null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={() => onOpenChange(false)}
        aria-describedby={copy ? 'metric-modal-description' : undefined}
      >
        <DialogHeader>
          <DialogTitle>{copy?.title ?? 'Metric'}</DialogTitle>
        </DialogHeader>
        <p id="metric-modal-description" className="text-sm text-muted-foreground">
          {copy?.body ?? ''}
        </p>
      </DialogContent>
    </Dialog>
  )
}

export { METRIC_COPY }
