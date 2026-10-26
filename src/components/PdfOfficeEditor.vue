<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue'

import { createEditorState, provideEditorState } from '@/composables/useEditorState'
import { useFontLoader } from '@/composables/useFontLoader'
import {
  exportHtml,
  downloadHtmlFile,
  printHtmlDocument,
} from '@/exporters/htmlPrintExporter'
import { exportDocumentJson } from '@/exporters/jsonSchemaExporter'
import {
  normalizeDocument,
  type ExportPdfPayload,
  type FontDescriptor,
  type PdfDocumentSchema,
  type ShapeKind,
  type VariableMap,
} from '@/types/editor'
import EditorRibbon from './ribbon/EditorRibbon.vue'
import PageViewport from './canvas/PageViewport.vue'
import LayersPanel from './panels/LayersPanel.vue'
import PagePreviewRail from './panels/PagePreviewRail.vue'
import PageSetupDialog from './panels/PageSetupDialog.vue'
import ContextMenu from './common/ContextMenu.vue'

const DEFAULT_FAMILIES = [
  'Inter',
  'Roboto',
  'Montserrat',
  'Lora',
  'Merriweather',
  'Open Sans',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
]

const props = withDefaults(
  defineProps<{
    modelValue: PdfDocumentSchema
    availableFonts?: Array<FontDescriptor | string>
    readOnly?: boolean
    uploadImageHandler?: (file: File) => Promise<string> | string
    variables?: VariableMap
    title?: string
    initialZoom?: number
    showRulers?: boolean
    showGrid?: boolean
    showMarginGuides?: boolean
    showPreview?: boolean
    historyLimit?: number
    maxInlineImageBytes?: number
  }>(),
  {
    availableFonts: () => [],
    readOnly: false,
    variables: () => ({}),
    title: 'Document',
    initialZoom: 1,
    showRulers: true,
    showGrid: false,
    showMarginGuides: false,
    showPreview: true,
    historyLimit: 100,
    maxInlineImageBytes: 2_000_000,
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', document: PdfDocumentSchema): void
  (event: 'change', document: PdfDocumentSchema): void
  (event: 'export-pdf', payload: ExportPdfPayload): void
  (event: 'upload-error', file: File, error: unknown): void
}>()

let lastEmitted: PdfDocumentSchema | null = null

const state = provideEditorState(
  createEditorState({
    document: normalizeDocument(props.modelValue),
    readOnly: computed(() => props.readOnly),
    initialZoom: props.initialZoom,
    historyLimit: props.historyLimit,
    onChange: (document) => {
      lastEmitted = document
      emit('update:modelValue', document)
      emit('change', document)
    },
  }),
)

state.showRulers.value = props.showRulers
state.showGrid.value = props.showGrid
state.showMarginGuides.value = props.showMarginGuides
state.showPreview.value = props.showPreview

const fileInput = ref<HTMLInputElement | null>(null)
const fontLoader = useFontLoader()

/*
 * Top-level binding on purpose: inside a template, `state.showPreview` would be
 * the Ref object itself (a plain object, always truthy) instead of its value,
 * so the rail would never react to the switch.
 */
const previewVisible = state.showPreview

const declaredFonts = computed<FontDescriptor[]>(() => {
  const list: FontDescriptor[] = []
  const push = (font: FontDescriptor | string) => {
    const descriptor = typeof font === 'string' ? { family: font } : font
    if (!descriptor.family) return
    if (!list.some((item) => item.family === descriptor.family)) list.push(descriptor)
  }
  for (const font of props.availableFonts) push(font)
  for (const font of state.document.value.fonts) push(font)
  return list
})

const fontFamilies = computed<FontDescriptor[]>(() => {
  // Document fonts come first: the ribbon falls back to the first item, and an
  // unformatted text box renders with exactly this family on the page.
  const families = declaredFonts.value.map((font) => font.family)
  for (const family of DEFAULT_FAMILIES) {
    if (!families.includes(family)) families.push(family)
  }
  return families.map((family) => ({ family }))
})

/** Base family for unformatted text, shared by the canvas and the ribbon. */
const documentFont = computed(() => declaredFonts.value[0]?.family ?? 'Inter')

watch(
  declaredFonts,
  (fonts) => {
    void fontLoader.loadFonts(fonts)
  },
  { immediate: true, deep: true },
)

watch(
  () => props.modelValue,
  (value) => {
    // Hosts usually keep the emitted document in a `ref`, and Vue hands props
    // back through a reactive proxy. Comparing the proxy against the raw object
    // we emitted never matches, so the editor would reload (and reset selection,
    // editing and history) on every change it made itself. `toRaw` unwraps both
    // sides so a plain echo is ignored while a genuinely new document loads.
    if (lastEmitted && toRaw(value) === toRaw(lastEmitted)) return
    state.loadDocument(value)
  },
)

/* --------------------------------------------------------------- images */

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Cannot read the image file'))
    reader.readAsDataURL(file)
  })
}

