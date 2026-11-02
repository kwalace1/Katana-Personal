import { accentTokens } from '@/lib/accent'
import { CLASSIC_DARK, CLASSIC_LIGHT, type ThemePalette } from './classic'
import { themePalette } from './families'
import { THEME_FAMILIES, type ThemeFamily } from './types'

/**
 * High contrast is a layer on the active palette, not a 19th theme.
 * Hue and the canvas stay put. Lightness moves only until text and
 * boundaries clear the enhanced targets.
 */
export const MORE_CONTRAST_QUERY = '(prefers-contrast: more), (forced-colors: active)'

const STYLE_ID = 'kp-contrast'

const PUBLISHED = [
  '--foreground',
  '--card-foreground',
  '--popover-foreground',
  '--muted-foreground',
  '--secondary-foreground',
  '--accent-foreground',
  '--primary',
  '--primary-foreground',
  '--border',
  '--input',
  '--ring',
  '--destructive',
  '--destructive-foreground',
] as const

type Channels = { h: number; s: number; l: number }

export function systemPrefersMoreContrast() {
  return window.matchMedia(MORE_CONTRAST_QUERY).matches
}

export function parseHsl(value: string): Channels | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/)
  if (!match) return null
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) }
}

function formatHsl({ h, s, l }: Channels) {
  const light = Math.round(l * 10) / 10
  const lightText = Number.isInteger(light) ? String(light) : light.toFixed(1)
  return `${Math.round(h)} ${Math.round(s)}% ${lightText}%`
}

function channelRgb(value: string) {
  const parsed = parseHsl(value)
  if (!parsed) return [0, 0, 0]
  const { h, s, l } = parsed
  const sat = s / 100
  const light = l / 100
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return [f(0), f(8), f(4)].map((channel) => Math.round(channel * 255))
}

