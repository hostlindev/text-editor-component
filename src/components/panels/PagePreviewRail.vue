<script setup lang="ts">
import { computed } from 'vue'
import { VChip, VIcon } from 'vuetify/components'

import { useEditorState } from '@/composables/useEditorState'
import PageThumbnail from '../canvas/PageThumbnail.vue'

const THUMB_WIDTH = 118

const state = useEditorState()
const { pages, pageIndex } = state

const count = computed(() => pages.value.length)

/*
 * `setPageIndex` is the same entry point the page labels use: it clamps the
 * index and clears the selection, so focusing a miniature never leaves the
 * inspector pointing at an element from the previous page.
 */
function focusPage(index: number): void {
  state.setPageIndex(index)
}
</script>

<template>
  <div class="pdf-preview">
    <div class="pdf-preview__header">
      <span class="pdf-preview__title">
        <VIcon icon="mdi-file-multiple-outline" size="16" />
        Miniaturas
      </span>
      <VChip size="x-small" class="pdf-preview__count">{{ count }}</VChip>
    </div>

    <div class="pdf-preview__list">
      <button
        v-for="(page, index) in pages"
        :key="page.id"
        type="button"
        class="pdf-preview__thumb"
        :class="{ 'pdf-preview__thumb--active': pageIndex === index }"
        :aria-label="`Ir a la página ${index + 1}`"
        :aria-current="pageIndex === index ? 'true' : undefined"
        @click="focusPage(index)"
      >
        <PageThumbnail :page="page" :width-px="THUMB_WIDTH" />
        <span class="pdf-preview__number">{{ index + 1 }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pdf-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px 12px 16px;
  gap: 8px;
  color: var(--pdf-ink);
  overflow: hidden;
}

.pdf-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 2px 8px;
  border-bottom: 1px solid var(--pdf-line);
}

.pdf-preview__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pdf-ink-muted);
}

.pdf-preview__title :deep(.v-icon) {
  color: var(--pdf-accent);
  opacity: 0.9;
}

.pdf-preview__count {
  font-size: 10.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pdf-preview__list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 2px 2px 8px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.pdf-preview__thumb {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 5px 5px 3px;
  border: 1px solid transparent;
  border-radius: var(--pdf-radius-sm);
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.pdf-preview__thumb:hover {
  background: color-mix(in srgb, var(--pdf-ink) 5%, transparent);
}

.pdf-preview__thumb--active {
  border-color: var(--pdf-accent-line);
  background: var(--pdf-accent-soft);
}

.pdf-preview__thumb--active :deep(.pdf-thumb) {
  box-shadow:
    0 0 0 1px var(--pdf-accent),
    0 2px 6px rgba(15, 23, 42, 0.16);
}

.pdf-preview__number {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--pdf-ink-muted);
  font-variant-numeric: tabular-nums;
}

.pdf-preview__thumb--active .pdf-preview__number {
  color: var(--pdf-accent);
}
</style>
