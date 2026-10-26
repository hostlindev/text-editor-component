<script setup lang="ts">
import { computed, ref } from 'vue'

import type { PdfCanvasElement } from '@/types/editor'
import { clampRectToPage, type SnapLine, type SnapRect } from '@/composables/useSnapping'
import { mmToPx, pxToMm, roundMm } from '@/composables/useUnitConverter'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
type ResizePatch = Partial<SnapRect> & { rotationDeg?: number }

const props = defineProps<{
  element: PdfCanvasElement
  zoom: number
  pageWidthMm: number
  pageHeightMm: number
  selected: boolean
  editing: boolean
  readOnly: boolean
  snap?: (rect: SnapRect) => { rect: SnapRect; guides: SnapLine[] }
}>()

const emit = defineEmits<{
  (event: 'select'): void
  (event: 'start-edit'): void
  (event: 'update', patch: ResizePatch): void
  (event: 'guides', lines: SnapLine[]): void
}>()

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN_SIZE_MM = 5

const root = ref<HTMLElement | null>(null)

/**
 * Capturing the pointer is a nice-to-have: it keeps the drag alive when the
 * cursor leaves the element. It throws when the pointer is no longer active
 * (a released or synthetic pointer), and an exception here would abort the
 * gesture before `preventDefault()`.
 */
function capturePointer(event: PointerEvent): void {
  try {
    ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  } catch {
    // The gesture still works through the element's own pointer handlers.
  }
}

const interactive = computed(
  () => !props.readOnly && !props.element.locked && !props.editing,
)

function mm(value: number): string {
  return `${mmToPx(value, props.zoom)}px`
}

const boxStyle = computed(() => ({
  left: mm(props.element.xMm),
  top: mm(props.element.yMm),
  width: mm(props.element.widthMm),
  height: mm(props.element.heightMm),
  zIndex: props.element.zIndex,
  transform: props.element.rotationDeg
    ? `rotate(${props.element.rotationDeg}deg)`
    : undefined,
}))

/* ------------------------------------------------------------------ moving */

let drag: { startX: number; startY: number; rect: SnapRect } | null = null

function onPointerDown(event: PointerEvent): void {
  if (!interactive.value || event.button !== 0) return
  if ((event.target as HTMLElement).closest('[data-handle]')) return

  emit('select')
  drag = {
    startX: event.clientX,
    startY: event.clientY,
    rect: {
      xMm: props.element.xMm,
      yMm: props.element.yMm,
      widthMm: props.element.widthMm,
      heightMm: props.element.heightMm,
    },
  }
  capturePointer(event)
  event.preventDefault()
}

function onPointerMove(event: PointerEvent): void {
  if (!drag) return
  const dx = pxToMm(event.clientX - drag.startX, props.zoom)
  const dy = pxToMm(event.clientY - drag.startY, props.zoom)

  const raw: SnapRect = {
    ...drag.rect,
    xMm: roundMm(drag.rect.xMm + dx),
    yMm: roundMm(drag.rect.yMm + dy),
  }

  const snapped = props.snap?.(raw) ?? { rect: raw, guides: [] }
  emit('guides', snapped.guides)
  emit('update', clampRectToPage(snapped.rect, props.pageWidthMm, props.pageHeightMm))
}

function endGesture(): void {
  drag = null
  resize = null
  rotate = null
  emit('guides', [])
}

function onDoubleClick(): void {
  if (!props.readOnly && !props.element.locked) emit('start-edit')
}

/* ---------------------------------------------------------------- resizing */

let resize: {
  dir: Handle
  startX: number
  startY: number
  rect: SnapRect
} | null = null

