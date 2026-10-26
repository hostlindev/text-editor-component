# PDF Office Designer — Vue 3 + Vuetify 3 library

Objective: ship a reusable, publishable library that renders an Office-like PDF design surface (rich text, free positioning, physical page units) and exports the design as a PDF-ready JSON + print-ready HTML.
Branch: `feat/pdf-office-designer` · Delivery: `single-pr` (authorized feature, ~1 release) · Test runner: `vitest` (`pnpm test`).

## Specs

- **S1 — Library packaging.** Vite library mode + TypeScript emits ESM and type declarations; `vue` and `vuetify` are declared as `peerDependencies` and kept external in `rollupOptions.external` ("no duplicar su peso"). Entry: `src/index.ts` exporting the plugin (`install`) and the components. Dev harness lives in `playground/`, importing the library locally.
- **S2 — Public API.** `PdfOfficeEditor.vue` props: `modelValue` (document JSON), `availableFonts`, `readOnly`, `uploadImageHandler` ("hook o prop (onImageUpload)"). Emits: `update:modelValue`, `export-pdf`, `change`. The component works controlled: it never mutates `modelValue` in place; every change emits a new document.
- **S3 — Units.** Internal truth is millimetres ("el lienzo trabaja internamente en unidades físicas (mm, ej. A4 = 210mm x 297mm)"). Screen conversion at 96 DPI: `1 mm = 3.7795 px`, multiplied by zoom (`0.5x` to `2.0x`). Exact constants: `96 / 25.4 = 3.7795275591` px/mm, `72 / 25.4` pt/mm. The same module converts mm↔px↔pt and returns page width/height honouring `orientation`.
- **S4 — Page sizes.** `pageConfig.size` accepts `'A4' | 'LETTER' | 'LEGAL' | { widthMm, heightMm }`; `orientation` `'portrait' | 'landscape'`; `marginsMm` `{ top, right, bottom, left }`. A4 = 210×297 mm, LETTER = 215.9×279.4 mm, LEGAL = 215.9×355.6 mm. Landscape swaps width/height.
- **S5 — Schema contract.** Exact interfaces `PdfDocumentSchema` (`version`, `pageConfig`, `fonts`, `pages`) and `PdfCanvasElement` (`id`, `type: 'text' | 'image' | 'shape' | 'table'`, `xMm`, `yMm`, `widthMm`, `heightMm`, `rotationDeg`, `zIndex`, `locked?`, `style`, `content`) as declared by the user, with element positions "en milímetros respecto a la esquina superior izquierda de la página". Document normalisation fills defaults, unique ids, sequential `zIndex` and clamps elements inside the page.
- **S6 — Canvas.** Grey workspace with Word-style page shadows, one sheet per page, optional millimetre/centimetre rulers (top and left), optional magnetic grid, zoom control (0.5x–2x plus fit-width), add / duplicate / delete page.
- **S7 — Free positioning.** Elements drag and resize inside page bounds. 8 resize handles (corners + edges) plus 1 rotation handle. `Shift` locks aspect ratio while resizing. Dragging is blocked while `locked` or `readOnly`. Deleting the selection with `Delete`/`Backspace` and duplicating with `Ctrl+D`.
- **S8 — Smart guides.** Magnetic snapping to page centre, page edges, margins and the edges/centres of sibling elements; the active alignment guides are drawn on the page.
- **S9 — Layers.** `zIndex` controls: bring to front, send to back, forward, backward, plus a layers panel listing elements of the current page with selection and ordering.
- **S10 — Rich text.** Double click enters text edit mode and temporarily disables dragging ("deshabilitando temporalmente el arrastre"). TipTap extensions: `TextStyle`, `FontFamily`, `Color`, `Highlight`, `TextAlign`, `Underline`, `Subscript`, `Superscript` and a custom `FontSize` in points. Content is stored as `html` and `tiptapJson`; the element height grows over its content and never clips silently.
- **S11 — Fonts.** `useFontLoader` injects Google Fonts stylesheets and local `@font-face` rules for `{ family, sourceUrl }` and waits for `document.fonts.ready`, so the selector and the exported PDF share the same fonts.
- **S12 — Images.** Insert via file picker, desktop drag & drop and clipboard paste. `uploadImageHandler` may upload and return a URL; otherwise the file is inlined as a data URL (with a documented size guard). Adjust modes `contain | cover | fill`, opacity and border radius.
- **S13 — Shapes.** `shape` elements render rectangle, ellipse or line with fill/border from `style`.
- **S14 — Ribbon.** Vuetify tabs `Inicio`, `Insertar`, `Diseño de Página`, `Vista` (`v-tabs`/`v-toolbar`). Formatting controls reflect the selection immediately ("si el usuario selecciona un texto con fuente Montserrat 14pt, los v-select de la barra deben reflejarlo de inmediato") and apply commands to the active TipTap editor.
- **S15 — History.** Debounced snapshots of the document JSON, `Ctrl+Z` / `Ctrl+Y` (and `Ctrl+Shift+Z`), bounded stack, exposed `canUndo`/`canRedo` state driving the ribbon buttons.
- **S16 — Placeholders.** Insert `{{campo}}` tokens; export replaces them from a `variables` record when provided, leaving unknown tokens untouched and reporting them.
- **S17 — JSON exporter.** `exportDocumentJson(doc)` serialises the normalised schema for backend persistence; `parseDocumentJson(text)` validates and rejects malformed input with readable errors.
- **S18 — HTML print exporter.** `exportHtml(doc)` produces a standalone HTML document with `@page` size/orientation/margins and absolute positioning in mm — "ideal para enviarlo a Puppeteer / Playwright / Gotenberg / WeasyPrint". Includes the document fonts. `export-pdf` emits `{ format: 'html' | 'json', html?, json?, variables, missingVariables }`.
- **S19 — Zero global side effects.** The library does not import `vuetify/styles` nor register global components by default; `install` only registers `PdfOfficeEditor`. Vuetify components are imported explicitly per SFC so consumers keep tree-shaking and their own theme.
- **S20 — Docs.** `README.md` documents install, peer deps, props/emits, schema, server-side PDF pipeline and the playground commands.
- **S21 — One paint source.** Shape fill, border, border width and radius live in `ElementStyle` only; `content.shape` keeps the geometry (`rect | ellipse | line`). `normalizeDocument` migrates the legacy `content.shape.fill/stroke/strokeWidthPt/radiusMm` into `style` and drops the legacy keys, idempotently, so an explicit "Sin fondo" survives a reload. A legacy outline disabled by `stroke: 'transparent'` or `strokeWidthPt: 0` migrates to *no border*, never to a 1pt default. The canvas renderer and the HTML print exporter read the same `style`.
- **S22 — Formatting without edit mode.** Selecting a text box (single click, not editing) enables the ribbon text controls and applies family, size, colour, highlight, weight, alignment and lists to the whole box, persisting `html` + `tiptapJson`. The controls show the *effective* values — the document font for an unformatted box, `12pt` for an unformatted size, `#000000` for colour — instead of an empty field.
- **S23 — Typed numeric values.** Rotation and opacity expose a numeric field next to the slider; rotation accepts `-180…180` degrees and opacity `0…100` percent, both clamped, with the field and the slider sharing one document value.
- **S24 — Option discoverability.** Every icon-only action carries an accessible name and a tooltip explaining what the option does, including when the button is disabled.
- **S25 — Escape semantics.** `Escape` inside an open menu, colour picker or inspector field only closes that control and keeps the element selected *and* the edit session alive; `Escape` on the canvas ends edit mode and clears the selection.

