/**
 * Convert a markdown answer into a clean, single-line plain-text preview for the
 * chat roster sidebar. The roster renders `lastMessageSummary.text` as plain
 * text, so raw markdown (`**5**`, `*   item`, `` `code` ``) would show its
 * syntax characters. Strip emphasis / code / heading / list / link markup and
 * collapse whitespace so the preview reads as prose.
 *
 * Underscores are handled carefully: they're stripped only when used as italic
 * delimiters at word boundaries, never inside identifiers (`execute_sql`,
 * `ai_query`) which the agents mention often.
 */
export function toPreviewText(raw: string | null | undefined): string {
  let s = String(raw || '')
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> label
  s = s.replace(/```[^\n]*\n?/g, ' ') // code-fence lines
  s = s.replace(/`([^`]+)`/g, '$1') // inline code -> inner text (keeps underscores)
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2') // **bold** / __bold__ -> inner text
  s = s.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1$2') // _italic_ at word boundaries only
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
  s = s.replace(/^\s{0,3}>\s?/gm, '') // blockquotes
  s = s.replace(/^\s{0,3}([-+*]|\d+[.)])\s+/gm, '') // list markers
  s = s.replace(/[*`~#]/g, '') // leftover emphasis/code/heading chars (NOT underscore)
  return s.replace(/\s+/g, ' ').trim()
}
