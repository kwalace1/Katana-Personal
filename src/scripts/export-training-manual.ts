/**
 * Export in-app tour training copy to docs/KATANA_TRAINING_MANUAL.md
 * Run: npx tsx src/scripts/export-training-manual.ts
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { DriveStep } from 'driver.js'
import {
  TOUR_STEPS,
  KYI_COMPANY_TOUR_STEPS,
} from '../lib/tour-training-steps'
import { getModuleTourMeta, type ModuleTourId } from '../lib/tour-definitions'
import { ONBOARDING_TOUR_SEQUENCE } from '../lib/onboarding-tour'

const OUTPUT_PATH = resolve(process.cwd(), 'docs/KATANA_TRAINING_MANUAL.md')

function extractTourAnchor(element: DriveStep['element']): string | null {
  if (typeof element !== 'string') return null
  const match = element.match(/\[data-tour="([^"]+)"\]/)
  return match?.[1] ?? null
}

function formatDescription(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trimEnd()
      if (trimmed.startsWith('• ')) {
        return `- ${trimmed.slice(2)}`
      }
      if (/^\d+\.\s/.test(trimmed)) {
        return trimmed.replace(/^(\d+)\.\s/, '$1. ')
      }
      return trimmed
    })
    .join('\n')
    .trim()
}

function renderSteps(steps: DriveStep[], startNumber = 1): string {
  return steps
    .map((step, index) => {
      const title = step.popover?.title ?? 'Untitled step'
      const description = step.popover?.description ?? ''
      const anchor = extractTourAnchor(step.element)
      const stepNum = startNumber + index

      const lines = [
        `### ${stepNum}. ${title}`,
        '',
        formatDescription(description),
      ]

      if (anchor) {
        lines.push('', `*UI element: \`data-tour="${anchor}"\`*`)
      }

      return lines.join('\n')
    })
    .join('\n\n')
}

function renderModuleChapter(moduleId: ModuleTourId, chapterNumber: number): string {
  const meta = getModuleTourMeta(moduleId)
  const steps = TOUR_STEPS[moduleId] ?? []

  return [
    `## Part ${chapterNumber}: ${meta.name}`,
    '',
    `**Route:** \`${meta.route}\``,
    '',
    meta.description,
    '',
    renderSteps(steps),
  ].join('\n')
}

function buildManual(): string {
  const generatedAt = new Date().toISOString().slice(0, 10)
  const moduleCount = ONBOARDING_TOUR_SEQUENCE.length
  const stepCount =
    ONBOARDING_TOUR_SEQUENCE.reduce((sum, id) => sum + (TOUR_STEPS[id]?.length ?? 0), 0) +
    KYI_COMPANY_TOUR_STEPS.length

  const toc = ONBOARDING_TOUR_SEQUENCE.map((id, index) => {
    const meta = getModuleTourMeta(id)
    const steps = TOUR_STEPS[id]?.length ?? 0
    return `- [Part ${index + 1}: ${meta.name}](#part-${index + 1}-${slugify(meta.name)}) — ${steps} steps`
  }).join('\n')

  const chapters = ONBOARDING_TOUR_SEQUENCE.map((id, index) =>
    renderModuleChapter(id, index + 1),
  ).join('\n\n---\n\n')

  const kyiCompanyAppendix = [
    '## Appendix: KYI Company Workspace',
    '',
    'These steps apply when you open a specific company raise workspace (`/kyi/companies/:id`).',
    '',
    renderSteps(KYI_COMPANY_TOUR_STEPS),
  ].join('\n')

  return [
    '# Katana Training Manual',
    '',
    `> Auto-generated from in-app tour content (\`src/lib/tour-training-steps.ts\`).`,
    `> Last generated: ${generatedAt}. Re-run \`npx tsx src/scripts/export-training-manual.ts\` after tour copy changes.`,
    '',
    '## About this manual',
    '',
    'This document mirrors the Katana **full-system training tour** — the same walkthrough shown on first login and replayable from the Setup Guide. It covers the Employee Launchpad, Hub Dashboard, and every platform module in the standard training order.',
    '',
    `- **Modules:** ${moduleCount}`,
    `- **Steps:** ${stepCount} (including KYI company workspace appendix)`,
    `- **Estimated time:** 15–20 minutes in the interactive tour`,
    '',
    'Module access is role-based. Users only see modules their admin has granted via HR employee records. Skip chapters for modules you do not have access to.',
    '',
    '## Table of contents',
    '',
    toc,
    '- [Appendix: KYI Company Workspace](#appendix-kyi-company-workspace)',
    '',
    '---',
    '',
    chapters,
    '',
    '---',
    '',
    kyiCompanyAppendix,
    '',
    '---',
    '',
    '## Replay in the app',
    '',
    '1. Open the **Setup Guide** from the Hub or Employee Launchpad.',
    '2. Choose **Start training tour** (full system) or pick an individual module tutorial.',
    '3. Completed tours are tracked in your profile (`training_tour_completed_at`).',
    '',
  ].join('\n')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function main(): void {
  const markdown = buildManual()
  writeFileSync(OUTPUT_PATH, markdown, 'utf8')
  console.log(`Wrote ${OUTPUT_PATH}`)
  console.log(`  Modules: ${ONBOARDING_TOUR_SEQUENCE.length}`)
  console.log(
    `  Steps: ${ONBOARDING_TOUR_SEQUENCE.reduce((sum, id) => sum + (TOUR_STEPS[id]?.length ?? 0), 0) + KYI_COMPANY_TOUR_STEPS.length}`,
  )
}

main()
