<script setup lang="ts">
import { computed } from 'vue'

import type { PdfCanvasElement } from '@/types/editor'
import { sanitizeRichTextHtml } from '@/security/sanitizeHtml'

const props = defineProps<{
  element: PdfCanvasElement
}>()

const rows = computed(() => props.element.content.table?.rows ?? [])
const headerRow = computed(() => props.element.content.table?.headerRow !== false)

const boxStyle = computed(() => {
  const { style } = props.element
  return {
    padding: style.paddingMm ? `${style.paddingMm}mm` : undefined,
    background: style.backgroundColor,
    border:
      style.borderColor && style.borderWidthPt
        ? `${style.borderWidthPt}pt solid ${style.borderColor}`
        : undefined,
    opacity: style.opacity ?? undefined,
  }
})

function cellHtml(value: string): string {
  return sanitizeRichTextHtml(value)
}
</script>

<template>
  <div class="pdf-table" :style="boxStyle">
    <table class="pdf-table__grid">
      <tbody>
        <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
          <component
            :is="headerRow && rowIndex === 0 ? 'th' : 'td'"
            v-for="(cell, cellIndex) in row"
            :key="cellIndex"
            class="pdf-table__cell"
          >
            <span v-html="cellHtml(cell)" />
          </component>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.pdf-table {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  background: #fff;
}

.pdf-table__grid {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 10pt;
  color: #000;
}

.pdf-table__cell {
  border: 0.5pt solid #9e9e9e;
  padding: 1mm 2mm;
  text-align: left;
  vertical-align: top;
  overflow-wrap: break-word;
}

th.pdf-table__cell {
  font-weight: 600;
  background: #f5f5f5;
}
</style>
