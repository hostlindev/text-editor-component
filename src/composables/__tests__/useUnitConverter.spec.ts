import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'

import {
  MM_PER_PT,
  PAGE_SIZES_MM,
  PX_PER_MM,
  clamp,
  cmToMm,
  mmToPt,
  mmToPx,
  pageDimensionsMm,
  ptToMm,
  ptToPx,
  pxToMm,
  pxToPt,
  roundMm,
  useUnitConverter,
} from '../useUnitConverter'

describe('unit constants', () => {
  it('uses the 96 DPI CSS reference for millimetres', () => {
    expect(PX_PER_MM).toBeCloseTo(3.7795275591, 9)
    expect(MM_PER_PT).toBeCloseTo(0.3527777778, 9)
    expect(PX_PER_MM * 210).toBeCloseTo(793.7007874016, 6)
  })
})

describe('mmToPx / pxToMm', () => {
  it('converts millimetres to screen pixels at zoom 1', () => {
    expect(mmToPx(10)).toBeCloseTo(37.7952755906, 8)
  })

  it('applies the zoom factor', () => {
    expect(mmToPx(10, 2)).toBeCloseTo(75.5905511811, 8)
    expect(mmToPx(10, 0.5)).toBeCloseTo(18.8976377953, 8)
  })

  it('round trips both directions', () => {
    expect(pxToMm(mmToPx(297, 1.5), 1.5)).toBeCloseTo(297, 9)
    expect(pxToMm(96)).toBeCloseTo(25.4, 9)
  })
})

describe('point conversions', () => {
  it('converts mm to points using 72 pt per inch', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 9)
    expect(ptToMm(72)).toBeCloseTo(25.4, 9)
  })

  it('converts points to screen pixels', () => {
    expect(ptToPx(72)).toBeCloseTo(96, 9)
    expect(pxToPt(96)).toBeCloseTo(72, 9)
    expect(ptToPx(12, 2)).toBeCloseTo(32, 9)
  })
})

describe('helpers', () => {
  it('converts centimetres', () => {
    expect(cmToMm(2.1)).toBeCloseTo(21, 9)
  })

  it('rounds millimetres for stable storage', () => {
    expect(roundMm(10.123456)).toBe(10.12)
    expect(roundMm(10.125, 1)).toBe(10.1)
    expect(roundMm(10.16, 1)).toBe(10.2)
  })

  it('clamps values', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
    expect(clamp(5, 0, 10)).toBe(5)
  })
})

describe('pageDimensionsMm', () => {
  it('resolves the named presets', () => {
    expect(PAGE_SIZES_MM.A4).toEqual({ widthMm: 210, heightMm: 297 })
    expect(PAGE_SIZES_MM.LETTER).toEqual({ widthMm: 215.9, heightMm: 279.4 })
    expect(PAGE_SIZES_MM.LEGAL).toEqual({ widthMm: 215.9, heightMm: 355.6 })
    expect(pageDimensionsMm({ size: 'A4', orientation: 'portrait' })).toEqual({
      widthMm: 210,
      heightMm: 297,
    })
  })

  it('swaps width and height on landscape', () => {
    expect(pageDimensionsMm({ size: 'A4', orientation: 'landscape' })).toEqual({
      widthMm: 297,
      heightMm: 210,
    })
  })

  it('accepts a custom millimetre size', () => {
    expect(
      pageDimensionsMm({
        size: { widthMm: 100, heightMm: 150 },
        orientation: 'portrait',
      }),
    ).toEqual({ widthMm: 100, heightMm: 150 })
  })

  it('falls back to A4 for unknown values', () => {
    expect(
      pageDimensionsMm({
        size: 'TABLOID' as never,
        orientation: 'portrait',
      }),
    ).toEqual({ widthMm: 210, heightMm: 297 })
  })
})

describe('useUnitConverter', () => {
  it('binds the conversions to a reactive zoom', () => {
    const zoom = ref(1)
    const converter = useUnitConverter(zoom)

    expect(converter.mmToPx(10)).toBeCloseTo(37.7952755906, 8)

    zoom.value = 2
    expect(converter.mmToPx(10)).toBeCloseTo(75.5905511811, 8)
    expect(converter.zoom.value).toBe(2)
  })

  it('accepts a getter as zoom source', () => {
    const zoom = computed(() => 0.5)
    const converter = useUnitConverter(zoom)
    expect(converter.mmToPx(10)).toBeCloseTo(18.8976377953, 8)
  })
})
