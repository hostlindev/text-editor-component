<script setup lang="ts">
import { computed } from 'vue'

import type { PdfCanvasElement } from '@/types/editor'

const props = defineProps<{
  element: PdfCanvasElement
}>()

const shape = computed(() => props.element.content.shape ?? { kind: 'rect' as const })

/**
 * Every visual property comes from `ElementStyle`; `content.shape` only keeps
 * the geometry (rect, ellipse, line) the exporter also needs.
 */
const shapeStyle = computed(() => {
  const { style } = props.element
  const kind = shape.value.kind

  const border =
    style.borderColor && style.borderWidthPt
      ? `${style.borderWidthPt}pt solid ${style.borderColor}`
      : undefined

  if (kind === 'line') {
    return {
      opacity: style.opacity !== undefined ? String(style.opacity) : undefined,
      borderTop: `${style.borderWidthPt ?? 1}pt solid ${style.borderColor ?? '#000000'}`,
    }
  }

  return {
    opacity: style.opacity !== undefined ? String(style.opacity) : undefined,
    background: style.backgroundColor,
    border,
    borderRadius:
      kind === 'ellipse'
        ? '50%'
        : style.borderRadiusMm
          ? `${style.borderRadiusMm}mm`
          : undefined,
  }
})
</script>

<template>
  <div class="pdf-shape" :style="shapeStyle" />
</template>

<style scoped>
.pdf-shape {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
</style>
