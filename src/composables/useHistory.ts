import { computed, ref, shallowRef, type ComputedRef, type ShallowRef } from 'vue'

import { deepClone } from '@/utils/deepClone'

export interface UseHistoryOptions {
  /** Maximum number of snapshots kept in the undo stack. */
  limit?: number
  /**
   * Window used to coalesce bursts of mutations into a single snapshot.
   * `0` commits synchronously (useful for tests and for discrete actions).
   */
  debounceMs?: number
}

export interface History<T> {
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  current: ComputedRef<T | null>
  size: ComputedRef<number>
  reset: (value: T) => void
  push: (value: T) => void
  flush: () => void
  undo: () => T | null
  redo: () => T | null
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Snapshot history for a JSON-serialisable state.
 *
 * `push` is debounced so a drag gesture or a burst of keystrokes produces one
 * undo step instead of hundreds. `undo`/`redo` flush any pending snapshot first,
 * so `Ctrl+Z` right after a keystroke always reverts the visible state.
 */
export function useHistory<T>(options: UseHistoryOptions = {}): History<T> {
  const limit = Math.max(2, options.limit ?? 100)
  const debounceMs = Math.max(0, options.debounceMs ?? 300)

  const stack = shallowRef<T[]>([]) as ShallowRef<T[]>
  const redoStack = shallowRef<T[]>([]) as ShallowRef<T[]>
  const pending = ref<T | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  const canUndo = computed(() => stack.value.length > 1)
  const canRedo = computed(() => redoStack.value.length > 0)
  const current = computed<T | null>(() => stack.value[stack.value.length - 1] ?? null)
  const size = computed(() => stack.value.length)

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function commit(): void {
    clearTimer()
    const value = pending.value
    pending.value = null
    if (value === null) return
    if (stack.value.length > 0 && sameValue(stack.value[stack.value.length - 1], value)) return

    const next = [...stack.value, deepClone(value)]
    if (next.length > limit) next.splice(0, next.length - limit)
    stack.value = next
    redoStack.value = []
  }

  function flush(): void {
    if (pending.value !== null) commit()
  }

  function reset(value: T): void {
    clearTimer()
    pending.value = null
    stack.value = [deepClone(value)]
    redoStack.value = []
  }

  function push(value: T): void {
    pending.value = deepClone(value)
    clearTimer()
    if (debounceMs === 0) {
      commit()
      return
    }
    timer = setTimeout(commit, debounceMs)
  }

  function undo(): T | null {
    flush()
    if (stack.value.length <= 1) return null

    const next = [...stack.value]
    const removed = next.pop()
    if (removed !== undefined) redoStack.value = [removed, ...redoStack.value]
    stack.value = next
    return stack.value[stack.value.length - 1] ?? null
  }

  function redo(): T | null {
    flush()
    const [next, ...rest] = redoStack.value
    if (next === undefined) return null

    redoStack.value = rest
    stack.value = [...stack.value, next]
    return next
  }

  return { canUndo, canRedo, current, size, reset, push, flush, undo, redo }
}
