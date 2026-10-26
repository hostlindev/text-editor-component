<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  VBtn,
  VBtnToggle,
  VColorPicker,
  VIcon,
  VMenu,
  VSelect,
  VSwitch,
  VTab,
  VTabs,
} from 'vuetify/components'

import { useEditorState } from '@/composables/useEditorState'
import type { FontDescriptor, ShapeKind } from '@/types/editor'
import IconAction from '@/components/common/IconAction.vue'
import FontControls from './FontControls.vue'
import InsertControls from './InsertControls.vue'
import PageSetupDialog from '../panels/PageSetupDialog.vue'

defineProps<{
  fonts: FontDescriptor[]
}>()

const emit = defineEmits<{
  (event: 'insert-text'): void
  (event: 'insert-image'): void
  (event: 'insert-table'): void
  (event: 'insert-shape', kind: ShapeKind): void
}>()

const state = useEditorState()
const {
  selectedElement,
  canUndo,
  canRedo,
  readOnly,
  zoom,
  pages,
  pageIndex,
  showRulers,
  showGrid,
  showMarginGuides,
  showPreview,
} = state

const tab = ref<'home' | 'insert' | 'layout' | 'view'>('home')
const pageSetupOpen = ref(false)

const SIZE_ITEMS = [
  { title: 'A4', value: 'A4' },
  { title: 'Carta', value: 'LETTER' },
  { title: 'Legal', value: 'LEGAL' },
]

const currentSize = computed(() => {
  const size = state.document.value.pageConfig.size
  return typeof size === 'string' ? size : 'custom'
})

const orientation = computed({
  get: () => state.document.value.pageConfig.orientation,
  set: (value: 'portrait' | 'landscape') => {
    state.setPageConfig({ ...state.document.value.pageConfig, orientation: value })
  },
})

function setSize(value: string): void {
  if (value === 'custom') {
    pageSetupOpen.value = true
    return
  }
  state.setPageConfig({
    ...state.document.value.pageConfig,
    size: value as 'A4' | 'LETTER' | 'LEGAL',
  })
}

const hasSelection = computed(() => selectedElement.value !== null)
</script>

