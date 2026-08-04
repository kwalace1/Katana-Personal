import { formatShortDate } from '@/lib/dates'

export function relativeWhen(iso: string) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return formatShortDate(iso)
  const mins = Math.round((Date.now() - t) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return formatShortDate(iso)
}
