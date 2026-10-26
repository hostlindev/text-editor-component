# vue-vuetify-pdf-designer

Office-style PDF design surface for **Vue 3 + Vuetify 3**.

Rich text boxes, images, shapes and free positioning on physical pages
(A4 / Letter / Legal / custom, in millimetres). The design is persisted as a
single JSON document and exported as a standalone, print-ready HTML file that
Puppeteer, Playwright, Gotenberg or WeasyPrint convert into a PDF with 1:1
fidelity to what the user saw.

```
mm → px   1 mm = 3.7795 px  (96 DPI CSS reference) × zoom
mm → pt   1 mm = 2.8346 pt  (72 pt per inch)
```

## Install

```bash
pnpm add vue-vuetify-pdf-designer
```

The library is a **peer-dependency-only** package: it never bundles Vue,
Vuetify or TipTap. Install the ones you use, matching your app versions:

```bash
pnpm add vue vuetify \
  @tiptap/vue-3 @tiptap/pm @tiptap/starter-kit \
  @tiptap/extension-text-style @tiptap/extension-text-align \
  @tiptap/extension-highlight @tiptap/extension-subscript \
  @tiptap/extension-superscript
```

Sharing a single `@tiptap/pm` instance with the rest of your app is mandatory
(ProseMirror breaks identity checks when it is duplicated), which is why those
packages are peers and stay external in the build.

### Vuetify setup

The library does **not** import `vuetify/styles` and does **not** register
global components. Your app owns the Vuetify instance and its theme. Each SFC
imports exactly the Vuetify components it renders, so tree-shaking survives:

```ts
import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

import { VueVuetifyPdfDesigner } from 'vue-vuetify-pdf-designer'

const app = createApp(App)
app.use(createVuetify())
app.use(VueVuetifyPdfDesigner) // registers <PdfOfficeEditor>
app.mount('#app')
```

Or import the component directly (preferred if you only use it in one place):

```vue
<script setup lang="ts">
import { PdfOfficeEditor } from 'vue-vuetify-pdf-designer'
</script>
```

The default export of the package is the plugin object, so
`app.use(PdfDesigner)` works too.

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  PdfOfficeEditor,
  createDocument,
  createTextElement,
  exportDocumentJson,
  type PdfDocumentSchema,
} from 'vue-vuetify-pdf-designer'

const document = ref<PdfDocumentSchema>(
  createDocument({
    fonts: [{ family: 'Montserrat', weights: [400, 700] }],
    pages: [
      {
        id: 'page_1',
        elements: [
          createTextElement({
            id: 'title',
            xMm: 20,
            yMm: 40,
            widthMm: 170,
            heightMm: 20,
            content: { html: '<h1>Certificado para {{nombre}}</h1>' },
          }),
        ],
      },
    ],
  }),
)

function onExport(payload) {
  // Send payload.html to your PDF engine, or persist payload.json.
  console.log(payload.missingVariables)
}
</script>

<template>
  <PdfOfficeEditor
    v-model="document"
    :available-fonts="[{ family: 'Montserrat', weights: [400, 700] }]"
    :variables="{ nombre: 'Ana Pérez' }"
    title="Certificado"
    @export-pdf="onExport"
  />
</template>
```

The component is **controlled**: it never mutates `modelValue` in place. Every
change emits a brand-new document, so plain `v-model` or a store both work.

## Editing behaviour

- **Selecting is enough to format.** A single click selects a text box and enables
  the ribbon text controls; they apply the family, size, colour, highlight,
  weight, alignment or list to the whole box and persist `html` + `tiptapJson`.
  Double click enters edit mode, where the same controls act on the caret.
- **Effective values are shown.** When a box has no explicit mark, the ribbon
  displays what the page actually renders: the document's first font, `12pt` and
  `#000000`, instead of an empty field.
- **Rotation and opacity accept typed values.** The inspector pairs each slider
  with a numeric field — degrees (`-180…180`) and percent (`0…100`) — both clamped
  and both writing the same document value.
