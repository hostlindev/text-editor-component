<script setup lang="ts">
import { computed } from 'vue'

import { useEditorState, type ElementPatch } from '@/composables/useEditorState'
import { mmToPx } from '@/composables/useUnitConverter'
import type { PdfCanvasElement } from '@/types/editor'
import FreeElementWrapper from './FreeElementWrapper.vue'
import { resolveElementComponent } from './elementRegistry'

const props = defineProps<{
  index: number
}>()

const state = useEditorState()
const { zoom, pageIndex, selectedId, editingId, readOnly, showGrid, showMarginGuides, guides } =
  state

const page = computed(() => state.pages.value[props.index]!)
const isActive = computed(() => pageIndex.value === props.index)
const box = computed(() => state.pageBox.value)

const sheetStyle = computed(() => ({
  width: `${mmToPx(box.value.widthMm, zoom.value)}px`,
  height: `${mmToPx(box.value.heightMm, zoom.value)}px`,
  background: page.value.background || '#ffffff',
}))

const marginOverlayStyle = computed(() => {
  const margins = state.document.value.pageConfig.marginsMm
  return {
    top: `${mmToPx(margins.top, zoom.value)}px`,
    right: `${mmToPx(margins.right, zoom.value)}px`,
    bottom: `${mmToPx(margins.bottom, zoom.value)}px`,
    left: `${mmToPx(margins.left, zoom.value)}px`,
  }
})

const gridStyle = computed(() => {
  const step = mmToPx(5, zoom.value)
  return {
    backgroundImage: `repeating-linear-gradient(to right, rgba(15,23,42,0.07) 0 1px, transparent 1px ${step}px), repeating-linear-gradient(to bottom, rgba(15,23,42,0.07) 0 1px, transparent 1px ${step}px)`,
  }
})

const sortedElements = computed(() =>
  [...page.value.elements].sort((a, b) => a.zIndex - b.zIndex),
)

const activeGuides = computed(() => (isActive.value ? guides.value : []))

function activate(element: PdfCanvasElement): void {
  if (pageIndex.value !== props.index) state.setPageIndex(props.index)
  state.select(element.id)
}

function edit(element: PdfCanvasElement): void {
  if (pageIndex.value !== props.index) state.setPageIndex(props.index)
  state.startEditing(element.id)
}

function onSheetPointerDown(): void {
  state.select(null)
  state.stopEditing()
}

function snapFor(element: PdfCanvasElement) {
  return (rect: { xMm: number; yMm: number; widthMm: number; heightMm: number }) =>
    state.snapRect(rect, element.id)
}

function elementComponent(element: PdfCanvasElement) {
  return resolveElementComponent(element)
}

function childProps(element: PdfCanvasElement) {
  const base = { element }
  if (element.type !== 'text') return base
  return {
    ...base,
    editing: isActive.value && editingId.value === element.id,
    zoom: zoom.value,
    readOnly: readOnly.value,
  }
}

function onElementUpdate(element: PdfCanvasElement, patch: ElementPatch): void {
  state.updateElement(element.id, patch)
}
</script>

<template>
  <div
    class="pdf-sheet"
    :class="{ 'pdf-sheet--active': isActive }"
    :data-page-index="index"
    :style="sheetStyle"
    @pointerdown.self="onSheetPointerDown"
  >
    <div v-if="showGrid && isActive" class="pdf-sheet__grid" :style="gridStyle" />

    <div
      v-if="showMarginGuides && isActive"
      class="pdf-sheet__margins"
      :style="marginOverlayStyle"
    />

    <FreeElementWrapper
      v-for="element in sortedElements"
      :key="element.id"
      :element="element"
      :zoom="zoom"
      :page-width-mm="box.widthMm"
      :page-height-mm="box.heightMm"
      :selected="isActive && selectedId === element.id"
      :editing="isActive && editingId === element.id"
      :read-only="readOnly"
      :snap="snapFor(element)"
      @select="activate(element)"
      @start-edit="edit(element)"
      @update="(patch) => state.updateElement(element.id, patch)"
      @guides="state.setGuides($event)"
    >
      <!--
        The element components own their local editing state and report patches
        upward (`RichTextElement` emits the sanitized html and Tiptap JSON). The
        listener must live on the dynamic component itself: Vue does not proxy a
        slot child's emits to the parent component's listeners, so attaching
        `@update` only to `FreeElementWrapper` silently dropped every text edit.
      -->
      <component
        :is="elementComponent(element)"
        v-bind="childProps(element)"
        @update="(patch: ElementPatch) => onElementUpdate(element, patch)"
      />
    </FreeElementWrapper>

    <template v-if="isActive">
      <div
        v-for="(guide, guideIndex) in activeGuides"
        :key="`${guide.axis}-${guide.positionMm}-${guideIndex}`"
        class="pdf-sheet__guide"
        :class="`pdf-sheet__guide--${guide.axis}`"
        :style="
          guide.axis === 'x'
            ? { left: `${mmToPx(guide.positionMm, zoom)}px` }
            : { top: `${mmToPx(guide.positionMm, zoom)}px` }
        "
      />
    </template>
  </div>
</template>

<style scoped>
.pdf-sheet {
  position: relative;
  box-shadow: var(--pdf-shadow-sheet);
  overflow: hidden;
  flex: 0 0 auto;
  transition: box-shadow 0.2s ease;
}

.pdf-sheet--active {
  box-shadow:
    var(--pdf-shadow-sheet),
    0 0 0 1px var(--pdf-accent-line);
}

.pdf-sheet__grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pdf-sheet__margins {
  position: absolute;
  border: 1px dashed var(--pdf-accent-line);
  pointer-events: none;
}

.pdf-sheet__guide {
  position: absolute;
  background: #f43f5e;
  pointer-events: none;
  z-index: 9999;
}

.pdf-sheet__guide--x {
  top: 0;
  bottom: 0;
  width: 1px;
}

.pdf-sheet__guide--y {
  left: 0;
  right: 0;
  height: 1px;
}
</style>
