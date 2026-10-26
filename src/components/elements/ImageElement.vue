<script setup lang="ts">
import { computed } from 'vue'

import type { PdfCanvasElement } from '@/types/editor'

const props = defineProps<{
  element: PdfCanvasElement
}>()

const boxStyle = computed(() => {
  const { style, content } = props.element
  return {
    background: style.backgroundColor,
    border:
      style.borderColor && style.borderWidthPt
        ? `${style.borderWidthPt}pt solid ${style.borderColor}`
        : undefined,
    borderRadius: style.borderRadiusMm ? `${style.borderRadiusMm}mm` : undefined,
    opacity: style.opacity ?? undefined,
    objectFit: content.objectFit ?? 'contain',
  }
})
</script>

<template>
  <div class="pdf-img" :style="{ ...boxStyle, objectFit: undefined }">
    <img
      v-if="element.content.imageUrl"
      class="pdf-img__img"
      :src="element.content.imageUrl"
      :alt="element.content.alt || ''"
      :style="{ objectFit: boxStyle.objectFit }"
      draggable="false"
    />
    <div v-else class="pdf-img__placeholder">
      <span>Imagen</span>
    </div>
  </div>
</template>

<style scoped>
.pdf-img {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.pdf-img__img {
  width: 100%;
  height: 100%;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}

.pdf-img__placeholder {
  font-size: 11px;
  color: #757575;
  font-family: system-ui, sans-serif;
}
</style>