<template>
  <div class="editor-ribbon">
    <div class="editor-ribbon__bar">
      <VTabs v-model="tab" density="compact" class="editor-ribbon__tabs">
        <VTab value="home" size="small">Inicio</VTab>
        <VTab value="insert" size="small">Insertar</VTab>
        <VTab value="layout" size="small">Diseño de Página</VTab>
        <VTab value="view" size="small">Vista</VTab>
      </VTabs>
    </div>

    <div class="editor-ribbon__body">
      <template v-if="tab === 'home'">
        <div class="editor-ribbon__group">
          <IconAction
            icon="mdi-undo"
            label="Deshacer"
            hint="Deshacer: revierte el último cambio"
            :disabled="!canUndo"
            @click="state.undo()"
          />
          <IconAction
            icon="mdi-redo"
            label="Rehacer"
            hint="Rehacer: recupera el cambio que deshiciste"
            :disabled="!canRedo"
            @click="state.redo()"
          />
        </div>

        <div class="editor-ribbon__group">
          <FontControls :fonts="fonts" />
        </div>

        <div class="editor-ribbon__group">
          <IconAction
            icon="mdi-content-duplicate"
            label="Duplicar elemento"
            hint="Duplicar: crea una copia desplazada del elemento"
            :disabled="!hasSelection || readOnly"
            @click="selectedElement && state.duplicateElement(selectedElement.id)"
          />
          <IconAction
            icon="mdi-delete-outline"
            label="Eliminar elemento"
            hint="Eliminar: quita el elemento de la página"
            :disabled="!hasSelection || readOnly"
            @click="selectedElement && state.removeElement(selectedElement.id)"
          />
          <IconAction
            icon="mdi-arrange-bring-to-front"
            label="Traer al frente"
            hint="Traer al frente: sube el elemento por encima del resto"
            :disabled="!hasSelection || readOnly"
            @click="selectedElement && state.bringToFront(selectedElement.id)"
          />
          <IconAction
            icon="mdi-arrange-send-to-back"
            label="Enviar al fondo"
            hint="Enviar al fondo: coloca el elemento detrás del resto"
            :disabled="!hasSelection || readOnly"
            @click="selectedElement && state.sendToBack(selectedElement.id)"
          />
          <IconAction
            :icon="selectedElement?.locked ? 'mdi-lock' : 'mdi-lock-open-variant-outline'"
            :label="selectedElement?.locked ? 'Desbloquear elemento' : 'Bloquear elemento'"
            :hint="
              selectedElement?.locked
                ? 'Desbloquear: vuelve a permitir mover y editar el elemento'
                : 'Bloquear: evita mover o editar el elemento por error'
            "
            :disabled="!hasSelection || readOnly"
            @click="selectedElement && state.updateElement(selectedElement.id, { locked: !selectedElement.locked })"
          />
        </div>
      </template>

      <template v-else-if="tab === 'insert'">
        <div class="editor-ribbon__group">
          <InsertControls
            @insert-text="emit('insert-text')"
            @insert-image="emit('insert-image')"
            @insert-table="emit('insert-table')"
            @insert-shape="(kind) => emit('insert-shape', kind)"
          />
        </div>

        <div class="editor-ribbon__group">
          <VBtn
            prepend-icon="mdi-file-plus-outline"
            size="small"
            variant="text"
            :disabled="readOnly"
            @click="state.addPage()"
          >
            Nueva página
          </VBtn>
          <VBtn
            prepend-icon="mdi-content-duplicate"
            size="small"
            variant="text"
            :disabled="readOnly"
            @click="state.duplicatePage()"
          >
            Duplicar página
          </VBtn>
          <VBtn
            prepend-icon="mdi-file-remove-outline"
            size="small"
            variant="text"
            :disabled="readOnly || pages.length <= 1"
            @click="state.removePage()"
          >
            Eliminar página
          </VBtn>
        </div>
      </template>

      <template v-else-if="tab === 'layout'">
        <div class="editor-ribbon__group">
          <span class="editor-ribbon__label">Hoja</span>
          <VSelect
            class="editor-ribbon__size"
            :items="SIZE_ITEMS"
            :model-value="currentSize"
            density="compact"
            variant="outlined"
            hide-details
            :disabled="readOnly"
            @update:model-value="setSize"
          />

          <VBtnToggle v-model="orientation" mandatory density="compact" variant="outlined" divided class="editor-ribbon__toggle">
            <VBtn value="portrait" size="small" aria-label="Vertical" title="Vertical">
              <VIcon icon="mdi-crop-portrait" size="18" />
            </VBtn>
            <VBtn value="landscape" size="small" aria-label="Horizontal" title="Horizontal">
              <VIcon icon="mdi-crop-landscape" size="18" />
            </VBtn>
          </VBtnToggle>
        </div>

        <div class="editor-ribbon__group">
          <VBtn size="small" variant="text" prepend-icon="mdi-page-layout-body" @click="pageSetupOpen = true">
            Márgenes
          </VBtn>

          <VMenu location="bottom" :close-on-content-click="false">
            <template #activator="{ props: activatorProps }">
              <VBtn
                v-bind="activatorProps"
                size="small"
                variant="text"
                prepend-icon="mdi-format-color-fill"
                :disabled="readOnly"
              >
                Fondo de página
              </VBtn>
            </template>
            <div class="pa-2">
              <VColorPicker
                :model-value="state.page.value.background || '#ffffff'"
                hide-inputs
                @update:model-value="(value) => state.setPageBackground(value)"
              />
              <VBtn block variant="text" size="small" class="mt-2" @click="state.setPageBackground(undefined)">
                Blanco
              </VBtn>
            </div>
          </VMenu>
        </div>

        <div class="editor-ribbon__group editor-ribbon__group--push">
          <span class="editor-ribbon__pill">
            Página {{ pageIndex + 1 }} de {{ pages.length }}
          </span>
        </div>
      </template>

      <template v-else>
        <div class="editor-ribbon__group">
          <IconAction
            icon="mdi-minus"
            label="Alejar"
            hint="Alejar: reduce el zoom del lienzo"
            @click="state.zoomOut()"
          />
          <span class="editor-ribbon__zoom">{{ Math.round(zoom * 100) }}%</span>
          <IconAction
            icon="mdi-plus"
            label="Acercar"
            hint="Acercar: aumenta el zoom del lienzo"
            @click="state.zoomIn()"
          />
          <IconAction
            icon="mdi-fit-to-page-outline"
            label="Zoom al 100%"
            hint="Zoom al 100%: vuelve al tamaño real"
            @click="state.setZoom(1)"
          />
        </div>

        <div class="editor-ribbon__group">
          <VSwitch v-model="showRulers" label="Reglas" density="compact" hide-details class="mr-3" />
          <VSwitch v-model="showGrid" label="Grilla" density="compact" hide-details class="mr-3" />
          <VSwitch v-model="showMarginGuides" label="Márgenes" density="compact" hide-details class="mr-3" />
          <VSwitch v-model="showPreview" label="Miniaturas" density="compact" hide-details />
        </div>
      </template>
    </div>

    <PageSetupDialog v-model="pageSetupOpen" />
  </div>
