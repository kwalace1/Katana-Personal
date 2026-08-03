import { describe, expect, it } from 'vitest'
import {
  assertSafePublicUrl,
  extractBySelector,
  htmlToText,
} from './automation-browser'
import { parseViewport } from './automation-api'
import { isExtractableFile } from './automation-document-extract'

describe('automation-browser helpers', () => {
  it('rejects private URLs', () => {
    expect(() => assertSafePublicUrl('http://localhost/admin')).toThrow(/Private|local/i)
    expect(() => assertSafePublicUrl('http://127.0.0.1/')).toThrow(/Private|local/i)
    expect(() => assertSafePublicUrl('http://192.168.1.1/')).toThrow(/Private|local/i)
  })

  it('accepts public https URLs', () => {
    const u = assertSafePublicUrl('https://example.com/path')
    expect(u.hostname).toBe('example.com')
  })

  it('strips html to text', () => {
    expect(htmlToText('<p>Hello <b>world</b></p><script>x()</script>')).toBe('Hello world')
  })

  it('extracts by class selector', () => {
    const html = '<div class="main"><p>Body copy</p></div><div class="other">Skip</div>'
    expect(extractBySelector(html, '.main')).toContain('Body copy')
  })
})

describe('parseViewport', () => {
  it('parses WxH', () => {
    expect(parseViewport('1920x1080')).toEqual({ width: 1920, height: 1080 })
    expect(parseViewport('1280×720')).toEqual({ width: 1280, height: 720 })
  })

  it('falls back on invalid input', () => {
    expect(parseViewport('nope')).toEqual({ width: 1280, height: 900 })
  })
})

describe('isExtractableFile', () => {
  it('marks common text formats as extractable', () => {
    expect(isExtractableFile(new File(['hi'], 'a.pdf', { type: 'application/pdf' }))).toBe(true)
    expect(isExtractableFile(new File(['hi'], 'a.txt'))).toBe(true)
    expect(isExtractableFile(new File(['hi'], 'a.docx'))).toBe(true)
    expect(isExtractableFile(new File(['hi'], 'a.xlsx'))).toBe(true)
  })

  it('rejects image-only uploads as non-extractable', () => {
    expect(isExtractableFile(new File([], 'shot.png', { type: 'image/png' }))).toBe(false)
  })
})
