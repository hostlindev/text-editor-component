import {
  computed,
  inject,
  provide,
  ref,
  shallowRef,
  type ComputedRef,
  type InjectionKey,
  type Ref,
  type ShallowRef,
} from 'vue'
import { Editor } from '@tiptap/vue-3'

import { createTextExtensions } from './textExtensions'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  createDocument,
  createEmptyPage,
  createId,
  createImageElement,
  createShapeElement,
  createTableElement,
  createTextElement,
  normalizeDocument,
  pageDimensionsMm,
  type ElementContent,
  type ElementStyle,
  type ElementType,
  type PageConfig,
  type PdfCanvasElement,
  type PdfDocumentSchema,
  type PdfPage,
} from '@/types/editor'
import { clampRectToPage, snapMove, type SnapLine, type SnapRect } from './useSnapping'
import { useHistory } from './useHistory'
import { PX_PER_MM } from './useUnitConverter'
import { deepClone as clone } from '@/utils/deepClone'

export interface EditorStateOptions {
  document?: PdfDocumentSchema
  readOnly?: boolean | Ref<boolean>
  onChange?: (document: PdfDocumentSchema) => void
  historyLimit?: number
  historyDebounceMs?: number
  initialZoom?: number
}

export type ElementPatch = Partial<
  Omit<PdfCanvasElement, 'id' | 'type' | 'style' | 'content'>
> & {
  style?: Partial<ElementStyle>
  content?: Partial<ElementContent>
}

export interface ActiveTextState {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  subscript: boolean
  superscript: boolean
  bulletList: boolean
  orderedList: boolean
  fontFamily: string | null
  fontSize: string | null
  color: string | null
  highlight: string | null
  align: 'left' | 'center' | 'right' | 'justify'
}

/**
 * One formatting intent, either for the live editor or for a text box that is
 * only selected. Keeping it as data lets the state own the mutation instead of
 * letting the ribbon drive a TipTap instance it does not persist.
 */
export type TextFormatCommand =
  | {
      type:
        | 'bold'
        | 'italic'
        | 'underline'
        | 'strike'
        | 'subscript'
        | 'superscript'
        | 'bulletList'
        | 'orderedList'
    }
  | { type: 'fontFamily' | 'fontSize' | 'color' | 'highlight'; value: string | null }
  | { type: 'align'; value: ActiveTextState['align'] }

export interface EditorState {
  document: ShallowRef<PdfDocumentSchema>
  pages: ComputedRef<PdfPage[]>
  page: ComputedRef<PdfPage>
  pageIndex: Ref<number>
  pageBox: ComputedRef<{ widthMm: number; heightMm: number }>
  zoom: Ref<number>
  showGrid: Ref<boolean>
  showRulers: Ref<boolean>
  showMarginGuides: Ref<boolean>
  showPreview: Ref<boolean>
  readOnly: ComputedRef<boolean>
  selectedId: Ref<string | null>
  selectedElement: ComputedRef<PdfCanvasElement | null>
  editingId: Ref<string | null>
  activeEditor: ShallowRef<Editor | null>
  activeTextVersion: Ref<number>
  activeTextState: ComputedRef<ActiveTextState | null>
  guides: Ref<SnapLine[]>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>

  select: (id: string | null) => void
  startEditing: (id: string) => void
  stopEditing: () => void
  setActiveEditor: (editor: Editor | null) => void
  formatText: (command: TextFormatCommand) => void

  addElement: (type: ElementType, overrides?: Partial<PdfCanvasElement>) => PdfCanvasElement
  updateElement: (id: string, patch: ElementPatch) => void
  removeElement: (id: string) => void
  duplicateElement: (id: string) => PdfCanvasElement | null
  moveElement: (id: string, rect: Partial<SnapRect>) => void
  snapRect: (rect: SnapRect, excludeId?: string) => { rect: SnapRect; guides: SnapLine[] }
  setGuides: (lines: SnapLine[]) => void

  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  bringForward: (id: string) => void
  sendBackward: (id: string) => void

  addPage: () => void
  duplicatePage: (index?: number) => void
  removePage: (index?: number) => void
  setPageIndex: (index: number) => void
  movePage: (from: number, to: number) => void
  setPageConfig: (config: PageConfig) => void
  setPageBackground: (color: string | undefined) => void

  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  fitToWidth: (availablePx: number) => void

  undo: () => void
  redo: () => void
  loadDocument: (document: PdfDocumentSchema) => void
}

function toRef(readOnly: boolean | Ref<boolean> | undefined): ComputedRef<boolean> {
  if (readOnly === undefined) return computed(() => false)
  if (typeof readOnly === 'boolean') return computed(() => readOnly)
  return computed(() => readOnly.value)
}

