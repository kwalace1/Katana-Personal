import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { searchHub, type HubSearchResult } from '@/lib/hub-quick-search'
import type { ModuleId } from '@/lib/module-access'
import { cn } from '@/lib/utils'

interface HubQuickSearchDialogProps {
  allowedModules: ModuleId[]
  trigger?: React.ReactNode
}

export function HubQuickSearchDialog({ allowedModules, trigger }: HubQuickSearchDialogProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HubSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const runSearch = useCallback(
    async (searchText: string) => {
      const trimmed = searchText.trim()
      if (!trimmed) {
        setResults([])
        setHasSearched(false)
        return
      }
      setIsSearching(true)
      setHasSearched(true)
      try {
        const next = await searchHub(trimmed, allowedModules)
        setResults(next)
      } catch {
        toast.error('Search failed. Please try again.')
        setResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [allowedModules]
  )

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      void runSearch(query)
    }, 300)
    return () => window.clearTimeout(handle)
  }, [open, query, runSearch])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setHasSearched(false)
    }
  }, [open])

  const groupedResults = useMemo(() => {
    const groups = new Map<string, HubSearchResult[]>()
    for (const result of results) {
      const bucket = groups.get(result.moduleLabel) ?? []
      bucket.push(result)
      groups.set(result.moduleLabel, bucket)
    }
    return [...groups.entries()]
  }, [results])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Search className="h-4 w-4" />
            Quick Search
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Search</DialogTitle>
          <DialogDescription>
            Search projects, tasks, customers, inventory, workforce jobs, and more across your modules.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="hub-search-query">Search</Label>
            <Input
              id="hub-search-query"
              autoFocus
              placeholder="Search projects, tasks, clients, inventory..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runSearch(query)
              }}
            />
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border">
            {isSearching ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            ) : !query.trim() ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Start typing to search across your accessible modules.
              </p>
            ) : hasSearched && results.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No results for &ldquo;{query.trim()}&rdquo;.
              </p>
            ) : (
              <div className="divide-y">
                {groupedResults.map(([moduleLabel, items]) => (
                  <div key={moduleLabel} className="p-2">
                    <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {moduleLabel}
                    </div>
                    <div className="space-y-1">
                      {items.map((result) => (
                        <Link
                          key={`${result.type}-${result.id}`}
                          to={result.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-start justify-between gap-3 rounded-md px-2 py-2',
                            'hover:bg-muted/70 transition-colors'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">{result.title}</div>
                            {result.subtitle ? (
                              <div className="truncate text-xs text-muted-foreground">{result.subtitle}</div>
                            ) : null}
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                            {result.type.replace('-', ' ')}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