- **Every icon action explains itself.** Tooltips describe what each option does,
  including when the button is disabled; the accessible name comes from the same
  label.
- **`Escape` closes, it does not discard.** Inside a menu, colour picker or
  inspector field it only dismisses that control and keeps the element selected.
  On the canvas it ends edit mode and clears the selection.
- **Layers step one position per click.** Each row of the layers panel carries
  _Subir una capa_ / _Bajar una capa_; the button at the top or bottom of the
  stack is disabled. _Traer al frente_ / _Enviar al fondo_ live in the ribbon and
  in the context menu.
- **Right click opens a context menu.** Over an element it offers the layer steps,
  the jumps, duplicate, lock and delete; over empty page space it offers the four
  insert commands and _Ajustes de página_. Right-clicking an unselected element
  selects it first, `Escape` closes the menu without dropping the selection, and
  right-clicking inside a text box, a form field or an open overlay still shows
  the browser's own menu (paste and spellcheck).
- **Thumbnails follow the document.** A rail on the right shows a live miniature
  of every page with the active one highlighted; clicking a miniature focuses
  that page. It is the real page — same fonts, colours and rotations — rendered
  read-only, and the _Vista_ tab toggles it.

## Layout

The editor fills its container, so that container needs a definite height — and
it must **not** be rendered underneath a fixed app bar. The editor draws its own
ribbon at the top; if a host app bar overlaps it, the _Insertar_ tab cannot be
clicked and no element can be added. Inside `VApp`, use `VMain`, which reserves
the app-bar height:

```vue
<VApp>
  <VAppBar>…</VAppBar>
  <VMain class="editor-host">
    <PdfOfficeEditor v-model="doc" />
  </VMain>
</VApp>

<style scoped>
.editor-host {
  display: flex;
  flex-direction: column;
  height: 100vh; /* VMain pads itself by the app-bar height */
  min-height: 0;
}
.editor-host > * {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
```

Without `VMain`, offset the container yourself (`padding-top`/`margin-top` equal
to the app bar height). The page canvas scrolls inside the editor, so the page
around it should not: a document with a fixed `100vh` box avoids the double
scrollbar. In short containers the editor keeps a `480px` minimum height.

## Theming

The editor derives its whole palette from a small set of CSS custom properties
declared on `.pdf-office-editor`, so nested components inherit them. Override any
of them from your own stylesheet to match a brand without touching the library:

```css
.brand-workspace .pdf-office-editor {
  --pdf-accent: #0ea5e9;
  --pdf-canvas: #f4f6fb;
  --pdf-radius: 14px;
  --pdf-font: 'Inter', system-ui, sans-serif;
}
```

| Token                                       | Purpose                                                |
| ------------------------------------------- | ------------------------------------------------------ |
| `--pdf-accent`                              | Selection, active rows, focus and primary actions      |
| `--pdf-accent-soft` / `--pdf-accent-line`   | Tinted backgrounds and borders derived from the accent |
| `--pdf-surface` / `--pdf-surface-muted`     | Ribbon, sidebar and inspector surfaces                 |
| `--pdf-canvas` / `--pdf-canvas-deep`        | Workspace wash around the sheet                        |
| `--pdf-line` / `--pdf-line-strong`          | Hairlines, separators, field outlines                  |
| `--pdf-ink` / `--pdf-ink-muted`             | Primary and secondary text                             |
| `--pdf-radius` / `--pdf-radius-sm`          | Card and control rounding                              |
| `--pdf-shadow-sheet` / `--pdf-shadow-float` | Sheet elevation and floating pills                     |
| `--pdf-font`                                | UI typeface (document fonts stay per-element)          |

By default `--pdf-accent` follows the Vuetify theme (`rgb(var(--v-theme-primary))`),
and `--pdf-surface` follows `--v-theme-surface`. Under `.v-theme--dark` the editor
darkens its chrome automatically while keeping the paper white, because the print
output must not depend on the host theme. Neither the sheet nor the exported HTML
uses these tokens.