- **S26 — One-click layer stepping.** Every row of the layers list exposes "Subir una capa" and "Bajar una capa": one click moves that element exactly one position in the stack (`bringForward` / `sendBackward`), through the document history. The button that cannot move any further (already topmost / bottommost) is disabled, and both are disabled in read-only. "Traer al frente" and "Enviar al fondo" stay available in the ribbon and in the context menu, so the row keeps four actions.

- **S27 — Context menu.** Right-clicking an element opens a menu with "Subir una capa", "Bajar una capa", "Traer al frente", "Enviar al fondo", "Duplicar", "Bloquear/Desbloquear" and "Eliminar". Right-clicking empty page space or the canvas around it opens "Insertar texto/imagen/tabla/forma" plus "Ajustes de página". Right-clicking an element that is not selected selects it first; right-clicking a page that is not active focuses it. Right-click inside a text editor, a form field or an open overlay leaves the browser's own menu untouched (paste and spellcheck depend on it). `Escape` and an outside click close the menu without clearing the selection, and every command goes through the document history.

- **S28 — Thumbnail preview.** A rail on the right of the page shows a live miniature of every page — the real sheet scaled down, read-only, no handles or guides — with the active page highlighted; clicking a miniature focuses that page. The rail is on by default and the "Vista" tab toggles it with "Miniaturas". Narrow windows must not gain a horizontal page scroll because of it.

## Tasks

| ID | Spec | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| T1 | S1, S19, S20 (structure) | inline | done | lib build config + playground wired; `pnpm build` emits ESM/CJS/CSS/d.ts |
| T2 | S3, S4, S5 | inline | done | `useUnitConverter.spec` (13), `editor.spec` (13) |
| T3 | S15, S16, S17, S18 | inline | done | `useHistory.spec` (10), `jsonSchemaExporter.spec` (8), `htmlPrintExporter.spec` (14) |
| T4 | S6, S7, S8 | inline | done | `useSnapping.spec` (10) + `FreeElementWrapper`/`DocumentPage` implemented |
| T5 | S10, S11, S13, S12 | inline | done | TipTap bridge (`shallowRef<Editor>`), `useFontLoader.spec` (7), image/shape/table elements |
| T6 | S9, S14 | inline | done | `LayersPanel` (z-order + properties), `EditorRibbon` 4 tabs |
| T7 | S2, S19 | inline | done | `PdfOfficeEditor.spec` mount suite (6); plugin install |
| T8 | S20 | inline | done | `README.md` rewritten (install, API, schema, PDF pipeline, deviation note) |
| T9 | S21 | inline | done | `editor.spec` paint migration (5, incl. `strokeWidthPt: 0`), shape render test, exporter fixture; CDP shape fill/border |
| T10 | S22, S25 | inline | done | `useEditorState.spec` text formatting (6), `PdfOfficeEditor.spec` font/escape/edit-mode (4); CDP family/size/colour |
| T11 | S23, S24 | inline | done | `PdfOfficeEditor.spec` typed clamp + tooltip activators (3, incl. zoom pill); CDP typed 45/40/500/150, ribbon hover, zoom pill 36/62/36 `34px` buttons |
| T12 | S26 | inline | done | `PdfOfficeEditor.spec` row buttons + boundary disable; CDP 6 layers, one click = one z step up and back, ends disabled at top/bottom |
| T13 | S27 | inline | done | `PdfOfficeEditor.spec` element/page menu + duplicate through the menu + native menu kept in fields; CDP menu at pointer, Escape keeps selection, 7/7 items disabled in read-only |
| T14 | S28 | inline | done | `PdfOfficeEditor.spec` miniatures/active/focus + rail switch; CDP rail 166px between canvas and inspector, real content, follows stacking, grows to 2 pages, 3 viewports without page scroll |

