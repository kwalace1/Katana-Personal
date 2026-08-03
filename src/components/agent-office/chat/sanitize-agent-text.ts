import { stripLeakedFenceArtifacts } from '@/lib/office/chat/assistant-text-sanitize'
import { stripAllInternalMetadata } from '@/lib/office/strip-internal-metadata'

/**
 * Render-time sanitation for persisted assistant messages. Weak relay models
 * (the office's delegation path) leak three artifact classes into otherwise
 * good answers: internal working-state JSON (factsUpsert/planSteps/...),
 * restated answers around code fences, and mid-sentence paragraph breaks from
 * stream stitching. Each pass below is conservative — legit prose and real
 * code blocks are untouched.
 */

const INTERNAL_FENCE_KEYS = [
  '"factsUpsert"',
  '"workflowKey"',
  '"objectiveSummary"',
  '"evidenceIds"',
  '"invariants"',
  '"derived"',
  '"failures"',
  '"statusUpsert"',
  '"planSteps"',
  '"nextAction"',
]

/** Remove whole fenced blocks whose body is internal machine metadata. */
function stripInternalJsonFences(text: string): string {
  return text.replace(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/g, (block, body: string) =>
    INTERNAL_FENCE_KEYS.some((k) => body.includes(k)) ? '' : block,
  )
}

/** Remove stray fence remnants: lines that are only 1-2 backticks. */
function stripStrayBacktickLines(text: string): string {
  return text.replace(/(^|\n)\s*`{1,2}\s*(?=\n|$)/g, '$1')
}

/**
 * Heal paragraph breaks the stream stitched into the middle of a sentence.
 * Signature: a blank line whose continuation starts with a space + lowercase
 * ("projects\n\n in total") — legitimate markdown paragraphs never start with
 * a space. Also rejoin a bold run split right after its opening marker
 * ("the **\n\nSmart Sensor**").
 */
function healMidSentenceBreaks(text: string): string {
  return text
    .replace(/\n{2,}(?= [a-z0-9*(])/g, '')
    .replace(/\*\*\n{2,}(?=[A-Za-z0-9])/g, '**')
}

/**
 * Split sentences the model glued together with no space ("…cert'.No one…").
 * Restated answer blocks arrive glued this way; splitting them onto their own
 * lines is what lets the repeated-block collapser see and remove the restates.
 * (Same seam rule as SwarmClaw's deglueSentences, applied up front.)
 */
function deglueSentenceSeams(text: string): string {
  return text.replace(/([a-z0-9)\]'"])([.!?])([A-Z*])/g, '$1$2\n\n$3')
}

function normalize(s: string): string {
  return s.replace(/[*_`#>\s]/g, '').toLowerCase()
}

/**
 * Drop the trailing sentence when it verbatim-repeats earlier content —
 * the glued restatement left behind after a metadata fence is removed.
 */
function dropRepeatedTrailingSentence(text: string): string {
  const trimmed = text.trim()
  const lastEnd = Math.max(
    trimmed.lastIndexOf('.', trimmed.length - 2),
    trimmed.lastIndexOf('!', trimmed.length - 2),
    trimmed.lastIndexOf('?', trimmed.length - 2),
  )
  if (lastEnd < 20) return trimmed
  const tail = trimmed.slice(lastEnd + 1).trim()
  const head = trimmed.slice(0, lastEnd + 1)
  const normTail = normalize(tail)
  if (normTail.length >= 12 && normalize(head).includes(normTail)) return head.trim()
  return trimmed
}

/** Rejoin bold runs split across a paragraph break ("**16\n\n**"). */
function healSplitEmphasis(text: string): string {
  return text.replace(/\*\*([^*\n]+)\n{2,}\*\*/g, '**$1**')
}

/**
 * Drop paragraphs that verbatim-repeat an earlier paragraph. Restating models
 * emit the same paragraph two or three times per answer; identical paragraphs
 * are never legitimate in a single reply. Skipped when code fences are present.
 */
function dedupeParagraphs(text: string): string {
  if (text.includes('```')) return text
  const seen = new Set<string>()
  const kept: string[] = []
  for (const para of text.split(/\n{2,}/)) {
    const norm = normalize(para)
    if (norm.length >= 8) {
      if (seen.has(norm)) continue
      seen.add(norm)
    }
    kept.push(para)
  }
  return kept.join('\n\n')
}

/** Full sanitation pipeline for persisted assistant messages. */
export function sanitizeAgentText(text: string): string {
  if (!text) return text
  let t = stripInternalJsonFences(text)
  t = stripAllInternalMetadata(t) // schema-validated removal of unfenced working-state JSON
  t = stripStrayBacktickLines(t)
  t = healMidSentenceBreaks(t)
  t = deglueSentenceSeams(t) // expose glued restates as separate paragraphs…
  t = stripLeakedFenceArtifacts(t) // empty fences + doubled answers
  t = dedupeParagraphs(t) // …then drop verbatim-repeated paragraphs
  t = healSplitEmphasis(t)
  t = dropRepeatedTrailingSentence(t)
  return t.trim()
}
