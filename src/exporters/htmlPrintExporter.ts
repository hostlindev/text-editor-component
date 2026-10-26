import {
  normalizeDocument,
  pageDimensionsMm,
  type PdfCanvasElement,
  type PdfDocumentSchema,
  type VariableMap,
} from '@/types/editor'
import { fontFaceRule, googleFontHref, normalizeFamily } from '@/composables/useFontLoader'

const PLACEHOLDER_PATTERN = /\{\{\s*([\w.$-]+)\s*\}\}/g

export interface HtmlExportOptions {
  title?: string
  /** Values for `{{token}}` placeholders. Unknown tokens are reported, not dropped. */
  variables?: VariableMap
}

export interface HtmlExportResult {
  html: string
  missingVariables: string[]
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function num(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 1000) / 1000
  return String(rounded)
}

export function interpolateVariables(
  text: string,
  variables: VariableMap = {},
): { value: string; missingVariables: string[] } {
  const missing = new Set<string>()
  const value = text.replace(PLACEHOLDER_PATTERN, (match, rawKey: string) => {
    const key = rawKey.trim()
    const provided = Object.hasOwn(variables, key) ? variables[key] : undefined
    if (provided === undefined || provided === null) {
      missing.add(key)
      return match
    }
    return escapeHtml(String(provided))
  })
  return { value, missingVariables: [...missing] }
}

export function collectPlaceholders(document: unknown): string[] {
  const doc = normalizeDocument(document)
  const found: string[] = []
  for (const page of doc.pages) {
    for (const element of page.elements) {
      if (element.type !== 'text' || !element.content.html) continue
      for (const match of element.content.html.matchAll(PLACEHOLDER_PATTERN)) {
        const key = match[1]?.trim()
        if (key && !found.includes(key)) found.push(key)
      }
    }
  }
  return found
}

function geometryDeclarations(element: PdfCanvasElement): string[] {
  const declarations: string[] = [
    `left: ${num(element.xMm)}mm`,
    `top: ${num(element.yMm)}mm`,
    `width: ${num(element.widthMm)}mm`,
    `z-index: ${element.zIndex}`,
  ]

  // Text boxes grow with their content instead of silently clipping it.
  if (element.type === 'text') {
    declarations.push(`min-height: ${num(element.heightMm)}mm`)
  } else {
    declarations.push(`height: ${num(element.heightMm)}mm`)
  }

  if (element.rotationDeg) declarations.push(`transform: rotate(${num(element.rotationDeg)}deg)`)

  return declarations
}

function paintDeclarations(element: PdfCanvasElement): string[] {
  const { style } = element
  const declarations: string[] = []
  if (style.backgroundColor) declarations.push(`background: ${style.backgroundColor}`)
  if (style.borderColor && style.borderWidthPt) {
    declarations.push(`border: ${num(style.borderWidthPt)}pt solid ${style.borderColor}`)
  }
  if (style.borderRadiusMm) declarations.push(`border-radius: ${num(style.borderRadiusMm)}mm`)
  if (style.opacity !== undefined && style.opacity !== 1) {
    declarations.push(`opacity: ${num(style.opacity)}`)
  }
  if (style.paddingMm) declarations.push(`padding: ${num(style.paddingMm)}mm`)
  return declarations
}

function styleDeclarations(element: PdfCanvasElement): string {
  return [...geometryDeclarations(element), ...paintDeclarations(element)].join('; ')
}

function renderText(element: PdfCanvasElement, variables: VariableMap, missing: Set<string>): string {
  const source = element.content.html ?? ''
  const interpolated = interpolateVariables(source, variables)
  for (const key of interpolated.missingVariables) missing.add(key)
  return `<div class="pdf-el pdf-text" style="${styleDeclarations(element)}">${interpolated.value}</div>`
}

function renderImage(element: PdfCanvasElement): string {
  const url = escapeHtml(element.content.imageUrl ?? '')
  const fit = element.content.objectFit ?? 'contain'
  const alt = escapeHtml(element.content.alt ?? '')
  const declarations = `${styleDeclarations(element)}; overflow: hidden`
  return `<div class="pdf-el pdf-image" style="${declarations}"><img src="${url}" alt="${alt}" style="width: 100%; height: 100%; object-fit: ${fit}; display: block" /></div>`
}