Final verification: `pnpm test` → 10 files / 121 tests passed; `pnpm type-check` → exit 0;
`pnpm build` → exit 0, `dist/vue-vuetify-pdf-designer.js` 92.44 kB, `.cjs` 82.58 kB, CSS 8.06 kB,
types in `dist/index.d.ts`; no `MIXED_EXPORTS` warning after setting `output.exports: 'named'`.
Browser verification (Edge headless over CDP, `pnpm dev`): insert → edit → type → delete → insert →
delete all → insert all work with no console errors.

## Log

**L1 (user request, verbatim excerpt).** "Vamos a desarrollar esto: Plan de Desarrollo: Librería de Editor de Diseño PDF Estilo Office para Vue 3 + Vuetify 3 … El objetivo del componente es ofrecer un entorno de diseño visual (estilo Microsoft Word / Publisher) donde los usuarios puedan redactar texto enriquecido, cambiar tipografías y posicionar libremente cajas de texto e imágenes sobre páginas con medidas físicas reales para su posterior generación en PDF."

**L2 — Workspace baseline.** `D:\Workspace\component-editor-text\text-editor` is a fresh `create-vue` scaffold: no git repo, no Vuetify, no TipTap, `src/` only holds `App.vue` + `main.ts`.

**L3 — Deviations from the plan, with reasons.**
1. `vuetify` resolved to 4.x on install; pinned back to `^3` because the requirement is Vuetify 3 (S1). Installed 3.13.7.
2. `vite-plugin-vuetify` with `autoImport: true` is *not* used. For a published library, auto-import rewrites component imports at build time and injects Vuetify styles into the consumer's CSS bundle, coupling the artifact to the plugin. Explicit per-SFC component imports keep the contract explicit, tree-shakeable and plugin-free (S19). Vuetify CSS stays the consumer's responsibility (`vuetify/styles`).
3. Distribution formats are `es` + `cjs`, not UMD. Externalising `@tiptap/*` is mandatory to avoid a second ProseMirror instance, and ProseMirror ships no stable UMD global, so a UMD build would be a broken artifact. Documented in README; a tiptap-bundled UMD build can be added on request.
4. `src/types/editor.ts` instead of `editor.d.ts`: the file ships runtime constants (page sizes, schema version) next to the interfaces.
5. Icon font `@mdi/font` is a dev/peer dependency used by the playground; the library itself never imports it.
6. `src/utils/deepClone.ts` centralises snapshot cloning. `structuredClone` is tried first but wrapped in try/catch because happy-dom's implementation throws `DataCloneError` on plain objects; the JSON round-trip is the documented fallback.
7. Vitest inlines `vuetify` (`test.server.deps.inline`): Vuetify 3 ships per-component `.css` imports that Node cannot load as modules, so mount tests fail without it.
8. Package default export is the **plugin** (`VueVuetifyPdfDesigner`), with `PdfOfficeEditor` as a named export. Rollup `output.exports: 'named'` keeps the CJS build unambiguous (`require(pkg).default` is the plugin) and removes the `MIXED_EXPORTS` warning.
9. `RichTextElement` holds the TipTap instance in `shallowRef`; a deep `ref` unwraps the `Editor` class into a plain object and breaks its typing/identity.

**L4 — Verification boundary.** Every claim above is verified by unit/mount tests, `vue-tsc` and a real library build. No browser or headless-PDF run was performed (Playwright/Puppeteer are not installed), so visual fidelity of the canvas and the `@page` output on a real print engine remain unverified. `require()` of the CJS artifact in bare Node fails on Vuetify's `.css` imports, which is expected: the package is meant to be consumed through a bundler.

**L5 (user report, verbatim).** "Ok, los elemento de la barra de tareas tienen buen responsive en la version desktop. Adicional una vez que se eliminan elementos no se puede agregar ningun elemento mas. Añade ese feature"

