import { describe, expect, it } from 'vitest'

import { createDocument, createTextElement } from '@/types/editor'
import {
  DocumentParseError,
  exportDocumentJson,
  isValidDocument,
  parseDocumentJson,
} from '../jsonSchemaExporter'

describe('exportDocumentJson', () => {
  it('serialises the normalised document as pretty JSON by default', () => {
    const doc = createDocument()
    const json = exportDocumentJson(doc)

    expect(json).toContain('\n  ')
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe('1.0.0')
    expect(parsed.pages).toHaveLength(1)
  })

  it('serialises without newlines when pretty is false', () => {
    const json = exportDocumentJson(createDocument(), { pretty: false })
    expect(json).not.toContain('\n')
  })

  it('always emits the full schema, including element defaults', () => {
    const json = exportDocumentJson({
      pages: [
        {
          id: 'p1',
          elements: [{ id: 'e1', type: 'text', xMm: 10, yMm: 10, widthMm: 20, heightMm: 20 }],
        },
      ],
    })

    const el = JSON.parse(json).pages[0].elements[0]
    expect(el.rotationDeg).toBe(0)
    expect(el.zIndex).toBe(1)
    expect(el.style).toEqual({})
    expect(el.content).toEqual(expect.any(Object))
  })

  it('does not mutate the source document', () => {
    const doc = createDocument()
    const snapshot = JSON.stringify(doc)
    exportDocumentJson(doc)
    expect(JSON.stringify(doc)).toBe(snapshot)
  })
})

describe('parseDocumentJson', () => {
  it('round trips an exported document', () => {
    const doc = createDocument({
      pages: [
        {
          id: 'p1',
          elements: [createTextElement({ id: 'e1', xMm: 12, yMm: 15 })],
        },
      ],
    })

    const restored = parseDocumentJson(exportDocumentJson(doc))
    expect(restored.pages[0]?.elements[0]?.xMm).toBe(12)
    expect(restored.pages[0]?.elements[0]?.content.html).toBe(
      doc.pages[0]?.elements[0]?.content.html,
    )
  })

  it('rejects invalid JSON with a readable error', () => {
    expect(() => parseDocumentJson('{oops')).toThrow(DocumentParseError)
    expect(() => parseDocumentJson('{oops')).toThrow(/Invalid JSON/)
  })

  it('rejects a JSON value that is not a document', () => {
    expect(() => parseDocumentJson('"hello"')).toThrow(/expected a document object/)
    expect(() => parseDocumentJson('{"pages":{}}')).toThrow(/pages must be an array/)
  })

  it('normalises a partially valid document', () => {
    const restored = parseDocumentJson('{"pages":[{"id":"p1"}]}')
    expect(restored.pageConfig.size).toBe('A4')
    expect(restored.pages[0]?.elements).toEqual([])
  })
})

describe('isValidDocument', () => {
  it('accepts a normalised document', () => {
    expect(isValidDocument(createDocument())).toBe(true)
  })

  it('rejects non documents', () => {
    expect(isValidDocument(null)).toBe(false)
    expect(isValidDocument({})).toBe(false)
    expect(isValidDocument({ pages: [] })).toBe(false)
  })
})
