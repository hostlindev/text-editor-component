<script setup lang="ts">
import { computed } from 'vue'
import {
  VBtn,
  VChip,
  VColorPicker,
  VIcon,
  VList,
  VListItem,
  VMenu,
  VSlider,
  VSwitch,
  VTextField,
  VTooltip,
} from 'vuetify/components'

import { useEditorState, type ElementPatch } from '@/composables/useEditorState'
import IconAction from '@/components/common/IconAction.vue'
import type { ElementStyle, ElementType, PdfCanvasElement } from '@/types/editor'

const state = useEditorState()
const { page, selectedElement, readOnly } = state

const ICONS: Record<ElementType, string> = {
  text: 'mdi-format-text',
  image: 'mdi-image-outline',
  shape: 'mdi-shape-outline',
  table: 'mdi-table',
}

const LABELS: Record<ElementType, string> = {
  text: 'Texto',
  image: 'Imagen',
  shape: 'Forma',
  table: 'Tabla',
}

const layers = computed(() => [...page.value.elements].sort((a, b) => b.zIndex - a.zIndex))

const rotationValue = computed(() => Math.round(selectedElement.value?.rotationDeg ?? 0))
const opacityValue = computed(() =>
  Math.round((selectedElement.value?.style.opacity ?? 1) * 100),
)

/**
 * The list paints topmost first, so the first row cannot step up and the last
 * one cannot step down. Both ends are read from the rendered order instead of
 * comparing z-index values, because `reorder()` renumbers them on every move.
 */
const topmostId = computed(() => layers.value[0]?.id ?? null)
const bottommostId = computed(() => layers.value[layers.value.length - 1]?.id ?? null)

function elementTitle(element: PdfCanvasElement): string {
  return element.name || LABELS[element.type]
}

function select(element: PdfCanvasElement): void {
  state.select(element.id)
}

function update(patch: ElementPatch): void {
  if (!selectedElement.value) return
  state.updateElement(selectedElement.value.id, patch)
}

function updateStyle(style: Partial<ElementStyle>): void {
  if (!selectedElement.value) return
  state.updateElement(selectedElement.value.id, { style })
}

/**
 * Number inputs fire on every keystroke, so anything that is not a finite
 * number is ignored instead of clamping the field to zero mid-typing.
 */
function parseNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

function updateGeometry(key: 'xMm' | 'yMm' | 'widthMm' | 'heightMm', value: string | number): void {
  const parsed = parseNumber(value)
  if (parsed === null) return
  update({ [key]: parsed } as ElementPatch)
}

function updateOpacity(value: number | number[]): void {
  const numeric = Array.isArray(value) ? value[0] : value
  if (typeof numeric === 'number') updateStyle({ opacity: numeric })
}

function updateRotation(value: number | number[]): void {
  const numeric = Array.isArray(value) ? value[0] : value
  if (typeof numeric === 'number') update({ rotationDeg: clampRotation(numeric) })
}

function clampRotation(value: number): number {
  return Math.min(180, Math.max(-180, value))
}

function updateRotationInput(value: unknown): void {
  const parsed = parseNumber(value)
  if (parsed === null) return
  update({ rotationDeg: clampRotation(parsed) })
}

/** The field speaks percent, the document stores 0..1. */
function updateOpacityInput(value: unknown): void {
  const parsed = parseNumber(value)
  if (parsed === null) return
  updateStyle({ opacity: Math.min(100, Math.max(0, parsed)) / 100 })
}
</script>