</template>

<style scoped>
.editor-ribbon {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  background: var(--pdf-surface);
  border-bottom: 1px solid var(--pdf-line-strong);
  box-shadow: 0 12px 24px -24px rgba(15, 23, 42, 0.55);
}

/* ------------------------------------------------------------- tabs row */

.editor-ribbon__bar {
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-bottom: 1px solid var(--pdf-line);
}

.editor-ribbon__tabs {
  height: 38px;
  min-height: 0;
}

.editor-ribbon__tabs :deep(.v-tab) {
  height: 38px;
  min-width: 0;
  padding: 0 14px;
  font-size: 12.5px;
  font-weight: 550;
  letter-spacing: 0.01em;
  text-transform: none;
  color: var(--pdf-ink-muted);
  transition: color 0.15s ease;
}

.editor-ribbon__tabs :deep(.v-tab:hover) {
  color: var(--pdf-ink);
}

.editor-ribbon__tabs :deep(.v-tab--selected) {
  color: var(--pdf-accent);
}

.editor-ribbon__tabs :deep(.v-tab__slider) {
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--pdf-accent);
}

/* ------------------------------------------------------------- body row */

.editor-ribbon__body {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 6px 12px;
  min-height: 54px;
  background: var(--pdf-surface-muted);
}

.editor-ribbon__group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border-radius: var(--pdf-radius);
  background: transparent;
}

.editor-ribbon__group + .editor-ribbon__group {
  position: relative;
  margin-left: 4px;
}

.editor-ribbon__group + .editor-ribbon__group::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 18%;
  bottom: 18%;
  width: 1px;
  background: var(--pdf-line-strong);
}

.editor-ribbon__group.editor-ribbon__group--push {
  margin-left: auto;
  padding-right: 0;
}

.editor-ribbon__group.editor-ribbon__group--push::before {
  display: none;
}

/* Tool buttons: compact, softly rounded, quiet until hovered. */
.editor-ribbon__body :deep(.v-btn) {
  height: 32px;
  min-width: 32px;
  border-radius: var(--pdf-radius-sm);
  color: var(--pdf-ink);
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}

.editor-ribbon__body :deep(.v-btn .v-icon) {
  opacity: 0.82;
  font-size: 19px;
}

.editor-ribbon__body :deep(.v-btn:hover > .v-btn__overlay) {
  opacity: 0.06;
}

.editor-ribbon__body :deep(.v-btn--variant-text:not(.v-btn--disabled):hover) {
  background: color-mix(in srgb, var(--pdf-ink) 5%, transparent);
}

.editor-ribbon__body :deep(.v-btn--disabled) {
  opacity: 0.42;
}

.editor-ribbon__body :deep(.v-btn--active),
.editor-ribbon__body :deep(.v-btn[aria-pressed='true']) {
  color: var(--pdf-accent);
}

/* Selects and toggles share the button's radius and typography. */
.editor-ribbon__body :deep(.v-field) {
  border-radius: var(--pdf-radius-sm);
  background: var(--pdf-surface);
  font-size: 12.5px;
  min-height: 34px;
}

.editor-ribbon__body :deep(.v-field__input) {
  font-size: 12.5px;
  min-height: 34px;
  padding-top: 0;
  padding-bottom: 0;
}

/*
 * Vuetify already fades the disabled input to 0.87; an extra blanket opacity
 * made the fields look broken on first load, so the border and the hint text
 * stay readable while only the value loses contrast.
 */
.editor-ribbon__body :deep(.v-field--disabled) {
  opacity: 1;
}

.editor-ribbon__body :deep(.v-field--disabled .v-field__outline) {
  --v-field-border-opacity: 0.24;
}

.editor-ribbon__body :deep(.v-field--disabled input::placeholder) {
  color: var(--pdf-ink-muted);
  opacity: 0.8;
}

.editor-ribbon__body :deep(.v-btn-toggle) {
  border-radius: var(--pdf-radius-sm);
  overflow: hidden;
}

.editor-ribbon__body :deep(.v-switch .v-label) {
  font-size: 12.5px;
  opacity: 0.9;
}

.editor-ribbon__size {
  max-width: 124px;
  min-width: 104px;
}

.editor-ribbon__toggle {
  margin-left: 4px;
}

.editor-ribbon__label {
  margin-right: 8px;
  color: var(--pdf-ink-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.editor-ribbon__pill {
  padding: 3px 10px;
  border: 1px solid var(--pdf-line);
  border-radius: 999px;
  background: var(--pdf-surface);
  color: var(--pdf-ink-muted);
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.editor-ribbon__zoom {
  min-width: 46px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--pdf-ink);
}
</style>
