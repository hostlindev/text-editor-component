import { describe, expect, it } from 'vitest'

import {
  createDocument,
  createImageElement,
  createShapeElement,
  createTextElement,
} from '@/types/editor'
import {
  collectPlaceholders,
  escapeHtml,
  exportHtml,
  interpolateVariables,
} from '../htmlPrintExporter'

describe('interpolateVariables', () => {
  it('replaces known placeholders and reports nothing missing', () => {
    const result = interpolateVariables('Hola {{nombre}}, hoy es {{fecha}}', {
      nombre: 'Ana',
      fecha: '2026-10-25',
    })

    expect(result.value).toBe('Hola Ana, hoy es 2026-10-25')
    expect(result.missingVariables).toEqual([])
  })

  it('keeps unknown placeholders and reports them once', () => {
    const result = interpolateVariables('{{a}} {{b}} {{a}}', { a: 'x' })

    expect(result.value).toBe('x {{b}} x')
    expect(result.missingVariables).toEqual(['b'])
  })

  it('escapes the interpolated values', () => {
    const result = interpolateVariables('{{name}}', { name: '<script>' })
    expect(result.value).toBe('&lt;script&gt;')
  })

  it('tolerates spaces inside the braces', () => {
    expect(interpolateVariables('{{ nombre }}', { nombre: 'Ana' }).value).toBe('Ana')
  })
})

describe('collectPlaceholders', () => {
  it('lists the placeholders used by the document in order', () => {
    const doc = createDocument({
      pages: [
        {
          id: 'p1',
          elements: [
            createTextElement({ content: { html: '<p>{{nombre}}</p>' } }),
            createTextElement({ content: { html: '<p>{{fecha}} - {{nombre}}</p>' } }),
          ],
        },
      ],
    })

    expect(collectPlaceholders(doc)).toEqual(['nombre', 'fecha'])
  })
})

describe('escapeHtml', () => {
  it('escapes the five dangerous characters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
  })
})

describe('exportHtml', () => {
  const doc = createDocument({
    fonts: [
      { family: 'Montserrat' },
      { family: 'Inter', sourceUrl: 'https://cdn.example.com/inter.woff2' },
    ],
    pages: [
      {
        id: 'p1',
        elements: [
          createTextElement({
            id: 'text1',
            xMm: 20,
            yMm: 30,
            widthMm: 80,
            heightMm: 20,
            rotationDeg: 5,
            zIndex: 2,
            content: { html: '<p>Hola <strong>{{nombre}}</strong></p>' },
            style: { backgroundColor: '#ffeeaa', paddingMm: 2 },
          }),
          createImageElement({
            id: 'img1',
            xMm: 10,
            yMm: 100,
            widthMm: 50,
            heightMm: 50,
            content: { imageUrl: 'https://cdn.example.com/logo.png', objectFit: 'cover' },
            style: { opacity: 0.8, borderRadiusMm: 3 },
          }),
          createShapeElement({
            id: 'shape1',
            xMm: 120,
            yMm: 200,
            widthMm: 40,
            heightMm: 20,
            content: { shape: { kind: 'rect' } },
            style: { backgroundColor: '#000000', borderColor: '#ffffff', borderWidthPt: 1 },
          }),
        ],
      },
    ],
  })

  const result = exportHtml(doc, { title: 'Certificado', variables: { nombre: 'Ana' } })

  it('emits a standalone HTML document', () => {
    expect(result.html.startsWith('<!doctype html>')).toBe(true)
    expect(result.html).toContain('<title>Certificado</title>')
    expect(result.html).toContain('<style>')
  })

  it('declares the physical page size for the print engine', () => {
    expect(result.html).toContain('@page')
    expect(result.html).toContain('size: 210mm 297mm')
    expect(result.html).toContain('width: 210mm')
    expect(result.html).toContain('height: 297mm')
  })

  it('positions elements in millimetres with rotation and stacking', () => {
    expect(result.html).toContain('left: 20mm')
    expect(result.html).toContain('top: 30mm')
    expect(result.html).toContain('width: 80mm')
    expect(result.html).toContain('transform: rotate(5deg)')
    expect(result.html).toContain('z-index: 2')
  })

  it('renders the rich text html and interpolates variables', () => {
    expect(result.html).toContain('Hola <strong>Ana</strong>')
    expect(result.missingVariables).toEqual([])
  })

  it('renders images with fit and opacity', () => {
    expect(result.html).toContain('src="https://cdn.example.com/logo.png"')
    expect(result.html).toContain('object-fit: cover')
    expect(result.html).toContain('opacity: 0.8')
    expect(result.html).toContain('border-radius: 3mm')
  })

  it('renders shapes', () => {
    expect(result.html).toContain('background: #000000')
    expect(result.html).toContain('border: 1pt solid #ffffff')
  })

  it('loads the document fonts', () => {
    expect(result.html).toContain('fonts.googleapis.com')
    expect(result.html).toContain('Montserrat')
    expect(result.html).toContain('@font-face')
    expect(result.html).toContain('https://cdn.example.com/inter.woff2')
  })

  it('reports placeholders that the caller did not provide', () => {
    const missing = exportHtml(doc).missingVariables
    expect(missing).toEqual(['nombre'])
  })

  it('emits a page break per page', () => {
    const twoPages = createDocument({
      pages: [
        { id: 'p1', elements: [] },
        { id: 'p2', elements: [] },
      ],
    })

    expect(exportHtml(twoPages).html.match(/class="pdf-page"/g)).toHaveLength(2)
  })

  it('honours the landscape orientation', () => {
    const landscape = createDocument({
      pageConfig: {
        size: 'A4',
        orientation: 'landscape',
        marginsMm: { top: 10, right: 10, bottom: 10, left: 10 },
      },
    })

    expect(exportHtml(landscape).html).toContain('size: 297mm 210mm')
  })

  it('escapes the page background and the document title', () => {
    const dangerous = createDocument({
      pages: [{ id: 'p1', background: '"><script>alert(1)</script>', elements: [] }],
    })

    const html = exportHtml(dangerous, { title: '<b>x</b>' }).html
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
