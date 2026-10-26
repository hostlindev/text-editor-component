<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  VApp,
  VAppBar,
  VBtn,
  VChip,
  VDialog,
  VDivider,
  VIcon,
  VMain,
  VSpacer,
  VSwitch,
  VTextarea,
} from 'vuetify/components'

import PdfOfficeEditor from '@/components/PdfOfficeEditor.vue'
import { exportDocumentJson } from '@/exporters/jsonSchemaExporter'
import {
  createDocument,
  createImageElement,
  createShapeElement,
  createTextElement,
  type PdfDocumentSchema,
  type ExportPdfPayload,
} from '@/types/editor'

const LOGO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" rx="10" fill="#1565c0"/><text x="120" y="72" font-family="Arial, sans-serif" font-size="30" fill="#ffffff" text-anchor="middle">ACME</text></svg>',
)}`

const document = ref<PdfDocumentSchema>(
  createDocument({
    fonts: [{ family: 'Montserrat' }, { family: 'Lora' }],
    pages: [
      {
        id: 'page_1',
        elements: [
          createShapeElement({
            id: 'shape_band',
            xMm: 0,
            yMm: 0,
            widthMm: 210,
            heightMm: 12,
            zIndex: 1,
            style: { backgroundColor: '#1565c0' },
          }),
          createImageElement({
            id: 'image_logo',
            xMm: 20,
            yMm: 24,
            widthMm: 48,
            heightMm: 24,
            zIndex: 2,
            content: { imageUrl: LOGO, objectFit: 'contain', alt: 'ACME' },
            style: { borderRadiusMm: 2 },
          }),
          createTextElement({
            id: 'text_title',
            xMm: 20,
            yMm: 60,
            widthMm: 170,
            heightMm: 22,
            zIndex: 3,
            content: {
              html: '<h1 style="font-size: 26pt; margin: 0">Certificado de finalización</h1>',
            },
            style: { paddingMm: 0 },
          }),
          createTextElement({
            id: 'text_body',
            xMm: 20,
            yMm: 92,
            widthMm: 170,
            heightMm: 40,
            zIndex: 4,
            content: {
              html: '<p>Se certifica que <strong>{{nombre}}</strong> completó el programa de <em>{{programa}}</em> el {{fecha}}.</p><p style="margin-top: 4mm">Emitido por {{emisor}}.</p>',
            },
          }),
          createShapeElement({
            id: 'shape_rule',
            xMm: 20,
            yMm: 150,
            widthMm: 170,
            heightMm: 6,
            zIndex: 5,
            style: { borderColor: '#1565c0', borderWidthPt: 2 },
            content: { shape: { kind: 'line' } },
          }),
          createTextElement({
            id: 'text_footer',
            xMm: 20,
            yMm: 250,
            widthMm: 170,
            heightMm: 12,
            zIndex: 6,
            content: {
              html: '<p style="font-size: 9pt; color: #757575">Documento generado con vue-vuetify-pdf-designer</p>',
            },
          }),
        ],
      },
    ],
  }),
)

const variables = ref({
  nombre: 'Ana Pérez',
  programa: 'Diseño Editorial',
  fecha: '25/10/2026',
  emisor: 'Academia ACME',
})

const availableFonts = [
  { family: 'Montserrat', weights: [400, 700] },
  { family: 'Lora', weights: [400, 700] },
  { family: 'Open Sans' },
]

const readOnly = ref(false)
const showJson = ref(false)
const showHtml = ref(false)
const lastExport = ref<ExportPdfPayload | null>(null)
const editorRef = ref<InstanceType<typeof PdfOfficeEditor> | null>(null)

const json = computed(() => exportDocumentJson(document.value))
const elementCount = computed(() =>
  document.value.pages.reduce((total, page) => total + page.elements.length, 0),
)

function downloadHtml(): void {
  editorRef.value?.downloadHtml('certificado.html')
}

function print(): void {
  editorRef.value?.printPdf()
}

function refreshJson(): void {
  showJson.value = true
}

function onExport(payload: ExportPdfPayload): void {
  lastExport.value = payload
  showHtml.value = true
}
</script>

<template>
  <VApp>
    <VAppBar flat height="60" color="surface" class="app-bar">
      <div class="brand">
        <span class="brand__mark">
          <VIcon icon="mdi-file-pdf-box" size="20" />
        </span>
        <span class="brand__text">
          <span class="brand__title">PDF Office Designer</span>
          <span class="brand__subtitle">Editor de documentos</span>
        </span>
      </div>

      <VChip size="small" variant="tonal" class="app-bar__chip" prepend-icon="mdi-layers-outline">
        {{ document.pages.length }} pág · {{ elementCount }} elementos
      </VChip>

      <VSpacer />

      <VSwitch
        v-model="readOnly"
        label="Solo lectura"
        density="compact"
        hide-details
        class="app-bar__switch"
      />
      <VBtn variant="text" size="small" prepend-icon="mdi-code-json" @click="refreshJson">
        JSON
      </VBtn>
      <VBtn variant="text" size="small" prepend-icon="mdi-download" @click="downloadHtml">
        Descargar HTML
      </VBtn>
      <VBtn
        color="primary"
        variant="flat"
        size="small"
        class="app-bar__cta"
        prepend-icon="mdi-printer"
        @click="print"
      >
        Imprimir / PDF
      </VBtn>
    </VAppBar>

    <VMain class="playground">
      <PdfOfficeEditor
        ref="editorRef"
        v-model="document"
        :available-fonts="availableFonts"
        :read-only="readOnly"
        :variables="variables"
        title="Certificado de finalización"
        class="playground__editor"
        @export-pdf="onExport"
        @upload-error="(file, error) => console.error('upload failed', file, error)"
      />
    </VMain>

    <VDialog v-model="showJson" max-width="840">
      <div class="dialog-card">
        <div class="dialog-card__head">
          <span class="dialog-card__title">Documento (JSON)</span>
          <VSpacer />
          <VBtn icon="mdi-close" variant="text" size="small" @click="showJson = false" />
        </div>
        <VDivider />
        <div class="dialog-card__body">
          <VTextarea
            :model-value="json"
            readonly
            variant="solo-filled"
            rows="22"
            class="dialog-code"
            hide-details
          />
        </div>
      </div>
    </VDialog>

    <VDialog v-model="showHtml" max-width="840">
      <div class="dialog-card">
        <div class="dialog-card__head">
          <span class="dialog-card__title">HTML para el motor de PDF</span>
          <VChip v-if="lastExport?.missingVariables.length" size="small" color="warning" class="ml-3">
            Faltan: {{ lastExport.missingVariables.join(', ') }}
          </VChip>
          <VSpacer />
          <VBtn icon="mdi-close" variant="text" size="small" @click="showHtml = false" />
        </div>
        <VDivider />
        <div class="dialog-card__body">
          <VTextarea
            :model-value="lastExport?.html ?? ''"
            readonly
            variant="solo-filled"
            rows="22"
            class="dialog-code"
            hide-details
          />
        </div>
      </div>
    </VDialog>
  </VApp>
</template>

<style scoped>
/*
 * `VMain` reserves the app-bar height, so the ribbon is never rendered under
 * it. The explicit `100vh` gives the chain a definite height: with an auto
 * height the A4 sheet's 1123px push the editor into a page scrollbar instead
 * of scrolling inside the canvas.
 */
.playground {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
}

.playground__editor {
  flex: 1 1 auto;
  min-height: 0;
}

/* ------------------------------------------------------------- app bar */

.app-bar {
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  padding-inline: 14px;
  font-family: 'Segoe UI Variable Text', 'Segoe UI', Inter, system-ui, sans-serif;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  color: #fff;
  background: linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%);
  box-shadow: 0 4px 12px -4px rgba(79, 70, 229, 0.65);
}

.brand__mark :deep(.v-icon) {
  color: #fff;
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.brand__title {
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: #1c2333;
}

.brand__subtitle {
  font-size: 11px;
  color: #677085;
}

.app-bar__chip {
  margin-left: 18px;
  font-size: 11.5px;
  font-weight: 500;
}

.app-bar__switch {
  margin-right: 10px;
}

.app-bar__switch :deep(.v-label) {
  font-size: 12.5px;
  opacity: 0.85;
}

.app-bar :deep(.v-btn) {
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}

.app-bar__cta {
  margin-left: 6px;
  box-shadow: 0 6px 16px -8px rgba(79, 70, 229, 0.85);
}

/* ------------------------------------------------------------- dialogs */

.dialog-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgb(var(--v-theme-surface));
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.08),
    0 24px 64px -24px rgba(15, 23, 42, 0.45);
}

.dialog-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 12px 18px;
}

.dialog-card__title {
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: #1c2333;
}

.dialog-card__body {
  padding: 14px;
  background: #f7f8fb;
}

.dialog-code :deep(.v-field) {
  border-radius: 10px;
  font-family: ui-monospace, 'Cascadia Code', 'SFMono-Regular', Consolas, monospace;
}

.dialog-code :deep(.v-field__input) {
  font-family: inherit;
  font-size: 12px;
  line-height: 1.55;
}
</style>
