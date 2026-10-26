import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MARGINS_MM,
  DOCUMENT_VERSION,
  createDocument,
  createEmptyPage,
  createImageElement,
  createShapeElement,
  createTextElement,
  normalizeDocument,
} from '../editor'

describe('createDocument', () => {
  it('creates an A4 portrait document with one empty page', () => {
    const doc = createDocument()

    expect(doc.version).toBe(DOCUMENT_VERSION)
    expect(doc.pageConfig).toEqual({
      size: 'A4',
      orientation: 'portrait',
      marginsMm: DEFAULT_MARGINS_MM,
    })
    expect(doc.fonts).toEqual([])
    expect(doc.pages).toHaveLength(1)
    expect(doc.pages[0]?.id).toBeTruthy()
    expect(doc.pages[0]?.elements).toEqual([])
  })

  it('does not share mutable defaults between documents', () => {
    const a = createDocument()
    const b = createDocument()
    expect(a.pages[0]).not.toBe(b.pages[0])
    expect(a.pageConfig.marginsMm).not.toBe(b.pageConfig.marginsMm)
  })
})

describe('element factories', () => {
  it('creates a text element with rich text defaults in millimetres', () => {
    const el = createTextElement({ xMm: 20, yMm: 30 })

    expect(el.type).toBe('text')
    expect(el.xMm).toBe(20)
    expect(el.yMm).toBe(30)
    expect(el.widthMm).toBeGreaterThan(0)
    expect(el.heightMm).toBeGreaterThan(0)
    expect(el.rotationDeg).toBe(0)
    expect(el.content.html).toBeTruthy()
    expect(el.content.tiptapJson).toEqual(expect.any(Object))
    expect(el.id).not.toBe(createTextElement().id)
  })

  it('creates image and shape elements with their own content shape', () => {
    const image = createImageElement({ content: { imageUrl: 'https://example.com/a.png' } })
    expect(image.type).toBe('image')
    expect(image.content.imageUrl).toBe('https://example.com/a.png')
    expect(image.content.objectFit).toBe('contain')

    const shape = createShapeElement({ content: { shape: { kind: 'ellipse' } } })
    expect(shape.type).toBe('shape')
    expect(shape.content.shape).toMatchObject({ kind: 'ellipse' })
  })
})

