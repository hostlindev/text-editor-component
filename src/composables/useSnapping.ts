import type { MarginsMm } from '@/types/editor'

export const DEFAULT_SNAP_THRESHOLD_MM = 1.5

export type SnapAxis = 'x' | 'y'

export type SnapKind = 'page' | 'center' | 'margin' | 'element'

export interface SnapRect {
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}

export interface SnapLine {
  axis: SnapAxis
  positionMm: number
  kind: SnapKind
}

export interface SnapOptions {
  pageWidthMm: number
  pageHeightMm: number
  marginsMm?: MarginsMm
  /** Maximum distance, in millimetres, at which a line attracts the box. */
  thresholdMm?: number
}

export interface SnapResult {
  xMm: number
  yMm: number
  guides: SnapLine[]
}

interface Target {
  positionMm: number
  kind: SnapKind
}

interface AxisSnap {
  delta: number
  guide: SnapLine | null
}

function xTargets(options: SnapOptions, siblings: SnapRect[]): Target[] {
  const targets: Target[] = [
    { positionMm: 0, kind: 'page' },
    { positionMm: options.pageWidthMm, kind: 'page' },
    { positionMm: options.pageWidthMm / 2, kind: 'center' },
  ]
  if (options.marginsMm) {
    targets.push({ positionMm: options.marginsMm.left, kind: 'margin' })
    targets.push({ positionMm: options.pageWidthMm - options.marginsMm.right, kind: 'margin' })
  }
  for (const sibling of siblings) {
    targets.push({ positionMm: sibling.xMm, kind: 'element' })
    targets.push({ positionMm: sibling.xMm + sibling.widthMm / 2, kind: 'element' })
    targets.push({ positionMm: sibling.xMm + sibling.widthMm, kind: 'element' })
  }
  return targets
}

function yTargets(options: SnapOptions, siblings: SnapRect[]): Target[] {
  const targets: Target[] = [
    { positionMm: 0, kind: 'page' },
    { positionMm: options.pageHeightMm, kind: 'page' },
    { positionMm: options.pageHeightMm / 2, kind: 'center' },
  ]
  if (options.marginsMm) {
    targets.push({ positionMm: options.marginsMm.top, kind: 'margin' })
    targets.push({ positionMm: options.pageHeightMm - options.marginsMm.bottom, kind: 'margin' })
  }
  for (const sibling of siblings) {
    targets.push({ positionMm: sibling.yMm, kind: 'element' })
    targets.push({ positionMm: sibling.yMm + sibling.heightMm / 2, kind: 'element' })
    targets.push({ positionMm: sibling.yMm + sibling.heightMm, kind: 'element' })
  }
  return targets
}

function snapAxis(
  start: number,
  size: number,
  axis: SnapAxis,
  targets: Target[],
  threshold: number,
): AxisSnap {
  const edges = [start, start + size / 2, start + size]
  let best: { distance: number; delta: number; target: Target } | null = null

  for (const edge of edges) {
    for (const target of targets) {
      const delta = target.positionMm - edge
      const distance = Math.abs(delta)
      if (distance > threshold) continue
      if (best === null || distance < best.distance) {
        best = { distance, delta, target }
      }
    }
  }

  if (best === null) return { delta: 0, guide: null }
  return {
    delta: best.delta,
    guide: { axis, positionMm: best.target.positionMm, kind: best.target.kind },
  }
}

/**
 * Snaps a moving box to page edges, the page centre, the margins and sibling
 * elements. Only the closest alignment per axis is applied, so the box never
 * jumps between competing guides.
 */
export function snapMove(
  rect: SnapRect,
  options: SnapOptions,
  siblings: SnapRect[] = [],
): SnapResult {
  const threshold = options.thresholdMm ?? DEFAULT_SNAP_THRESHOLD_MM
  const siblingsInsidePage = siblings.filter(
    (sibling) => sibling !== rect && Number.isFinite(sibling.xMm) && Number.isFinite(sibling.yMm),
  )

  const horizontal = snapAxis(
    rect.xMm,
    rect.widthMm,
    'x',
    xTargets(options, siblingsInsidePage),
    threshold,
  )
  const vertical = snapAxis(
    rect.yMm,
    rect.heightMm,
    'y',
    yTargets(options, siblingsInsidePage),
    threshold,
  )

  const guides: SnapLine[] = []
  if (horizontal.guide) guides.push(horizontal.guide)
  if (vertical.guide) guides.push(vertical.guide)

  return {
    xMm: rect.xMm + horizontal.delta,
    yMm: rect.yMm + vertical.delta,
    guides,
  }
}

/**
 * Restricts a box to the page. Used by drag/resize so an element can never be
 * dragged out of the printable area.
 */
export function clampRectToPage(
  rect: SnapRect,
  pageWidthMm: number,
  pageHeightMm: number,
  minSizeMm = 1,
): SnapRect {
  const widthMm = Math.min(Math.max(rect.widthMm, minSizeMm), pageWidthMm)
  const heightMm = Math.min(Math.max(rect.heightMm, minSizeMm), pageHeightMm)
  return {
    widthMm,
    heightMm,
    xMm: Math.min(Math.max(rect.xMm, 0), pageWidthMm - widthMm),
    yMm: Math.min(Math.max(rect.yMm, 0), pageHeightMm - heightMm),
  }
}