## Props

| Prop                                                           | Type                                                  | Default                             | Description                                                                                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `modelValue`                                                   | `PdfDocumentSchema`                                   | —                                   | The document to render. Required.                                                                                                     |
| `availableFonts`                                               | `Array<FontDescriptor \| string>`                     | `[]`                                | Families offered by the ribbon. `{ family, sourceUrl?, weights? }` loads a self-hosted `@font-face`; a plain name loads Google Fonts. |
| `readOnly`                                                     | `boolean`                                             | `false`                             | Hides the ribbon and blocks every mutation. Imported/loaded documents still render through the same page model.                       |
| `uploadImageHandler`                                           | `(file: File) => Promise<string> \| string`           | —                                   | Uploads the picked image and returns a URL. Without it, images are inlined as data URLs up to `maxInlineImageBytes`.                  |
| `variables`                                                    | `Record<string, string \| number \| boolean \| null>` | `{}`                                | Values for `{{campo}}` placeholders at export time.                                                                                   |
| `title`                                                        | `string`                                              | `'Document'`                        | Document title used by the HTML export and download filename.                                                                         |
| `initialZoom`                                                  | `number`                                              | `1`                                 | Initial zoom, clamped to `0.5`–`2`.                                                                                                   |
| `showRulers` / `showGrid` / `showMarginGuides` / `showPreview` | `boolean`                                             | `true` / `false` / `false` / `true` | Initial visibility of the view aids (all togglable in the _Vista_ tab). `showPreview` is the thumbnail rail.                          |
| `historyLimit`                                                 | `number`                                              | `100`                               | Maximum undo snapshots.                                                                                                               |
| `maxInlineImageBytes`                                          | `number`                                              | `2000000`                           | Size guard for inline base64 images. Above it, `upload-error` is emitted instead of bloating the JSON.                                |

## Emits

| Event               | Payload                        | When                                       |
| ------------------- | ------------------------------ | ------------------------------------------ |
| `update:modelValue` | `PdfDocumentSchema`            | Every document mutation.                   |
| `change`            | `PdfDocumentSchema`            | Same payload, for `@change` listeners.     |
| `export-pdf`        | `ExportPdfPayload`             | After calling `exportPdf()`.               |
| `upload-error`      | `(file: File, error: unknown)` | Image upload or inline-size guard failure. |

## Exposed methods

Access them through a template ref:

```ts
const editor = ref<InstanceType<typeof PdfOfficeEditor> | null>(null)
```

| Method                                                 | Description                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `exportPdf(format?: 'html' \| 'json')`                 | Builds and emits `export-pdf`; returns the payload.                       |
| `downloadHtml(filename?)`                              | Triggers a browser download of the standalone HTML.                       |
| `printPdf()`                                           | Opens the browser print dialog using the same HTML (client-side PDF).     |
| `insertText()` / `insertTable()` / `insertShape(kind)` | Inserts an element at the next cascading position.                        |
| `pickImage()`                                          | Opens the image file picker.                                              |
| `undo()` / `redo()`                                    | History control.                                                          |
| `addPage()`                                            | Appends an empty page and focuses it.                                     |
| `setZoom(value)`                                       | Sets zoom, clamped to `0.5`–`2`.                                          |
| `state`                                                | The full editor state (`useEditorState` shape) for advanced integrations. |

## Document schema

Everything is expressed in **millimetres relative to the top-left corner of its
page**, so the browser preview and the server-side PDF engine share one layout
model.

