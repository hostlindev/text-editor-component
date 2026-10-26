<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { VIcon } from 'vuetify/components'

/**
 * A small, self-contained context menu.
 *
 * It is deliberately not a `VMenu`: the panel is positioned from raw pointer
 * coordinates, Vuetify's overlay would have to be teleported out of the editor
 * root (losing the `--pdf-*` design tokens) and its transition makes the open
 * state hard to observe. Dismissal lives here instead: outside pointer, scroll,
 * resize and Escape all close the panel, and Escape is consumed so the canvas
 * does not also clear the selection.
 */
const props = defineProps<{
  open: boolean
  x: number
  y: number
  title: string
  items: Array<{
    id: string
    label: string
    icon: string
    shortcut?: string
    danger?: boolean
    disabled?: boolean
    separatorBefore?: boolean
  }>
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'select', id: string): void
}>()

const root = ref<HTMLElement | null>(null)
const position = ref({ left: 0, top: 0 })

/** Keep the panel inside the window: a click near an edge must not clip it. */
async function place(): Promise<void> {
  position.value = { left: props.x, top: props.y }
  await nextTick()
  const element = root.value
  if (!element) return

  const { width, height } = element.getBoundingClientRect()
  const viewportWidth = window.innerWidth || 0
  const viewportHeight = window.innerHeight || 0
  const margin = 8

  position.value = {
    left: Math.max(margin, Math.min(props.x, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(props.y, viewportHeight - height - margin)),
  }
}

function close(): void {
  emit('close')
}

function onPointerDown(event: PointerEvent): void {
  const element = root.value
  const target = event.target as Node | null
  if (element && target && element.contains(target)) return
  close()
}

function onScrollOrResize(): void {
  close()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    // Stop here: the editor listens on `window` and would clear the selection.
    event.preventDefault()
    event.stopPropagation()
    close()
    return
  }

  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()

  const buttons = Array.from(
    root.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
  )
  if (buttons.length === 0) return

  const current = buttons.findIndex((button) => button === document.activeElement)
  const step = event.key === 'ArrowDown' ? 1 : -1
  const next = (current + step + buttons.length) % buttons.length
  buttons[next]?.focus()
}

function choose(id: string): void {
  emit('select', id)
  close()
}

/*
 * The dismissal listeners exist only while the panel is open, so they can never
 * interfere with an unrelated click on the canvas.
 */
function bind(): void {
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
}

function unbind(): void {
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      unbind()
      return
    }
    bind()
    await place()
    root.value?.focus()
  },
  { immediate: true },
)

watch(
  () => [props.x, props.y],
  () => {
    if (props.open) void place()
  },
)

onBeforeUnmount(unbind)
</script>

<template>
  <div
    v-if="open"
    ref="root"
    class="pdf-context-menu"
    role="menu"
    tabindex="-1"
    :aria-label="title"
    :style="{ left: `${position.left}px`, top: `${position.top}px` }"
    @keydown="onKeydown"
    @contextmenu.prevent
  >
    <template v-for="item in items" :key="item.id">
      <div v-if="item.separatorBefore" class="pdf-context-menu__divider" role="separator" />
      <button
        type="button"
        role="menuitem"
        class="pdf-context-menu__item"
        :class="{ 'pdf-context-menu__item--danger': item.danger }"
        :disabled="item.disabled"
        @click="choose(item.id)"
      >
        <VIcon :icon="item.icon" size="18" />
        <span class="pdf-context-menu__label">{{ item.label }}</span>
        <span v-if="item.shortcut" class="pdf-context-menu__shortcut">{{ item.shortcut }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.pdf-context-menu {
  position: fixed;
  z-index: 2400;
  display: flex;
  flex-direction: column;
  min-width: 224px;
  padding: 5px;
  border: 1px solid var(--pdf-line-strong);
  border-radius: var(--pdf-radius-sm);
  background: var(--pdf-surface);
  color: var(--pdf-ink);
  box-shadow: var(--pdf-shadow-float);
  outline: none;
}

.pdf-context-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.pdf-context-menu__item:hover:not(:disabled),
.pdf-context-menu__item:focus-visible:not(:disabled) {
  background: var(--pdf-accent-soft);
  outline: none;
}

.pdf-context-menu__item:disabled {
  opacity: 0.4;
  cursor: default;
}

.pdf-context-menu__item :deep(.v-icon) {
  color: var(--pdf-ink-muted);
  opacity: 0.9;
}

.pdf-context-menu__item:hover:not(:disabled) :deep(.v-icon) {
  color: var(--pdf-accent);
  opacity: 1;
}

.pdf-context-menu__item--danger {
  color: #c62828;
}

.pdf-context-menu__item--danger :deep(.v-icon) {
  color: inherit;
}

.pdf-context-menu__label {
  flex: 1 1 auto;
}

.pdf-context-menu__shortcut {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--pdf-ink-muted);
  font-variant-numeric: tabular-nums;
}

.pdf-context-menu__divider {
  height: 1px;
  margin: 4px 6px;
  background: var(--pdf-line);
}
</style>