describe('normalizeDocument', () => {
  it('fills missing configuration with defaults', () => {
    const doc = normalizeDocument({ pages: [{ id: 'p1', elements: [] }] })

    expect(doc.version).toBe(DOCUMENT_VERSION)
    expect(doc.pageConfig.size).toBe('A4')
    expect(doc.pageConfig.marginsMm).toEqual(DEFAULT_MARGINS_MM)
    expect(doc.pages).toHaveLength(1)
    expect(doc.pages[0]?.id).toBe('p1')
  })

  it('creates a page when the input has none', () => {
    const doc = normalizeDocument({})
    expect(doc.pages).toHaveLength(1)
    expect(doc.pages[0]?.id).toBeTruthy()
  })

  it('keeps element geometry inside the page and assigns ordered z-index', () => {
    const doc = normalizeDocument({
      pages: [
        {
          id: 'p1',
          elements: [
            { id: 'a', type: 'text', xMm: -10, yMm: 500, widthMm: 400, heightMm: 40 },
            { id: 'b', type: 'image', xMm: 10, yMm: 10, widthMm: 20, heightMm: 20, zIndex: 99 },
          ],
        },
      ],
    })

    const [first, second] = doc.pages[0]?.elements ?? []
    expect(first?.xMm).toBe(0)
    expect(first?.widthMm).toBe(210)
    expect(first?.yMm).toBe(257)
    expect(first?.zIndex).toBe(1)
    expect(second?.zIndex).toBe(2)
    expect(second?.heightMm).toBe(20)
  })

  it('preserves relative z-index order with contiguous values', () => {
    const doc = normalizeDocument({
      pages: [
        {
          id: 'p1',
          elements: [
            { id: 'low', type: 'text', zIndex: 2 },
            { id: 'high', type: 'text', zIndex: 7 },
          ],
        },
      ],
    })

    expect(doc.pages[0]?.elements.map((e) => e.zIndex)).toEqual([1, 2])
    expect(doc.pages[0]?.elements.map((e) => e.id)).toEqual(['low', 'high'])
    expect(doc.pages[0]?.elements[0]?.style).toEqual({})
    expect(doc.pages[0]?.elements[0]?.rotationDeg).toBe(0)
  })

  it('assigns unique ids to elements missing one', () => {
    const doc = normalizeDocument({
      pages: [
        {
          id: 'p1',
          elements: [{ type: 'text' }, { type: 'text' }, { type: 'text' }],
        },
      ],
    })

    const ids = doc.pages[0]?.elements.map((e) => e.id) ?? []
    expect(new Set(ids).size).toBe(3)
  })

  it('never mutates the input document', () => {
    const input = { pages: [{ id: 'p1', elements: [{ id: 'a', type: 'text', xMm: 5 }] }] }
    const snapshot = JSON.stringify(input)
    normalizeDocument(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('ignores unknown element types by falling back to text', () => {
    const doc = normalizeDocument({
      pages: [{ id: 'p1', elements: [{ id: 'a', type: 'video' as never }] }],
    })
    expect(doc.pages[0]?.elements[0]?.type).toBe('text')
  })

  it('drops duplicated element ids', () => {
    const doc = normalizeDocument({
      pages: [
        { id: 'p1', elements: [{ id: 'dup', type: 'text' }, { id: 'dup', type: 'text' }] },
      ],
    })
    const ids = doc.pages[0]?.elements.map((e) => e.id) ?? []
    expect(new Set(ids).size).toBe(2)
  })
})

describe('shape paint lives in the element style', () => {
  it('creates the default paint in style instead of the legacy content shape', () => {
    const shape = createShapeElement()

    expect(shape.content.shape).toEqual({ kind: 'rect' })
    expect(shape.style.backgroundColor).toBe('#e0e0e0')
  })

  it('migrates legacy shape paint from content into style', () => {
    const doc = normalizeDocument({
      pages: [
        {
          id: 'p1',
          elements: [
            {
              id: 's1',
              type: 'shape',
              content: {
                shape: { kind: 'rect', fill: '#112233', stroke: '#445566', strokeWidthPt: 2, radiusMm: 3 },
              },
            },
          ],
        },
      ],
    })

    const shape = doc.pages[0]?.elements[0]
    expect(shape?.style).toEqual({
      backgroundColor: '#112233',
      borderColor: '#445566',
      borderWidthPt: 2,
      borderRadiusMm: 3,
    })
    expect(shape?.content.shape).toEqual({ kind: 'rect' })
  })

  it('keeps an explicit style over the legacy paint and is idempotent', () => {
    const input = {
      pages: [
        {
          id: 'p1',
          elements: [
            {
              id: 's1',
              type: 'shape',
              style: { backgroundColor: '#ffffff' },
              content: { shape: { kind: 'ellipse', fill: '#000000' } },
            },
          ],
        },
      ],
    }

    const once = normalizeDocument(input)
    const twice = normalizeDocument(JSON.parse(JSON.stringify(once)))

    expect(once.pages[0]?.elements[0]?.style.backgroundColor).toBe('#ffffff')
    expect(once.pages[0]?.elements[0]?.content.shape).toEqual({ kind: 'ellipse' })
    expect(twice).toEqual(once)
  })

  it('drops a transparent legacy stroke instead of painting a border', () => {
    const doc = normalizeDocument({
      pages: [
        {
          id: 'p1',
          elements: [
            {
              id: 's1',
              type: 'shape',
              content: { shape: { kind: 'rect', fill: '#e0e0e0', stroke: 'transparent', strokeWidthPt: 0 } },
            },
          ],
        },
      ],
    })

    expect(doc.pages[0]?.elements[0]?.style).toEqual({ backgroundColor: '#e0e0e0' })
  })

  it('drops a zero-width legacy stroke instead of inventing a 1pt border', () => {
    const doc = normalizeDocument({
      pages: [
        {
          id: 'p1',
          elements: [
            {
              id: 's1',
              type: 'shape',
              content: { shape: { kind: 'rect', fill: '#e0e0e0', stroke: '#445566', strokeWidthPt: 0 } },
            },
          ],
        },
      ],
    })

    expect(doc.pages[0]?.elements[0]?.style).toEqual({ backgroundColor: '#e0e0e0' })
  })
})

describe('createEmptyPage', () => {
  it('creates a page with a unique id', () => {
    expect(createEmptyPage().id).not.toBe(createEmptyPage().id)
  })
})