/** WCAG relative contrast. Symmetric in its arguments. */
export function contrastRatio(foreground: string, background: string) {
  const lum = (rgb: number[]) => {
    const lin = rgb.map((channel) => {
      const c = channel / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
  }
  const [hi, lo] = [lum(channelRgb(foreground)), lum(channelRgb(background))].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

function tuneAgainst(color: string, backgrounds: string[], minimum: number, darken: boolean) {
  const grounds = backgrounds.filter((ground) => ground.length > 0)
  if (grounds.length === 0 || grounds.every((ground) => contrastRatio(color, ground) >= minimum)) return color
  const parsed = parseHsl(color)
  if (!parsed) return color
  let current = parsed
  const step = darken ? -0.5 : 0.5
  for (let i = 0; i < 180; i++) {
    const nextL = Math.round((current.l + step) * 10) / 10
    if (nextL < 6 || nextL > 97) break
    current = { ...current, l: nextL }
    const value = formatHsl(current)
    if (grounds.every((ground) => contrastRatio(value, ground) >= minimum)) return value
  }
  return formatHsl(current)
}

function present(palette: ThemePalette, keys: string[]) {
  return keys.map((key) => palette[key]).filter((value): value is string => Boolean(value))
}

/**
 * Returns the same palette with lightness adjusted for enhanced contrast.
 * Background, card, and accent washes are left alone so the theme stays recognizable.
 */
export function highContrastPalette(palette: ThemePalette, appearance: 'light' | 'dark'): ThemePalette {
  const next: ThemePalette = { ...palette }
  const darkenText = appearance === 'light'
  const page = present(next, ['--background', '--card', '--popover'])
  const mutedGrounds = present(next, ['--background', '--card', '--popover', '--muted', '--secondary'])

  if (next['--foreground']) next['--foreground'] = tuneAgainst(next['--foreground'], page, 7, darkenText)
  if (next['--card-foreground'] && next['--card']) {
    next['--card-foreground'] = tuneAgainst(next['--card-foreground'], [next['--card']], 7, darkenText)
  }
  if (next['--popover-foreground'] && next['--popover']) {
    next['--popover-foreground'] = tuneAgainst(next['--popover-foreground'], [next['--popover']], 7, darkenText)
  }
  if (next['--muted-foreground']) {
    next['--muted-foreground'] = tuneAgainst(next['--muted-foreground'], mutedGrounds, 7, darkenText)
  }
  if (next['--secondary-foreground'] && next['--secondary']) {
    next['--secondary-foreground'] = tuneAgainst(next['--secondary-foreground'], [next['--secondary']], 7, darkenText)
  }
  if (next['--accent-foreground'] && next['--accent']) {
    next['--accent-foreground'] = tuneAgainst(next['--accent-foreground'], [next['--accent']], 7, darkenText)
  }

  if (next['--primary'] && next['--primary-foreground']) {
    const text = next['--primary-foreground']
    const textLight = (parseHsl(text)?.l ?? 100) >= 50
    let primary = tuneAgainst(next['--primary'], [text], 7, textLight)
    const grounds = present(next, ['--background', '--card'])
    if (grounds.some((ground) => contrastRatio(primary, ground) < 3)) {
      const nudged = tuneAgainst(primary, grounds, 3, appearance === 'light')
      if (contrastRatio(text, nudged) >= 7) primary = nudged
    }
    next['--primary'] = primary
    if (palette['--ring'] && palette['--ring'] === palette['--primary']) next['--ring'] = primary
  }
  if (next['--ring'] && next['--ring'] === palette['--ring']) {
    next['--ring'] = tuneAgainst(next['--ring'], page, 3, appearance === 'light')
  }

  if (next['--border']) {
    const border = tuneAgainst(next['--border'], page, 3, appearance === 'light')
    next['--border'] = border
    if (next['--input']) next['--input'] = border
  }

  if (next['--destructive'] && next['--destructive-foreground']) {
    const ink = next['--destructive-foreground']
    const inkLight = (parseHsl(ink)?.l ?? 100) >= 50
    next['--destructive'] = tuneAgainst(next['--destructive'], [ink], 4.5, inkLight)
  }

  return next
}

function familyOf(value: string | undefined): ThemeFamily {
  return (THEME_FAMILIES as readonly string[]).includes(value ?? '') ? (value as ThemeFamily) : 'classic'
}

function paintPalette(family: ThemeFamily, appearance: 'light' | 'dark') {
  const classic = appearance === 'dark' ? CLASSIC_DARK : CLASSIC_LIGHT
  return highContrastPalette(
    {
      '--destructive': classic['--destructive'],
      '--destructive-foreground': classic['--destructive-foreground'],
      ...themePalette(family, appearance),
    },
    appearance,
  )
}

/** Writes tuned tokens for the painted family. Removes them when contrast is standard. */
export function renderContrastStyle(root: HTMLElement = document.documentElement) {
  const existing = document.getElementById(STYLE_ID)
  if (root.dataset.contrast !== 'high') {
    existing?.remove()
    return
  }
  const family = familyOf(root.dataset.theme)
  const appearance = root.classList.contains('dark') ? 'dark' : 'light'
  const source: ThemePalette = {
    '--destructive': (appearance === 'dark' ? CLASSIC_DARK : CLASSIC_LIGHT)['--destructive'],
    '--destructive-foreground': (appearance === 'dark' ? CLASSIC_DARK : CLASSIC_LIGHT)['--destructive-foreground'],
    ...themePalette(family, appearance),
  }
  const tuned = paintPalette(family, appearance)
  const body = PUBLISHED.filter((key) => tuned[key] && tuned[key] !== source[key])
    .map((key) => `  ${key}: ${tuned[key]};`)
    .join('\n')
  const selector =
    appearance === 'dark'
      ? `html.dark[data-contrast='high'][data-theme='${family}']`
      : `html[data-contrast='high'][data-theme='${family}']`
  let style = existing instanceof HTMLStyleElement ? existing : null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = body ? `${selector} {\n${body}\n}\n` : ''
}

/**
 * Classic accent is stored as inline variables, which beat the contrast sheet.
 * Retune those variables from the accent template so a custom hue still clears.
 */
export function tuneAccentForContrast(root: HTMLElement = document.documentElement) {
  if (root.dataset.contrast !== 'high') return
  if ((root.dataset.theme || 'classic') !== 'classic') return
  const inline = root.style.getPropertyValue('--primary').trim()
  if (!inline) return
  const hue = parseHsl(inline)?.h
  if (hue == null) return
  const dark = root.classList.contains('dark')
  const template = accentTokens(hue, dark)
  const tuned = highContrastPalette(
    { ...themePalette('classic', dark ? 'dark' : 'light'), ...template },
    dark ? 'dark' : 'light',
  )
  for (const [key, value] of Object.entries(template)) {
    root.style.setProperty(key, tuned[key] ?? value)
  }
}
