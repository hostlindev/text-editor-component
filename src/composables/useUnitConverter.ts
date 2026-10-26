import { computed, type ComputedRef, type Ref } from 'vue'

import { PAGE_SIZES_MM, pageDimensionsMm, type PageOrientation, type PageSize } from '@/types/editor'

/**
 * The page model is physical: millimetres are the only truth.
 * Screen pixels are derived from the CSS reference resolution (96 DPI) and the
 * current zoom, so the on-screen sheet and the printed PDF share proportions.
 */
export const DPI = 96
export const PX_PER_MM = DPI / 25.4
export const PT_PER_MM = 72 / 25.4
export const MM_PER_PT = 25.4 / 72
export const MM_PER_INCH = 25.4

export { PAGE_SIZES_MM, pageDimensionsMm }

export function mmToPx(mm: number, zoom = 1): number {
  return mm * PX_PER_MM * zoom
}

export function pxToMm(px: number, zoom = 1): number {
  if (zoom === 0) return 0
  return px / (PX_PER_MM * zoom)
}

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM
}

export function ptToMm(pt: number): number {
  return pt * MM_PER_PT
}

export function ptToPx(pt: number, zoom = 1): number {
  return (pt * DPI) / 72 * zoom
}

export function pxToPt(px: number, zoom = 1): number {
  if (zoom === 0) return 0
  return (px / zoom) * (72 / DPI)
}

export function cmToMm(cm: number): number {
  return cm * 10
}

export function mmToCm(mm: number): number {
  return mm / 10
}

export function roundMm(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

type ZoomSource = Ref<number> | ComputedRef<number> | (() => number)

export interface UnitConverter {
  zoom: ComputedRef<number>
  mmToPx: (mm: number) => number
  pxToMm: (px: number) => number
  ptToPx: (pt: number) => number
  pxToPt: (px: number) => number
}

/**
 * Binds the conversions to a zoom source. The returned functions read the zoom
 * at call time, so using them inside `computed`/templates stays reactive.
 */
export function useUnitConverter(zoomSource: ZoomSource): UnitConverter {
  const zoom = computed(() => (typeof zoomSource === 'function' ? zoomSource() : zoomSource.value))

  return {
    zoom,
    mmToPx: (mm: number) => mmToPx(mm, zoom.value),
    pxToMm: (px: number) => pxToMm(px, zoom.value),
    ptToPx: (pt: number) => ptToPx(pt, zoom.value),
    pxToPt: (px: number) => pxToPt(px, zoom.value),
  }
}

export interface PageBox {
  widthMm: number
  heightMm: number
}

export function resolvePageBox(config: {
  size: PageSize
  orientation: PageOrientation
}): PageBox {
  return pageDimensionsMm(config)
}