function applySnapped(
  element: PdfCanvasElement,
  rect: Partial<SnapRect>,
  pageWidthMm: number,
  pageHeightMm: number,
): void {
  const merged: SnapRect = {
    xMm: rect.xMm ?? element.xMm,
    yMm: rect.yMm ?? element.yMm,
    widthMm: rect.widthMm ?? element.widthMm,
    heightMm: rect.heightMm ?? element.heightMm,
  }
  const clamped = clampRectToPage(merged, pageWidthMm, pageHeightMm)
  element.xMm = clamped.xMm
  element.yMm = clamped.yMm
  element.widthMm = clamped.widthMm
  element.heightMm = clamped.heightMm
}

/* ------------------------------------------------------- text formatting */

const EMPTY_TEXT_STATE: ActiveTextState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  subscript: false,
  superscript: false,
  bulletList: false,
  orderedList: false,
  fontFamily: null,
  fontSize: null,
  color: null,
  highlight: null,
  align: 'left',
}

type TextChain = ReturnType<Editor['chain']>

/**
 * A single detached editor used to read and rewrite the HTML of a text box
 * that is not in edit mode. It uses the very same extensions as the visible
 * editor, so the ribbon never guesses how marks serialize. Every call reloads
 * the content first, so one shared instance is safe.
 */
let textProbe: Editor | null = null
let textProbeCache: { html: string; state: ActiveTextState } | null = null

function getTextProbe(): Editor | null {
  if (typeof document === 'undefined') return null
  if (!textProbe) {
    textProbe = new Editor({
      extensions: createTextExtensions(),
      content: '<p></p>',
      editable: false,
    })
  }
  return textProbe
}

function loadTextProbe(html: string, selectAll = true): Editor | null {
  const editor = getTextProbe()
  if (!editor) return null
  editor.commands.setContent(html || '<p></p>', { emitUpdate: false })
  if (selectAll) editor.commands.selectAll()
  return editor
}

function readTextState(editor: Editor): ActiveTextState {
  const textStyle = editor.getAttributes('textStyle') as {
    fontFamily?: string
    fontSize?: string
    color?: string
  }
  const highlight = editor.getAttributes('highlight') as { color?: string }

  const align: ActiveTextState['align'] = editor.isActive({ textAlign: 'center' })
    ? 'center'
    : editor.isActive({ textAlign: 'right' })
      ? 'right'
      : editor.isActive({ textAlign: 'justify' })
        ? 'justify'
        : 'left'

  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strike: editor.isActive('strike'),
    subscript: editor.isActive('subscript'),
    superscript: editor.isActive('superscript'),
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    fontFamily: textStyle.fontFamily ?? null,
    fontSize: textStyle.fontSize ?? null,
    color: textStyle.color ?? null,
    highlight: highlight.color ?? null,
    align,
  }
}

function readElementTextState(html: string): ActiveTextState | null {
  if (textProbeCache && textProbeCache.html === html) return textProbeCache.state
  const editor = loadTextProbe(html)
  if (!editor) return null
  const state = readTextState(editor)
  textProbeCache = { html, state }
  return state
}

function quoteFamily(family: string): string {
  return family.includes(' ') ? `'${family}'` : family
}

function runTextCommand(chain: TextChain, command: TextFormatCommand): void {
  switch (command.type) {
    case 'bold':
      chain.toggleBold().run()
      return
    case 'italic':
      chain.toggleItalic().run()
      return
    case 'underline':
      chain.toggleUnderline().run()
      return
    case 'strike':
      chain.toggleStrike().run()
      return
    case 'subscript':
      chain.toggleSubscript().run()
      return
    case 'superscript':
      chain.toggleSuperscript().run()
      return
    case 'bulletList':
      chain.toggleBulletList().run()
      return
    case 'orderedList':
      chain.toggleOrderedList().run()
      return
    case 'fontFamily':
      if (command.value) chain.setFontFamily(quoteFamily(command.value)).run()
      return
    case 'fontSize':
      if (command.value) {
        chain.setFontSize(command.value.endsWith('pt') ? command.value : `${command.value}pt`).run()
      }
      return
    case 'color':
      if (command.value) chain.setColor(command.value).run()
      return
    case 'highlight':
      if (command.value) chain.setHighlight({ color: command.value }).run()
      else chain.unsetHighlight().run()
      return
    case 'align':
      chain.setTextAlign(command.value).run()
      return
  }
}