async function resolveImageUrl(file: File): Promise<string> {
  if (props.uploadImageHandler) {
    const url = await props.uploadImageHandler(file)
    if (!url) throw new Error('uploadImageHandler must resolve to a URL')
    return url
  }

  if (file.size > props.maxInlineImageBytes) {
    throw new Error(
      `Image is ${file.size} bytes, above the ${props.maxInlineImageBytes} byte inline limit. Provide uploadImageHandler to store it instead.`,
    )
  }

  return readFileAsDataUrl(file)
}

async function insertImageFile(file: File): Promise<void> {
  if (props.readOnly) return
  try {
    const imageUrl = await resolveImageUrl(file)
    const element = state.addElement('image', {
      content: { imageUrl, alt: file.name },
    })
    state.select(element.id)
  } catch (error) {
    emit('upload-error', file, error)
  }
}

function pickImage(): void {
  fileInput.value?.click()
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await insertImageFile(file)
}

function onPaste(event: ClipboardEvent): void {
  if (props.readOnly || state.activeEditor.value) return
  const items = Array.from(event.clipboardData?.items ?? [])
  const imageItem = items.find((item) => item.type.startsWith('image/'))
  if (!imageItem) return
  const file = imageItem.getAsFile()
  if (!file) return
  event.preventDefault()
  void insertImageFile(file)
}

function onDrop(event: DragEvent): void {
  if (props.readOnly) return
  const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
    file.type.startsWith('image/'),
  )
  if (files.length === 0) return
  event.preventDefault()
  for (const file of files) void insertImageFile(file)
}

function onDragOver(event: DragEvent): void {
  if (props.readOnly) return
  event.preventDefault()
}

/* ------------------------------------------------------------- inserting */

function insertText(): void {
  const element = state.addElement('text')
  state.select(element.id)
  state.startEditing(element.id)
}

function insertTable(): void {
  const element = state.addElement('table')
  state.select(element.id)
}

function insertShape(kind: ShapeKind): void {
  // Paint is element style; `content.shape` only carries the geometry.
  const style =
    kind === 'rect'
      ? { backgroundColor: '#e0e0e0' }
      : kind === 'ellipse'
        ? { backgroundColor: '#c5e1a5' }
        : { backgroundColor: undefined, borderColor: '#424242', borderWidthPt: 2 }
  const element = state.addElement('shape', { content: { shape: { kind } }, style })
  state.select(element.id)
}

/* ---------------------------------------------------------------- export */

function buildExport(): ExportPdfPayload {
  const document = state.document.value
  const { html, missingVariables } = exportHtml(document, {
    title: props.title,
    variables: props.variables,
  })
  return {
    format: 'html',
    document,
    html,
    json: exportDocumentJson(document),
    missingVariables,
  }
}

function exportPdf(format: 'html' | 'json' = 'html'): ExportPdfPayload {
  const payload = { ...buildExport(), format }
  emit('export-pdf', payload)
  return payload
}

function downloadHtml(filename?: string): void {
  const payload = buildExport()
  downloadHtmlFile(
    { html: payload.html, missingVariables: payload.missingVariables },
    filename ?? `${props.title || 'document'}.html`,
  )
}

function printPdf(): void {
  printHtmlDocument(buildExport().html)
}

/* ---------------------------------------------------------- context menu */

const pageSetupOpen = ref(false)

interface ContextMenuItem {
  id: string
  label: string
  icon: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  separatorBefore?: boolean
}

const contextMenu = reactive({
  open: false,
  x: 0,
  y: 0,
  target: 'page' as 'element' | 'page',
  elementId: null as string | null,
})

