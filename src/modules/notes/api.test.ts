import { beforeEach, describe, expect, it } from 'vitest'
import { localDb } from '@/lib/local-db'
import { noteTitleFromInput, notesApi } from './api'

const USER = 'test-notes'

describe('notes titles', () => {
  beforeEach(() => {
    localStorage.clear()
    localDb.clearAll(USER)
  })

  it('keeps spaces between words', () => {
    expect(noteTitleFromInput('Grocery list for Saturday')).toBe('Grocery list for Saturday')
    const note = notesApi.createNote(USER, { title: '  Weekly plan  ' })
    expect(note.title).toBe('Weekly plan')
    const updated = notesApi.updateNote(USER, note.id, { title: 'Call the dentist Monday' })
    expect(updated?.title).toBe('Call the dentist Monday')
  })

  it('does not keep a title that is only spaces', () => {
    expect(noteTitleFromInput('   ')).toBe('Untitled')
    const note = notesApi.createNote(USER, { title: '   ' })
    expect(note.title).toBe('Untitled')
    const updated = notesApi.updateNote(USER, note.id, { title: '\n\t ' })
    expect(updated?.title).toBe('Untitled')
  })
})
