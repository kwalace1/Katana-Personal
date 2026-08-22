import { beforeEach, describe, expect, it } from 'vitest'
import { localDb } from '@/lib/local-db'
import { tasksApi } from './api'

const USER = 'test-task-lists'

describe('task lists', () => {
  beforeEach(() => {
    localStorage.clear()
    localDb.clearAll(USER)
  })

  it('assigns new tasks to a list and shows them when that list is selected', () => {
    const groceries = tasksApi.createList(USER, 'Groceries')
    const task = tasksApi.createTask(USER, { title: 'Milk', list_id: groceries.id })
    expect(task.list_id).toBe(groceries.id)
    expect(tasksApi.tasksOnList(USER, groceries.id).map((t) => t.title)).toContain('Milk')
  })

  it('treats unassigned tasks as belonging to the default list', () => {
    const lists = tasksApi.listLists(USER)
    const fallback = lists[0]
    expect(fallback).toBeTruthy()
    const task = tasksApi.createTask(USER, { title: 'Inbox item', list_id: null })
    expect(task.list_id).toBe(fallback!.id)
    expect(tasksApi.tasksOnList(USER, fallback!.id).some((t) => t.id === task.id)).toBe(true)
  })

  it('removes a list and moves its tasks to another list', () => {
    const keep = tasksApi.listLists(USER)[0]!
    const extra = tasksApi.createList(USER, 'Weekend')
    const task = tasksApi.createTask(USER, { title: 'Mow lawn', list_id: extra.id })
    expect(tasksApi.deleteList(USER, extra.id)).toBe(true)
    expect(tasksApi.listLists(USER).some((l) => l.id === extra.id)).toBe(false)
    expect(tasksApi.getTask(USER, task.id)?.list_id).toBe(keep.id)
  })

  it('refuses to delete the last list', () => {
    const only = tasksApi.listLists(USER)[0]!
    expect(tasksApi.deleteList(USER, only.id)).toBe(false)
    expect(tasksApi.listLists(USER)).toHaveLength(1)
  })

  it('links tasks to a habit and returns them when that habit is selected', () => {
    const task = tasksApi.createTask(USER, { title: 'Meditate 10m', habit_id: 'habit-1' })
    expect(tasksApi.forHabit(USER, 'habit-1').map((t) => t.id)).toEqual([task.id])
    tasksApi.updateTask(USER, task.id, { habit_id: null })
    expect(tasksApi.forHabit(USER, 'habit-1')).toEqual([])
  })
})