<template>
  <div class="layers-panel">
    <div class="layers-panel__header">
      <span class="layers-panel__title">
        <VIcon icon="mdi-layers-outline" size="16" />
        Capas
      </span>
      <VChip size="x-small" class="layers-panel__count">{{ layers.length }}</VChip>
    </div>

    <VList density="compact" class="layers-panel__list">
      <VListItem
        v-for="element in layers"
        :key="element.id"
        class="layers-panel__item"
        rounded="lg"
        :active="selectedElement?.id === element.id"
        :prepend-icon="ICONS[element.type]"
        :title="elementTitle(element)"
        :subtitle="`z ${element.zIndex} · ${Math.round(element.widthMm)}×${Math.round(element.heightMm)} mm`"
        @click="select(element)"
      >
        <template #append>
          <div class="layers-panel__actions">
            <IconAction
              icon="mdi-arrow-up-bold"
              label="Subir una capa"
              hint="Subir una capa: adelanta el elemento un nivel por encima del que lo tapa"
              size="x-small"
              density="comfortable"
              :disabled="readOnly || element.id === topmostId"
              @click.stop="state.bringForward(element.id)"
            />
            <IconAction
              icon="mdi-arrow-down-bold"
              label="Bajar una capa"
              hint="Bajar una capa: atrasa el elemento un nivel"
              size="x-small"
              density="comfortable"
              :disabled="readOnly || element.id === bottommostId"
              @click.stop="state.sendBackward(element.id)"
            />
            <IconAction
              :icon="element.locked ? 'mdi-lock' : 'mdi-lock-open-variant-outline'"
              :label="element.locked ? 'Desbloquear' : 'Bloquear'"
              :hint="
                element.locked
                  ? 'Desbloquear: vuelve a permitir mover y editar el elemento'
                  : 'Bloquear: evita mover o editar el elemento por error'
              "
              size="x-small"
              density="comfortable"
              :disabled="readOnly"
              @click.stop="state.updateElement(element.id, { locked: !element.locked })"
            />
            <IconAction
              icon="mdi-delete-outline"
              label="Eliminar"
              hint="Eliminar: quita el elemento de la página"
              size="x-small"
              density="comfortable"
              :disabled="readOnly"
              @click.stop="state.removeElement(element.id)"
            />
          </div>
        </template>
      </VListItem>
      <VListItem v-if="layers.length === 0" title="Sin elementos" subtitle="Inserta texto, imagen o forma" />
    </VList>

    <template v-if="selectedElement">
      <div class="layers-panel__header layers-panel__header--sub">
        <span class="layers-panel__title">
          <VIcon icon="mdi-tune-variant" size="16" />
          Propiedades
        </span>
      </div>

      <div class="layers-panel__card">
        <VTextField
          :model-value="selectedElement.name || ''"
          label="Nombre"
          density="compact"
          variant="outlined"
          hide-details
          :disabled="readOnly"
          @update:model-value="(value) => update({ name: String(value) })"
        />
      </div>

      <div class="layers-panel__card">
        <span class="layers-panel__label">Posición y tamaño</span>
        <div class="layers-panel__grid">
          <VTextField
            :model-value="selectedElement.xMm"
            type="number"
            label="X (mm)"
            density="compact"
            variant="outlined"
            hide-details
            :disabled="readOnly"
            @update:model-value="(value) => updateGeometry('xMm', value as string)"
          />
          <VTextField
            :model-value="selectedElement.yMm"
            type="number"
            label="Y (mm)"
            density="compact"
            variant="outlined"
            hide-details
            :disabled="readOnly"
            @update:model-value="(value) => updateGeometry('yMm', value as string)"
          />
          <VTextField
            :model-value="selectedElement.widthMm"
            type="number"
            label="Ancho (mm)"
            density="compact"
            variant="outlined"
            hide-details
            :disabled="readOnly"
            @update:model-value="(value) => updateGeometry('widthMm', value as string)"
          />
          <VTextField
            :model-value="selectedElement.heightMm"
            type="number"
            label="Alto (mm)"
            density="compact"
            variant="outlined"
            hide-details
            :disabled="readOnly"
            @update:model-value="(value) => updateGeometry('heightMm', value as string)"
          />
        </div>
      </div>

      <div class="layers-panel__card">
        <div class="layers-panel__field-head">
          <span class="layers-panel__label">Rotación</span>
          <VTextField
            class="layers-panel__number"
            data-testid="rotation-input"
            :model-value="rotationValue"
            type="number"
            suffix="°"
            density="compact"
            variant="outlined"
            hide-details
            aria-label="Rotación en grados"
            :disabled="readOnly"
            @update:model-value="updateRotationInput"
          />
        </div>
        <VSlider
          :model-value="rotationValue"
          :min="-180"
          :max="180"
          :step="1"
          hide-details
          density="compact"
          color="primary"
          aria-label="Rotación con el control deslizante"
          :disabled="readOnly"
          @update:model-value="updateRotation"
        />
      </div>

      <div class="layers-panel__card">
        <div class="layers-panel__field-head">
          <span class="layers-panel__label">Opacidad</span>
          <VTextField
            class="layers-panel__number"
            data-testid="opacity-input"
            :model-value="opacityValue"
            type="number"
            suffix="%"
            density="compact"
            variant="outlined"
            hide-details
            aria-label="Opacidad en porcentaje"
            :disabled="readOnly"
            @update:model-value="updateOpacityInput"
          />
        </div>
        <VSlider
          :model-value="selectedElement.style.opacity ?? 1"
          :min="0"
          :max="1"
          :step="0.05"
          hide-details
          density="compact"
          color="primary"
          aria-label="Opacidad con el control deslizante"
          :disabled="readOnly"
          @update:model-value="updateOpacity"
        />
      </div>

      <div class="layers-panel__card">
        <span class="layers-panel__label">Estilo</span>
        <div class="layers-panel__row">
          <VMenu location="end" :close-on-content-click="false">
            <template #activator="{ props: menuProps }">
              <span v-bind="menuProps" class="layers-panel__anchor">
                <VTooltip text="Fondo: color de relleno del elemento" location="top" open-delay="400">
                  <template #activator="{ props: tooltipProps }">
                    <VBtn
                      v-bind="tooltipProps"
                      class="layers-panel__action"
                      size="small"
                      variant="tonal"
                      prepend-icon="mdi-format-color-fill"
                      aria-label="Fondo"
                      :disabled="readOnly"
                    >
                      Fondo
                    </VBtn>
                  </template>
                </VTooltip>
              </span>
            </template>
            <div class="pa-2">
              <VColorPicker
                :model-value="selectedElement.style.backgroundColor || '#ffffff'"
                hide-inputs
                @update:model-value="(value) => updateStyle({ backgroundColor: value })"
              />
              <VBtn block variant="text" size="small" class="mt-2" @click="updateStyle({ backgroundColor: undefined })">
                Sin fondo
              </VBtn>
            </div>
          </VMenu>

          <VMenu location="end" :close-on-content-click="false">
            <template #activator="{ props: menuProps }">
              <span v-bind="menuProps" class="layers-panel__anchor">
                <VTooltip text="Borde: color y grosor del contorno" location="top" open-delay="400">
                  <template #activator="{ props: tooltipProps }">
                    <VBtn
                      v-bind="tooltipProps"
                      class="layers-panel__action"
                      size="small"
                      variant="tonal"
                      prepend-icon="mdi-border-color"
                      aria-label="Borde"
                      :disabled="readOnly"
                    >
                      Borde
                    </VBtn>
                  </template>
                </VTooltip>
              </span>
            </template>
            <div class="pa-2">
              <VColorPicker
                :model-value="selectedElement.style.borderColor || '#000000'"
                hide-inputs
                @update:model-value="(value) => updateStyle({ borderColor: value })"
              />
              <VTextField
                :model-value="selectedElement.style.borderWidthPt ?? 0"
                type="number"
                label="Grosor (pt)"
                density="compact"
                variant="outlined"
                hide-details
                class="mt-3"
                :disabled="readOnly"
                @update:model-value="(value) => updateStyle({ borderWidthPt: Number(value) })"
              />
            </div>
          </VMenu>
        </div>

        <div class="layers-panel__grid">
          <VTextField
            :model-value="selectedElement.style.borderRadiusMm ?? 0"
            type="number"
            label="Radio (mm)"
            density="compact"
            variant="outlined"
            hide-details
            :disabled="readOnly"
            @update:model-value="(value) => updateStyle({ borderRadiusMm: Number(value) })"
          />
          <VTextField
            :model-value="selectedElement.style.paddingMm ?? 0"
            type="number"
            label="Relleno (mm)"
            density="compact"
            variant="outlined"
            hide-details
            :disabled="readOnly"
            @update:model-value="(value) => updateStyle({ paddingMm: Number(value) })"
          />
        </div>
      </div>

      <div class="layers-panel__card layers-panel__card--row">
        <VSwitch
          :model-value="selectedElement.locked === true"
          label="Bloqueado"
          density="compact"
          hide-details
          color="primary"
          :disabled="readOnly"
          @update:model-value="(value) => update({ locked: value === true })"
        />
        <IconAction
          icon="mdi-content-duplicate"
          label="Duplicar"
          hint="Duplicar: crea una copia desplazada del elemento"
          :disabled="readOnly"
          @click="state.duplicateElement(selectedElement.id)"
        />
        <IconAction
          icon="mdi-delete-outline"
          label="Eliminar"
          hint="Eliminar: quita el elemento de la página"
          color="error"
          :disabled="readOnly"
          @click="state.removeElement(selectedElement.id)"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.layers-panel {
  display: flex;
  flex-direction: column;
  padding: 10px 12px 16px;
  gap: 8px;
  overflow-y: auto;
  height: 100%;
  color: var(--pdf-ink);
  scrollbar-width: thin;
}