export function createEditorState(options: EditorStateOptions = {}): EditorState {
  const initial = normalizeDocument(options.document ?? createDocument())
  const document = shallowRef<PdfDocumentSchema>(initial)
  const readOnly = toRef(options.readOnly)

  const pageIndex = ref(0)
  const zoom = ref(clampZoom(options.initialZoom ?? 1))
  const showGrid = ref(false)
  const showRulers = ref(true)
  const showMarginGuides = ref(false)
  const showPreview = ref(true)
  const selectedId = ref<string | null>(null)
  const editingId = ref<string | null>(null)
  const guides = ref<SnapLine[]>([])

  const activeEditor = shallowRef<Editor | null>(null)
  const activeTextVersion = ref(0)

  const history = useHistory<PdfDocumentSchema>({
    limit: options.historyLimit ?? 100,
    debounceMs: options.historyDebounceMs ?? 300,
  })
  history.reset(initial)

  const pages = computed(() => document.value.pages)
  const page = computed<PdfPage>(() => pages.value[pageIndex.value] ?? pages.value[0] ?? createEmptyPage())
  const pageBox = computed(() => pageDimensionsMm(document.value.pageConfig))

  const selectedElement = computed<PdfCanvasElement | null>(
    () => page.value.elements.find((element) => element.id === selectedId.value) ?? null,
  )

  const activeTextState = computed<ActiveTextState | null>(() => {
    const editor = activeEditor.value
    // Read the transaction counter so every keystroke recomputes the ribbon state.
    void activeTextVersion.value

    if (editor && editingId.value === selectedId.value) return readTextState(editor)

    // A selected but idle text box still drives the ribbon: without this the
    // font, size and colour controls look empty and their commands are lost.
    const element = selectedElement.value
    if (!element || element.type !== 'text') return null
    return readElementTextState(element.content.html ?? '') ?? EMPTY_TEXT_STATE
  })

  function clampZoom(value: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
  }

  function findElement(doc: PdfDocumentSchema, index: number, id: string) {
    return doc.pages[index]?.elements.find((element) => element.id === id) ?? null
  }

  function commit(mutator: (doc: PdfDocumentSchema) => void, opts: { history?: boolean } = {}): void {
    if (readOnly.value) return
    const next = clone(document.value)
    mutator(next)
    document.value = next
    if (opts.history !== false) history.push(next)
    options.onChange?.(next)
  }

  function normalizeZ(doc: PdfDocumentSchema, index: number): void {
    const elements = doc.pages[index]?.elements
    if (!elements) return
    // Stacking order is the array order; z-index values are only its projection.
    elements.forEach((element, position) => {
      element.zIndex = position + 1
    })
  }

  function select(id: string | null): void {
    if (id !== selectedId.value) {
      stopEditing()
      selectedId.value = id
    }
  }

  function startEditing(id: string): void {
    if (readOnly.value) return
    selectedId.value = id
    editingId.value = id
  }

  function stopEditing(): void {
    editingId.value = null
    activeEditor.value = null
  }

  function setActiveEditor(editor: Editor | null): void {
    activeEditor.value = editor
    activeTextVersion.value += 1
  }

  function addElement(type: ElementType, overrides: Partial<PdfCanvasElement> = {}): PdfCanvasElement {
    const factory =
      type === 'image'
        ? createImageElement
        : type === 'shape'
          ? createShapeElement
          : type === 'table'
            ? createTableElement
            : createTextElement

    const box = pageBox.value
    const offset = page.value.elements.length * 3
    const element = factory({
      ...overrides,
      content: overrides.content,
      style: overrides.style,
      // Cascade new elements instead of stacking them exactly on top.
      xMm: overrides.xMm ?? Math.max(0, Math.min(20 + offset, box.widthMm - 60)),
      yMm: overrides.yMm ?? Math.max(0, Math.min(20 + offset, box.heightMm - 30)),
    })

    applySnapped(element, {}, box.widthMm, box.heightMm)
    element.zIndex = page.value.elements.length + 1

    commit((doc) => {
      doc.pages[pageIndex.value]?.elements.push(clone(element))
    })

    selectedId.value = element.id
    return element
  }

  function updateElement(id: string, patch: ElementPatch): void {
    commit((doc) => {
      const element = findElement(doc, pageIndex.value, id)
      if (!element) return
      if (patch.style) element.style = { ...element.style, ...patch.style }
      if (patch.content) element.content = { ...element.content, ...patch.content }
      const geometry = {
        xMm: patch.xMm,
        yMm: patch.yMm,
        widthMm: patch.widthMm,
        heightMm: patch.heightMm,
      }
      if (Object.values(geometry).some((value) => value !== undefined)) {
        applySnapped(element, geometry, pageBox.value.widthMm, pageBox.value.heightMm)
      }
      if (patch.rotationDeg !== undefined) element.rotationDeg = patch.rotationDeg
      if (patch.locked !== undefined) element.locked = patch.locked
      if (patch.name !== undefined) element.name = patch.name
    })
  }

  function moveElement(id: string, rect: Partial<SnapRect>): void {
    updateElement(id, rect)
  }

  /**
   * Applies a formatting command to the caret when the box is being edited, or
   * to the whole box when it is merely selected. Without the second path the
   * ribbon controls would have nothing to act on until the user double-clicks.
   */
  function formatText(command: TextFormatCommand): void {
    if (readOnly.value) return
    const element = selectedElement.value
    if (!element || element.type !== 'text') return

    const live = activeEditor.value
    if (live && editingId.value === element.id) {
      runTextCommand(live.chain().focus(), command)
      return
    }

    const probe = loadTextProbe(element.content.html ?? '')
    if (!probe) return
    runTextCommand(probe.chain(), command)

    updateElement(element.id, {
      content: {
        html: probe.getHTML(),
        tiptapJson: probe.getJSON() as Record<string, unknown>,
      },
    })
  }

  function removeElement(id: string): void {
    commit((doc) => {
      const target = doc.pages[pageIndex.value]
      if (!target) return
      target.elements = target.elements.filter((element) => element.id !== id)
      normalizeZ(doc, pageIndex.value)
    })
    if (selectedId.value === id) selectedId.value = null
    if (editingId.value === id) stopEditing()
  }

  function duplicateElement(id: string): PdfCanvasElement | null {
    const source = selectedElement.value
    if (!source || source.id !== id) return null

    const copy: PdfCanvasElement = clone(source)
    copy.id = createId(source.type)
    copy.xMm = Math.min(source.xMm + 5, pageBox.value.widthMm - source.widthMm)
    copy.yMm = Math.min(source.yMm + 5, pageBox.value.heightMm - source.heightMm)
    copy.zIndex = page.value.elements.length + 1

    commit((doc) => {
      doc.pages[pageIndex.value]?.elements.push(clone(copy))
    })

    selectedId.value = copy.id
    return copy
  }

  function snapRect(rect: SnapRect, excludeId?: string): { rect: SnapRect; guides: SnapLine[] } {
    const siblings = page.value.elements.filter((element) => element.id !== excludeId)
    const box = pageBox.value
    const result = snapMove(rect, {
      pageWidthMm: box.widthMm,
      pageHeightMm: box.heightMm,
      marginsMm: document.value.pageConfig.marginsMm,
    }, siblings)

    return {
      rect: {
        xMm: result.xMm,
        yMm: result.yMm,
        widthMm: rect.widthMm,
        heightMm: rect.heightMm,
      },
      guides: result.guides,
    }
  }

  function setGuides(lines: SnapLine[]): void {
    guides.value = lines
  }

  function reorder(id: string, mode: 'front' | 'back' | 'forward' | 'backward'): void {
    commit((doc) => {
      const target = doc.pages[pageIndex.value]
      const element = target?.elements.find((item) => item.id === id)
      if (!target || !element) return

      const sorted = [...target.elements].sort((a, b) => a.zIndex - b.zIndex)
      const index = sorted.indexOf(element)
      if (mode === 'front') {
        sorted.splice(index, 1)
        sorted.push(element)
      } else if (mode === 'back') {
        sorted.splice(index, 1)
        sorted.unshift(element)
      } else if (mode === 'forward' && index < sorted.length - 1) {
        sorted.splice(index, 1)
        sorted.splice(index + 1, 0, element)
      } else if (mode === 'backward' && index > 0) {
        sorted.splice(index, 1)
        sorted.splice(index - 1, 0, element)
      }

      target.elements = sorted
      normalizeZ(doc, pageIndex.value)
    })
  }

  function addPage(): void {
    commit((doc) => {
      doc.pages.push(createEmptyPage())
    })
    pageIndex.value = pages.value.length - 1
    selectedId.value = null
  }

  function duplicatePage(index = pageIndex.value): void {
    commit((doc) => {
      const source = doc.pages[index]
      if (!source) return
      const copy: PdfPage = clone(source)
      copy.id = createId('page')
      copy.elements = copy.elements.map((element) => ({ ...element, id: createId(element.type) }))
      doc.pages.splice(index + 1, 0, copy)
    })
    pageIndex.value = Math.min(index + 1, pages.value.length - 1)
    selectedId.value = null
  }

  function removePage(index = pageIndex.value): void {
    if (pages.value.length <= 1) return
    commit((doc) => {
      doc.pages.splice(index, 1)
    })
    pageIndex.value = Math.min(index, pages.value.length - 1)
    selectedId.value = null
    stopEditing()
  }

  function setPageIndex(index: number): void {
    pageIndex.value = Math.min(Math.max(index, 0), pages.value.length - 1)
    selectedId.value = null
    stopEditing()
  }

  function movePage(from: number, to: number): void {
    commit((doc) => {
      if (from < 0 || from >= doc.pages.length || to < 0 || to >= doc.pages.length) return
      const [moved] = doc.pages.splice(from, 1)
      if (moved) doc.pages.splice(to, 0, moved)
    })
    pageIndex.value = Math.min(Math.max(to, 0), pages.value.length - 1)
  }

  function setPageConfig(config: PageConfig): void {
    commit((doc) => {
      doc.pageConfig = config
      const box = pageDimensionsMm(config)
      for (const target of doc.pages) {
        for (const element of target.elements) {
          applySnapped(element, {}, box.widthMm, box.heightMm)
        }
      }
    })
  }

  function setPageBackground(color: string | undefined): void {
    commit((doc) => {
      const target = doc.pages[pageIndex.value]
      if (target) target.background = color
    })
  }

  function setZoom(value: number): void {
    zoom.value = clampZoom(value)
  }

  function zoomIn(): void {
    setZoom(zoom.value + 0.1)
  }

  function zoomOut(): void {
    setZoom(zoom.value - 0.1)
  }

  function fitToWidth(availablePx: number): void {
    const contentWidth = pageBox.value.widthMm * PX_PER_MM
    if (contentWidth <= 0 || availablePx <= 0) return
    setZoom((availablePx - 32) / contentWidth)
  }

  function undo(): void {
    const snapshot = history.undo()
    if (!snapshot) return
    document.value = normalizeDocument(snapshot)
    options.onChange?.(document.value)
    selectedId.value = null
    stopEditing()
    pageIndex.value = Math.min(pageIndex.value, pages.value.length - 1)
  }

  function redo(): void {
    const snapshot = history.redo()
    if (!snapshot) return
    document.value = normalizeDocument(snapshot)
    options.onChange?.(document.value)
    selectedId.value = null
    stopEditing()
    pageIndex.value = Math.min(pageIndex.value, pages.value.length - 1)
  }

  function loadDocument(next: PdfDocumentSchema): void {
    const normalized = normalizeDocument(next)
    document.value = normalized
    history.reset(normalized)
    pageIndex.value = Math.min(pageIndex.value, normalized.pages.length - 1)

    // Keep the editing session when the same elements are still there. A host
    // that stores a copy of the emitted document sends it back on every change;
    // dropping the selection there would make the component uneditable.
    const current = normalized.pages[pageIndex.value]
    const exists = (id: string | null): boolean =>
      id !== null && Boolean(current?.elements.some((element) => element.id === id))

    if (!exists(selectedId.value)) selectedId.value = null
    if (!exists(editingId.value)) stopEditing()
  }

  return {
    document,
    pages,
    page,
    pageIndex,
    pageBox,
    zoom,
    showGrid,
    showRulers,
    showMarginGuides,
    showPreview,
    readOnly,
    selectedId,
    selectedElement,
    editingId,
    activeEditor,
    activeTextVersion,
    activeTextState,
    guides,
    canUndo: history.canUndo,
    canRedo: history.canRedo,

    select,
    startEditing,
    stopEditing,
    setActiveEditor,

    addElement,
    updateElement,
    formatText,
    removeElement,
    duplicateElement,
    moveElement,
    snapRect,
    setGuides,

    bringToFront: (id) => reorder(id, 'front'),
    sendToBack: (id) => reorder(id, 'back'),
    bringForward: (id) => reorder(id, 'forward'),
    sendBackward: (id) => reorder(id, 'backward'),

    addPage,
    duplicatePage,
    removePage,
    setPageIndex,
    movePage,
    setPageConfig,
    setPageBackground,

    setZoom,
    zoomIn,
    zoomOut,
    fitToWidth,

    undo,
    redo,
    loadDocument,
  }
}

export const EDITOR_STATE_KEY: InjectionKey<EditorState> = Symbol('pdf-designer-editor-state')

export function provideEditorState(state: EditorState): EditorState {
  provide(EDITOR_STATE_KEY, state)
  return state
}

export function useEditorState(): EditorState {
  const state = inject(EDITOR_STATE_KEY, null)
  if (!state) {
    throw new Error(
      '[vue-vuetify-pdf-designer] useEditorState() must be called inside <PdfOfficeEditor>.',
    )
  }
  return state
}
