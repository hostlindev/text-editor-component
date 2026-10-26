<script setup lang="ts">
import { VBtn, VIcon, VList, VListItem, VMenu } from 'vuetify/components'

import type { ShapeKind } from '@/types/editor'

const emit = defineEmits<{
  (event: 'insert-text'): void
  (event: 'insert-image'): void
  (event: 'insert-table'): void
  (event: 'insert-shape', kind: ShapeKind): void
}>()

const shapes: Array<{ kind: ShapeKind; title: string; icon: string }> = [
  { kind: 'rect', title: 'Rectángulo', icon: 'mdi-rectangle-outline' },
  { kind: 'ellipse', title: 'Elipse', icon: 'mdi-circle-outline' },
  { kind: 'line', title: 'Línea', icon: 'mdi-minus' },
]
</script>

<template>
  <div class="insert-controls">
    <VBtn class="insert-controls__btn" variant="text" size="small" @click="emit('insert-text')">
      <VIcon icon="mdi-format-text" size="18" start />
      <span>Cuadro de texto</span>
    </VBtn>

    <VBtn class="insert-controls__btn" variant="text" size="small" @click="emit('insert-image')">
      <VIcon icon="mdi-image-plus" size="18" start />
      <span>Imagen</span>
    </VBtn>

    <VMenu location="bottom" :close-on-content-click="true">
      <template #activator="{ props: activatorProps }">
        <VBtn
          v-bind="activatorProps"
          class="insert-controls__btn"
          variant="text"
          size="small"
          append-icon="mdi-chevron-down"
        >
          <VIcon icon="mdi-shape-outline" size="18" start />
          <span>Forma</span>
        </VBtn>
      </template>
      <VList density="compact" class="insert-controls__menu">
        <VListItem
          v-for="shape in shapes"
          :key="shape.kind"
          :prepend-icon="shape.icon"
          :title="shape.title"
          @click="emit('insert-shape', shape.kind)"
        />
      </VList>
    </VMenu>

    <VBtn class="insert-controls__btn" variant="text" size="small" @click="emit('insert-table')">
      <VIcon icon="mdi-table" size="18" start />
      <span>Tabla</span>
    </VBtn>
  </div>
</template>

<style scoped>
.insert-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/*
 * Insert actions read as primary actions, so they get a bordered tile instead
 * of the flat toolbar treatment used by the Home tab.
 */
.insert-controls__btn {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--pdf-line-strong);
  border-radius: var(--pdf-radius-sm);
  background: var(--pdf-surface);
  color: var(--pdf-ink);
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  box-shadow: 0 1px 1px rgba(15, 23, 42, 0.04);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.insert-controls__btn :deep(.v-icon) {
  color: var(--pdf-accent);
  opacity: 1;
}

.insert-controls__btn:hover {
  border-color: var(--pdf-accent-line);
  background: var(--pdf-accent-soft);
  color: var(--pdf-accent);
  box-shadow: 0 2px 6px -2px rgba(15, 23, 42, 0.18);
}

.insert-controls__btn--ghost {
  border-style: dashed;
  background: transparent;
}

.insert-controls__menu {
  border-radius: var(--pdf-radius-sm);
}
</style>
