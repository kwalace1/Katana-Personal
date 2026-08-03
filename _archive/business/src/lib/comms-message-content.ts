/**
 * Comms message content encoding for rich message types (GIFs, etc.)
 * GIF messages use prefix ::gif:: followed by the image URL.
 */

export const GIF_PREFIX = '::gif::'

export type ParsedMessageContent =
  | { type: 'text'; text: string }
  | { type: 'gif'; url: string }

export function encodeGifMessage(url: string): string {
  return `${GIF_PREFIX}${url.trim()}`
}

export function isGifMessage(content: string): boolean {
  return content.startsWith(GIF_PREFIX)
}

export function parseMessageContent(content: string): ParsedMessageContent {
  if (content.startsWith(GIF_PREFIX)) {
    const url = content.slice(GIF_PREFIX.length).trim()
    if (url) return { type: 'gif', url }
  }
  return { type: 'text', text: content }
}

export function getMessagePreview(content: string): string {
  const parsed = parseMessageContent(content)
  if (parsed.type === 'gif') return 'GIF'
  const trimmed = parsed.text.trim()
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed
}