**L6 — Root cause of L5 (reproduced in Edge, not in happy-dom).** The editor reloaded its own document on every change. `PdfOfficeEditor` guards the `modelValue` watcher with `value === lastEmitted`, but the host stores the emitted document in a `ref` and Vue reads props through a reactive proxy, so the proxy never equals the raw emitted object. `loadDocument` then ran after every mutation and reset `selectedId`, `editingId` and the undo stack. Symptom: inserting a text box worked but the box was immediately deselected and left edit mode, so typing did nothing and the ribbon's delete button stayed disabled — the insert looked like it had not happened. Nobody could add anything *usable* after deleting.

Fix:
1. `PdfOfficeEditor` compares `toRaw(value) === toRaw(lastEmitted)`, so an echoed emission is ignored while a genuinely new document still loads.
2. `loadDocument` keeps the selection and the editing session when those element ids still exist after normalization, protecting hosts that store a copy of the document.
3. `isTypingTarget` guards `closest` (keydown can originate from `document`/`window`, which have no `closest`; it threw an uncaught `TypeError`).
4. `FreeElementWrapper` wraps `setPointerCapture` in `capturePointer`: Edge throws `NotFoundError` for an inactive pointer and that exception aborted the gesture before `preventDefault()`.

Evidence: new mount tests with a `v-model` host (`PdfOfficeEditor.spec.ts`) failed before the fix (selection `null`, `editingId` `null`, undo did not revert) and pass after it; full suite 10 files / 121 tests; Edge CDP run of insert → type → delete → insert → delete all → insert with zero console errors.

**L7 (user report, verbatim).** "Lo que pasa es el que el app-bar tapa la barra de tareas. Y no ninguna forma de agregar un nuevo elemento."

**L8 — Root cause of L7: playground layout, not the editor.** The playground rendered `<PdfOfficeEditor>` in a plain `div` sized `calc(100vh - 64px)` next to a `VAppBar` that is fixed and 56px tall. Measured in Edge: app bar occupied 0–56 and the ribbon started at 0, so the tabs row (0–36) was fully covered; `document.elementFromPoint` at the "Insertar" tab centre returned the app bar's chip and a real mouse click did not switch tabs. The earlier CDP checks missed it because `.click()` calls the handler without hit-testing.

Fix (playground + docs):
1. The editor now lives in `VMain`, which reserves the app-bar height (tabs start at 56).
2. `.playground` gets `height: 100vh` + `min-height: 0` and the editor `flex: 1 1 auto; min-height: 0`; without a definite height the A4 sheet's 1123px pushed the page into a scrollbar (`scrollHeight` 1368 vs `clientHeight` 807, now 807/807).
3. README gained a "Layout" section stating the requirement, because the same mistake is easy in a consumer app.

Verification: Edge CDP with real `Input.dispatchMouseEvent` clicks — `hitIsTab: true`, `pageScrolls: false`, click *Insertar* → `activeTab: "Insertar"`, click *Cuadro de texto* → 7 elements in edit mode, typing lands (`<p>Prueba real</p>`), Delete → 6, insert again → 7 and typeable (`<p>Despues de borrar</p>`), zero console exceptions.

**L9 (user report, verbatim).** "Al insertar un cuadroi de texto y escribir el texto desaparece."

**L10 — Root cause of L9: the element component's `update` emit had no listener.** `DocumentPage.vue` rendered each element with `<component :is="elementComponent(element)" v-bind="childProps(element)" />`. `RichTextElement` reports every TipTap change through `emit('update', { content: { html, tiptapJson }, heightMm })`, but only `FreeElementWrapper` (the drag/resize wrapper) had an `@update` listener. Vue does not forward a slot child's emits to the parent component's listeners, so the payload was dropped: the editor DOM showed `<p>Hola</p>` while the document kept the creation default `<p></p>`. The stale html then rendered the box empty as soon as editing stopped.

The bug was invisible to the earlier verification because that run inserted the text with a single `Input.insertText` and snapshotted the *editor* DOM, never the persisted document and never the state after leaving edit mode. A new `PdfOfficeEditor.spec.ts` case now emits `update` from the mounted `RichTextElement` and asserts the persisted `content.html`, the reported `heightMm`, and the rendered text after `stopEditing()` — it failed with `expected '<p></p>' to be '<p>Hola</p>'` before the fix.

Fix:
1. `DocumentPage.vue` binds `@update="(patch: ElementPatch) => onElementUpdate(element, patch)"` on the dynamic element component, next to the existing `v-bind`. Only `RichTextElement` and `FreeElementWrapper` emit `update`, so the two listeners never collide.
2. `onElementUpdate` delegates to `state.updateElement`, which already merges `content` and geometry and pushes a debounced history snapshot (300 ms), so a typing burst is one undo step.

Verification: Edge CDP typing character by character with `Input.dispatchKeyEvent` — `<p>Hola</p>` while editing, then after Escape the static box shows `Hola`, the exported JSON has `content.html: "<p>Hola</p>"` and a non-empty `tiptapJson`; 40-character sentence with spaces persists intact (`<p>Certificado emitido para Ana Perez en octubre de 2026</p>`); delete + insert again + type `Otra vez` persists the same way; `pageScrolls: false`; zero console exceptions. `pnpm test` 122/122, `pnpm type-check` 0, `pnpm build` 0.



**L11 (user request, verbatim).** "Ok, ahora necesito que agregues el diseño. Mejora el diseño para que se vea profesional, con interfaz bastante moderna, utiliza css si es necesario."