.layers-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 4px 8px;
  border-bottom: 1px solid var(--pdf-line);
}

.layers-panel__header--sub {
  margin-top: 6px;
}

.layers-panel__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pdf-ink-muted);
}

.layers-panel__title :deep(.v-icon) {
  color: var(--pdf-accent);
  opacity: 0.9;
}

.layers-panel__count {
  font-size: 10.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.layers-panel__list {
  flex: 0 0 auto;
  overflow: visible;
  padding: 0;
  background: transparent;
}

.layers-panel__list :deep(.v-list-item) {
  min-height: 46px;
  margin-bottom: 2px;
  border-radius: var(--pdf-radius-sm);
  border: 1px solid transparent;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.layers-panel__list :deep(.v-list-item-subtitle) {
  font-size: 10.5px;
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
}

.layers-panel__list :deep(.v-list-item:hover) {
  background: color-mix(in srgb, var(--pdf-ink) 4%, transparent);
}

.layers-panel__list :deep(.v-list-item--active) {
  background: var(--pdf-accent-soft);
  border-color: var(--pdf-accent-line);
  color: var(--pdf-ink);
}

.layers-panel__list :deep(.v-list-item--active .v-list-item__prepend .v-icon) {
  color: var(--pdf-accent);
  opacity: 1;
}

.layers-panel__list :deep(.v-list-item--active .v-list-item__overlay) {
  opacity: 0;
}

.layers-panel__actions {
  display: flex;
  gap: 0;
}

.layers-panel__actions :deep(.v-btn) {
  opacity: 0.42;
}

.layers-panel__actions :deep(.v-btn:hover) {
  opacity: 1;
}

/* Each inspector group is a quiet card so the sidebar keeps a rhythm. */
.layers-panel__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--pdf-line);
  border-radius: var(--pdf-radius);
  background: color-mix(in srgb, var(--pdf-surface) 97%, var(--pdf-canvas));
}

