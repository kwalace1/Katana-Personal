import { supabase } from '@/lib/supabase'

export interface ChatStreamOptions {
  messages: { role: string; content: string }[]
  onChunk: (text: string) => void
  onDone: () => void
  onError: (error: string) => void
  signal?: AbortSignal
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  } catch {
    return null
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

/** Server / edge bursts often recover after a short wait (429, provider failover). */
function isRetriableChatFailure(status: number, message: string): boolean {
  if (status === 429) return true
  const m = message.toLowerCase()
  return (
    m.includes('rate') ||
    m.includes('429') ||
    m.includes('too many requests') ||
    m.includes('all providers failed') ||
    m.includes('resource exhausted')
  )
}

export async function streamChat(opts: ChatStreamOptions): Promise<void> {
  const { messages, onChunk, onDone, onError, signal } = opts

  const token = await getAccessToken()
  if (!token) {
    onError('You must be signed in to use Katana AI tools.')
    return
  }

  const maxAttempts = 2
  let lastFailMessage = ''

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      try {
        await delay(4000, signal)
      } catch {
        return
      }
    }

    let res: Response
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ messages }),
        signal,
      })
    } catch (err) {
      if (signal?.aborted) return
      lastFailMessage = err instanceof Error ? err.message : 'Network error'
      if (attempt + 1 < maxAttempts && isRetriableChatFailure(0, lastFailMessage)) {
        continue
      }
      onError(lastFailMessage)
      return
    }

    if (res.status === 401) {
      onError('Session expired. Please sign in again to use Katana AI tools.')
      return
    }

    if (!res.ok) {
      let msg = `Error ${res.status}`
      try {
        const json = await res.json()
        if (json.error) msg = json.error
      } catch { /* use default msg */ }
      lastFailMessage = msg
      if (attempt + 1 < maxAttempts && isRetriableChatFailure(res.status, msg)) {
        continue
      }
      onError(msg)
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      onError('No response stream')
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            onDone()
            return
          }
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) onChunk(content)
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      if (signal?.aborted) return
      onError(err instanceof Error ? err.message : 'Stream read error')
      return
    }

    onDone()
    return
  }

  onError(lastFailMessage || 'Chat request failed after retries.')
}
