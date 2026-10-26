/**
 * Public document contract of the designer.
 *
 * Everything the editor persists is expressed in millimetres, relative to the
 * top-left corner of its page, so the same JSON can be rendered by the browser
 * preview and by a server-side PDF engine without a second layout model.
 */

export const DOCUMENT_VERSION = '1.0.0'

export const PAGE_SIZES_MM = {
  A4: { widthMm: 210, heightMm: 297 },
  LETTER: { widthMm: 215.9, heightMm: 279.4 },
  LEGAL: { widthMm: 215.9, heightMm: 355.6 },
} as const

export type PageSizeName = keyof typeof PAGE_SIZES_MM

export interface PageSizeCustom {
  widthMm: number
  heightMm: number
}

export type PageSize = PageSizeName | PageSizeCustom

export type PageOrientation = 'portrait' | 'landscape'

export interface MarginsMm {
  top: number
  right: number
  bottom: number
  left: number
}

export const DEFAULT_MARGINS_MM: MarginsMm = {
  top: 20,
  right: 20,
  bottom: 20,
  left: 20,
}

/** Hard limits used by the normaliser and by the UI. */
export const MIN_ELEMENT_MM = 1
export const MAX_ZOOM = 2
export const MIN_ZOOM = 0.5

export interface PageConfig {
  size: PageSize
  orientation: PageOrientation
  marginsMm: MarginsMm
}

export interface FontDescriptor {
  family: string
  /** URL of the `.ttf` / `.woff2` file, so the PDF engine loads the same font. */
  sourceUrl?: string
  weights?: number[]
}

export type ElementType = 'text' | 'image' | 'shape' | 'table'

export type ObjectFit = 'contain' | 'cover' | 'fill'

export type ShapeKind = 'rect' | 'ellipse' | 'line'

export interface ShapeDefinition {
  kind: ShapeKind
  /**
   * @deprecated Paint belongs to `ElementStyle`. Legacy documents are migrated
   * by `normalizeDocument` and the renderer never reads these keys again.
   */
  fill?: string
  /** @deprecated Use `ElementStyle.borderColor`. */
  stroke?: string
  /** @deprecated Use `ElementStyle.borderWidthPt`. */
  strokeWidthPt?: number
  /** @deprecated Use `ElementStyle.borderRadiusMm`. */
  radiusMm?: number
}

export interface TableDefinition {
  rows: string[][]
  headerRow?: boolean
}

export interface ElementStyle {
  backgroundColor?: string
  borderColor?: string
  borderWidthPt?: number
  borderRadiusMm?: number
  opacity?: number
  paddingMm?: number
}

export interface ElementContent {
  /** Rich text as HTML. Always present on `text` elements. */
  html?: string
  /** ProseMirror document, kept so hosts can post-process the text structurally. */
  tiptapJson?: Record<string, unknown>
  /** Base64 data URL or signed URL. */
  imageUrl?: string
  objectFit?: ObjectFit
  alt?: string
  shape?: ShapeDefinition
  table?: TableDefinition
}

export interface PdfCanvasElement {
  id: string
  type: ElementType
  /** Millimetres from the page's top-left corner. */
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  rotationDeg: number
  zIndex: number
  locked?: boolean
  /** Optional label shown in the layers panel. */
  name?: string
  style: ElementStyle
  content: ElementContent
}

export interface PdfPage {
  id: string
  background?: string
  name?: string
  elements: PdfCanvasElement[]
}

export interface PdfDocumentSchema {
  version: string
  pageConfig: PageConfig
  fonts: FontDescriptor[]
  pages: PdfPage[]
}

export type VariableValue = string | number | boolean | null | undefined
export type VariableMap = Record<string, VariableValue>

