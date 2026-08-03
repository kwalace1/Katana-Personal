/** Lightweight markdown → safe HTML (no raw HTML passthrough). */
export function renderSimpleMarkdown(src: string): string {
  const escaped = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const lines = escaped.split('\n')
  const out: string[] = []
  let inList = false

  function closeList() {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }

  function inline(text: string) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="rounded bg-secondary px-1 text-[0.9em]">$1</code>')
  }

  for (const line of lines) {
    if (/^###\s+/.test(line)) {
      closeList()
      out.push(`<h3 class="mt-3 mb-1 font-display text-lg">${inline(line.replace(/^###\s+/, ''))}</h3>`)
      continue
    }
    if (/^##\s+/.test(line)) {
      closeList()
      out.push(`<h2 class="mt-4 mb-1 font-display text-xl">${inline(line.replace(/^##\s+/, ''))}</h2>`)
      continue
    }
    if (/^#\s+/.test(line)) {
      closeList()
      out.push(`<h1 class="mt-4 mb-2 font-display text-2xl">${inline(line.replace(/^#\s+/, ''))}</h1>`)
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul class="my-2 list-disc space-y-1 pl-5">')
        inList = true
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }
    closeList()
    if (!line.trim()) {
      out.push('<div class="h-2"></div>')
    } else {
      out.push(`<p class="leading-relaxed">${inline(line)}</p>`)
    }
  }
  closeList()
  return out.join('')
}