/** Both stack ends, so a step button that cannot move is visibly spent. */
const contextStackEnds = computed(() => {
  const sorted = [...state.page.value.elements].sort((a, b) => a.zIndex - b.zIndex)
  return {
    topId: sorted[sorted.length - 1]?.id ?? null,
    bottomId: sorted[0]?.id ?? null,
  }
})

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  const readOnly = props.readOnly

  if (contextMenu.target === 'page') {
    return [
      { id: 'insert-text', label: 'Insertar texto', icon: 'mdi-format-text', disabled: readOnly },
      { id: 'insert-image', label: 'Insertar imagen', icon: 'mdi-image-plus', disabled: readOnly },
      { id: 'insert-table', label: 'Insertar tabla', icon: 'mdi-table-plus', disabled: readOnly },
      { id: 'insert-shape', label: 'Insertar forma', icon: 'mdi-shape-plus', disabled: readOnly },
      {
        id: 'page-setup',
        label: 'Ajustes de página…',
        icon: 'mdi-page-layout-body',
        separatorBefore: true,
        disabled: readOnly,
      },
    ]
  }

  const element = state.page.value.elements.find((item) => item.id === contextMenu.elementId)
  const disabled = readOnly || !element

  return [
    {
      id: 'forward',
      label: 'Subir una capa',
      icon: 'mdi-arrow-up-bold',
      disabled: disabled || contextMenu.elementId === contextStackEnds.value.topId,
    },
    {
      id: 'backward',
      label: 'Bajar una capa',
      icon: 'mdi-arrow-down-bold',
      disabled: disabled || contextMenu.elementId === contextStackEnds.value.bottomId,
    },
    {
      id: 'front',
      label: 'Traer al frente',
      icon: 'mdi-arrow-up-bold-box-outline',
      separatorBefore: true,
      disabled,
    },
    { id: 'back', label: 'Enviar al fondo', icon: 'mdi-arrow-down-bold-box-outline', disabled },
    {
      id: 'duplicate',
      label: 'Duplicar',
      icon: 'mdi-content-duplicate',
      shortcut: 'Ctrl+D',
      separatorBefore: true,
      disabled,
    },
    {
      id: 'lock',
      label: element?.locked ? 'Desbloquear' : 'Bloquear',
      icon: element?.locked ? 'mdi-lock' : 'mdi-lock-open-variant-outline',
      disabled,
    },
    {
      id: 'delete',
      label: 'Eliminar',
      icon: 'mdi-delete-outline',
      shortcut: 'Supr',
      danger: true,
      separatorBefore: true,
      disabled,
    },
  ]
})

function pageIndexFromNode(node: HTMLElement | null): number | null {
  const sheet = node?.closest<HTMLElement>('.pdf-sheet')
  const index = Number(sheet?.dataset.pageIndex)
  return Number.isInteger(index) ? index : null
}

function onCanvasContextMenu(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (!target || typeof target.closest !== 'function') return

  // A text box being edited, a form field and an open overlay keep the browser
  // menu: paste and spellcheck live there.
  if (target.closest('input, textarea, [contenteditable="true"], .v-overlay-container')) return

  const elementNode = target.closest<HTMLElement>('[data-element-id]')
  const pageFromDom = pageIndexFromNode(target)
  if (pageFromDom !== null && pageFromDom !== state.pageIndex.value) {
    state.setPageIndex(pageFromDom)
  }

  event.preventDefault()

  if (elementNode?.dataset.elementId) {
    // Office behaviour: right-clicking an unselected layer selects it first.
    if (state.selectedId.value !== elementNode.dataset.elementId) {
      state.select(elementNode.dataset.elementId)
    }
    contextMenu.target = 'element'
    contextMenu.elementId = elementNode.dataset.elementId
  } else {
    contextMenu.target = 'page'
    contextMenu.elementId = null
  }

  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.open = true
}

function runContextAction(id: string): void {
  const elementId = contextMenu.elementId

  switch (id) {
    case 'forward':
      if (elementId) state.bringForward(elementId)
      return
    case 'backward':
      if (elementId) state.sendBackward(elementId)
      return
    case 'front':
      if (elementId) state.bringToFront(elementId)
      return
    case 'back':
      if (elementId) state.sendToBack(elementId)
      return
    case 'duplicate':
      if (elementId) state.duplicateElement(elementId)
      return
    case 'lock': {
      if (!elementId) return
      const element = state.page.value.elements.find((item) => item.id === elementId)
      state.updateElement(elementId, { locked: !element?.locked })
      return
    }
    case 'delete':
      if (elementId) state.removeElement(elementId)
      return
    case 'insert-text':
      insertText()
      return
    case 'insert-image':
      pickImage()
      return
    case 'insert-table':
      insertTable()
      return
    case 'insert-shape':
      insertShape('rect')
      return
    case 'page-setup':
      pageSetupOpen.value = true
      return
  }
}

