<script setup lang="ts">
import { computed } from 'vue'

import { useEditorState } from '@/composables/useEditorState'
import { mmToPx } from '@/composables/useUnitConverter'
import type { PdfCanvasElement, PdfPage } from '@/types/editor'
import { resolveElementComponent } from './elementRegistry'

/**
 * A page rendered as a miniature.
 *
 * It is the real page, not a placeholder: the same element components paint the
 * same millimetres. It cannot reuse `DocumentPage`, because that component reads
 * the global zoom and draws the editor's own chrome — grid, margins, guides and
 * selection handles — which would show up inside the preview.
 *
 * The sheet is laid out at 96 DPI and scaled with a CSS transform. That is the
 * only way the miniature stays proportional: text is authored in `pt`, an
 * absolute CSS unit that ignores the container width, but it does follow a
 * transform.
 */
const props = defineProps<{
  page: PdfPage
  widthPx: number
}>()

const state = useEditorState()
const box = computed(() => state.pageBox.value)

const sheetWidthPx = computed(() => mmToPx(box.value.widthMm, 1))
const sheetHeightPx = computed(() => mmToPx(box.value.heightMm, 1))
const scale = computed(() => props.widthPx / (sheetWidthPx.value || 1))
const heightPx = computed(() => Math.round(sheetHeightPx.value * scale.value * 100) / 100)

const sortedElements = computed(() =>
  [...props.page.elements].sort((a, b) => a.zIndex - b.zIndex),
)

function elementStyle(element: PdfCanvasElement) {
  return {
    left: `${mmToPx(element.xMm, 1)}px`,
    top: `${mmToPx(element.yMm, 1)}px`,
    width: `${mmToPx(element.widthMm, 1)}px`,
    height: `${mmToPx(element.heightMm, 1)}px`,
    zIndex: element.zIndex,
    transform: element.rotationDeg ? `rotate(${element.rotationDeg}deg)` : undefined,
  }
}
</script>

<template>
  <div
    class="pdf-thumb"
    :style="{
      width: `${widthPx}px`,
      height: `${heightPx}px`,
      background: page.background || '#ffffff',
    }"
  >
    <div
      class="pdf-thumb__sheet"
      :style="{
        width: `${sheetWidthPx}px`,
        height: `${sheetHeightPx}px`,
        transform: `scale(${scale})`,
      }"
    >
      <div
        v-for="element in sortedElements"
        :key="element.id"
        class="pdf-thumb__element"
        :style="elementStyle(element)"
      >
        <component
          :is="resolveElementComponent(element)"
          :element="element"
          :editing="false"
          :zoom="1"
          :read-only="true"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pdf-thumb {
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.14);
}

.pdf-thumb__sheet {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  pointer-events: none;
}

.pdf-thumb__element {
  position: absolute;
}
</style>
