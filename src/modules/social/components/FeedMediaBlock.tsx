import { Play } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { signFeedMediaFull, signFeedMediaTimeline } from '@/lib/social/feed-media-storage'
import type { FeedMedia } from '@/lib/social/feed'
import { cn } from '@/lib/utils'

type Props = {
  media: FeedMedia[]
  compact?: boolean
}

function LazyFeedImage({
  item,
  className,
  compact,
}: {
  item: FeedMedia
  className?: string
  compact?: boolean
}) {
  const [previewUrl, setPreviewUrl] = useState(item.url)
  const [fullUrl, setFullUrl] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState(false)
  const [loadingFull, setLoadingFull] = useState(false)

  const ensurePreview = useCallback(async () => {
    if (previewUrl) return previewUrl
    const url = await signFeedMediaTimeline(item)
    if (url) setPreviewUrl(url)
    return url
  }, [item, previewUrl])

  useEffect(() => {
    if (!previewUrl && !item.url) void ensurePreview()
  }, [ensurePreview, item.url, previewUrl])

  const openFull = async () => {
    if (loadingFull) return
    setLoadingFull(true)
    try {
      await ensurePreview()
      const url = fullUrl || (await signFeedMediaFull(item))
      if (url) {
        setFullUrl(url)
        setLightbox(true)
      }
    } finally {
      setLoadingFull(false)
    }
  }

  if (!previewUrl && !item.url) {
    return null
  }

  const src = previewUrl || item.url
  if (!src) return null

  return (
    <>
      <button
        type="button"
        onClick={() => void openFull()}
        className={cn('block w-full cursor-zoom-in border-0 bg-secondary p-0', className)}
        aria-label="View full photo"
      >
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn(
            'w-full object-cover',
            compact ? 'max-h-64' : 'max-h-[min(70vh,28rem)]',
          )}
        />
      </button>
      {lightbox && fullUrl ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(false)}
        >
          <img
            src={fullUrl}
            alt=""
            className="max-h-[92vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  )
}

function LazyFeedVideo({
  item,
  className,
  compact,
}: {
  item: FeedMedia
  className?: string
  compact?: boolean
}) {
  const [posterUrl, setPosterUrl] = useState(item.url)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)

  const ensurePoster = useCallback(async () => {
    if (posterUrl) return posterUrl
    const url = await signFeedMediaTimeline(item)
    if (url) setPosterUrl(url)
    return url
  }, [item, posterUrl])

  const play = async () => {
    if (loading) return
    setLoading(true)
    try {
      const url = videoUrl || (await signFeedMediaFull(item))
      if (!url) return
      setVideoUrl(url)
      setPlaying(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!posterUrl && !item.url) void ensurePoster()
  }, [ensurePoster, item.url, posterUrl])

  if (playing && videoUrl) {
    return (
      <video
        src={videoUrl}
        controls
        autoPlay
        playsInline
        preload="none"
        className={className}
      />
    )
  }

  const poster = posterUrl || item.url

  return (
    <button
      type="button"
      onClick={() => void play()}
      disabled={loading}
      className={cn(
        'relative flex w-full items-center justify-center bg-black p-0',
        className,
        loading && 'opacity-70',
      )}
      aria-label="Play video"
    >
      {poster ? (
        <img
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover opacity-90"
        />
      ) : (
        <div className="aspect-video w-full bg-black" />
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <Play className="ml-0.5 h-6 w-6 fill-current" />
        </span>
      </span>
    </button>
  )
}

export function FeedMediaBlock({ media, compact }: Props) {
  if (!media?.length) return null

  return (
    <div
      className={cn(
        'relative mt-2 overflow-hidden rounded-2xl border border-border/50',
        media.length === 1 ? 'grid grid-cols-1' : 'grid grid-cols-2 gap-px bg-border/40',
      )}
    >
      {media.map((m) =>
        m.type === 'video' ? (
          <LazyFeedVideo
            key={m.path}
            item={m}
            compact={compact}
            className={cn(
              'w-full object-contain',
              media.length === 1
                ? compact
                  ? 'max-h-64'
                  : 'max-h-[min(70vh,28rem)]'
                : 'aspect-square object-cover',
            )}
          />
        ) : (
          <LazyFeedImage
            key={m.path}
            item={m}
            compact={compact}
            className={cn(
              media.length === 1 ? undefined : 'aspect-square',
            )}
          />
        ),
      )}
    </div>
  )
}

/** Tiny preview for edit sheet — poster/thumb only, no full download. */
export function FeedMediaEditPreview({ item }: { item: FeedMedia }) {
  const [src, setSrc] = useState(item.url)

  useEffect(() => {
    if (src || item.url) return
    void signFeedMediaTimeline(item).then((url) => {
      if (url) setSrc(url)
    })
  }, [item, item.url, src])

  const display = src || item.url
  if (!display) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary/60 text-[0.65rem] text-muted-foreground">
        Video
      </div>
    )
  }

  return (
    <img
      src={display}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
    />
  )
}
