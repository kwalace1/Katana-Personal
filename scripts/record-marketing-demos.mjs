/**
 * Record portrait marketing clips of Katana Personal.
 * Uses a throwaway local workspace named Maya (not a real account).
 *
 *   node scripts/record-marketing-demos.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3001'
const OUT_DIR =
  process.env.DEMO_OUT_DIR ||
  path.join(os.homedir(), 'Downloads', 'Katana-landing-page', 'personal-demos')
const VIEWPORT = { width: 390, height: 844 }
const VIDEO_SIZE = { width: 780, height: 1688 }

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForOk(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.status < 500) return
    } catch {
      // still booting
    }
    await sleep(500)
  }
  throw new Error(`App did not start at ${url}`)
}

async function maybeStartDevServer() {
  try {
    const res = await fetch(BASE, { redirect: 'manual' })
    if (res.status < 500) return null
  } catch {
    // need to start
  }
  const child = spawn('npm', ['run', 'dev'], {
    cwd: ROOT,
    stdio: 'pipe',
    env: { ...process.env, BROWSER: 'none' },
  })
  await waitForOk(BASE)
  return child
}

function findFfmpeg() {
  const staticBin = '/tmp/katana-ffmpeg/node_modules/ffmpeg-static/ffmpeg'
  if (fs.existsSync(staticBin)) return staticBin
  const bundled = path.join(os.homedir(), 'Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac')
  if (fs.existsSync(bundled)) return bundled
  return 'ffmpeg'
}

async function typeSlow(locator, text) {
  await locator.click()
  await locator.fill('')
  await locator.pressSequentially(text, { delay: 38 })
}

async function waitSettled(page) {
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {})
  await sleep(400)
  await page
    .waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 15_000 })
    .catch(() => {})
  await sleep(350)
}

async function gotoReady(page, pathname) {
  await page.goto(`${BASE}${pathname}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await waitSettled(page)
}

async function skipRitual(page) {
  await page.evaluate(() => {
    localStorage.setItem('katana-personal:onboarding-done', '1')
    localStorage.setItem('katana-personal:captured-once', '1')
    localStorage.setItem('katana-personal:pwa-nudge-dismiss', '1')
    localStorage.setItem('katana-personal:backup-nudge-dismiss', '1')
    localStorage.removeItem('katana-personal:ritual-step')
  })
}

async function dismissNoise(page) {
  for (const name of ['Dismiss', 'Got it', 'Not now', 'Maybe later']) {
    const btn = page.getByRole('button', { name, exact: true }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {})
      await sleep(200)
    }
  }
}

async function openFreshWorkspace(page, { withSplit = false } = {}) {
  await gotoReady(page, '/')
  const name = page.getByPlaceholder('Your name')
  await name.waitFor({ state: 'visible', timeout: 30_000 })
  await typeSlow(name, 'Maya')
  await page.getByRole('button', { name: 'Open Katana' }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
  await sleep(500)
  await skipRitual(page)
  await gotoReady(page, '/settings')
  const load = page.getByRole('button', { name: 'Load demo day' })
  await load.waitFor({ state: 'visible' })
  await load.click()
  await sleep(500)

  if (withSplit) {
    await gotoReady(page, '/health?area=fitness&tab=splits')
    const preset = page.getByRole('button', { name: 'Push / Pull / Legs' })
    if (await preset.isVisible().catch(() => false)) {
      await preset.click()
      await sleep(300)
      const save = page.getByRole('button', { name: 'Save split' })
      if (await save.isEnabled().catch(() => false)) {
        await save.click()
        await sleep(500)
      }
    }
  }
}

async function recordToday(page) {
  await gotoReady(page, '/dashboard')
  await page.getByText(/Good (morning|afternoon|evening)/).waitFor({ timeout: 20_000 })
  await dismissNoise(page)
  await sleep(900)

  const capture = page.getByPlaceholder('Call Mom Friday 3pm')
  await capture.waitFor({ state: 'visible' })
  await capture.scrollIntoViewIfNeeded()
  await sleep(350)
  await typeSlow(capture, 'Call Mom Friday 3pm')
  await sleep(500)
  await page.getByRole('button', { name: 'Create' }).click()
  await sleep(1400)

  const next = page.getByText('Do this next', { exact: true })
  if (await next.isVisible().catch(() => false)) {
    await next.scrollIntoViewIfNeeded()
    await sleep(600)
  }
  const mark = page.getByRole('button', { name: 'Mark done' }).first()
  if (await mark.isVisible().catch(() => false)) {
    await mark.click()
    await sleep(1400)
    const close = page.getByRole('button', { name: /not now|close/i }).first()
    if (await close.isVisible().catch(() => false)) await close.click().catch(() => {})
  }
  await sleep(700)
}

async function recordAsk(page) {
  await gotoReady(page, '/ask')
  await page.getByRole('heading', { name: 'Ask' }).waitFor({ timeout: 20_000 })
  await dismissNoise(page)
  await sleep(1100)

  const chips = [
    'What should I work on today?',
    'Close my day',
    'Prep for tomorrow',
    'Clear my morning',
    'How are my Circles?',
  ]
  for (const label of chips) {
    const chip = page.getByRole('button', { name: label }).first()
    if (await chip.isVisible().catch(() => false)) {
      await chip.click()
      break
    }
  }
  await sleep(2000)
  const action = page.locator('[role="log"] button').first()
  if (await action.isVisible().catch(() => false)) {
    await action.click()
    await sleep(1600)
  }
}

async function recordFitness(page) {
  await gotoReady(page, '/health?area=fitness&tab=lift')
  await page.getByRole('heading', { name: 'Fitness' }).waitFor({ timeout: 20_000 })
  await dismissNoise(page)
  await sleep(700)

  const name = page.getByLabel('Workout name')
  await name.scrollIntoViewIfNeeded()
  await typeSlow(name, 'Push')
  await sleep(250)

  const exercise = page.getByPlaceholder('Exercise').first()
  await exercise.scrollIntoViewIfNeeded()
  await typeSlow(exercise, 'Bench Press')
  await sleep(200)

  const weight = page.getByLabel('Exercise 1 set 1 weight')
  await weight.click()
  await weight.fill('135')
  const reps = page.getByLabel('Exercise 1 set 1 reps')
  await reps.click()
  await reps.fill('8')
  await sleep(350)

  await page.getByRole('button', { name: 'Save workout' }).click()
  await sleep(1500)
  const close = page.getByRole('button', { name: /not now|close/i }).first()
  if (await close.isVisible().catch(() => false)) await close.click().catch(() => {})
}

async function recordWellness(page) {
  await gotoReady(page, '/health?area=wellness&tab=overview')
  await page.keyboard.press('Escape').catch(() => {})
  await page.getByRole('heading', { name: 'Wellness', exact: true }).waitFor({ timeout: 20_000 })
  await sleep(1200)
  await dismissNoise(page)

  const logGlass = page.locator('button', { hasText: 'Log a glass' }).first()
  await logGlass.waitFor({ state: 'attached', timeout: 20_000 })
  await logGlass.scrollIntoViewIfNeeded()
  await sleep(400)
  for (let i = 0; i < 3; i++) {
    await logGlass.click({ force: true })
    await sleep(650)
  }
  const week = page.getByText('This week at a glance')
  if (await week.isVisible().catch(() => false)) {
    await week.scrollIntoViewIfNeeded()
    await sleep(1400)
  }
}

async function recordTogether(page) {
  await gotoReady(page, '/dashboard')
  await dismissNoise(page)
  await sleep(600)

  const mark = page.getByRole('button', { name: 'Mark done' }).first()
  if (await mark.isVisible().catch(() => false)) {
    await mark.scrollIntoViewIfNeeded()
    await sleep(350)
    await mark.click({ force: true })
    await sleep(2200)
    const notNow = page.getByRole('button', { name: 'Not now' })
    if (await notNow.isVisible().catch(() => false)) {
      await notNow.click()
      await sleep(600)
    }
  }

  await page.keyboard.press('Escape').catch(() => {})
  await sleep(400)
  await gotoReady(page, '/social')
  await page.getByText(/How Together works|Connect to see|Friends/).first().waitFor({ timeout: 20_000 }).catch(() => {})
  await sleep(1500)
  await page.mouse.wheel(0, 260)
  await sleep(800)

  await gotoReady(page, '/circles')
  await page.getByText(/Circle|Together|Friends|board/i).first().waitFor({ timeout: 20_000 }).catch(() => {})
  await sleep(1500)
  await page.mouse.wheel(0, 220)
  await sleep(900)

  await gotoReady(page, '/shared')
  await sleep(1400)
}

function transcode(src, dest, startSec) {
  const ffmpeg = findFfmpeg()
  const start = Math.max(0, startSec - 0.15).toFixed(2)
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss',
      start,
      '-i',
      src,
      '-an',
      '-vf',
      'scale=780:1688:force_original_aspect_ratio=decrease,pad=780:1688:(ow-iw)/2:(oh-ih)/2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '20',
      '-preset',
      'fast',
      '-movflags',
      '+faststart',
      dest,
    ]
    const child = spawn(ffmpeg, args, { stdio: 'pipe' })
    let err = ''
    child.stderr.on('data', (d) => {
      err += String(d)
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg failed (${code}): ${err.slice(-500)}`))
    })
  })
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const server = await maybeStartDevServer()
  const clips = []
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const requested = (process.env.DEMO_CLIPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const jobs = [
    ['personal-today', recordToday, { withSplit: false }],
    ['personal-ask', recordAsk, { withSplit: false }],
    ['personal-fitness', recordFitness, { withSplit: true }],
    ['personal-wellness', recordWellness, { withSplit: false }],
    ['personal-together', recordTogether, { withSplit: false }],
  ].filter(([name]) => requested.length === 0 || requested.includes(name))

  try {
    for (const [name, run, setup] of jobs) {
      console.log(`Recording ${name}…`)
      const rawDir = path.join(OUT_DIR, '_raw', name)
      fs.rmSync(rawDir, { recursive: true, force: true })
      fs.mkdirSync(rawDir, { recursive: true })

      const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: 'light',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        reducedMotion: 'reduce',
        recordVideo: { dir: rawDir, size: VIDEO_SIZE },
      })
      const page = await context.newPage()
      page.setDefaultTimeout(25_000)
      const videoStarted = Date.now()
      let actionStarted = videoStarted
      try {
        await openFreshWorkspace(page, setup)
        await waitSettled(page)
        actionStarted = Date.now()
        await run(page)
        await sleep(1200)
      } finally {
        const video = page.video()
        await context.close()
        const src = video ? await video.path() : null
        if (!src || !fs.existsSync(src)) throw new Error(`No video for ${name}`)
        const dest = path.join(OUT_DIR, `${name}.mp4`)
        const startSec = (actionStarted - videoStarted) / 1000 + 1.1
        await transcode(src, dest, startSec)
        const stat = fs.statSync(dest)
        clips.push({ name, dest, bytes: stat.size, startSec })
        console.log(`  wrote ${dest} (trimmed ${startSec.toFixed(1)}s of setup)`)
      }
    }
  } finally {
    await browser.close().catch(() => {})
    if (server) server.kill()
  }

  const manifest = path.join(OUT_DIR, 'README.txt')
  const lines = [
    'Katana Personal marketing clips',
    'Portrait 780×1688, muted H.264 — drop into the phone frames on the company site.',
    '',
    ...clips.map((c) => `${c.name}.mp4  (${Math.round(c.bytes / 1024)} KB)`),
    '',
    'Recorded from a throwaway local demo workspace (Maya + Load demo day).',
    'Together shows the share sheet plus Social / Circles / Plans.',
    'Feed and Circles need cloud friends to look fully lived-in — this capture uses the empty Together setup, which is honest to a first-run.',
  ]
  fs.writeFileSync(manifest, lines.join('\n'))
  console.log('\nDone.')
  for (const c of clips) console.log(c.dest)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
