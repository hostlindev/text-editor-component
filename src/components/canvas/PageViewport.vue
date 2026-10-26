<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { VBtn, VBtnGroup, VTooltip } from 'vuetify/components'

import { useEditorState } from '@/composables/useEditorState'
import { mmToPx } from '@/composables/useUnitConverter'
import DocumentPage from './DocumentPage.vue'

const RULER_SIZE = 26
const PAGE_PADDING = 32

const state = useEditorState()
const { zoom, pageIndex, pages, pageBox, showRulers } = state

const scroller = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
const scrollLeft = ref(0)
const scrollTop = ref(0)

let observer: ResizeObserver | null = null

onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !scroller.value) return
  observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) containerWidth.value = entry.contentRect.width
  })
  observer.observe(scroller.value)
  containerWidth.value = scroller.value.clientWidth
})

onBeforeUnmount(() => observer?.disconnect())

const pageWidthPx = computed(() => mmToPx(pageBox.value.widthMm, zoom.value))

/** Left edge of the sheet inside the scroller, used to align the rulers. */
const originX = computed(() =>
  Math.max(PAGE_PADDING, (containerWidth.value - pageWidthPx.value) / 2),
)

const xTicks = computed(() => {
  const ticks: Array<{ mm: number; px: number; label: string }> = []
  const width = pageBox.value.widthMm
  for (let mm = 0; mm <= width; mm += 10) {
    ticks.push({
      mm,
      px: mmToPx(mm, zoom.value),
      label: mm === 0 ? '' : String(mm / 10),
    })
  }
  return ticks
})

const yTicks = computed(() => {
  const ticks: Array<{ mm: number; px: number; label: string }> = []
  const height = pageBox.value.heightMm
  for (let mm = 0; mm <= height; mm += 10) {
    ticks.push({
      mm,
      px: mmToPx(mm, zoom.value),
      label: mm === 0 ? '' : String(mm / 10),
    })
  }
  return ticks
})

function onScroll(event: Event): void {
  const target = event.target as HTMLElement
  scrollLeft.value = target.scrollLeft
  scrollTop.value = target.scrollTop
}

function onWheelZoom(event: WheelEvent): void {
  if (event.deltaY < 0) state.zoomIn()
  else state.zoomOut()
}

function clearSelection(): void {
  state.select(null)
  state.stopEditing()
}

function focusPage(index: number): void {
  pageIndex.value = index
}
</script>

<template>
  <div class="pdf-viewport" :class="{ 'pdf-viewport--no-rulers': !showRulers }">
    <div class="pdf-viewport__corner" />

    <div v-if="showRulers" class="pdf-viewport__ruler pdf-viewport__ruler--x">
      <div
        class="pdf-viewport__ticks"
        :style="{ marginLeft: `${originX}px`, transform: `translateX(${-scrollLeft}px)` }"
      >
        <span
          v-for="tick in xTicks"
          :key="tick.mm"
          class="pdf-viewport__tick pdf-viewport__tick--x"
          :style="{ left: `${tick.px}px` }"
        >
          {{ tick.label }}
        </span>
      </div>
    </div>

    <div v-if="showRulers" class="pdf-viewport__ruler pdf-viewport__ruler--y">
      <div
        class="pdf-viewport__ticks"
        :style="{ marginTop: `${PAGE_PADDING}px`, transform: `translateY(${-scrollTop}px)` }"
      >
        <span
          v-for="tick in yTicks"
          :key="tick.mm"
          class="pdf-viewport__tick pdf-viewport__tick--y"
          :style="{ top: `${tick.px}px` }"
        >
          {{ tick.label }}
        </span>
      </div>
    </div>

    <div
      ref="scroller"
      class="pdf-viewport__scroller"
      @scroll="onScroll"
      @wheel.ctrl.prevent="onWheelZoom"
      @pointerdown.self="clearSelection"
    >
      <div class="pdf-viewport__pages" :style="{ padding: `${PAGE_PADDING}px` }" @pointerdown.self="clearSelection">
        <div v-for="(page, index) in pages" :key="page.id" class="pdf-viewport__page">
          <DocumentPage :index="index" />
          <button
            type="button"
            class="pdf-viewport__page-label"
            :class="{ 'pdf-viewport__page-label--active': pageIndex === index }"
            @click="focusPage(index)"
          >
            Página {{ index + 1 }}
          </button>
        </div>
      </div>

      <div class="pdf-viewport__zoom">
        <VBtnGroup class="pdf-viewport__zoom-group" density="comfortable" variant="elevated" elevation="0">
          <!--
            Each button keeps its own tooltip, and the activator is a span so the
            explanation still appears while the button is disabled (a disabled
            Vuetify button ignores pointer events). The group's own rounded
            overflow keeps the pill shape across the wrappers.
          -->
          <VTooltip text="Alejar: reduce el zoom de la página" location="top" open-delay="400">
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="pdf-viewport__zoom-slot">
                <VBtn
                  icon="mdi-minus"
                  size="small"
                  height="34"
                  aria-label="Alejar"
                  :disabled="zoom <= 0.5"
                  @click="state.zoomOut()"
                />
              </span>
            </template>
          </VTooltip>
          <VTooltip
            text="Ajustar al ancho: encaja el ancho de la página en el área visible"
            location="top"
            open-delay="400"
          >
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="pdf-viewport__zoom-slot">
                <VBtn
                  size="small"
                  height="34"
                  class="pdf-viewport__zoom-value"
                  aria-label="Ajustar al ancho"
                  @click="state.fitToWidth(containerWidth)"
                >
                  {{ Math.round(zoom * 100) }}%
                </VBtn>
              </span>
            </template>
          </VTooltip>
          <VTooltip text="Acercar: aumenta el zoom de la página" location="top" open-delay="400">
            <template #activator="{ props: tooltipProps }">
              <span v-bind="tooltipProps" class="pdf-viewport__zoom-slot">
                <VBtn
                  icon="mdi-plus"
                  size="small"
                  height="34"
                  aria-label="Acercar"
                  :disabled="zoom >= 2"
                  @click="state.zoomIn()"
                />
              </span>
            </template>
          </VTooltip>
        </VBtnGroup>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pdf-viewport {
  display: grid;
  grid-template-columns: v-bind('`${RULER_SIZE}px`') 1fr;
  grid-template-rows: v-bind('`${RULER_SIZE}px`') 1fr;
  height: 100%;
  min-height: 0;
  background: var(--pdf-canvas);
}

