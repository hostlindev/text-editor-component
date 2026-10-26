import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEditorState } from '../useEditorState'
import {
  createDocument,
  createShapeElement,
  createTextElement,
  type PdfDocumentSchema,
} from '@/types/editor'

function makeState(document: PdfDocumentSchema = createDocument()) {
  return createEditorState({ document, historyDebounceMs: 0 })
}

describe('createEditorState — elements', () => {
  it('adds an element, selects it and emits the new document', () => {
    const onChange = vi.fn()
    const initial = createDocument()
    const state = createEditorState({ document: initial, onChange, historyDebounceMs: 0 })

    const element = state.addElement('text')

    expect(state.page.value.elements).toHaveLength(1)
    expect(state.page.value.elements[0]?.id).toBe(element.id)
    expect(state.selectedId.value).toBe(element.id)
    expect(element.zIndex).toBe(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]?.[0]).not.toBe(initial)
  })

  it('does not mutate the document object it was given', () => {
    const document = createDocument()
    const snapshot = JSON.stringify(document)
    const state = makeState(document)

    state.addElement('text')

    expect(JSON.stringify(document)).toBe(snapshot)
  })

  it('stacks new elements above the existing ones', () => {
    const state = makeState()
    state.addElement('text')
    const second = state.addElement('image')
    expect(second.zIndex).toBe(2)
  })

  it('clamps geometry updates inside the page', () => {
    const state = makeState()
    const element = state.addElement('text')

    state.updateElement(element.id, { xMm: 500, yMm: -20, widthMm: 400, heightMm: 10 })

    const updated = state.page.value.elements[0]!
    expect(updated.xMm).toBe(0)
    expect(updated.widthMm).toBe(210)
    expect(updated.yMm).toBe(0)
  })

  it('merges style and content instead of replacing them', () => {
    const state = makeState()
    const element = state.addElement('text')

    state.updateElement(element.id, { style: { backgroundColor: '#fff' } })
    state.updateElement(element.id, { style: { paddingMm: 2 } })
    state.updateElement(element.id, { content: { html: '<p>hola</p>' } })

    const updated = state.page.value.elements[0]!
    expect(updated.style).toEqual({ backgroundColor: '#fff', paddingMm: 2 })
    expect(updated.content.html).toBe('<p>hola</p>')
    expect(updated.content.tiptapJson).toEqual(expect.any(Object))
  })

  it('duplicates an element with a new id, offset and top z-index', () => {
    const state = makeState()
    const original = state.addElement('text', { xMm: 10, yMm: 10 })
    state.select(original.id)

    const copy = state.duplicateElement(original.id)

    expect(copy).not.toBeNull()
    expect(copy?.id).not.toBe(original.id)
    expect(copy?.xMm).toBe(15)
    expect(copy?.zIndex).toBe(2)
    expect(state.selectedId.value).toBe(copy?.id)
  })

  it('removes an element and clears the selection', () => {
    const state = makeState()
    const element = state.addElement('text')
    state.select(element.id)

    state.removeElement(element.id)

    expect(state.page.value.elements).toHaveLength(0)
    expect(state.selectedId.value).toBeNull()
  })

  it('reorders layers without gaps', () => {
    const state = makeState()
    const a = state.addElement('text')
    const b = state.addElement('text')
    const c = state.addElement('text')

    state.bringToFront(a.id)
    expect(state.page.value.elements.map((el) => el.id)).toEqual([b.id, c.id, a.id])
    expect(state.page.value.elements.map((el) => el.zIndex)).toEqual([1, 2, 3])

    state.sendToBack(c.id)
    expect(state.page.value.elements[0]?.id).toBe(c.id)
    expect(state.page.value.elements.map((el) => el.zIndex)).toEqual([1, 2, 3])
  })

  it('blocks mutations in read-only mode', () => {
    const state = createEditorState({ readOnly: true, historyDebounceMs: 0 })
    const element = createTextElement({ id: 'locked_doc' })
    state.loadDocument(createDocument({ pages: [{ id: 'p1', elements: [element] }] }))

    state.addElement('text')
    state.updateElement('locked_doc', { xMm: 50 })
    state.removeElement('locked_doc')

    expect(state.page.value.elements).toHaveLength(1)
    expect(state.page.value.elements[0]?.xMm).toBe(element.xMm)
  })
})