```ts
interface PdfDocumentSchema {
  version: string
  pageConfig: {
    size: 'A4' | 'LETTER' | 'LEGAL' | { widthMm: number; heightMm: number }
    orientation: 'portrait' | 'landscape'
    marginsMm: { top: number; right: number; bottom: number; left: number }
  }
  fonts: Array<{ family: string; sourceUrl?: string; weights?: number[] }>
  pages: Array<{ id: string; background?: string; elements: PdfCanvasElement[] }>
}

interface PdfCanvasElement {
  id: string
  type: 'text' | 'image' | 'shape' | 'table'
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  rotationDeg: number
  zIndex: number
  locked?: boolean
  name?: string
  style: {
    backgroundColor?: string
    borderColor?: string
    borderWidthPt?: number
    borderRadiusMm?: number
    opacity?: number
    paddingMm?: number
  }
  content: {
    html?: string
    tiptapJson?: object
    imageUrl?: string
    objectFit?: 'contain' | 'cover' | 'fill'
    alt?: string
    shape?: { kind: 'rect' | 'ellipse' | 'line' }
    table?: { rows: string[][]; headerRow?: boolean }
  }
}
```

Shape paint belongs to `style` (`backgroundColor`, `borderColor`,
`borderWidthPt`, `borderRadiusMm`), not to `content.shape`, which only carries the
geometry. Documents written before this change are migrated on load: the legacy
`content.shape.fill/stroke/strokeWidthPt/radiusMm` keys are copied into `style`
and removed, so a stored document keeps looking the same while a single source of
truth survives reloads and exports.

Stacking order **is the array order**: `zIndex` is renumbered `1..n` from the
array position, so any stored value is normalised on load.

Serialise with `exportDocumentJson(document)` and restore with
`parseDocumentJson(text)` (throws `DocumentParseError` with a readable message).
`normalizeDocument(input)` accepts untrusted JSON, fills defaults, dedupes ids
and clamps geometry inside the page.

## Exporting a PDF

### Option A — HTML/CSS print-ready (recommended)

`exportHtml(document, { title, variables })` returns a standalone HTML document
containing:

- `@page { size: <width>mm <height>mm; margin: 0 }`
- absolutely positioned elements in millimetres, with rotation, z-index, opacity,
  borders and `object-fit`
- the document's fonts (Google Fonts links and `@font-face` rules)

Send that HTML to any headless Chromium:

```ts
import { exportHtml } from 'vue-vuetify-pdf-designer'

const { html, missingVariables } = exportHtml(document, {
  title: 'Certificado',
  variables: { nombre: 'Ana Pérez' },
})

await page.setContent(html, { waitUntil: 'networkidle0' })
await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
```

Unknown `{{placeholders}}` are preserved in the output and reported once in
`missingVariables`, so a missing record never silently produces a blank field.
`collectPlaceholders(document)` lists every token used by a template.

### Option B — client-side printing

`printPdf()` renders the same HTML inside a hidden iframe and opens the browser
print dialog. The browser becomes the PDF engine; no server involved.

## Fonts

`useFontLoader` injects a Google Fonts stylesheet for `{ family }` and an
`@font-face` rule for `{ family, sourceUrl }`, then awaits `document.fonts.ready`.
The exported HTML reuses the exact same rules, so the PDF rasterises the glyphs
the user saw. Declare every custom family in `document.fonts` (or pass it via
`availableFonts`) — the editor cannot embed a font it was never given.

## Package formats

The build emits **ESM + CJS** and type declarations:

```
dist/vue-vuetify-pdf-designer.js    ESM
dist/vue-vuetify-pdf-designer.cjs   CommonJS
dist/vue-vuetify-pdf-designer.css   Component styles
dist/index.d.ts                     Types
```

**No UMD build on purpose.** Vue, Vuetify and TipTap stay external to avoid a
second ProseMirror instance, and ProseMirror ships no stable UMD global — a UMD
artifact would be a broken bundle. Use the ESM build with a bundler.

## Development

```bash
pnpm install
pnpm dev          # playground at http://localhost:5173
pnpm test         # vitest (unit + component mount tests)
pnpm type-check   # vue-tsc --build
pnpm build        # type-check + library build
```

The playground (`playground/`) imports the source directly and exercises the
ribbon, canvas, layers panel, JSON view, HTML download and print.

## License

MIT

# text-editor-component

Componente para diseño de documento dentro de una app de vue