.layers-panel__card--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.layers-panel__label {
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pdf-ink-muted);
}

.layers-panel__field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* The numeric twin of each slider: type an exact value or drag the handle. */
.layers-panel__number {
  max-width: 92px;
}

.layers-panel__number :deep(.v-field__input) {
  min-height: 32px;
  padding-top: 0;
  padding-bottom: 0;
  text-align: right;
}

.layers-panel__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.layers-panel__row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.layers-panel__anchor {
  display: inline-flex;
  flex: 1 1 0;
}

.layers-panel__anchor :deep(.v-btn) {
  width: 100%;
}

.layers-panel :deep(.v-field) {
  border-radius: var(--pdf-radius-sm);
  background: var(--pdf-surface);
  font-size: 12px;
}

.layers-panel :deep(.v-field__input) {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.layers-panel :deep(.v-btn) {
  border-radius: var(--pdf-radius-sm);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}

.layers-panel__action {
  flex: 1 1 0;
}

.layers-panel :deep(.v-slider) {
  margin-inline: 0;
}

.layers-panel :deep(.v-switch .v-label) {
  font-size: 12px;
  opacity: 0.9;
}

/* Thin, quiet scrollbar: the inspector is narrow, a native bar eats 15px. */
.layers-panel {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--pdf-ink) 22%, transparent) transparent;
}

.layers-panel::-webkit-scrollbar {
  width: 10px;
}

.layers-panel::-webkit-scrollbar-track {
  background: transparent;
}

.layers-panel::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background-clip: content-box;
  background-color: color-mix(in srgb, var(--pdf-ink) 22%, transparent);
}
</style>
