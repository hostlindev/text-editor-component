import { describe, expect, it } from 'vitest'

import {
  fontFaceRule,
  googleFontHref,
  inferFontFormat,
  normalizeFamily,
} from '../useFontLoader'

describe('googleFontHref', () => {
  it('builds a css2 url for a single family', () => {
    const href = googleFontHref('Montserrat')
    expect(href).toBe(
      'https://fonts.googleapis.com/css2?family=Montserrat&display=swap',
    )
  })

  it('encodes spaces and appends the requested weights', () => {
    const href = googleFontHref('Open Sans', [400, 700])
    expect(href).toContain('family=Open+Sans:wght@400;700')
    expect(href).toContain('display=swap')
  })

  it('returns null for an empty family', () => {
    expect(googleFontHref('   ')).toBeNull()
  })
})

describe('inferFontFormat', () => {
  it('detects woff2, woff, truetype and opentype', () => {
    expect(inferFontFormat('https://x/a.woff2?v=1')).toBe('woff2')
    expect(inferFontFormat('https://x/a.woff')).toBe('woff')
    expect(inferFontFormat('https://x/a.ttf')).toBe('truetype')
    expect(inferFontFormat('https://x/a.otf')).toBe('opentype')
  })

  it('falls back to woff2', () => {
    expect(inferFontFormat('https://x/font')).toBe('woff2')
  })
})

describe('normalizeFamily', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeFamily('  Open   Sans ')).toBe('Open Sans')
  })
})

describe('fontFaceRule', () => {
  it('builds an @font-face rule with the detected format', () => {
    const rule = fontFaceRule({ family: 'Inter', sourceUrl: 'https://x/inter.woff2' })

    expect(rule).toContain('@font-face')
    expect(rule).toContain('font-family: "Inter"')
    expect(rule).toContain("url('https://x/inter.woff2') format('woff2')")
    expect(rule).toContain('font-display: swap')
  })

  it('quotes families with spaces and apostrophes safely', () => {
    const rule = fontFaceRule({ family: 'O\'Hara Sans', sourceUrl: 'https://x/f.ttf' })
    expect(rule).toContain('font-family: "O\'Hara Sans"')
  })

  it('returns an empty string without a source url', () => {
    expect(fontFaceRule({ family: 'Inter' })).toBe('')
  })
})
