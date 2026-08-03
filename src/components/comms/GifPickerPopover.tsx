import { useState, useEffect, useCallback } from 'react'
import { ImageIcon, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  getTrendingGifs,
  searchGifs,
  isGifSearchAvailable,
  type GifResult,
} from '@/lib/comms-gif-search'

interface GifPickerPopoverProps {
  onSelect: (gifUrl: string) => void
}

export function GifPickerPopover({ onSelect }: GifPickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)

  const loadGifs = useCallback(async (q: string) => {
    if (!isGifSearchAvailable()) return
    setLoading(true)
    try {
      const results = q.trim() ? await searchGifs(q) : await getTrendingGifs()
      setGifs(results)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !isGifSearchAvailable()) return
    const timer = setTimeout(() => {
      void loadGifs(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [open, query, loadGifs])

  const handleSelect = (url: string) => {
    onSelect(url)
    setOpen(false)
    setQuery('')
  }

  const available = isGifSearchAvailable()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title={available ? 'Send a GIF' : 'GIF search (set VITE_TENOR_API_KEY)'}
        >
          <span className="text-[10px] font-bold tracking-tight">GIF</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start" side="top">
        {!available ? (
          <div className="text-xs text-muted-foreground p-2 space-y-2">
            <ImageIcon className="w-8 h-8 mx-auto opacity-40" />
            <p>
              Add <code className="text-[10px] bg-muted px-1 rounded">VITE_TENOR_API_KEY</code> to
              your .env to enable GIF search.
            </p>
            <p>
              <a
                href="https://developers.google.com/tenor/guides/quickstart"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Get a free Tenor API key
              </a>
            </p>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search GIFs..."
                className="pl-8 h-8 text-sm"
              />
            </div>
            <ScrollArea className="h-56">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : gifs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No GIFs found</p>
              ) : (
                <div className="grid grid-cols-2 gap-1 pr-2">
                  {gifs.map(gif => (
                    <button
                      key={gif.id}
                      type="button"
                      className="rounded overflow-hidden hover:ring-2 ring-primary transition-all aspect-square bg-muted"
                      onClick={() => handleSelect(gif.url)}
                      title={gif.title}
                    >
                      <img
                        src={gif.previewUrl}
                        alt={gif.title || 'GIF'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
