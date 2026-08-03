import { describe, it, expect } from 'vitest'
import {
  encodeGifMessage,
  isGifMessage,
  parseMessageContent,
  getMessagePreview,
  GIF_PREFIX,
} from './comms-message-content'

describe('comms-message-content', () => {
  it('encodes and parses GIF messages', () => {
    const url = 'https://media.tenor.com/example.gif'
    const encoded = encodeGifMessage(url)
    expect(encoded).toBe(`${GIF_PREFIX}${url}`)
    expect(isGifMessage(encoded)).toBe(true)
    expect(parseMessageContent(encoded)).toEqual({ type: 'gif', url })
  })

  it('parses plain text messages', () => {
    expect(parseMessageContent('Hello team!')).toEqual({ type: 'text', text: 'Hello team!' })
    expect(isGifMessage('Hello team!')).toBe(false)
  })

  it('returns GIF preview label', () => {
    expect(getMessagePreview(encodeGifMessage('https://example.com/a.gif'))).toBe('GIF')
  })
})