function onResizeDown(event: PointerEvent, dir: Handle): void {
  if (props.readOnly || props.element.locked || event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  emit('select')
  resize = {
    dir,
    startX: event.clientX,
    startY: event.clientY,
    rect: {
      xMm: props.element.xMm,
      yMm: props.element.yMm,
      widthMm: props.element.widthMm,
      heightMm: props.element.heightMm,
    },
  }
  capturePointer(event)
}

function onResizeMove(event: PointerEvent): void {
  if (!resize) return
  const { dir, rect } = resize
  const dx = pxToMm(event.clientX - resize.startX, props.zoom)
  const dy = pxToMm(event.clientY - resize.startY, props.zoom)

  let x = rect.xMm
  let y = rect.yMm
  let width = rect.widthMm
  let height = rect.heightMm

  if (dir.includes('e')) width = rect.widthMm + dx
  if (dir.includes('s')) height = rect.heightMm + dy
  if (dir.includes('w')) {
    width = rect.widthMm - dx
    x = rect.xMm + dx
  }
  if (dir.includes('n')) {
    height = rect.heightMm - dy
    y = rect.yMm + dy
  }

  width = Math.max(width, MIN_SIZE_MM)
  height = Math.max(height, MIN_SIZE_MM)

  const corner = dir.length === 2
  if (event.shiftKey && corner) {
    const ratio = rect.widthMm / rect.heightMm
    height = Math.max(width / ratio, MIN_SIZE_MM)
    width = height * ratio
    if (dir.includes('w')) x = rect.xMm + rect.widthMm - width
    if (dir.includes('n')) y = rect.yMm + rect.heightMm - height
  }

  emit(
    'update',
    clampRectToPage({ xMm: roundMm(x), yMm: roundMm(y), widthMm: roundMm(width), heightMm: roundMm(height) }, props.pageWidthMm, props.pageHeightMm, MIN_SIZE_MM),
  )
}

/* ---------------------------------------------------------------- rotating */

let rotate: { startAngle: number; startRotation: number; centerX: number; centerY: number } | null =
  null

function pointerAngle(event: PointerEvent): number {
  const box = root.value?.getBoundingClientRect()
  if (!box) return 0
  const centerX = box.left + box.width / 2
  const centerY = box.top + box.height / 2
  return (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI
}

function onRotateDown(event: PointerEvent): void {
  if (props.readOnly || props.element.locked || event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  emit('select')
  rotate = {
    startAngle: pointerAngle(event),
    startRotation: props.element.rotationDeg,
    centerX: 0,
    centerY: 0,
  }
  capturePointer(event)
}

function onRotateMove(event: PointerEvent): void {
  if (!rotate) return
  let degrees = rotate.startRotation + (pointerAngle(event) - rotate.startAngle)
  if (event.shiftKey) degrees = Math.round(degrees / 15) * 15
  degrees = Math.round(degrees) % 360
  emit('update', { rotationDeg: degrees })
}

defineExpose({ endGesture })
</script>

<template>
  <div
    ref="root"
    class="pdf-el"
    :class="{
      'pdf-el--selected': selected && !editing,
      'pdf-el--editing': editing,
      'pdf-el--locked': element.locked,
      'pdf-el--interactive': interactive,
      'pdf-el--rotated': element.rotationDeg !== 0,
    }"
    :style="boxStyle"
    :data-element-id="element.id"
    role="group"
    :aria-label="element.name || `${element.type} element`"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endGesture"
    @pointercancel="endGesture"
    @dblclick.stop="onDoubleClick"
  >
    <slot />

    <template v-if="selected && !readOnly && !element.locked && !editing">
      <span
        v-for="handle in HANDLES"
        :key="handle"
        :data-handle="handle"
        class="pdf-el__handle"
        :class="`pdf-el__handle--${handle}`"
        @pointerdown="onResizeDown($event, handle)"
        @pointermove="onResizeMove"
        @pointerup="endGesture"
        @pointercancel="endGesture"
      />
      <span
        class="pdf-el__rotate"
        data-handle="rotate"
        title="Rotate (Shift snaps to 15°)"
        @pointerdown="onRotateDown"
        @pointermove="onRotateMove"
        @pointerup="endGesture"
        @pointercancel="endGesture"
      />
    </template>

    <span v-if="element.locked" class="pdf-el__lock" aria-hidden="true">🔒</span>
  </div>
</template>

<style scoped>
.pdf-el {
  position: absolute;
  box-sizing: border-box;
  touch-action: none;
}

.pdf-el--interactive {
  cursor: move;
}

.pdf-el--editing {
  cursor: text;
}

.pdf-el--selected {
  outline: 1.5px solid var(--pdf-accent, #2563eb);
  outline-offset: 0;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--pdf-accent, #2563eb) 12%, transparent);
}

.pdf-el__handle {
  position: absolute;
  width: 9px;
  height: 9px;
  background: #fff;
  border: 1.5px solid var(--pdf-accent, #2563eb);
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.28);
  z-index: 2;
  transition: transform 0.1s ease;
}

.pdf-el__handle:hover {
  transform: scale(1.15);
}

.pdf-el__handle--nw { top: -5px; left: -5px; cursor: nwse-resize; }
.pdf-el__handle--n { top: -5px; left: calc(50% - 4.5px); cursor: ns-resize; }
.pdf-el__handle--ne { top: -5px; right: -5px; cursor: nesw-resize; }
.pdf-el__handle--e { top: calc(50% - 4.5px); right: -5px; cursor: ew-resize; }
.pdf-el__handle--se { bottom: -5px; right: -5px; cursor: nwse-resize; }
.pdf-el__handle--s { bottom: -5px; left: calc(50% - 4.5px); cursor: ns-resize; }
.pdf-el__handle--sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
.pdf-el__handle--w { top: calc(50% - 4.5px); left: -5px; cursor: ew-resize; }

.pdf-el__rotate {
  position: absolute;
  top: -30px;
  left: calc(50% - 7px);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 1.5px solid var(--pdf-accent, #2563eb);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.3);
  cursor: grab;
  z-index: 2;
}

.pdf-el__rotate:active {
  cursor: grabbing;
}

/* Connector between the rotate handle and the box edge. */
.pdf-el__rotate::before {
  content: '';
  position: absolute;
  top: 13px;
  left: calc(50% - 0.5px);
  width: 1px;
  height: 16px;
  background: var(--pdf-accent, #2563eb);
  opacity: 0.55;
}

.pdf-el__lock {
  position: absolute;
  right: 2px;
  bottom: 2px;
  font-size: 10px;
  opacity: 0.6;
}
</style>
