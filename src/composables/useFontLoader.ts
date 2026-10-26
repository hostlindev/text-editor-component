import { ref, type Ref } from 'vue'

import type { FontDescriptor } from '@/types/editor'

export const GOOGLE_FONTS_BASE = 'https://fonts.googleapis.com/css2'

export function normalizeFamily(family: string): string {
  return family.trim().replace(/\s+/g, ' ')
}

/**
 * Builds a Google Fonts CSS2 URL, or `null` for an empty family.
 * Weights default to the regular cut when the caller does not ask for more.
 */
export function googleFontHref(family: string, weights?: number[]): string | null {
  const normalized = normalizeFamily(family)
  if (!normalized) return null
  const encoded = normalized.replace(/ /g, '+')
  const axis = weights && weights.length > 0 ? `:wght@${weights.join(';')}` : ''
  return `${GOOGLE_FONTS_BASE}?family=${encoded}${axis}&display=swap`
}

export function inferFontFormat(url: string): 'woff2' | 'woff' | 'truetype' | 'opentype' {
  const path = url.split(/[?#]/)[0]?.toLowerCase() ?? ''
  if (path.endsWith('.woff2')) return 'woff2'
  if (path.endsWith('.woff')) return 'woff'
  if (path.endsWith('.ttf')) return 'truetype'
  if (path.endsWith('.otf')) return 'opentype'
  return 'woff2'
}

function cssString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * `@font-face` rule for a self-hosted font. The exact same rule is injected in
 * the editor and in the exported HTML, so the PDF engine rasterises the same
 * glyphs the user saw.
 */
export function fontFaceRule(font: FontDescriptor): string {
  if (!font.sourceUrl) return ''
  const family = normalizeFamily(font.family)
  if (!family) return ''
  const format = inferFontFormat(font.sourceUrl)
  const weights = font.weights && font.weights.length > 0 ? font.weights : [400]
  return weights
    .map(
      (weight) => `@font-face {
  font-family: ${cssString(family)};
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('${font.sourceUrl}') format('${format}');
}`,
    )
    .join('\n')
}

function slug(family: string): string {
  return normalizeFamily(family)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export interface FontLoader {
  loaded: Ref<string[]>
  loadFont: (font: FontDescriptor) => Promise<void>
  loadFonts: (fonts: FontDescriptor[]) => Promise<void>
  isLoaded: (family: string) => boolean
}

/**
 * Loads the fonts declared by the host document before the canvas renders.
 * Google families get a stylesheet link, self-hosted files an `@font-face` rule.
 */
export function useFontLoader(): FontLoader {
  const loaded = ref<string[]>([])
  const injected = new Set<string>()

  function appendStylesheet(href: string, id: string): void {
    if (typeof document === 'undefined' || injected.has(id)) return
    const existing = document.getElementById(id)
    if (existing) {
      injected.add(id)
      return
    }
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
    injected.add(id)
  }

  function appendStyle(css: string, id: string): void {
    if (typeof document === 'undefined' || !css || injected.has(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = css
    document.head.appendChild(style)
    injected.add(id)
  }

  async function loadFont(font: FontDescriptor): Promise<void> {
    const family = normalizeFamily(font.family)
    if (!family) return

    if (font.sourceUrl) {
      appendStyle(fontFaceRule(font), `pdf-designer-font-${slug(family)}`)
    } else {
      const href = googleFontHref(family, font.weights)
      if (href) appendStylesheet(href, `pdf-designer-google-${slug(family)}`)
    }

    if (!loaded.value.includes(family)) loaded.value = [...loaded.value, family]

    const fontSet = typeof document !== 'undefined' ? document.fonts : undefined
    if (fontSet) {
      await fontSet.ready
    }
  }

  async function loadFonts(fonts: FontDescriptor[]): Promise<void> {
    await Promise.all(fonts.map((font) => loadFont(font)))
  }

  function isLoaded(family: string): boolean {
    return loaded.value.includes(normalizeFamily(family))
  }

  return { loaded, loadFont, loadFonts, isLoaded }
}