**L12 - Design pass: token-driven chrome, no behavior change.** The editor looked like an unstyled Vuetify form: flat grey canvas, default-density toolbar, raw inputs in the sidebar. The redesign was done with CSS plus small markup changes, and it deliberately did not touch the ribbon's responsive behavior (user had already accepted desktop responsive behavior in L5).

Approach:
1. **Tokens first.** `PdfOfficeEditor.vue` declares the palette on `.pdf-office-editor` (`--pdf-accent`, `--pdf-accent-soft`, `--pdf-accent-line`, `--pdf-surface`, `--pdf-surface-muted`, `--pdf-canvas`, `--pdf-canvas-deep`, `--pdf-line`, `--pdf-line-strong`, `--pdf-ink`, `--pdf-ink-muted`, `--pdf-radius`, `--pdf-radius-sm`, `--pdf-shadow-sheet`, `--pdf-shadow-float`, `--pdf-font`). Every child inherits them, so a host customizes the whole editor from one rule. The accent derives from `rgb(var(--v-theme-primary))` with `color-mix()` tints; `.v-theme--dark .pdf-office-editor` re-declares only the chrome tokens, keeping the paper white because print output must not follow the host theme.
2. **Ribbon.** Tabs row on its own surface, grouped command clusters separated by hairlines instead of `VDivider` components, compact 32px tool buttons, a page-count pill pushed to the right, uppercase micro-labels for the layout selects, and bordered insert tiles with accent icons so "Insertar" reads as the primary action. The `__group--push` needs a compound selector to beat the `+ .editor-ribbon__group` separator rule.
3. **Canvas.** Light-table wash plus a dotted grid, refined rulers, page labels as pills, a floating rounded zoom pill, thin custom scrollbars, and a tokenized sheet shadow/active ring.
4. **Inspector.** Layer rows as cards (`rounded="lg"`), uppercase section labels, per-group inspector cards, value chips for rotation/opacity, and one scroll container instead of a nested list scroller.
5. **Playground.** Gradient brand mark, 60px app bar, dialog cards with monospace code panes, theme primary `#4f46e5`.

Bugs found while redesigning (reported rather than assumed):
1. `mdi-page-portrait` and `mdi-page-landscape` **do not exist** in MDI, so the orientation toggle rendered two empty buttons. Replaced with `mdi-crop-portrait`/`mdi-crop-landscape`; the rendered `::before` glyphs were read back over CDP to confirm.
2. `VListItem` sets `rounded-0` (`border-radius: 0 !important`), which overrode the scoped row radius; fixed with the `rounded="lg"` prop (measured radius 8px, accent-soft background, accent border).
3. Disabled `VTextField`s were faded twice (Vuetify input 0.87 x custom 0.55), so the font fields looked broken on first load. The blanket opacity was removed and the outline/hint contrast is now set explicitly (measured field opacity 1, input 0.87).
4. The sidebar had two nested scrollbars (list `max-height` + panel); the list now flows and the panel owns the single scrollbar (`listScrolls: false`, `panelScrolls: true`).
5. Dark theme exposed three hardcoded light-only colors (ruler tick borders, canvas dot pattern, canvas top gradient mixed with `#ffffff`); all three now use tokens, and the dark canvas renders as one uniform tone.
6. Replacing `label` with `placeholder` on the font selects removed their accessible name (a regression introduced by this pass). Both now carry `aria-label`; verified over CDP that the real `combobox` input reports `aria-label` "Fuente"/"Tamaño".

Evidence (Edge CDP, real `Input.dispatchMouseEvent`, dev server `localhost:5201`): tab switching works by hit-test, orientation glyphs resolve, page pill gap 12px, sheet shadow/accent ring applied, sidebar 296px, canvas background gradient present, zero console exceptions, `pageScrolls: false`. Functional regression after the markup change: *Insertar* -> *Cuadro de texto* -> type `Hola` -> Escape -> static box shows `Hola` and JSON keeps `<p>Hola</p>`. Dark check: forced `v-theme--dark` gives canvas `#10141c`, ink `#e6e9f2`, sheet `rgb(255,255,255)`.

`pnpm test` 122/122 (10 files), `pnpm type-check` 0, `pnpm build` 0; library CSS 8.06 kB -> 18.44 kB (gzip 3.81 kB). README gained a "Theming" section documenting the tokens and the dark behavior.

**L13 (user request, verbatim).** "Ok, tengo algunas mejoras que agregar. Al seleccionar un objeto no se esta cambian color del fondo, corrigelo. Tampoc se aplica la el estilo del borde. Para la rotación y la opacidad que tambien se pueda escribir directamente el valor y no solamente se realiza moviendo la barra. Al seleccionar un text, la fuente y el tamaño no se muestra seleccionado, realiza el ajuste. La opcion para cambiar el color de texto tampoco esta cambiando el color. Necesito que para esas opciones se especifique para que sirve cada opción con un icono tal vez. Sería buena que para cada opción se muestre un tooltip que indique para que funciona la opción."

**L14 — Root causes of L13, each reproduced in Edge before the fix.**

