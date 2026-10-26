<script setup lang="ts">
import { computed } from 'vue'
import { VBtn, VColorPicker, VDivider, VMenu, VSelect } from 'vuetify/components'

import { useEditorState, type TextFormatCommand } from '@/composables/useEditorState'
import IconAction from '@/components/common/IconAction.vue'
import type { FontDescriptor } from '@/types/editor'

const props = defineProps<{
  fonts: FontDescriptor[]
}>()

const state = useEditorState()
const textState = state.activeTextState

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 60, 72]
/** Matches `.pdf-rt__prose`, the size an unformatted box actually renders at. */
const DEFAULT_SIZE_PT = 12

const familyItems = computed(() => props.fonts.map((font) => font.family))

/*
 * A text box without an explicit mark still renders with the document font and
 * the base size, so the ribbon shows those effective values instead of an empty
 * field that looks broken.
 */
const currentFamily = computed(() => {
  const value = textState.value?.fontFamily
  if (value) return value.replace(/^['"]|['"]$/g, '')
  return props.fonts[0]?.family ?? 'Inter'
})

const currentSize = computed(() => {
  const value = textState.value?.fontSize
  return value ? value.replace('pt', '') : String(DEFAULT_SIZE_PT)
})

const currentColor = computed(() => textState.value?.color ?? '#000000')

const disabled = computed(() => textState.value === null)

function run(command: TextFormatCommand): void {
  state.formatText(command)
}

function toggle(
  command: 'bold' | 'italic' | 'underline' | 'strike' | 'subscript' | 'superscript',
): void {
  run({ type: command })
}

function setFamily(family: string | null): void {
  if (!family) return
  run({ type: 'fontFamily', value: family })
}

function setSize(size: string | null): void {
  if (!size) return
  run({ type: 'fontSize', value: `${size}pt` })
}

function setColor(color: string): void {
  run({ type: 'color', value: color })
}

function setHighlight(color: string | null): void {
  run({ type: 'highlight', value: color })
}

function setAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
  run({ type: 'align', value: align })
}

function toggleList(kind: 'bulletList' | 'orderedList'): void {
  run({ type: kind })
}
</script>

<template>
  <div class="font-controls">
    <VSelect
      class="font-controls__family"
      :items="familyItems"
      :model-value="currentFamily"
      :disabled="disabled"
      density="compact"
      variant="outlined"
      hide-details
      placeholder="Fuente"
      aria-label="Fuente"
      title="Fuente del texto"
      @update:model-value="setFamily"
    />

    <VSelect
      class="font-controls__size"
      :items="FONT_SIZES.map(String)"
      :model-value="currentSize"
      :disabled="disabled"
      density="compact"
      variant="outlined"
      hide-details
      placeholder="Tamaño"
      aria-label="Tamaño"
      title="Tamaño de la tipografía en puntos"
      @update:model-value="setSize"
    />

    <IconAction
      icon="mdi-format-bold"
      label="Negrita"
      hint="Negrita: aplica o quita el peso fuerte al texto"
      :disabled="disabled"
      :color="textState?.bold ? 'primary' : undefined"
      @click="toggle('bold')"
    />
    <IconAction
      icon="mdi-format-italic"
      label="Cursiva"
      hint="Cursiva: inclina el texto"
      :disabled="disabled"
      :color="textState?.italic ? 'primary' : undefined"
      @click="toggle('italic')"
    />
    <IconAction
      icon="mdi-format-underline"
      label="Subrayado"
      hint="Subrayado: dibuja una línea bajo el texto"
      :disabled="disabled"
      :color="textState?.underline ? 'primary' : undefined"
      @click="toggle('underline')"
    />
    <IconAction
      icon="mdi-format-strikethrough"
      label="Tachado"
      hint="Tachado: cruza el texto con una línea"
      :disabled="disabled"
      :color="textState?.strike ? 'primary' : undefined"
      @click="toggle('strike')"
    />

    <VDivider vertical class="mx-2" />

    <VMenu location="bottom" :close-on-content-click="false">
      <template #activator="{ props: menuProps }">
        <span v-bind="menuProps" class="font-controls__anchor">
          <IconAction
            icon="mdi-format-color-text"
            label="Color del texto"
            hint="Color del texto: cambia el color de la tipografía"
            :disabled="disabled"
          >
            <span class="font-controls__swatch" :style="{ background: currentColor }" />
          </IconAction>
        </span>
      </template>
      <div class="pa-2">
        <VColorPicker :model-value="currentColor" hide-inputs @update:model-value="setColor" />
        <VBtn block variant="text" size="small" class="mt-2" @click="setColor('#000000')">
          Volver a negro
        </VBtn>
      </div>
    </VMenu>

    <VMenu location="bottom" :close-on-content-click="false">
      <template #activator="{ props: menuProps }">
        <span v-bind="menuProps" class="font-controls__anchor">
          <IconAction
            icon="mdi-format-color-highlight"
            label="Resaltado"
            hint="Resaltado: pinta el fondo del texto"
            :disabled="disabled"
          >
            <span
              class="font-controls__swatch"
              :style="{ background: textState?.highlight || 'transparent' }"
            />
          </IconAction>
        </span>
      </template>
      <div class="pa-2">
        <VColorPicker
          :model-value="textState?.highlight || '#ffff00'"
          hide-inputs
          @update:model-value="setHighlight"
        />
        <VBtn block variant="text" size="small" class="mt-2" @click="setHighlight(null)">
          Quitar resaltado
        </VBtn>
      </div>
    </VMenu>

    <VDivider vertical class="mx-2" />

    <IconAction
      icon="mdi-format-align-left"
      label="Alinear a la izquierda"
      hint="Alinear a la izquierda: pega el texto al margen izquierdo"
      :disabled="disabled"
      :color="textState?.align === 'left' ? 'primary' : undefined"
      @click="setAlign('left')"
    />
    <IconAction
      icon="mdi-format-align-center"
      label="Centrar"
      hint="Centrar: reparte el texto al centro del cuadro"
      :disabled="disabled"
      :color="textState?.align === 'center' ? 'primary' : undefined"
      @click="setAlign('center')"
    />
    <IconAction
      icon="mdi-format-align-right"
      label="Alinear a la derecha"
      hint="Alinear a la derecha: pega el texto al margen derecho"
      :disabled="disabled"
      :color="textState?.align === 'right' ? 'primary' : undefined"
      @click="setAlign('right')"
    />
    <IconAction
      icon="mdi-format-align-justify"
      label="Justificar"
      hint="Justificar: distribuye el texto entre ambos márgenes"
      :disabled="disabled"
      :color="textState?.align === 'justify' ? 'primary' : undefined"
      @click="setAlign('justify')"
    />

    <VDivider vertical class="mx-2" />

    <IconAction
      icon="mdi-format-list-bulleted"
      label="Lista con viñetas"
      hint="Lista con viñetas: convierte el texto en una lista de puntos"
      :disabled="disabled"
      :color="textState?.bulletList ? 'primary' : undefined"
      @click="toggleList('bulletList')"
    />
    <IconAction
      icon="mdi-format-list-numbered"
      label="Lista numerada"
      hint="Lista numerada: numera cada línea del texto"
      :disabled="disabled"
      :color="textState?.orderedList ? 'primary' : undefined"
      @click="toggleList('orderedList')"
    />
    <IconAction
      icon="mdi-format-subscript"
      label="Subíndice"
      hint="Subíndice: baja el texto por debajo de la línea base"
      :disabled="disabled"
      :color="textState?.subscript ? 'primary' : undefined"
      @click="toggle('subscript')"
    />
    <IconAction
      icon="mdi-format-superscript"
      label="Superíndice"
      hint="Superíndice: sube el texto por encima de la línea base"
      :disabled="disabled"
      :color="textState?.superscript ? 'primary' : undefined"
      @click="toggle('superscript')"
    />
  </div>
</template>

<style scoped>
.font-controls {
  display: flex;
  align-items: center;
  gap: 1px;
  flex-wrap: wrap;
}

.font-controls__family {
  max-width: 168px;
  min-width: 132px;
}

.font-controls__size {
  max-width: 96px;
  min-width: 90px;
}

/* Menu anchors keep the button tight so the popover points at it. */
.font-controls__anchor {
  display: inline-flex;
}

/* The colour swatch sits under the icon like in a real text editor. */
.font-controls__swatch {
  position: absolute;
  bottom: 4px;
  left: 50%;
  width: 16px;
  height: 4px;
  transform: translateX(-50%);
  border-radius: 2px;
  border: 1px solid rgba(15, 23, 42, 0.22);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.6) inset;
}
</style>