.pdf-viewport--no-rulers {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.pdf-viewport--no-rulers .pdf-viewport__corner {
  display: none;
}

.pdf-viewport__corner {
  background: var(--pdf-surface-muted);
  border-right: 1px solid var(--pdf-line);
  border-bottom: 1px solid var(--pdf-line);
}

.pdf-viewport__ruler {
  position: relative;
  overflow: hidden;
  background: var(--pdf-surface);
  color: var(--pdf-ink-muted);
  font-size: 9px;
  font-family: var(--pdf-font);
  font-weight: 500;
  user-select: none;
}

.pdf-viewport__ruler--x {
  border-bottom: 1px solid var(--pdf-line);
}

.pdf-viewport__ruler--y {
  border-right: 1px solid var(--pdf-line);
}

.pdf-viewport__ticks {
  position: absolute;
  inset: 0;
  will-change: transform;
}

.pdf-viewport__tick--x {
  position: absolute;
  top: 0;
  height: 100%;
  padding-left: 3px;
  border-left: 1px solid var(--pdf-line-strong);
  line-height: v-bind('`${RULER_SIZE}px`');
}

.pdf-viewport__tick--y {
  position: absolute;
  left: 0;
  width: 100%;
  padding-top: 1px;
  border-top: 1px solid var(--pdf-line-strong);
  text-align: center;
}

/*
 * The canvas reads as a light table: a soft vertical wash plus a dotted grid,
 * so the white sheet is the brightest element on screen.
 */
.pdf-viewport__scroller {
  position: relative;
  overflow: auto;
  min-width: 0;
  min-height: 0;
  outline: none;
  background-color: var(--pdf-canvas);
  background-image:
    radial-gradient(
      circle at 1px 1px,
      color-mix(in srgb, var(--pdf-ink) 9%, transparent) 1px,
      transparent 0
    ),
    linear-gradient(180deg, color-mix(in srgb, var(--pdf-canvas) 74%, var(--pdf-surface)) 0%, var(--pdf-canvas) 45%);
  background-size:
    18px 18px,
    100% 100%;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--pdf-ink) 24%, transparent) transparent;
}

.pdf-viewport__scroller::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.pdf-viewport__scroller::-webkit-scrollbar-track {
  background: transparent;
}

.pdf-viewport__scroller::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background-clip: content-box;
  background-color: color-mix(in srgb, var(--pdf-ink) 24%, transparent);
}

.pdf-viewport__scroller::-webkit-scrollbar-thumb:hover {
  background-color: color-mix(in srgb, var(--pdf-ink) 38%, transparent);
}

.pdf-viewport__pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  min-width: fit-content;
  min-height: 100%;
  box-sizing: border-box;
}

.pdf-viewport__page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.pdf-viewport__page-label {
  border: 1px solid transparent;
  background: transparent;
  color: var(--pdf-ink-muted);
  font-family: var(--pdf-font);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  padding: 2px 10px;
  border-radius: 999px;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.pdf-viewport__page-label:hover {
  background: color-mix(in srgb, var(--pdf-surface) 80%, transparent);
  border-color: var(--pdf-line);
  color: var(--pdf-ink);
}

.pdf-viewport__page-label--active {
  background: var(--pdf-surface);
  border-color: var(--pdf-accent-line);
  color: var(--pdf-accent);
  font-weight: 600;
}

.pdf-viewport__zoom {
  position: sticky;
  bottom: 14px;
  display: flex;
  justify-content: flex-end;
  padding: 0 18px 4px;
  pointer-events: none;
  margin-top: -46px;
}

.pdf-viewport__zoom > * {
  pointer-events: auto;
}

.pdf-viewport__zoom-group {
  overflow: hidden;
  border: 1px solid var(--pdf-line-strong);
  border-radius: 999px;
  background: var(--pdf-surface);
  box-shadow: var(--pdf-shadow-float);
}

/* Tooltip activators: a real box (not `display: contents`) so a disabled
   button's span still receives the hover, and vertical centring survives. */
.pdf-viewport__zoom-slot {
  display: inline-flex;
  align-items: center;
}

/* Height comes from the button's own `height` prop: VBtnGroup injects
   `height: auto` into horizontal groups, which beats any stylesheet rule. */
.pdf-viewport__zoom-group :deep(.v-btn) {
  color: var(--pdf-ink);
}

/* Icon buttons only, so the percentage button keeps its own wider min-width. */
.pdf-viewport__zoom-group :deep(.v-btn--icon) {
  min-width: 36px;
}

.pdf-viewport__zoom-group :deep(.v-btn--variant-elevated) {
  background: transparent;
  box-shadow: none;
}

.pdf-viewport__zoom-value {
  min-width: 62px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