1. **Shape paint had two homes.** `ShapeElement.vue` and `renderShape` preferred `content.shape.fill/stroke/strokeWidthPt`, but the inspector writes `ElementStyle`. A shape created with the factory default `stroke: 'transparent'` therefore ignored every background the user picked, and the legacy keys won over `style` forever. Fix: paint lives in `ElementStyle` (S21); `normalizeDocument` migrates the legacy keys through `migrateShapePaint` and deletes them, so the choice is stable and idempotent. `ShapeElement` and the exporter now read `style` only, with `geometryDeclarations`/`paintDeclarations` sharing the export path.
2. **The ribbon only worked inside edit mode.** `activeTextState` returned `null` whenever no TipTap instance was focused, so a merely selected text box showed empty, disabled font fields and every command was a no-op. Fix: `formatText` routes to the live editor when editing, otherwise to one detached probe editor built from the *same* `createTextExtensions()` factory (`textExtensions.ts` moved to `composables/` so there is a single rule set), then persists `html` + `tiptapJson` through `updateElement`. `activeTextState` reads the selected element when idle and falls back to the document font, `12pt` and `#000000`, which are the values the page actually renders.
3. **The base font did not match the document.** The page inherited the chrome UI font. `PdfOfficeEditor` now publishes `--pdf-doc-font` from the first declared font and `.pdf-rt` consumes it; the static view also declares `font-size: 12pt` so it matches the editing view and the print exporter instead of relying on the browser default.
4. **Rotation and opacity were slider-only.** Both now have a numeric twin (`data-testid="rotation-input"` / `"opacity-input"`), clamped to `-180…180` and `0…100`, sharing the document value with the slider; the field speaks percent while the document stores `0…1`.
5. **`Escape` threw away the selection.** The window listener cleared `selectedId` unconditionally, and closing a colour picker fires `Escape` too, so the inspector collapsed mid-task. The overlay context is captured in the capture phase (`escapeDismissesOverlay`) because Vuetify closes the overlay first on `document`; now `Escape` inside a menu, picker or field only dismisses it (S25).
6. **The font fallback claimed the wrong family.** The ribbon fell back to `fonts[0]`, and the list started with the hardcoded defaults (`Inter`) while the document declared `Montserrat`; the field disagreed with the rendered page. Declared fonts now come first, so the fallback equals `--pdf-doc-font`.

Option discoverability (S24) is one shared `IconAction.vue`: a `VTooltip` around a `span` activator, because a disabled `VBtn` swallows pointer events and its tooltip would never appear. Tooltips also cover the layers panel actions and the style buttons, and `aria-label` keeps the accessible name.

Evidence: 13 new/updated assertions failed first (`editor.spec` paint migration, `useEditorState.spec` text formatting, `PdfOfficeEditor.spec` shape paint, typed inputs, tooltip activator, escape, font fallback) and now pass; full suite 10 files / **138 tests**, `pnpm type-check` 0, `pnpm build-only` 0 (CSS 18.79 kB / gzip 3.87 kB). Edge CDP run against `localhost:5201` at 1680x1400: fill pick `rgb(21,101,192) -> rgb(44,50,56)`, border `4px solid rgb(209,46,46)`, selected text shows `Montserrat`/`12`, choosing `Lora` writes `font-family: Lora`, size `20` writes `font-size: 20pt`, colour writes `rgb(199,44,44)`, typed `45` gives `matrix(0.707107, …)`, typed `40` gives `opacity 0.4`, `500`/`150` clamp to `180`/`100`, tooltips `"Deshacer: revierte el último cambio"` (disabled) and `"Negrita: aplica o quita el peso fuerte al texto"`. Ribbon layout unchanged where it was accepted (94px tall at 1680/1440/1280, wrapping to 132px at 1024, no horizontal page scroll).

**L15 — Independent verification of L13/L14: one blocker and four advisories fixed.**

An independent read-only verifier re-ran the suites and wrote its own probe specs against a scratch copy of the tree (no git repo here, so the working tree *is* the candidate). Verdicts: S21 **not satisfied**, S22/S23/S24 satisfied, S25 satisfied with an edit-mode caveat. Each finding below got a failing test first, except the two render-only ones.

