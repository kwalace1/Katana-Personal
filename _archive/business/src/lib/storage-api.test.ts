import { describe, it, expect } from 'vitest'
import {
  validateUploadFile,
  formatBytes,
  getModuleColor,
  calculateDurationHours,
} from './storage-api'

function makeFile(name: string, size: number, type = 'application/pdf'): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type })
}

describe('validateUploadFile', () => {
  it('accepts a valid PDF under 25MB', () => {
    const file = makeFile('doc.pdf', 1024, 'application/pdf')
    expect(validateUploadFile(file).valid).toBe(true)
  })

  it('accepts a valid JPEG image', () => {
    const file = makeFile('photo.jpg', 500_000, 'image/jpeg')
    expect(validateUploadFile(file).valid).toBe(true)
  })

  it('accepts a valid PNG image', () => {
    const file = makeFile('screenshot.png', 2_000_000, 'image/png')
    expect(validateUploadFile(file).valid).toBe(true)
  })

  it('accepts a CSV file', () => {
    const file = makeFile('data.csv', 1024, 'text/csv')
    expect(validateUploadFile(file).valid).toBe(true)
  })

  it('rejects a file exceeding 25MB', () => {
    const file = makeFile('huge.pdf', 26 * 1024 * 1024, 'application/pdf')
    const result = validateUploadFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('25MB')
  })

  it('rejects an empty file', () => {
    const file = makeFile('empty.pdf', 0, 'application/pdf')
    const result = validateUploadFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('empty')
  })

  it('rejects disallowed extension', () => {
    const file = makeFile('script.exe', 1024, 'application/octet-stream')
    const result = validateUploadFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('.exe')
  })

  it('rejects disallowed MIME type', () => {
    const file = makeFile('data.json', 1024, 'application/x-malicious')
    const result = validateUploadFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('MIME')
  })

  it('accepts file with empty MIME type (extension-based)', () => {
    const file = makeFile('readme.txt', 100, '')
    expect(validateUploadFile(file).valid).toBe(true)
  })

  it('rejects file with no extension', () => {
    const file = makeFile('noext', 100, 'application/pdf')
    const result = validateUploadFile(file)
    expect(result.valid).toBe(false)
  })
})

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512.0 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB')
  })
})

describe('getModuleColor', () => {
  it('returns correct color for projects', () => {
    expect(getModuleColor('projects')).toBe('#3b82f6')
  })

  it('returns correct color for hr', () => {
    expect(getModuleColor('hr')).toBe('#8b5cf6')
  })

  it('returns fallback for unknown module', () => {
    expect(getModuleColor('unknown')).toBe('#6b7280')
  })
})