/* ------------------------------------------------------------- shortcuts */

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  if (element.isContentEditable) return true
  // Keydown can be dispatched from `document`/`window` or from a text node,
  // which have no `closest`; treat those as non-typing instead of throwing.
  if (typeof element.closest !== 'function') return false
  return Boolean(element.closest('input, textarea, select, [contenteditable="true"]'))
}

function nudge(dx: number, dy: number): void {
  const element = state.selectedElement.value
  if (!element || element.locked) return
  state.updateElement(element.id, {
    xMm: element.xMm + dx,
    yMm: element.yMm + dy,
  })
}

/**
 * Vuetify menus and colour pickers close on Escape. Their listener runs on
 * `document`, before this one on `window`, and by then the overlay may already
 * be gone — so the decision is captured first. Without it, dismissing a picker
 * also dropped the selection and collapsed the inspector the user was editing.
 */
let escapeDismissesOverlay = false

function captureEscapeContext(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  const target = event.target as HTMLElement | null
  const insideControl =
    typeof target?.closest === 'function' &&
    Boolean(target.closest('.v-overlay-container, .v-field, .v-menu, [role="dialog"]'))
  escapeDismissesOverlay =
    insideControl || document.querySelector('.v-overlay--active') !== null
}

function onKeydown(event: KeyboardEvent): void {
  const typing = isTypingTarget(event.target)
  const modifier = event.ctrlKey || event.metaKey
  const key = event.key.toLowerCase()

  if (modifier && key === 'z') {
    if (typing) return
    event.preventDefault()
    if (event.shiftKey) state.redo()
    else state.undo()
    return
  }

  if (modifier && key === 'y') {
    if (typing) return
    event.preventDefault()
    state.redo()
    return
  }

  if (modifier && key === 'd') {
    if (typing) return
    const id = state.selectedId.value
    if (!id) return
    event.preventDefault()
    state.duplicateElement(id)
    return
  }

  if (event.key === 'Escape') {
    // Escape inside a menu, picker or field belongs to that control: it closes
    // and nothing else changes. The selection and, above all, the edit session
    // the user is in must survive — otherwise closing a colour picker would
    // also end editing and collapse the inspector.
    if (escapeDismissesOverlay) {
      escapeDismissesOverlay = false
      return
    }
    state.stopEditing()
    state.select(null)
    return
  }

  if (typing) return

  if (event.key === 'Delete' || event.key === 'Backspace') {
    const id = state.selectedId.value
    if (!id) return
    event.preventDefault()
    state.removeElement(id)
    return
  }

  const step = event.shiftKey ? 10 : 1
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    nudge(-step, 0)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    nudge(step, 0)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    nudge(0, -step)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    nudge(0, step)
  }
}

onMounted(() => {
  // Capture phase: the overlay's own Escape handler runs later on `document`.
  window.addEventListener('keydown', captureEscapeContext, true)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('paste', onPaste)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', captureEscapeContext, true)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('paste', onPaste)
})

defineExpose({
  state,
  exportPdf,
  downloadHtml,
  printPdf,
  insertText,
  insertTable,
  insertShape,
  pickImage,
  undo: state.undo,
  redo: state.redo,
  addPage: state.addPage,
  setZoom: state.setZoom,
})
</script>

