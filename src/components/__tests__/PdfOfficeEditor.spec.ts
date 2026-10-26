import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { defineComponent, h, nextTick, ref } from 'vue'

import PdfOfficeEditor from '../PdfOfficeEditor.vue'
import RichTextElement from '../elements/RichTextElement.vue'
import {
  createDocument,
  createShapeElement,
  createTextElement,
  type PdfDocumentSchema,
} from '@/types/editor'

const vuetify = createVuetify()

function factory(document: PdfDocumentSchema, readOnly = false) {
  return mount(PdfOfficeEditor, {
    props: { modelValue: document, readOnly },
    global: { plugins: [vuetify] },
    attachTo: document.body,
  })
}

interface ExposedEditor {
  state: {
    document: { value: PdfDocumentSchema }
    selectedId: { value: string | null }
    editingId: { value: string | null }
    pageIndex: { value: number }
    showPreview: { value: boolean }
    canUndo: { value: boolean }
    select: (id: string | null) => void
    removeElement: (id: string) => void
    undo: () => void
  }
  insertText: () => void
}

/**
 * Mounts the editor the way a host application does: `v-model` over a `ref`.
 * That is what exposes the emitted document back through a reactive proxy,
 * which is the scenario the "insert then edit" flow depends on.
 */
function controlledFactory(document: PdfDocumentSchema) {
  const model = ref<PdfDocumentSchema>(document)
  const editor = ref<ExposedEditor | null>(null)

  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(PdfOfficeEditor, {
            ref: editor,
            modelValue: model.value,
            'onUpdate:modelValue': (value: PdfDocumentSchema) => {
              model.value = value
            },
          })
      },
    }),
    {
      global: { plugins: [vuetify] },
      attachTo: document.body,
    },
  )

  return { wrapper, model, editor }
}


function documentWithText(): PdfDocumentSchema {
  return createDocument({
    pages: [
      {
        id: 'p1',
        elements: [
          createTextElement({
            id: 't1',
            xMm: 20,
            yMm: 20,
            widthMm: 80,
            heightMm: 20,
            content: { html: '<p>Hola mundo</p>' },
          }),
        ],
      },
    ],
  })
}

