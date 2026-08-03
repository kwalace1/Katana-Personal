/**
 * Generates sample files for PM "Import project" testing.
 * Run: node scripts/generate-sample-pm-import.mjs
 */

import * as XLSX from 'xlsx'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const outDir = join(process.cwd(), 'public', 'samples')
mkdirSync(outDir, { recursive: true })

const wb = XLSX.utils.book_new()

const projectAoA = [
  ['Name', 'Status', 'Deadline', 'Description', 'Owner'],
  [
    'Sample Imported Project',
    'active',
    '2026-12-31',
    'Demo project for testing Import project on Katana PM.',
    '',
  ],
]

const tasksAoA = [
  ['Title', 'Status', 'Priority', 'Assignee', 'Deadline', 'Description'],
  ['Kickoff meeting', 'todo', 'high', '', '2026-05-15', 'Book room and send agenda'],
  ['Define API contract', 'in progress', 'medium', '', '2026-05-20', 'Align with backend team'],
  ['Write migration guide', 'backlog', 'low', '', '2026-06-01', ''],
  ['Release checklist', 'review', 'high', '', '2026-05-25', 'Security and rollout'],
]

XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projectAoA), 'Project')
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tasksAoA), 'Tasks')

const xlsxPath = join(outDir, 'katana-pm-sample-import.xlsx')
XLSX.writeFile(wb, xlsxPath)
console.log('Wrote', xlsxPath)

const csvLines = tasksAoA.map((row) =>
  row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
)
const csvPath = join(outDir, 'katana-pm-sample-tasks-only.csv')
writeFileSync(csvPath, csvLines.join('\n'), 'utf8')
console.log('Wrote', csvPath)
