/**
 * Deep clone for plain JSON data.
 *
 * Documents and history snapshots are JSON by contract, so the JSON round-trip
 * is always correct. `structuredClone` is preferred when available because it
 * is faster and keeps `undefined`, but some DOM test environments ship an
 * implementation that rejects plain objects, so it is wrapped in a fallback.
 * Reactive proxies are unwrapped by neither path, which is intentional: the
 * editor never stores proxies in a snapshot.
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Fall back to the JSON representation below.
    }
  }
  return JSON.parse(JSON.stringify(value)) as T
}