1. **Blocker (S21): a legacy outline of zero width came back as 1pt.** `migrateShapePaint` only checked `stroke !== 'transparent'`, so `content.shape: { stroke: '#445566', strokeWidthPt: 0 }` — the old way of saying "no border" — migrated into `borderColor` plus the 1pt default. RED: `editor.spec` "drops a zero-width legacy stroke instead of inventing a 1pt border" (`expected { backgroundColor: '#e0e0e0', …(2) }`, i.e. two extra style keys). Fix: one predicate, `hasLegacyStroke(shape)`, used by both `createShapeElement` and `migrateShapePaint`; `strokeWidthPt: 0` means no border, `undefined` keeps the historical 1pt so documents that relied on that default still look the same. Explicit `style` still wins.
2. **Advisory (S25): `Escape` left edit mode when it only dismissed a picker.** The old branch called `state.stopEditing()` before consulting `escapeDismissesOverlay`, so closing a colour menu while editing also ended the edit session. RED: `PdfOfficeEditor.spec` "keeps the text box in edit mode when Escape only closes an overlay" (`null` vs `'t1'`). Fix: the overlay case returns before `stopEditing()`; a second `Escape`, this time on the canvas, performs the deselect.
3. **Advisory (S24): the zoom pill had no tooltips.** `PageViewport` now wraps each of the three buttons (minus, percentage, plus) in a `VTooltip` whose activator is a `span.pdf-viewport__zoom-slot` — the same reason `IconAction` needs a box: `.v-btn--disabled { pointer-events: none }`, so a tooltip attached to the button itself never opens at 0.5x/2x. The `title` on the percentage button was replaced by an `aria-label` + tooltip. Pin: `PdfOfficeEditor.spec` "gives the zoom controls an activator box…".
4. **Found while probing the pill: the declared button height never applied.** `VBtnGroup` calls `provideDefaults({ VBtn: { height: 'auto' } })` for horizontal groups, which lands as an **inline** `height: auto` on every descendant button; the stylesheet's `height: 34px` therefore lost the cascade and the buttons rendered 18px/16px inside a 40px pill. Measured in Edge before/after. Fix: each zoom button passes its own `height="34"` (an explicit child prop beats the injected default) and the scoped `min-width` now targets `.v-btn--icon` only, so the percentage button keeps its declared `62px` instead of being clamped to 36px by the same rule. Pill: 136x40 with contiguous 36/62/36 × 34px buttons.
5. **Advisory: two icon names do not exist in MDI.** `PageSetupDialog` used `mdi-page-portrait`/`mdi-page-landscape`; swapped to `mdi-crop-portrait`/`mdi-crop-landscape`.

Evidence after the fixes: `pnpm lint` 0, `pnpm test` 10 files / **141 tests**, `pnpm type-check` 0, `pnpm build-only` 0 (CSS 18.92 kB / gzip 3.89 kB). Edge CDP at 1680x1400 against a restarted dev server: formatting probe **15/15**, zoom probe **5/5** (pill geometry, `Alejar` disabled at 50%, its tooltip rendered above the pill, fit-to-width tooltip), layout probe **4/4** (ribbon 94/94/94/132px, no rails or page scroll, 14 ribbon icon actions), console **0** entries after hovering every tooltip and dismissing a picker. Scratch copies, probe scripts, the dev server and the headless browser were removed afterwards.

**L16 (user report, verbatim).** "Esta perfecto, pero desaparecieron la mayoria de los iconos de la barra de tareas"

**L16 — Root cause: `VBtn` ignores its `icon` prop when it receives a default slot.** `IconAction.vue` (introduced in L14 for S24) always renders `<slot />` inside its `VBtn` so callers could overlay a swatch. Vuetify renders the icon only in the `!slots.default` branch:

```js
[!slots.default && hasIcon ? h(VIcon, { icon: props.icon }) : h(VDefaultsProvider, … , { default: () => [slots.default?.() ?? text] })]
```

Because the slot function always exists, every icon action took the second branch and rendered an empty `.v-btn__content` — while still carrying `v-btn--icon` (the class comes from `!!props.icon`, not from the rendered output), so the buttons looked right-sized and kept their labels and tooltips. The only icons left were the two `VSelect` dropdown arrows. Measured in Edge before the fix: **21 `.icon-action`, 25 `.v-btn`, exactly 2 `.v-icon`** in the ribbon; the two swatch buttons still showed their swatch, which is why the loss read as "most of the icons".

Fix: `IconAction` now renders `<VIcon :icon="icon" />` itself, before the caller's slot, and keeps `:icon` on `VBtn` for the square `v-btn--icon` shape. Inline comment explains why the glyph is explicit.

Why it slipped: the L14/L15 probes asserted accessible names, tooltip text and ribbon heights — never that an icon node existed, and hit-testing a labelled button passes whether or not it draws a glyph. RED now pins it: `PdfOfficeEditor.spec` "renders the glyph of an icon-only action" asserts a `.v-icon` with the `mdi-undo` class inside the undo action and both a glyph and the swatch inside the colour action (failed with `expected false to be true`, passes now).

Evidence: `pnpm lint` 0, `pnpm test` 10 files / **142 tests**, `pnpm type-check` 0, `pnpm build-only` 0 (CSS 18.92 kB / gzip 3.89 kB). Edge CDP: **21/21** ribbon icon actions contain a `.v-icon` whose `::before` is a Material Design private-use codepoint (undo `U+F054C`, redo `U+F044E`, bold `U+F0264`, all 19px, zero missing), tooltips still open on disabled and enabled actions, fill repaint, selection kept after `Escape`, `Lora` applied, typed rotation `matrix(…)`, ribbon 94px with no page scroll, 0 console entries, and the ribbon screenshot reviewed by eye.

**L17 (user request, verbatim).** "Quiero que agregues al menu de capas la capacidad de poder subir el elemento y bajar el elemento por medio de un clic. Adicional agregar un menu de la interfaz por medio de clic derecho. Tambien quiero que agregue un vista previa en miniatura a lado derecho de la página."