function renderShape(element: PdfCanvasElement): string {
  const kind = element.content.shape?.kind ?? 'rect'
  const { style } = element
  const declarations = geometryDeclarations(element)
  if (style.opacity !== undefined && style.opacity !== 1) {
    declarations.push(`opacity: ${num(style.opacity)}`)
  }

  if (kind === 'line') {
    const width = style.borderWidthPt ?? 1
    const color = style.borderColor ?? '#000000'
    declarations.push('height: 0', `border-top: ${num(width)}pt solid ${color}`)
    return `<div class="pdf-el pdf-shape" style="${declarations.join('; ')}"></div>`
  }

  if (style.backgroundColor) declarations.push(`background: ${style.backgroundColor}`)
  if (style.borderColor && style.borderWidthPt) {
    declarations.push(`border: ${num(style.borderWidthPt)}pt solid ${style.borderColor}`)
  }
  if (kind === 'ellipse') declarations.push('border-radius: 50%')
  else if (style.borderRadiusMm) declarations.push(`border-radius: ${num(style.borderRadiusMm)}mm`)

  return `<div class="pdf-el pdf-shape" style="${declarations.join('; ')}"></div>`
}

function renderTable(element: PdfCanvasElement, variables: VariableMap, missing: Set<string>): string {
  const table = element.content.table ?? { rows: [] }
  const rows = table.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell) => {
          const interpolated = interpolateVariables(cell, variables)
          for (const key of interpolated.missingVariables) missing.add(key)
          const tag = table.headerRow && rowIndex === 0 ? 'th' : 'td'
          return `<${tag} style="border: 0.5pt solid #999; padding: 1mm 2mm; text-align: left">${interpolated.value}</${tag}>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  return `<table class="pdf-el pdf-table" style="${styleDeclarations(element)}; border-collapse: collapse; width: ${num(element.widthMm)}mm"><tbody>${rows}</tbody></table>`
}

function renderElement(element: PdfCanvasElement, variables: VariableMap, missing: Set<string>): string {
  switch (element.type) {
    case 'image':
      return renderImage(element)
    case 'shape':
      return renderShape(element)
    case 'table':
      return renderTable(element, variables, missing)
    case 'text':
    default:
      return renderText(element, variables, missing)
  }
}

function renderFonts(fonts: PdfDocumentSchema['fonts']): string {
  const links: string[] = []
  const faces: string[] = []

  for (const font of fonts) {
    const family = normalizeFamily(font.family)
    if (!family) continue
    if (font.sourceUrl) {
      const rule = fontFaceRule(font)
      if (rule) faces.push(rule)
    } else {
      const href = googleFontHref(family, font.weights)
      if (href) links.push(`<link rel="stylesheet" href="${escapeHtml(href)}" />`)
    }
  }

  return [...links, faces.length > 0 ? `<style>${faces.join('\n')}</style>` : '']
    .filter(Boolean)
    .join('\n')
}

/**
 * Renders the document as a standalone HTML page with physical page sizes and
 * absolute millimetre positioning. That is the artifact a headless Chromium
 * (Puppeteer / Playwright / Gotenberg) or WeasyPrint converts into a PDF with
 * 1:1 fidelity to the editor.
 */
export function exportHtml(document: unknown, options: HtmlExportOptions = {}): HtmlExportResult {
  const doc = normalizeDocument(document)
  const { widthMm, heightMm } = pageDimensionsMm(doc.pageConfig)
  const variables = options.variables ?? {}
  const missing = new Set<string>()

  const pages = doc.pages
    .map((page) => {
      const background = page.background ? escapeHtml(page.background) : '#ffffff'
      const elements = page.elements
        .map((element) => renderElement(element, variables, missing))
        .join('\n')
      return `<div class="pdf-page" style="width: ${num(widthMm)}mm; height: ${num(heightMm)}mm; background: ${background}">\n${elements}\n</div>`
    })
    .join('\n')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(options.title ?? 'Document')}</title>
${renderFonts(doc.fonts)}
<style>
  @page { size: ${num(widthMm)}mm ${num(heightMm)}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pdf-page { position: relative; overflow: hidden; page-break-after: always; break-after: page; }
  .pdf-page:last-of-type { page-break-after: auto; break-after: auto; }
  .pdf-el { position: absolute; }
  .pdf-text, .pdf-table { overflow-wrap: break-word; }
  .pdf-text p, .pdf-text h1, .pdf-text h2, .pdf-text h3, .pdf-text ul, .pdf-text ol { margin: 0; }
  .pdf-text ul, .pdf-text ol { padding-left: 5mm; }
  .pdf-image img { max-width: 100%; }
</style>
</head>
<body>
${pages}
</body>
</html>`

  return { html, missingVariables: [...missing] }
}

export function downloadHtmlFile(result: HtmlExportResult, filename = 'document.html'): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([result.html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Client-side "print to PDF" preview: the browser print dialog is the PDF
 * engine. It reuses the exact same HTML the backend would consume.
 */
export function printHtmlDocument(html: string): void {
  if (typeof document === 'undefined') return
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.srcdoc = html
  frame.onload = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 1000)
  }
  document.body.appendChild(frame)
}