/** Payload emitted by `PdfOfficeEditor` on `export-pdf`. */
export interface ExportPdfPayload {
  format: 'html' | 'json'
  document: PdfDocumentSchema
  html: string
  json: string
  missingVariables: string[]
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isNamedPageSize(size: unknown): size is PageSizeName {
  return typeof size === 'string' && Object.hasOwn(PAGE_SIZES_MM, size)
}

export function isCustomPageSize(size: unknown): size is PageSizeCustom {
  return (
    isRecord(size) &&
    typeof size.widthMm === 'number' &&
    Number.isFinite(size.widthMm) &&
    typeof size.heightMm === 'number' &&
    Number.isFinite(size.heightMm)
  )
}

/* -------------------------------------------------------------------------- */
/* Factories                                                                  */
/* -------------------------------------------------------------------------- */

let idCounter = 0

export function createId(prefix = 'el'): string {
  idCounter += 1
  const time = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `${prefix}_${time}${idCounter.toString(36)}${random}`
}

type ElementOverrides = Partial<Omit<PdfCanvasElement, 'style' | 'content'>> & {
  style?: Partial<ElementStyle>
  content?: Partial<ElementContent>
}

function decimal(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

const ELEMENT_DEFAULTS: Record<
  ElementType,
  { widthMm: number; heightMm: number; xMm: number; yMm: number }
> = {
  text: { widthMm: 80, heightMm: 20, xMm: 20, yMm: 20 },
  image: { widthMm: 60, heightMm: 40, xMm: 20, yMm: 20 },
  shape: { widthMm: 60, heightMm: 30, xMm: 20, yMm: 20 },
  table: { widthMm: 120, heightMm: 40, xMm: 20, yMm: 20 },
}

function createElementBase(type: ElementType, overrides: ElementOverrides = {}): PdfCanvasElement {
  const defaults = ELEMENT_DEFAULTS[type]
  return {
    id: overrides.id ?? createId(type),
    type,
    xMm: decimal(overrides.xMm, defaults.xMm),
    yMm: decimal(overrides.yMm, defaults.yMm),
    widthMm: decimal(overrides.widthMm, defaults.widthMm),
    heightMm: decimal(overrides.heightMm, defaults.heightMm),
    rotationDeg: decimal(overrides.rotationDeg, 0),
    zIndex: decimal(overrides.zIndex, 1),
    locked: overrides.locked === true ? true : undefined,
    name: overrides.name,
    style: { ...overrides.style },
    content: { ...overrides.content },
  }
}

export function createEmptyTextContent(): Pick<ElementContent, 'html' | 'tiptapJson'> {
  return {
    html: '<p></p>',
    tiptapJson: { type: 'doc', content: [{ type: 'paragraph' }] },
  }
}

export function createTextElement(overrides: ElementOverrides = {}): PdfCanvasElement {
  return createElementBase('text', {
    ...overrides,
    content: { ...createEmptyTextContent(), ...overrides.content },
  })
}

export function createImageElement(overrides: ElementOverrides = {}): PdfCanvasElement {
  return createElementBase('image', {
    ...overrides,
    content: { objectFit: 'contain', ...overrides.content },
  })
}

/**
 * Legacy shapes expressed "no outline" two ways: a transparent colour or a zero
 * stroke width. `strokeWidthPt: 0` must not be silently upgraded to the 1pt
 * default, or a shape saved without a border comes back with one.
 */
function hasLegacyStroke(shape: ShapeDefinition): boolean {
  const transparentStroke = shape.stroke === undefined || shape.stroke === 'transparent'
  return !transparentStroke && shape.strokeWidthPt !== 0
}

export function createShapeElement(overrides: ElementOverrides = {}): PdfCanvasElement {
  const shape = overrides.content?.shape
  // Paint is element style, not shape content: the inspector already edits
  // `ElementStyle`, so both the screen and the exporter read one source.
  const style: Partial<ElementStyle> = { backgroundColor: '#e0e0e0' }
  if (shape?.fill && shape.fill !== 'transparent') style.backgroundColor = shape.fill
  if (shape && hasLegacyStroke(shape)) {
    style.borderColor = shape.stroke
    style.borderWidthPt = shape.strokeWidthPt && shape.strokeWidthPt > 0 ? shape.strokeWidthPt : 1
  }
  if (shape?.radiusMm) style.borderRadiusMm = shape.radiusMm

  return createElementBase('shape', {
    ...overrides,
    style: { ...style, ...overrides.style },
    content: { shape: { kind: shape?.kind ?? 'rect' } },
  })
}

export function createTableElement(overrides: ElementOverrides = {}): PdfCanvasElement {
  return createElementBase('table', {
    ...overrides,
    content: { table: { rows: [['A', 'B'], ['', '']], headerRow: true }, ...overrides.content },
  })
}

export function createEmptyPage(overrides: Partial<PdfPage> = {}): PdfPage {
  return {
    id: overrides.id ?? createId('page'),
    background: overrides.background,
    name: overrides.name,
    elements: overrides.elements ? overrides.elements.map((el) => normalizeElement(el)) : [],
  }
}

export function createDefaultPageConfig(): PageConfig {
  return {
    size: 'A4',
    orientation: 'portrait',
    marginsMm: { ...DEFAULT_MARGINS_MM },
  }
}

export function createDocument(overrides: Partial<PdfDocumentSchema> = {}): PdfDocumentSchema {
  return normalizeDocument({
    version: DOCUMENT_VERSION,
    pageConfig: createDefaultPageConfig(),
    fonts: [],
    pages: [createEmptyPage()],
    ...overrides,
  })
}

/* -------------------------------------------------------------------------- */
/* Normalisation                                                              */
/* -------------------------------------------------------------------------- */

export function pageDimensionsMm(config: {
  size: PageSize
  orientation?: PageOrientation
}): { widthMm: number; heightMm: number } {
  const base = isCustomPageSize(config.size)
    ? { widthMm: config.size.widthMm, heightMm: config.size.heightMm }
    : PAGE_SIZES_MM[isNamedPageSize(config.size) ? config.size : 'A4']
  return config.orientation === 'landscape'
    ? { widthMm: base.heightMm, heightMm: base.widthMm }
    : { widthMm: base.widthMm, heightMm: base.heightMm }
}

function normalizeMargins(input: unknown): MarginsMm {
  const source = isRecord(input) ? input : {}
  const read = (key: keyof MarginsMm) => {
    const value = source[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? value
      : DEFAULT_MARGINS_MM[key]
  }
  return { top: read('top'), right: read('right'), bottom: read('bottom'), left: read('left') }
}

export function normalizePageConfig(input: unknown): PageConfig {
  const source = isRecord(input) ? input : {}
  const size = isNamedPageSize(source.size)
    ? source.size
    : isCustomPageSize(source.size)
      ? { widthMm: Math.max(source.size.widthMm, 10), heightMm: Math.max(source.size.heightMm, 10) }
      : 'A4'

  const orientation: PageOrientation = source.orientation === 'landscape' ? 'landscape' : 'portrait'

  return { size, orientation, marginsMm: normalizeMargins(source.marginsMm) }
}

function normalizeType(value: unknown): ElementType {
  return value === 'image' || value === 'shape' || value === 'table' || value === 'text'
    ? value
    : 'text'
}

function normalizeShape(input: unknown): ShapeDefinition {
  const source = isRecord(input) ? input : {}
  const kind: ShapeKind =
    source.kind === 'ellipse' || source.kind === 'line' || source.kind === 'rect'
      ? source.kind
      : 'rect'
  return {
    kind,
    fill: typeof source.fill === 'string' ? source.fill : undefined,
    stroke: typeof source.stroke === 'string' ? source.stroke : undefined,
    strokeWidthPt:
      typeof source.strokeWidthPt === 'number' && Number.isFinite(source.strokeWidthPt)
        ? source.strokeWidthPt
        : undefined,
    radiusMm:
      typeof source.radiusMm === 'number' && Number.isFinite(source.radiusMm)
        ? source.radiusMm
        : undefined,
  }
}

function normalizeStyle(input: unknown): ElementStyle {
  const source = isRecord(input) ? input : {}
  const style: ElementStyle = {}
  if (typeof source.backgroundColor === 'string') style.backgroundColor = source.backgroundColor
  if (typeof source.borderColor === 'string') style.borderColor = source.borderColor
  if (typeof source.borderWidthPt === 'number' && Number.isFinite(source.borderWidthPt)) {
    style.borderWidthPt = source.borderWidthPt
  }
  if (typeof source.borderRadiusMm === 'number' && Number.isFinite(source.borderRadiusMm)) {
    style.borderRadiusMm = source.borderRadiusMm
  }
  if (typeof source.opacity === 'number' && Number.isFinite(source.opacity)) {
    style.opacity = Math.min(1, Math.max(0, source.opacity))
  }
  if (typeof source.paddingMm === 'number' && Number.isFinite(source.paddingMm)) {
    style.paddingMm = Math.max(0, source.paddingMm)
  }
  return style
}

/**
 * Moves the pre-1.1 shape paint (`content.shape.fill`, `stroke`,
 * `strokeWidthPt`, `radiusMm`) into `ElementStyle`, then drops the legacy keys.
 *
 * Idempotent by design: once the keys are gone nothing is re-applied, so
 * "Sin fondo" (`backgroundColor: undefined`) survives a document reload.
 */
function migrateShapePaint(shape: ShapeDefinition, style: ElementStyle): void {
  const isTransparent = (value?: string) => value === undefined || value === 'transparent'

  if (style.backgroundColor === undefined && !isTransparent(shape.fill)) {
    style.backgroundColor = shape.fill
  }
  if (style.borderColor === undefined && hasLegacyStroke(shape)) {
    style.borderColor = shape.stroke
    if (style.borderWidthPt === undefined) {
      style.borderWidthPt = shape.strokeWidthPt && shape.strokeWidthPt > 0 ? shape.strokeWidthPt : 1
    }
  }
  if (style.borderRadiusMm === undefined && shape.radiusMm !== undefined) {
    style.borderRadiusMm = shape.radiusMm
  }

  delete shape.fill
  delete shape.stroke
  delete shape.strokeWidthPt
  delete shape.radiusMm
}

function normalizeContent(type: ElementType, input: unknown): ElementContent {
  const source = isRecord(input) ? input : {}
  const content: ElementContent = {}

  if (type === 'text') {
    content.html = stringOr(source.html, '')
    content.tiptapJson = isRecord(source.tiptapJson)
      ? source.tiptapJson
      : { type: 'doc', content: [{ type: 'paragraph' }] }
  }
  if (type === 'image') {
    content.imageUrl = typeof source.imageUrl === 'string' ? source.imageUrl : ''
    content.objectFit =
      source.objectFit === 'cover' || source.objectFit === 'fill' ? source.objectFit : 'contain'
    if (typeof source.alt === 'string') content.alt = source.alt
  }
  if (type === 'shape') {
    content.shape = normalizeShape(source.shape)
  }
  if (type === 'table') {
    const table = isRecord(source.table) ? source.table : {}
    const rows = Array.isArray(table.rows)
      ? table.rows
          .filter((row): row is unknown[] => Array.isArray(row))
          .map((row) => row.map((cell) => String(cell ?? '')))
      : [['A', 'B'], ['', '']]
    content.table = { rows, headerRow: table.headerRow !== false }
  }

  return content
}

/**
 * Normalises one element and clamps it inside the page it belongs to.
 * Unknown element types degrade to `text` instead of breaking the document.
 */
export function normalizeElement(
  input: unknown,
  pageWidthMm = 210,
  pageHeightMm = 297,
): PdfCanvasElement {
  const source = isRecord(input) ? input : {}
  const type = normalizeType(source.type)
  const defaults = ELEMENT_DEFAULTS[type]

  const width = Math.min(
    Math.max(decimal(source.widthMm, defaults.widthMm), MIN_ELEMENT_MM),
    pageWidthMm,
  )
  const height = Math.min(
    Math.max(decimal(source.heightMm, defaults.heightMm), MIN_ELEMENT_MM),
    pageHeightMm,
  )
  const x = Math.min(Math.max(decimal(source.xMm, defaults.xMm), 0), pageWidthMm - width)
  const y = Math.min(Math.max(decimal(source.yMm, defaults.yMm), 0), pageHeightMm - height)

  const style = normalizeStyle(source.style)
  const content = normalizeContent(type, source.content)
  if (type === 'shape' && content.shape) migrateShapePaint(content.shape, style)

  return {
    id: stringOr(source.id, createId(type)),
    type,
    xMm: x,
    yMm: y,
    widthMm: width,
    heightMm: height,
    rotationDeg: decimal(source.rotationDeg, 0),
    zIndex: decimal(source.zIndex, 1),
    locked: source.locked === true ? true : undefined,
    name: typeof source.name === 'string' ? source.name : undefined,
    style,
    content,
  }
}

function normalizeFonts(input: unknown): FontDescriptor[] {
  if (!Array.isArray(input)) return []
  const fonts: FontDescriptor[] = []
  for (const raw of input) {
    if (!isRecord(raw) || typeof raw.family !== 'string') continue
    const family = raw.family.trim()
    if (!family) continue
    if (fonts.some((font) => font.family === family)) continue
    const font: FontDescriptor = { family }
    if (typeof raw.sourceUrl === 'string' && raw.sourceUrl) font.sourceUrl = raw.sourceUrl
    if (Array.isArray(raw.weights)) {
      font.weights = raw.weights.filter(
        (weight): weight is number => typeof weight === 'number' && Number.isFinite(weight),
      )
    }
    fonts.push(font)
  }
  return fonts
}

/**
 * Builds a valid, self-consistent document from any unknown input.
 * The input is never mutated, ids are unique, and z-index values become
 * contiguous while preserving their relative order.
 */
export function normalizeDocument(input: unknown): PdfDocumentSchema {
  const source = isRecord(input) ? input : {}
  const pageConfig = normalizePageConfig(source.pageConfig)
  const dimensions = pageDimensionsMm(pageConfig)

  const pages: PdfPage[] = (Array.isArray(source.pages) ? source.pages : [])
    .filter(isRecord)
    .map((page) => {
      const elements = (Array.isArray(page.elements) ? page.elements : []).map((element) =>
        normalizeElement(element, dimensions.widthMm, dimensions.heightMm),
      )
      return {
        id: stringOr(page.id, createId('page')),
        background: typeof page.background === 'string' ? page.background : undefined,
        name: typeof page.name === 'string' ? page.name : undefined,
        elements,
      }
    })

  const resolvedPages = pages.length > 0 ? pages : [createEmptyPage()]

  const seenIds = new Set<string>()
  for (const page of resolvedPages) {
    if (seenIds.has(page.id)) page.id = createId('page')
    seenIds.add(page.id)

    const elementIds = new Set<string>()
    for (const element of page.elements) {
      if (elementIds.has(element.id) || seenIds.has(element.id)) {
        element.id = createId(element.type)
      }
      elementIds.add(element.id)
      seenIds.add(element.id)
    }

    page.elements
      .map((element, index) => ({ element, order: element.zIndex ?? index + 1 }))
      .sort((a, b) => a.order - b.order)
      .forEach(({ element }, index) => {
        element.zIndex = index + 1
      })
    page.elements.sort((a, b) => a.zIndex - b.zIndex)
  }

  return {
    version: typeof source.version === 'string' && source.version ? source.version : DOCUMENT_VERSION,
    pageConfig,
    fonts: normalizeFonts(source.fonts),
    pages: resolvedPages,
  }
}
