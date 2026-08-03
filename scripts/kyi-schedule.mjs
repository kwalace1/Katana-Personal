#!/usr/bin/env node
/**
 * Run fetch + import on a schedule (e.g. every 24 hours).
 * Usage: node scripts/kyi-schedule.mjs [interval_hours]
 * Example: node scripts/kyi-schedule.mjs 24
 * Or with npm: npm run kyi:schedule
 * Stop with Ctrl+C.
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const intervalHours = parseFloat(process.argv[2] || '24') || 24
const intervalMs = intervalHours * 60 * 60 * 1000

function runRefresh() {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'kyi:refresh'], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    })
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))))
    child.on('error', reject)
  })
}

async function loop() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = new Date(Date.now() + intervalMs).toISOString()
    console.log('[KYI schedule] Next run at', next)
    await new Promise((r) => setTimeout(r, intervalMs))
    try {
      await runRefresh()
    } catch (e) {
      console.error('[KYI schedule] Run failed:', e.message)
    }
  }
}

console.log('[KYI schedule] Fetch + import every', intervalHours, 'hour(s). Press Ctrl+C to stop.')
runRefresh()
  .then(() => loop())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