**L17 — Scope.** Three additions tracked as S26 (one-click layer stepping), S27 (context menu) and S28 (thumbnail rail). Design decisions taken here:
1. **Step vs jump.** `reorder()` in `useEditorState` already implemented `forward`/`backward` but only `bringToFront`/`sendToBack` were exposed in the UI. The layer row now carries the two step buttons; the jump-to-front/back commands stay in the ribbon and move into the context menu, so the row keeps four actions in a 296px sidebar instead of growing to six.
2. **Context menu source.** One `contextmenu` listener on the viewport root resolves the target from the DOM (`[data-element-id]`, `.pdf-sheet`, otherwise canvas) instead of threading emits through `PageViewport → DocumentPage → FreeElementWrapper`. It returns early, without `preventDefault`, for `input`, `textarea`, `[contenteditable="true"]` and open overlays: paste and spellcheck in a text box depend on the browser's own menu.
3. **Thumbnails are scaled sheets, not `DocumentPage` copies.** `DocumentPage` reads the global zoom and the active-page overlays (grid, margins, guides, selection handles), so reusing it would paint editor chrome inside a miniature. `PageThumbnail` renders the same element components at 96 DPI inside a `transform: scale()` wrapper: text is authored in `pt`, which is an absolute CSS unit, so only a transform keeps the miniature proportional to the sheet.
4. **Rail toggle.** Visibility is an internal `showPreview` ref (default on) exposed through the "Vista" tab as "Miniaturas", so a narrow window can reclaim the space without a hidden breakpoint.

**L17 - Bugs caught in the browser and in the suite (worth remembering).**
1. **`state.showPreview` in a template is the Ref object.** The rail's `v-if` was written `v-if="state.showPreview"`; a `Ref` is a plain truthy object inside the template, so the switch flipped the ref and the rail never moved. Fixed with a top-level `const previewVisible = state.showPreview` and an inline comment. RED added: "hides the thumbnail rail when the preview switch is off" (fails with the Ref form, passes now).
2. **The rename was forced by the linter.** A top-level `const showPreview` collided with the new `showPreview` prop (`vue(no-dupe-keys)`), hence `previewVisible`. A green `type-check` does not catch a template-only key collision; only `pnpm lint` did.
3. **The miniatures broke an existing test, correctly.** `persists the rich text edits emitted by the text element` used `findAllComponents(RichTextElement).at(-1)`, which after the rail was the static miniature instead of the live editor. Fixed by selecting the component whose `editing` prop is true, which also documents the new duplicate-tree reality for future tests.
4. **Two probe expectations were wrong, not the product.** (a) The bottom layer's "down" button is disabled, not the top layer's; (b) "Nueva página" is a text button on the *Insertar* tab, not an `aria-label` on the default tab. Both probes were corrected against the rendered DOM.

**L17 - Evidence.** RED first: `pnpm vitest run src/components/__tests__/PdfOfficeEditor.spec.ts` → 4 failed / 19 passed (`expected false to be true` on the row step buttons, both menus and the rail). GREEN: `pnpm lint` 0, `pnpm test` 10 files / **147 tests**, `pnpm type-check` 0, `pnpm build-only` 0 (CSS 22.41 kB / gzip 4.38 kB, JS 112.48 kB).

Edge CDP, main probe **18/18**: rail 166px between canvas (1203px) and inspector (296px) with `thumbW` 118; the miniature carries all 6 real elements and the real heading text; top row's *Subir* and bottom row's *Bajar* disabled while the opposite buttons stay enabled; one click moves `text_body` from z 4 to z 5 and `shape_rule` from 5 to 4, and one click on the row that now holds z 5 restores the original 1..6 stack; the miniature re-sorts with it; right-click on `text_title` opens *Acciones del elemento* at the pointer with 7 items, selects it and focuses the menu; `Escape` closes it and **keeps the selection**; *Duplicar* from the menu yields 7 rows and 7 miniature elements; empty space opens *Acciones de la página* with the 4 inserts + *Ajustes de página…*; right-click inside an editing text box leaves `defaultPrevented:false` and opens no custom menu (native paste/spellcheck preserved); *Nueva página* grows the rail to 2 thumbs with the new page active; clicking thumb 1 focuses *Página 1*; *Miniaturas* hides and restores the rail; ribbon 94px, no page scroll, 0 console entries.

Edge CDP, edge probe **8/8**: 1680/1280/1024 widths all keep `pageScrollX:false`, `ribbonOverflow:false`, canvas 1203/803/547, rail 166, thumbs 1; the menu near the bottom-right corner clamps inside the window (`797,720 → 1021,892`); right-clicking the layers panel opens nothing; read-only keeps the rail and its content while the ribbon disappears, and the menu opens with **every** item disabled (5 on the page menu, 7 on the element menu).

Known measurement, not a regression: the *Vista* tab is 96px while *Inicio*/*Insertar*/*Diseño de Página* are 94px. Removing the new switch at runtime still leaves 96px, so the difference predates S28; the accepted constraint (94px, no page scroll) is measured on *Inicio*, and no tab introduces a page scroll.

Screenshots reviewed: `rail.png` (rail geometry and role) and `thumb-zoom.png` at 3x (the miniature is the real page - heading, body, image, band with no doubling; the earlier apparent doubling was a low-resolution artifact).
