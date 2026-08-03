/**
 * Cheap models on the delegation/relay path sometimes append an empty code fence
 * (e.g. ```json ```) and repeat the answer around it - an artifact of internal
 * structured-output habits. Strip empty fenced blocks and collapse an answer that
 * was emitted twice around such a fence. Only touches EMPTY fences and exact
 * duplicates, so real code blocks and normal prose are never altered.
 */
function collapseRepeatedRelayAnswer(text: string): string {
  if (!text || text.length < 200) return text

  const parenRe = /\([^)]{8,80}\)/g
  const parens = [...text.matchAll(parenRe)]
  if (parens.length >= 2) {
    const first = parens[0][0].toLowerCase()
    for (let index = 1; index < parens.length; index += 1) {
      const match = parens[index]
      const marker = match[0].toLowerCase()
      if (match.index === undefined || match.index < 120) continue
      if (marker !== first && !marker.includes(first.slice(1, -1)) && !first.includes(marker.slice(1, -1))) {
        continue
      }
      const before = text.slice(0, match.index)
      const lastSentenceEnd = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'))
      if (lastSentenceEnd > 80) return before.slice(0, lastSentenceEnd + 1).trim()
      return before.trim()
    }
  }

  return text
}

/** Normalize a line for duplicate detection: strip one leading list marker and
 *  markdown emphasis, collapse whitespace, lowercase. */
function normalizeLineForDedup(line: string): string {
  return line
    .replace(/^\s*([*\-+]|\d+[.)])\s+/, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function isBulletLine(line: string): boolean {
  return /^\s*([*\-+]|\d+[.)])\s+/.test(line)
}

/** Cheap relay models (e.g. gemini-flash on the hub/synthesis path) sometimes
 *  glue a new sentence directly onto the previous one with no space
 *  (`...clients.There are...`). Insert a paragraph break so the restated block
 *  can be isolated. Only fires on the obvious lowercase-then-uppercase seam. */
function deglueSentences(text: string): string {
  return text.replace(/([a-z0-9)\]])([.!?])([A-Z])/g, '$1$2\n\n$3')
}

interface ContentLine {
  idx: number
  norm: string
}

function collectContentLines(lines: string[]): ContentLine[] {
  const content: ContentLine[] = []
  lines.forEach((line, idx) => {
    const norm = normalizeLineForDedup(line)
    if (norm.length >= 4) content.push({ idx, norm })
  })
  return content
}

/** True when two consecutive content lines repeat verbatim later — the signature
 *  of an answer the model restated rather than legitimately continued. */
function hasRepeatedConsecutiveBlock(content: ContentLine[]): boolean {
  const seenPairs = new Set<string>()
  for (let j = 1; j < content.length; j += 1) {
    const key = `${content[j - 1].norm}\u0001${content[j].norm}`
    if (seenPairs.has(key)) return true
    seenPairs.add(key)
  }
  return false
}

/**
 * When a weak relay model emits the same answer two or three times in a single
 * generation, the passes share a repeated multi-line block (a re-rendered list,
 * the same sentences, etc.). Detect the final restated block and keep only the
 * last pass — including up to two preceding context lines so a concluding
 * sentence ("There are no customers with open deals.") is preserved.
 *
 * Conservative by design: only triggers when a 2+ line block repeats verbatim,
 * which essentially never happens in legitimate prose, so real answers are
 * never truncated.
 */
function collapseRepeatedAnswerBlock(text: string): string {
  if (!text || text.length < 120) return text
  if (text.includes('```')) return text
  if (!hasRepeatedConsecutiveBlock(collectContentLines(text.split('\n')))) return text

  const lines = deglueSentences(text).split('\n')
  const content = collectContentLines(lines)
  if (content.length < 2) return text

  const firstSeen = new Map<string, number>()
  content.forEach((line, ci) => {
    if (!firstSeen.has(line.norm)) firstSeen.set(line.norm, ci)
  })

  // Find the last consecutive pair that repeats an earlier pair.
  const seenPairs = new Map<string, number>()
  let lastRepeatPos = -1
  for (let j = 1; j < content.length; j += 1) {
    const key = `${content[j - 1].norm}\u0001${content[j].norm}`
    if (seenPairs.has(key)) lastRepeatPos = j
    else seenPairs.set(key, j)
  }
  if (lastRepeatPos < 1) return text

  // Walk left across lines that already appeared earlier to reach the start of
  // the final restated block.
  let blockStartCi = lastRepeatPos - 1
  while (blockStartCi > 0) {
    const prev = content[blockStartCi - 1]
    const prevFirst = firstSeen.get(prev.norm)
    if (prevFirst === undefined || prevFirst >= blockStartCi - 1) break
    blockStartCi -= 1
  }

  let keepFromLine = content[blockStartCi].idx
  // Attach up to two non-bullet context lines directly above the block.
  let attached = 0
  for (let i = keepFromLine - 1; i >= 0 && attached < 2; i -= 1) {
    const line = lines[i]
    if (line.trim() === '') continue
    if (isBulletLine(line)) break
    keepFromLine = i
    attached += 1
  }

  const kept = lines.slice(keepFromLine).join('\n').trim()
  if (kept.length < 40) return text
  if (kept.length >= text.trim().length) return text
  return kept
}

export function stripLeakedFenceArtifacts(text: string): string {
  if (!text) return text
  let t = text
  const dupAroundFence = t.match(/^([\s\S]+?)\s*```[a-zA-Z0-9_-]*\s*```\s*([\s\S]+)$/)
  if (dupAroundFence) {
    const a = dupAroundFence[1].trim()
    const b = dupAroundFence[2].trim()
    if (a && b && (a === b || b.startsWith(a) || a.startsWith(b))) {
      t = a.length >= b.length ? a : b
    }
  }
  t = t.replace(/```[a-zA-Z0-9_-]*[ \t\r\n]*```/g, '').trim()
  const doubled = t.match(/^([\s\S]{8,}?)\s*\1$/)
  if (doubled) t = doubled[1].trim()
  t = collapseRepeatedRelayAnswer(t)
  t = collapseRepeatedAnswerBlock(t)
  return t.trim()
}