describe('createEditorState — pages', () => {
  it('adds and focuses a new page', () => {
    const state = makeState()
    state.addPage()

    expect(state.pages.value).toHaveLength(2)
    expect(state.pageIndex.value).toBe(1)
  })

  it('duplicates a page with independent elements', () => {
    const state = makeState(createDocument({
      pages: [{ id: 'p1', elements: [createTextElement({ id: 'e1', xMm: 10 })] }],
    }))

    state.duplicatePage(0)

    expect(state.pages.value).toHaveLength(2)
    expect(state.pages.value[1]?.elements[0]?.id).not.toBe('e1')
    state.updateElement(state.pages.value[1]!.elements[0]!.id, { xMm: 80 })
    expect(state.pages.value[0]?.elements[0]?.xMm).toBe(10)
  })

  it('never removes the last page', () => {
    const state = makeState()
    state.removePage(0)
    expect(state.pages.value).toHaveLength(1)
  })

  it('keeps the page index inside bounds when removing', () => {
    const state = makeState()
    state.addPage()
    state.addPage()
    state.setPageIndex(2)

    state.removePage(2)

    expect(state.pageIndex.value).toBe(1)
  })

  it('re-clamps elements when the page orientation changes', () => {
    const state = makeState()
    const element = state.addElement('text', { xMm: 180, yMm: 280, widthMm: 20, heightMm: 10 })

    state.setPageConfig({
      size: 'A4',
      orientation: 'landscape',
      marginsMm: { top: 20, right: 20, bottom: 20, left: 20 },
    })

    expect(state.pageBox.value).toEqual({ widthMm: 297, heightMm: 210 })
    const updated = state.page.value.elements.find((el) => el.id === element.id)!
    expect(updated.xMm).toBe(180)
    expect(updated.yMm).toBe(200)
    expect(updated.heightMm).toBe(10)
  })

  it('moves pages', () => {
    const state = makeState(createDocument({
      pages: [
        { id: 'a', elements: [] },
        { id: 'b', elements: [] },
        { id: 'c', elements: [] },
      ],
    }))

    state.movePage(0, 2)

    expect(state.pages.value.map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('createEditorState — history and zoom', () => {
  it('undoes and redoes document mutations', () => {
    const state = makeState()
    state.addElement('text')

    expect(state.canUndo.value).toBe(true)
    state.undo()
    expect(state.page.value.elements).toHaveLength(0)

    state.redo()
    expect(state.page.value.elements).toHaveLength(1)
  })

  it('resets history when a new document is loaded', () => {
    const state = makeState()
    state.addElement('text')
    state.loadDocument(createDocument())

    expect(state.canUndo.value).toBe(false)
  })

  it('clamps zoom between 0.5 and 2', () => {
    const state = makeState()
    state.setZoom(5)
    expect(state.zoom.value).toBe(2)
    state.setZoom(0.1)
    expect(state.zoom.value).toBe(0.5)
  })

  it('fits the page width to the available pixels', () => {
    const state = makeState()
    state.fitToWidth(830)
    expect(state.zoom.value).toBeCloseTo((830 - 32) / (210 * 3.7795275591), 2)
  })
})

describe('createEditorState — text box formatting', () => {
  function stateWithText(html: string) {
    const state = makeState(
      createDocument({
        pages: [{ id: 'p1', elements: [createTextElement({ id: 't1', content: { html } })] }],
      }),
    )
    state.select('t1')
    return state
  }

  it('reads the formatting stored in the selected text element', () => {
    const state = stateWithText(
      '<p><span style="font-family: Lora; font-size: 18pt"><strong>Hola</strong></span></p>',
    )

    const text = state.activeTextState.value
    expect(text?.bold).toBe(true)
    expect(text?.fontFamily).toBe('Lora')
    expect(text?.fontSize).toBe('18pt')
  })

  it('applies colour, family and size to the whole element without edit mode', () => {
    const state = stateWithText('<p>Hola</p>')

    state.formatText({ type: 'color', value: '#ff0000' })
    state.formatText({ type: 'fontFamily', value: 'Lora' })
    state.formatText({ type: 'fontSize', value: '18pt' })

    const html = state.page.value.elements[0]?.content.html ?? ''
    expect(html).toContain('#ff0000')
    expect(html).toContain('Lora')
    expect(html).toContain('18pt')
    expect(state.page.value.elements[0]?.content.tiptapJson).toEqual(expect.any(Object))
  })

  it('toggles bold on the whole element and reports it back', () => {
    const state = stateWithText('<p>Hola</p>')

    state.formatText({ type: 'bold' })

    expect(state.page.value.elements[0]?.content.html).toContain('<strong>')
    expect(state.activeTextState.value?.bold).toBe(true)

    state.formatText({ type: 'bold' })
    expect(state.activeTextState.value?.bold).toBe(false)
  })

  it('aligns the whole element', () => {
    const state = stateWithText('<p>Hola</p>')

    state.formatText({ type: 'align', value: 'center' })

    expect(state.page.value.elements[0]?.content.html).toContain('text-align: center')
    expect(state.activeTextState.value?.align).toBe('center')
  })

  it('ignores formatting when the selection is not a text element', () => {
    const state = makeState(
      createDocument({ pages: [{ id: 'p1', elements: [createShapeElement({ id: 's1' })] }] }),
    )
    state.select('s1')

    expect(state.activeTextState.value).toBeNull()
    state.formatText({ type: 'bold' })
    expect(state.page.value.elements[0]?.content.html).toBeUndefined()
  })

  it('does not format in read-only mode', () => {
    const state = createEditorState({
      readOnly: true,
      historyDebounceMs: 0,
      document: createDocument({
        pages: [
          {
            id: 'p1',
            elements: [createTextElement({ id: 't1', content: { html: '<p>Hola</p>' } })],
          },
        ],
      }),
    })
    state.select('t1')

    state.formatText({ type: 'bold' })

    expect(state.page.value.elements[0]?.content.html).toBe('<p>Hola</p>')
  })
})

describe('createEditorState — snapping and text bridge', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('snaps a rectangle against the current page from the state', () => {
    const state = makeState()
    const result = state.snapRect({ xMm: 99.5, yMm: 40, widthMm: 10, heightMm: 10 })
    expect(result.rect.xMm).toBe(100)
  })

  it('tracks whether a text editor is active', () => {
    const state = makeState()
    expect(state.activeTextState.value).toBeNull()
    state.setActiveEditor(null)
    expect(state.activeTextState.value).toBeNull()
  })
})
