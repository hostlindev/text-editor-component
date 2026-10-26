<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import {
  VBtn,
  VBtnToggle,
  VCard,
  VCardActions,
  VCardText,
  VCardTitle,
  VDialog,
  VDivider,
  VSelect,
  VSpacer,
  VTextField,
} from 'vuetify/components'

import { useEditorState } from '@/composables/useEditorState'
import {
  PAGE_SIZES_MM,
  isCustomPageSize,
  type PageConfig,
  type PageOrientation,
  type PageSizeName,
} from '@/types/editor'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const state = useEditorState()

const SIZE_ITEMS: Array<{ title: string; value: PageSizeName | 'custom' }> = [
  { title: 'A4 (210 × 297 mm)', value: 'A4' },
  { title: 'Carta (215,9 × 279,4 mm)', value: 'LETTER' },
  { title: 'Legal (215,9 × 355,6 mm)', value: 'LEGAL' },
  { title: 'Personalizado', value: 'custom' },
]

const form = reactive({
  size: 'A4' as PageSizeName | 'custom',
  widthMm: 210,
  heightMm: 297,
  orientation: 'portrait' as PageOrientation,
  top: 20,
  right: 20,
  bottom: 20,
  left: 20,
})

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function syncFromState(): void {
  const config = state.document.value.pageConfig
  if (isCustomPageSize(config.size)) {
    form.size = 'custom'
    form.widthMm = config.size.widthMm
    form.heightMm = config.size.heightMm
  } else {
    form.size = config.size
    form.widthMm = PAGE_SIZES_MM[config.size].widthMm
    form.heightMm = PAGE_SIZES_MM[config.size].heightMm
  }
  form.orientation = config.orientation
  form.top = config.marginsMm.top
  form.right = config.marginsMm.right
  form.bottom = config.marginsMm.bottom
  form.left = config.marginsMm.left
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) syncFromState()
  },
  { immediate: true },
)

function number(value: string | number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function apply(): void {
  const config: PageConfig = {
    size:
      form.size === 'custom'
        ? {
            widthMm: Math.max(number(form.widthMm, 210), 20),
            heightMm: Math.max(number(form.heightMm, 297), 20),
          }
        : form.size,
    orientation: form.orientation,
    marginsMm: {
      top: number(form.top, 20),
      right: number(form.right, 20),
      bottom: number(form.bottom, 20),
      left: number(form.left, 20),
    },
  }

  state.setPageConfig(config)
  open.value = false
}
</script>

<template>
  <VDialog v-model="open" max-width="560">
    <VCard>
      <VCardTitle class="text-subtitle-1 font-weight-medium pt-4">
        Configurar página
      </VCardTitle>
      <VDivider />
      <VCardText class="d-flex flex-column ga-3">
        <VSelect
          v-model="form.size"
          :items="SIZE_ITEMS"
          item-title="title"
          item-value="value"
          label="Tamaño de hoja"
          density="comfortable"
          variant="outlined"
          hide-details
        />

        <div v-if="form.size === 'custom'" class="d-flex ga-3">
          <VTextField
            v-model.number="form.widthMm"
            type="number"
            label="Ancho (mm)"
            density="compact"
            variant="outlined"
            hide-details
            min="20"
          />
          <VTextField
            v-model.number="form.heightMm"
            type="number"
            label="Alto (mm)"
            density="compact"
            variant="outlined"
            hide-details
            min="20"
          />
        </div>

        <div class="d-flex align-center ga-3">
          <span class="text-body-2">Orientación</span>
          <VBtnToggle
            v-model="form.orientation"
            mandatory
            density="compact"
            variant="outlined"
            divided
          >
            <VBtn value="portrait" size="small" prepend-icon="mdi-crop-portrait">
              Vertical
            </VBtn>
            <VBtn value="landscape" size="small" prepend-icon="mdi-crop-landscape">
              Horizontal
            </VBtn>
          </VBtnToggle>
        </div>

        <VDivider class="my-1" />
        <span class="text-body-2">Márgenes (mm)</span>

        <div class="d-flex ga-3">
          <VTextField
            v-model.number="form.top"
            type="number"
            label="Superior"
            density="compact"
            variant="outlined"
            hide-details
            min="0"
          />
          <VTextField
            v-model.number="form.right"
            type="number"
            label="Derecho"
            density="compact"
            variant="outlined"
            hide-details
            min="0"
          />
          <VTextField
            v-model.number="form.bottom"
            type="number"
            label="Inferior"
            density="compact"
            variant="outlined"
            hide-details
            min="0"
          />
          <VTextField
            v-model.number="form.left"
            type="number"
            label="Izquierdo"
            density="compact"
            variant="outlined"
            hide-details
            min="0"
          />
        </div>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" @click="open = false">Cancelar</VBtn>
        <VBtn color="primary" variant="flat" @click="apply">Aplicar</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
