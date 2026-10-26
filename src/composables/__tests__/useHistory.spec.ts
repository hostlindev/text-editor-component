import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useHistory } from '../useHistory'

describe('useHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('starts empty and only tracks pushed snapshots', () => {
    const history = useHistory<string>()
    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(false)

    history.reset('a')
    expect(history.canUndo.value).toBe(false)
    expect(history.current.value).toBe('a')
  })

  it('undoes and redoes committed snapshots', () => {
    const history = useHistory<string>({ debounceMs: 10 })
    history.reset('a')
    history.push('b')
    vi.advanceTimersByTime(10)

    expect(history.canUndo.value).toBe(true)
    expect(history.undo()).toBe('a')
    expect(history.canRedo.value).toBe(true)
    expect(history.redo()).toBe('b')
  })

  it('coalesces rapid pushes into one snapshot', () => {
    const history = useHistory<string>({ debounceMs: 50 })
    history.reset('a')
    history.push('b')
    history.push('c')
    history.push('d')
    vi.advanceTimersByTime(50)

    expect(history.size.value).toBe(2)
    expect(history.undo()).toBe('a')
  })

  it('flushes a pending snapshot before undoing', () => {
    const history = useHistory<string>({ debounceMs: 50 })
    history.reset('a')
    history.push('b')

    expect(history.undo()).toBe('a')
    expect(history.redo()).toBe('b')
  })

  it('ignores snapshots equal to the current one', () => {
    const history = useHistory<{ v: number }>({ debounceMs: 0 })
    history.reset({ v: 1 })
    history.push({ v: 1 })
    history.flush()

    expect(history.size.value).toBe(1)
  })

  it('drops the redo branch after a new push', () => {
    const history = useHistory<string>({ debounceMs: 0 })
    history.reset('a')
    history.push('b')
    history.flush()
    history.undo()
    history.push('c')
    history.flush()

    expect(history.canRedo.value).toBe(false)
    expect(history.undo()).toBe('a')
  })

  it('caps the stack length', () => {
    const history = useHistory<number>({ debounceMs: 0, limit: 3 })
    history.reset(0)
    for (let i = 1; i <= 5; i += 1) {
      history.push(i)
      history.flush()
    }

    expect(history.size.value).toBe(3)
    expect(history.current.value).toBe(5)
    expect(history.undo()).toBe(4)
  })

  it('returns null when there is nothing to undo or redo', () => {
    const history = useHistory<string>()
    history.reset('a')
    expect(history.undo()).toBeNull()
    expect(history.redo()).toBeNull()
  })

  it('clones snapshots so later mutation cannot corrupt the stack', () => {
    const history = useHistory<{ list: number[] }>({ debounceMs: 0 })
    const state = { list: [1] }
    history.reset(state)
    state.list.push(2)

    expect(history.current.value).toEqual({ list: [1] })
  })

  it('allows resetting the stack', () => {
    const history = useHistory<string>({ debounceMs: 0 })
    history.reset('a')
    history.push('b')
    history.flush()
    history.reset('z')

    expect(history.size.value).toBe(1)
    expect(history.canUndo.value).toBe(false)
    expect(history.current.value).toBe('z')
  })
})