describe('PdfOfficeEditor', () => {
  it('renders the ribbon, one sheet per page and the static rich text', () => {
    const wrapper = factory(documentWithText())

    expect(wrapper.find('.pdf-office-editor').exists()).toBe(true)
    expect(wrapper.find('.editor-ribbon').exists()).toBe(true)
    expect(wrapper.findAll('.pdf-sheet')).toHaveLength(1)
    expect(wrapper.text()).toContain('Hola mundo')
    expect(wrapper.text()).toContain('Inicio')
    expect(wrapper.text()).toContain('Insertar')
    expect(wrapper.text()).toContain('Capas')

    wrapper.unmount()
  })

  it('renders one sheet per page', () => {
    const document = createDocument({
      pages: [
        { id: 'a', elements: [] },
        { id: 'b', elements: [] },
      ],
    })
    const wrapper = factory(document)

    expect(wrapper.findAll('.pdf-sheet')).toHaveLength(2)
    wrapper.unmount()
  })

  it('hides the ribbon in read-only mode', () => {
    const wrapper = factory(documentWithText(), true)

    expect(wrapper.find('.editor-ribbon').exists()).toBe(false)
    expect(wrapper.find('.pdf-sheet').exists()).toBe(true)

    wrapper.unmount()
  })

  it('emits update:modelValue and change when an element is inserted', async () => {
    const document = documentWithText()
    const wrapper = factory(document)

    ;(wrapper.vm as unknown as { insertText: () => void }).insertText()
    await nextTick()

    const updates = wrapper.emitted('update:modelValue') as PdfDocumentSchema[][] | undefined
    expect(updates).toBeTruthy()
    expect(updates?.[0]?.[0].pages[0]?.elements).toHaveLength(2)
    expect(wrapper.emitted('change')).toBeTruthy()
    expect(document.pages[0]?.elements).toHaveLength(1)

    wrapper.unmount()
  })

  it('exposes an export payload with html and json', () => {
    const wrapper = factory(documentWithText())
    const payload = (
      wrapper.vm as unknown as {
        exportPdf: (format?: 'html' | 'json') => { html: string; json: string; format: string }
      }
    ).exportPdf('html')

    expect(payload.format).toBe('html')
    expect(payload.html).toContain('@page')
    expect(payload.html).toContain('Hola mundo')
    expect(JSON.parse(payload.json).pages).toHaveLength(1)
    expect(wrapper.emitted('export-pdf')).toBeTruthy()

    wrapper.unmount()
  })

  it('does not mutate the model value prop', () => {
    const document = documentWithText()
    const snapshot = JSON.stringify(document)
    const wrapper = factory(document)

    ;(wrapper.vm as unknown as { insertText: () => void }).insertText()

    expect(JSON.stringify(document)).toBe(snapshot)
    wrapper.unmount()
  })

  it('keeps the inserted text box selected and editing under v-model', async () => {
    const { wrapper, editor, model } = controlledFactory(documentWithText())

    editor.value?.insertText()
    await nextTick()
    await nextTick()

    const elements = model.value.pages[0]?.elements ?? []
    expect(elements).toHaveLength(2)
    const inserted = elements[1]!
    expect(editor.value?.state.selectedId.value).toBe(inserted.id)
    expect(editor.value?.state.editingId.value).toBe(inserted.id)
    expect(wrapper.find('.pdf-rt--editing').exists()).toBe(true)

    wrapper.unmount()
  })

  it('inserts a new element after deleting one under v-model', async () => {
    const { wrapper, editor, model } = controlledFactory(documentWithText())

    editor.value?.insertText()
    await nextTick()
    await nextTick()

    const inserted = model.value.pages[0]?.elements[1]
    expect(inserted).toBeTruthy()

    editor.value?.state.removeElement(inserted!.id)
    await nextTick()
    await nextTick()
    expect(model.value.pages[0]?.elements).toHaveLength(1)

    editor.value?.insertText()
    await nextTick()
    await nextTick()

    const elements = model.value.pages[0]?.elements ?? []
    expect(elements).toHaveLength(2)
    const second = elements[1]!
    expect(editor.value?.state.selectedId.value).toBe(second.id)
    expect(editor.value?.state.editingId.value).toBe(second.id)

    wrapper.unmount()
  })

  it('persists the rich text edits emitted by the text element', async () => {
    const { wrapper, editor, model } = controlledFactory(documentWithText())

    editor.value?.insertText()
    await nextTick()
    await nextTick()

    expect(model.value.pages[0]?.elements).toHaveLength(2)

    // Target the live editor inside the sheet: the miniature also renders a
    // static `RichTextElement`, and it must never be the one receiving the emit.
    const textElement = wrapper
      .findAllComponents(RichTextElement)
      .find((component) => (component.props() as { editing: boolean }).editing)
    expect(textElement).toBeTruthy()

    textElement!.vm.$emit('update', {
      content: { html: '<p>Hola</p>', tiptapJson: { type: 'doc' } },
      heightMm: 24,
    })
    await nextTick()
    await nextTick()

    const persisted = model.value.pages[0]?.elements[1]
    expect(persisted?.content.html).toBe('<p>Hola</p>')
    expect(persisted?.heightMm).toBe(24)

    // The reported symptom: leaving edit mode rendered the stale, empty html.
    editor.value?.state.stopEditing()
    await nextTick()
    await nextTick()
    expect(wrapper.find('.pdf-rt--editing').exists()).toBe(false)
    expect(wrapper.text()).toContain('Hola')

    wrapper.unmount()
  })

  it('keeps the undo history when the host echoes the emitted document', async () => {
    const { wrapper, editor, model } = controlledFactory(documentWithText())

    editor.value?.insertText()
    await nextTick()
    expect(model.value.pages[0]?.elements).toHaveLength(2)

    editor.value?.state.undo()
    await nextTick()

    expect(model.value.pages[0]?.elements).toHaveLength(1)
    expect(editor.value?.state.document.value.pages[0]?.elements).toHaveLength(1)

    wrapper.unmount()
  })

  it('paints shapes from the element style instead of the legacy shape content', () => {
    const document = createDocument({
      pages: [
        {
          id: 'p1',
          elements: [
            createShapeElement({
              id: 's1',
              style: { backgroundColor: '#123456', borderColor: '#abcdef', borderWidthPt: 2 },
              content: { shape: { kind: 'rect', fill: '#000000' } },
            }),
          ],
        },
      ],
    })
    const wrapper = factory(document)
    const shape = wrapper.find('.pdf-shape')

    expect(shape.exists()).toBe(true)
    const node = shape.element as HTMLElement
    expect(node.style.backgroundColor).toBe('#123456')
    expect(node.style.borderTopStyle).toBe('solid')
    expect(node.style.borderTopColor).toBe('#abcdef')
    expect(node.style.borderTopWidth).toBe('2pt')

    wrapper.unmount()
  })

  it('accepts typed rotation and opacity values from the inspector', async () => {
    const { wrapper, editor, model } = controlledFactory(documentWithText())
    editor.value?.state.select('t1')
    await nextTick()
    await nextTick()

    const rotation = wrapper.find('[data-testid="rotation-input"] input')
    const opacity = wrapper.find('[data-testid="opacity-input"] input')
    expect(rotation.exists()).toBe(true)
    expect(opacity.exists()).toBe(true)

    await rotation.setValue('45')
    await opacity.setValue('40')

    const element = model.value.pages[0]?.elements[0]
    expect(element?.rotationDeg).toBe(45)
    expect(element?.style.opacity).toBeCloseTo(0.4, 5)

    await rotation.setValue('500')
    await opacity.setValue('150')

    expect(model.value.pages[0]?.elements[0]?.rotationDeg).toBe(180)
    expect(model.value.pages[0]?.elements[0]?.style.opacity).toBe(1)

    wrapper.unmount()
  })

  it('keeps an accessible label and a tooltip activator on icon-only actions', () => {
    const wrapper = factory(documentWithText())

    const undo = wrapper.find('[aria-label="Deshacer"]')
    expect(undo.exists()).toBe(true)
    expect(undo.element.closest('.icon-action')).not.toBeNull()

    wrapper.unmount()
  })

  it('renders the glyph of an icon-only action', () => {
    const wrapper = factory(documentWithText())

    // VBtn ignores its `icon` prop when it receives a default slot, so an
    // IconAction that always renders `<slot />` would show an empty button.
    const undo = wrapper.find('[aria-label="Deshacer"]')
    expect(undo.find('.v-icon').exists()).toBe(true)
    expect(undo.find('.v-icon').classes()).toContain('mdi-undo')

    // The colour action mixes the glyph with its swatch.
    const color = wrapper.find('[aria-label="Color del texto"]')
    expect(color.find('.v-icon').exists()).toBe(true)
    expect(color.find('.font-controls__swatch').exists()).toBe(true)

    wrapper.unmount()
  })

  it('gives the zoom controls an activator box so the disabled ones still explain themselves', () => {
    const wrapper = factory(documentWithText())

    for (const label of ['Alejar', 'Ajustar al ancho', 'Acercar']) {
      const button = wrapper.find(`[aria-label="${label}"]`)
      expect(button.exists()).toBe(true)
      // A disabled Vuetify button ignores pointer events, so the tooltip needs a
      // real box around it; `display: contents` would have no hover target.
      const slot = button.element.closest('.pdf-viewport__zoom-slot')
      expect(slot).not.toBeNull()
      expect(button.attributes('title')).toBeUndefined()
    }

    wrapper.unmount()
  })

  it('keeps the selection when Escape only closes an open menu', async () => {
    const { wrapper, editor } = controlledFactory(documentWithText())
    editor.value?.state.select('t1')
    await nextTick()

    const overlay = document.createElement('div')
    overlay.className = 'v-overlay-container'
    const option = document.createElement('button')
    overlay.appendChild(option)
    document.body.appendChild(overlay)

    option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    // Dismissing a colour picker must not collapse the inspector the user is in.
    expect(editor.value?.state.selectedId.value).toBe('t1')

    overlay.remove()
    wrapper.unmount()
  })

  it('clears the selection when Escape is pressed on the canvas', async () => {
    const { wrapper, editor } = controlledFactory(documentWithText())
    editor.value?.state.select('t1')
    await nextTick()

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(editor.value?.state.selectedId.value).toBeNull()
    wrapper.unmount()
  })

  it('shows the document font as the effective family of an unformatted text box', async () => {    const document = createDocument({
      fonts: [{ family: 'Montserrat' }, { family: 'Lora' }],
      pages: [{ id: 'p1', elements: [createTextElement({ id: 't1', content: { html: '<p>Hola</p>' } })] }],
    })
    const { wrapper, editor } = controlledFactory(document)
    editor.value?.state.select('t1')
    await nextTick()
    await nextTick()

    const input = wrapper.findAll('.font-controls .v-field input')[0]
    // The page renders Montserrat; the ribbon cannot claim Inter instead.
    expect((input.element as HTMLInputElement).value).toBe('Montserrat')

    wrapper.unmount()
  })

  it('keeps the text box in edit mode when Escape only closes an overlay', async () => {
    const { wrapper, editor } = controlledFactory(documentWithText())
    editor.value?.state.select('t1')
    editor.value?.state.startEditing('t1')
    await nextTick()
    await nextTick()

    const overlay = document.createElement('div')
    overlay.className = 'v-overlay v-overlay--active'
    const option = document.createElement('button')
    overlay.appendChild(option)
    document.body.appendChild(overlay)

    option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    // One Escape closes the picker; leaving edit mode needs a second one.
    expect(editor.value?.state.editingId.value).toBe('t1')
    expect(editor.value?.state.selectedId.value).toBe('t1')

    overlay.remove()
    wrapper.unmount()
  })

  it('steps a layer up and down with one click on its row', async () => {
    const document = createDocument({
      pages: [
        {
          id: 'p1',
          elements: [
            createTextElement({ id: 'low', name: 'Abajo', content: { html: '<p>Abajo</p>' } }),
            createTextElement({ id: 'high', name: 'Arriba', content: { html: '<p>Arriba</p>' } }),
          ],
        },
      ],
    })
    const { wrapper, editor } = controlledFactory(document)
    await nextTick()

    const order = () =>
      editor.value?.state.document.value.pages[0]?.elements.map((element) => element.id)
    expect(order()).toEqual(['low', 'high'])

    const rows = () => wrapper.findAll('.layers-panel__item')
    // The list paints the topmost layer first, so its step-up button is spent.
    expect(rows()[0]?.find('[aria-label="Subir una capa"]').attributes('disabled')).toBeDefined()
    expect(rows()[1]?.find('[aria-label="Subir una capa"]').attributes('disabled')).toBeUndefined()

    await rows()[1]!.find('[aria-label="Subir una capa"]').trigger('click')
    await nextTick()
    expect(order()).toEqual(['high', 'low'])
    expect(editor.value?.state.document.value.pages[0]?.elements.map((el) => el.zIndex)).toEqual([1, 2])

    await rows()[0]!.find('[aria-label="Bajar una capa"]').trigger('click')
    await nextTick()
    expect(order()).toEqual(['low', 'high'])

    wrapper.unmount()
  })

  it('opens the element context menu on right click and runs its commands', async () => {
    const { wrapper, editor } = controlledFactory(documentWithText())
    await nextTick()

    await wrapper.find('[data-element-id="t1"]').trigger('contextmenu', { clientX: 240, clientY: 200 })
    await nextTick()

    const menu = wrapper.find('.pdf-context-menu')
    expect(menu.exists()).toBe(true)
    // Right-clicking a layer selects it first, so the commands have a target.
    expect(editor.value?.state.selectedId.value).toBe('t1')

    const labels = wrapper.findAll('.pdf-context-menu [role="menuitem"]').map((item) => item.text())
    expect(labels.some((label) => label.includes('Subir una capa'))).toBe(true)
    expect(labels.some((label) => label.includes('Eliminar'))).toBe(true)

    const duplicate = wrapper
      .findAll('.pdf-context-menu [role="menuitem"]')
      .find((item) => item.text().includes('Duplicar'))
    await duplicate!.trigger('click')
    await nextTick()

    expect(editor.value?.state.document.value.pages[0]?.elements).toHaveLength(2)
    expect(wrapper.find('.pdf-context-menu').exists()).toBe(false)

    wrapper.unmount()
  })

  it('offers the insert commands on right click over empty page space', async () => {
    const { wrapper } = controlledFactory(documentWithText())
    await nextTick()

    await wrapper.find('.pdf-sheet').trigger('contextmenu', { clientX: 300, clientY: 300 })
    await nextTick()

    const labels = wrapper.findAll('.pdf-context-menu [role="menuitem"]').map((item) => item.text())
    expect(labels.some((label) => label.includes('Insertar texto'))).toBe(true)
    expect(labels.some((label) => label.includes('Ajustes de página'))).toBe(true)

    wrapper.unmount()
  })

  it('shows a miniature of every page on the right and focuses the one clicked', async () => {
    const document = createDocument({
      pages: [
        {
          id: 'a',
          elements: [createTextElement({ id: 't1', content: { html: '<p>Hola mundo</p>' } })],
        },
        { id: 'b', elements: [] },
      ],
    })
    const { wrapper, editor } = controlledFactory(document)
    await nextTick()

    expect(wrapper.find('.pdf-preview').exists()).toBe(true)
    const thumbs = () => wrapper.findAll('.pdf-preview__thumb')
    expect(thumbs()).toHaveLength(2)
    // The miniature is the real page, not a placeholder.
    expect(thumbs()[0]?.find('.pdf-rt__static').text()).toContain('Hola mundo')
    expect(thumbs()[0]?.classes()).toContain('pdf-preview__thumb--active')

    await thumbs()[1]!.trigger('click')
    await nextTick()

    expect(editor.value?.state.pageIndex.value).toBe(1)
    expect(thumbs()[1]?.classes()).toContain('pdf-preview__thumb--active')
    expect(thumbs()[0]?.classes()).not.toContain('pdf-preview__thumb--active')

    wrapper.unmount()
  })

  it('hides the thumbnail rail when the preview switch is off', async () => {
    const { wrapper, editor } = controlledFactory(documentWithText())
    await nextTick()

    expect(wrapper.find('.pdf-preview').exists()).toBe(true)

    // `state.showPreview` in a template would be the Ref object, always truthy;
    // the rail must follow its value.
    editor.value!.state.showPreview.value = false
    await nextTick()

    expect(wrapper.find('.pdf-preview').exists()).toBe(false)

    wrapper.unmount()
  })
})
