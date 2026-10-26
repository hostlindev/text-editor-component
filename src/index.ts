import type { App, Plugin } from 'vue'

import PdfOfficeEditor from './components/PdfOfficeEditor.vue'

export { PdfOfficeEditor }

/**
 * Vue plugin: registers `<PdfOfficeEditor>` globally.
 *
 * It is the package default export, so hosts can do:
 * `app.use(VueVuetifyPdfDesigner)`.
 */
export const VueVuetifyPdfDesigner: Plugin = {
  install(app: App) {
    app.component('PdfOfficeEditor', PdfOfficeEditor)
  },
}

export default VueVuetifyPdfDesigner

/* Components */
export { default as EditorRibbon } from './components/ribbon/EditorRibbon.vue'
export { default as FontControls } from './components/ribbon/FontControls.vue'
export { default as InsertControls } from './components/ribbon/InsertControls.vue'
export { default as PageViewport } from './components/canvas/PageViewport.vue'
export { default as DocumentPage } from './components/canvas/DocumentPage.vue'
export { default as FreeElementWrapper } from './components/canvas/FreeElementWrapper.vue'
export { default as RichTextElement } from './components/elements/RichTextElement.vue'
export { default as ImageElement } from './components/elements/ImageElement.vue'
export { default as ShapeElement } from './components/elements/ShapeElement.vue'
export { default as TableElement } from './components/elements/TableElement.vue'
export { default as PageSetupDialog } from './components/panels/PageSetupDialog.vue'
export { default as LayersPanel } from './components/panels/LayersPanel.vue'

/* Composables */
export {
  createEditorState,
  provideEditorState,
  useEditorState,
  EDITOR_STATE_KEY,
  type EditorState,
  type EditorStateOptions,
  type ElementPatch,
  type ActiveTextState,
} from './composables/useEditorState'
export { useHistory, type History, type UseHistoryOptions } from './composables/useHistory'
export {
  useUnitConverter,
  resolvePageBox,
  clamp,
  cmToMm,
  mmToCm,
  mmToPt,
  mmToPx,
  pageDimensionsMm,
  ptToMm,
  ptToPx,
  pxToMm,
  pxToPt,
  roundMm,
  DPI,
  MM_PER_INCH,
  MM_PER_PT,
  PAGE_SIZES_MM,
  PT_PER_MM,
  PX_PER_MM,
  type PageBox,
  type UnitConverter,
} from './composables/useUnitConverter'
export {
  useFontLoader,
  fontFaceRule,
  googleFontHref,
  inferFontFormat,
  normalizeFamily,
  type FontLoader,
} from './composables/useFontLoader'
export {
  snapMove,
  clampRectToPage,
  DEFAULT_SNAP_THRESHOLD_MM,
  type SnapAxis,
  type SnapKind,
  type SnapLine,
  type SnapOptions,
  type SnapRect,
  type SnapResult,
} from './composables/useSnapping'

/* Exporters */
export {
  exportDocumentJson,
  parseDocumentJson,
  parseDocumentFile,
  isValidDocument,
  DocumentParseError,
  type JsonExportOptions,
} from './exporters/jsonSchemaExporter'
export {
  exportHtml,
  downloadHtmlFile,
  printHtmlDocument,
  interpolateVariables,
  collectPlaceholders,
  escapeHtml,
  type HtmlExportOptions,
  type HtmlExportResult,
} from './exporters/htmlPrintExporter'

/* Security */
export { sanitizeRichTextHtml, hasExecutableMarkup } from './security/sanitizeHtml'

/* Types and factories */
export * from './types/editor'