<template>
  <div
    class="pdf-office-editor"
    :class="{ 'pdf-office-editor--readonly': readOnly }"
    :style="{ '--pdf-doc-font': documentFont }"
    @dragover="onDragOver"
    @drop.prevent="onDrop"
  >
    <EditorRibbon
      v-if="!readOnly"
      :fonts="fontFamilies"
      @insert-text="insertText"
      @insert-image="pickImage"
      @insert-table="insertTable"
      @insert-shape="insertShape"
    />

    <div class="pdf-office-editor__main">
      <PageViewport class="pdf-office-editor__canvas" @contextmenu="onCanvasContextMenu" />
      <aside v-if="previewVisible" class="pdf-office-editor__preview">
        <PagePreviewRail />
      </aside>
      <aside class="pdf-office-editor__sidebar">
        <LayersPanel />
      </aside>
    </div>

    <!--
      The context menu renders inside the editor root (not teleported) so it
      inherits the `--pdf-*` tokens, and it is positioned with `position: fixed`
      from the pointer coordinates.
    -->
    <ContextMenu
      :open="contextMenu.open"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :title="contextMenu.target === 'element' ? 'Acciones del elemento' : 'Acciones de la página'"
      :items="contextMenuItems"
      @close="contextMenu.open = false"
      @select="runContextAction"
    />

    <!--
      The ribbon owns its own page-setup dialog for the ribbon button; this
      instance serves the context menu and keeps working in read-only mode,
      where the ribbon is not rendered at all.
    -->
    <PageSetupDialog v-model="pageSetupOpen" />

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
      class="pdf-office-editor__file"
      @change="onFileChange"
    />
  </div>
</template>

<style scoped>
/*
 * Design tokens.
 *
 * They live on the editor root so every nested component inherits them and the
 * whole surface stays coherent with a single edit. The accent follows the host
 * Vuetify theme (`--v-theme-primary`) and falls back to a neutral blue when the
 * component is used outside Vuetify's theme provider.
 */
.pdf-office-editor {
  --pdf-accent: rgb(var(--v-theme-primary, 37 99 235));
  --pdf-accent-soft: color-mix(in srgb, var(--pdf-accent) 10%, transparent);
  --pdf-accent-line: color-mix(in srgb, var(--pdf-accent) 30%, transparent);
  --pdf-surface: rgb(var(--v-theme-surface, 255 255 255));
  --pdf-surface-muted: color-mix(in srgb, var(--pdf-surface) 93%, #0f172a);
  --pdf-canvas: #eef1f6;
  --pdf-canvas-deep: #e2e7f0;
  --pdf-line: rgba(15, 23, 42, 0.08);
  --pdf-line-strong: rgba(15, 23, 42, 0.14);
  --pdf-ink: #1c2333;
  --pdf-ink-muted: #677085;
  --pdf-radius: 12px;
  --pdf-radius-sm: 8px;
  --pdf-shadow-sheet:
    0 1px 2px rgba(15, 23, 42, 0.1),
    0 12px 32px -14px rgba(15, 23, 42, 0.32);
  --pdf-shadow-float:
    0 1px 2px rgba(15, 23, 42, 0.08),
    0 8px 24px -12px rgba(15, 23, 42, 0.28);
  --pdf-font: 'Segoe UI Variable Text', 'Segoe UI', Inter, system-ui, -apple-system,
    'Helvetica Neue', Arial, sans-serif;

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 480px;
  background: var(--pdf-canvas);
  color: var(--pdf-ink);
  font-family: var(--pdf-font);
  font-size: 13px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}

/* Dark surfaces: keep the paper white, darken only the editor chrome. */
.v-theme--dark .pdf-office-editor {
  --pdf-surface: rgb(var(--v-theme-surface, 30 34 45));
  --pdf-surface-muted: color-mix(in srgb, var(--pdf-surface) 88%, #ffffff);
  --pdf-canvas: #10141c;
  --pdf-canvas-deep: #0b0e15;
  --pdf-line: rgba(255, 255, 255, 0.09);
  --pdf-line-strong: rgba(255, 255, 255, 0.16);
  --pdf-ink: #e6e9f2;
  --pdf-ink-muted: #9aa3b8;
  --pdf-shadow-sheet:
    0 1px 2px rgba(0, 0, 0, 0.5),
    0 18px 40px -16px rgba(0, 0, 0, 0.7);
}

.pdf-office-editor__main {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.pdf-office-editor__canvas {
  flex: 1 1 auto;
  min-width: 0;
}

/* The rail sits between the page and the inspector, like Office's page list. */
.pdf-office-editor__preview {
  flex: 0 0 166px;
  border-left: 1px solid var(--pdf-line);
  background: var(--pdf-surface);
  overflow: hidden;
}

.pdf-office-editor__sidebar {
  flex: 0 0 296px;
  border-left: 1px solid var(--pdf-line);
  background: var(--pdf-surface);
  overflow: hidden;
}

.pdf-office-editor__file {
  display: none;
}

@media (max-width: 900px) {
  .pdf-office-editor__sidebar {
    flex-basis: 232px;
  }
}
</style>
