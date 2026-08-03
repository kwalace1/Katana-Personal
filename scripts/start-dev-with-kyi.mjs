#!/usr/bin/env node
/**
 * Start the full system on localhost:3001:
 * - KYI Flask app (port 5000, proxied at /kyi-app)
 * - Katana Vite dev server (port 3001)
 *
 * Usage: npm run dev:all   (from katana root)
 * Or:    node scripts/start-dev-with-kyi.mjs
 *
 * KYI path: set KYI_PATH or defaults to ../KYI relative to katana root.
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const katanaRoot = path.join(__dirname, '..')
const kyiPath = process.env.KYI_PATH || path.join(katanaRoot, '..', 'KYI')

const isWindows = process.platform === 'win32'
const pythonBin = isWindows
  ? path.join(kyiPath, 'venv', 'Scripts', 'python.exe')
  : path.join(kyiPath, 'venv', 'bin', 'python')

console.log('Starting full system on localhost:3001...')
console.log('  KYI path:', kyiPath)

const flask = spawn(pythonBin, ['app.py'], {
  cwd: kyiPath,
  stdio: 'pipe',
  detached: true,
  env: { ...process.env, FLASK_RUN_PORT: '5000' },
})

flask.stderr?.on('data', (d) => process.stderr.write(`[KYI] ${d}`))
flask.on('error', (err) => {
  console.error('Failed to start KYI app:', err.message)
  console.error('Ensure KYI is at', kyiPath, 'and venv exists. Set KYI_PATH if needed.')
  process.exit(1)
})
flask.unref()

setTimeout(() => {
  console.log('  Katana: http://localhost:3001')
  console.log('  KYI (via proxy): http://localhost:3001/kyi-app')
  console.log('')
  const vite = spawn('npm', ['run', 'dev'], { cwd: katanaRoot, stdio: 'inherit', shell: true })
  vite.on('exit', (code) => process.exit(code ?? 0))
}, 2500)
