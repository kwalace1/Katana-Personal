/**
 * Browser tool runners for the Automation module.
 * Server-side (Vercel / Vite middleware) — no Playwright; HTML fetch + parse.
 */

export type AutomationBrowserTool =
  | 'screenshot'
  | 'extract_text'
  | 'fill_form'
  | 'click'
  | 'download'

export interface AutomationBrowserRequest {
  tool: AutomationBrowserTool
  url: string
  selector?: string
  formData?: Record<string, string>
  clickSequence?: string[]
  timeoutMs?: number
  /** Screenshot viewport width (from settings). Defaults to 1280. */
  viewportWidth?: number
  /** Screenshot crop height (from settings). Defaults to 900. */
  viewportHeight?: number
}

export interface AutomationBrowserResult {
  ok: boolean
  tool: AutomationBrowserTool
  url: string
  title?: string
  text?: string
  screenshotUrl?: string
  download?: {
    fileName: string
    contentType: string
    contentBase64: string
    size: number
  }
  pagesVisited?: string[]
  statusCode?: number
  error?: string
}

const PRIVATE_HOST_RE =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|\[::1\]|::1$)/i

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_BODY_BYTES = 8 * 1024 * 1024
const MAX_TEXT_CHARS = 50_000

export function assertSafePublicUrl(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    throw new Error('Invalid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed')
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    throw new Error('Private or local URLs are not allowed')
  }
  return parsed
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m?.[1] ? htmlToText(m[1]).slice(0, 200) : undefined
}

/** Best-effort CSS selector match for class/id/tag without a DOM parser. */
export function extractBySelector(html: string, selector: string): string | null {
  const sel = selector.trim()
  if (!sel) return null

  if (sel.startsWith('#')) {
    const id = sel.slice(1).replace(/[^\w-]/g, '')
    if (!id) return null
    const re = new RegExp(
      `<([a-zA-Z0-9]+)([^>]*\\bid=["']${id}["'][^>]*)>([\\s\\S]*?)<\\/\\1>`,
      'i',
    )
    const m = html.match(re)
    return m ? htmlToText(m[0]) : null
  }

  if (sel.startsWith('.')) {
    const cls = sel.slice(1).replace(/[^\w-]/g, '')
    if (!cls) return null
    const re = new RegExp(
      `<([a-zA-Z0-9]+)([^>]*\\bclass=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*)>([\\s\\S]*?)<\\/\\1>`,
      'i',
    )
    const m = html.match(re)
    return m ? htmlToText(m[0]) : null
  }

  const tag = sel.replace(/[^\w]/g, '')
  if (!tag) return null
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = html.match(re)
  return m ? htmlToText(m[0]) : null
}

function findHrefForSelector(html: string, selector: string, baseUrl: string): string | null {
  const sel = selector.trim()
  let pattern: RegExp | null = null

  if (sel.startsWith('#')) {
    const id = sel.slice(1).replace(/[^\w-]/g, '')
    pattern = new RegExp(
      `<a[^>]*\\bid=["']${id}["'][^>]*href=["']([^"']+)["'][^>]*>|<a[^>]*href=["']([^"']+)["'][^>]*\\bid=["']${id}["'][^>]*>`,
      'i',
    )
  } else if (sel.startsWith('.')) {
    const cls = sel.slice(1).replace(/[^\w-]/g, '')
    pattern = new RegExp(
      `<a[^>]*\\bclass=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>|<a[^>]*href=["']([^"']+)["'][^>]*\\bclass=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>`,
      'i',
    )
  } else {
    const tagOrText = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    pattern = new RegExp(
      `<a[^>]*href=["']([^"']+)["'][^>]*>\\s*${tagOrText}`,
      'i',
    )
  }

  if (!pattern) return null
  const m = html.match(pattern)
  const href = m?.[1] || m?.[2]
  if (!href) return null
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

function findFormMeta(html: string, baseUrl: string): { action: string; method: string } {
  const m = html.match(/<form[^>]*>/i)
  if (!m) {
    return { action: baseUrl, method: 'POST' }
  }
  const tag = m[0]
  const actionMatch = tag.match(/\baction=["']([^"']*)["']/i)
  const methodMatch = tag.match(/\bmethod=["']([^"']*)["']/i)
  let action = baseUrl
  if (actionMatch?.[1]) {
    try {
      action = new URL(actionMatch[1], baseUrl).toString()
    } catch {
      action = baseUrl
    }
  }
  const method = (methodMatch?.[1] || 'POST').toUpperCase()
  return { action, method }
}

async function fetchWithLimits(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ response: Response; buffer: ArrayBuffer }> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'KatanaAutomationBot/1.0 (+https://katana.app)',
        Accept: '*/*',
        ...(init.headers || {}),
      },
    })
    const len = Number(response.headers.get('content-length') || 0)
    if (len > MAX_BODY_BYTES) {
      throw new Error('Response too large')
    }
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_BODY_BYTES) {
      throw new Error('Response too large')
    }
    return { response, buffer }
  } finally {
    clearTimeout(timer)
  }
}

function bufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64')
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function fileNameFromUrl(url: string, contentType: string): string {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop()
    if (last && last.includes('.')) return last
  } catch {
    /* ignore */
  }
  if (contentType.includes('pdf')) return 'download.pdf'
  if (contentType.includes('json')) return 'download.json'
  if (contentType.startsWith('image/')) return `download.${contentType.split('/')[1] || 'bin'}`
  if (contentType.includes('html')) return 'page.html'
  return 'download.bin'
}

export async function runAutomationBrowserTool(
  req: AutomationBrowserRequest,
): Promise<AutomationBrowserResult> {
  const timeoutMs = Math.min(Math.max(req.timeoutMs ?? DEFAULT_TIMEOUT_MS, 3000), 60_000)

  try {
    const target = assertSafePublicUrl(req.url)

    if (req.tool === 'screenshot') {
      const width = Math.min(Math.max(req.viewportWidth ?? 1280, 320), 2560)
      const height = Math.min(Math.max(req.viewportHeight ?? 900, 240), 2000)
      const shotUrl = `https://image.thum.io/get/width/${width}/crop/${height}/noanimate/${target.toString()}`
      return {
        ok: true,
        tool: 'screenshot',
        url: target.toString(),
        title: `Screenshot of ${target.hostname}`,
        screenshotUrl: shotUrl,
        text: `Screenshot captured via thumbnail service for ${target.toString()} (${width}×${height})`,
      }
    }

    if (req.tool === 'download') {
      const { response, buffer } = await fetchWithLimits(target.toString(), { timeoutMs })
      if (!response.ok) {
        return {
          ok: false,
          tool: 'download',
          url: target.toString(),
          statusCode: response.status,
          error: `Download failed with HTTP ${response.status}`,
        }
      }
      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      const fileName = fileNameFromUrl(target.toString(), contentType)
      return {
        ok: true,
        tool: 'download',
        url: target.toString(),
        title: fileName,
        statusCode: response.status,
        download: {
          fileName,
          contentType,
          contentBase64: bufferToBase64(buffer),
          size: buffer.byteLength,
        },
        text: `Downloaded ${fileName} (${buffer.byteLength} bytes)`,
      }
    }

    if (req.tool === 'extract_text') {
      const { response, buffer } = await fetchWithLimits(target.toString(), {
        timeoutMs,
        headers: { Accept: 'text/html,application/xhtml+xml,text/plain,*/*' },
      })
      if (!response.ok) {
        return {
          ok: false,
          tool: 'extract_text',
          url: target.toString(),
          statusCode: response.status,
          error: `Fetch failed with HTTP ${response.status}`,
        }
      }
      const html = new TextDecoder('utf-8').decode(buffer)
      const title = extractTitle(html)
      let text = req.selector
        ? extractBySelector(html, req.selector) ?? ''
        : htmlToText(html)
      if (req.selector && !text) {
        return {
          ok: false,
          tool: 'extract_text',
          url: target.toString(),
          title,
          statusCode: response.status,
          error: `No content matched selector "${req.selector}"`,
        }
      }
      if (text.length > MAX_TEXT_CHARS) text = `${text.slice(0, MAX_TEXT_CHARS)}…`
      return {
        ok: true,
        tool: 'extract_text',
        url: target.toString(),
        title,
        text,
        statusCode: response.status,
      }
    }

    if (req.tool === 'fill_form') {
      const formData = req.formData || {}
      const { response: pageRes, buffer: pageBuf } = await fetchWithLimits(target.toString(), {
        timeoutMs,
        headers: { Accept: 'text/html,*/*' },
      })
      const pageHtml = new TextDecoder('utf-8').decode(pageBuf)
      const { action, method } = findFormMeta(pageHtml, target.toString())
      assertSafePublicUrl(action)

      const body = new URLSearchParams(formData).toString()
      const submitInit: RequestInit & { timeoutMs?: number } = {
        timeoutMs,
        method: method === 'GET' ? 'GET' : 'POST',
        headers: {
          Accept: 'text/html,*/*',
          ...(method === 'GET'
            ? {}
            : { 'Content-Type': 'application/x-www-form-urlencoded' }),
        },
      }
      const submitUrl =
        method === 'GET'
          ? `${action}${action.includes('?') ? '&' : '?'}${body}`
          : action
      if (method !== 'GET') {
        submitInit.body = body
      }

      const { response, buffer } = await fetchWithLimits(submitUrl, submitInit)
      const html = new TextDecoder('utf-8').decode(buffer)
      let text = htmlToText(html)
      if (text.length > MAX_TEXT_CHARS) text = `${text.slice(0, MAX_TEXT_CHARS)}…`

      return {
        ok: response.ok,
        tool: 'fill_form',
        url: target.toString(),
        title: extractTitle(html) || `Form submit → ${action}`,
        text: response.ok
          ? text || `Form submitted successfully (HTTP ${response.status})`
          : text || `Form submit returned HTTP ${response.status}`,
        statusCode: response.status,
        pagesVisited: [target.toString(), submitUrl],
        error: response.ok ? undefined : `HTTP ${response.status}`,
      }
    }

    if (req.tool === 'click') {
      const sequence =
        req.clickSequence && req.clickSequence.length > 0
          ? req.clickSequence
          : req.selector
            ? [req.selector]
            : []
      if (sequence.length === 0) {
        return {
          ok: false,
          tool: 'click',
          url: target.toString(),
          error: 'Provide at least one click selector',
        }
      }

      const visited: string[] = [target.toString()]
      let currentUrl = target.toString()
      let lastHtml = ''
      let lastStatus = 0

      for (const sel of sequence) {
        const { response, buffer } = await fetchWithLimits(currentUrl, {
          timeoutMs,
          headers: { Accept: 'text/html,*/*' },
        })
        lastStatus = response.status
        lastHtml = new TextDecoder('utf-8').decode(buffer)
        if (!response.ok) {
          return {
            ok: false,
            tool: 'click',
            url: target.toString(),
            statusCode: response.status,
            pagesVisited: visited,
            error: `Failed loading ${currentUrl} (HTTP ${response.status})`,
          }
        }
        const next = findHrefForSelector(lastHtml, sel, currentUrl)
        if (!next) {
          return {
            ok: false,
            tool: 'click',
            url: target.toString(),
            title: extractTitle(lastHtml),
            pagesVisited: visited,
            text: htmlToText(lastHtml).slice(0, 2000),
            error: `No link found for selector "${sel}" on ${currentUrl}`,
          }
        }
        assertSafePublicUrl(next)
        currentUrl = next
        visited.push(next)
      }

      const { response, buffer } = await fetchWithLimits(currentUrl, {
        timeoutMs,
        headers: { Accept: 'text/html,*/*' },
      })
      lastStatus = response.status
      lastHtml = new TextDecoder('utf-8').decode(buffer)
      let text = htmlToText(lastHtml)
      if (text.length > MAX_TEXT_CHARS) text = `${text.slice(0, MAX_TEXT_CHARS)}…`

      return {
        ok: response.ok,
        tool: 'click',
        url: target.toString(),
        title: extractTitle(lastHtml),
        text,
        statusCode: lastStatus,
        pagesVisited: visited,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      }
    }

    return {
      ok: false,
      tool: req.tool,
      url: req.url,
      error: 'Unknown tool',
    }
  } catch (e) {
    const message =
      e instanceof Error
        ? e.name === 'AbortError'
          ? 'Request timed out'
          : e.message
        : 'Browser tool failed'
    return {
      ok: false,
      tool: req.tool,
      url: req.url,
      error: message,
    }
  }
}
