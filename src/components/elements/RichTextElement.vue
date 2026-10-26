<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'

import type { PdfCanvasElement } from '@/types/editor'
import { useEditorState } from '@/composables/useEditorState'
import { pxToMm, roundMm } from '@/composables/useUnitConverter'
import { sanitizeRichTextHtml } from '@/security/sanitizeHtml'
import { createTextExtensions } from '@/composables/textExtensions'

const props = defineProps<{
  element: PdfCanvasElement
  editing: boolean
  zoom: number
  readOnly: boolean
}>()

const emit = defineEmits<{
  (event: 'update', patch: { content?: Record<string, unknown>; heightMm?: number }): void
}>()

const state = useEditorState()
const editor = shallowRef<Editor | null>(null)

const boxStyle = computed(() => {
  const { style } = props.element
  return {
    padding: style.paddingMm ? `${style.paddingMm}mm` : undefined,
    background: style.backgroundColor,
    border:
      style.borderColor && style.borderWidthPt
        ? `${style.borderWidthPt}pt solid ${style.borderColor}`
        : undefined,
    borderRadius: style.borderRadiusMm ? `${style.borderRadiusMm}mm` : undefined,
    opacity: style.opacity ?? undefined,
  }
})

function measureHeight(): number {
  const dom = editor.value?.view.dom
  if (!dom) return props.element.heightMm
  const needed = pxToMm(dom.scrollHeight, props.zoom)
  return roundMm(Math.max(props.element.heightMm, needed + 1))
}

function mount(): void {
  if (editor.value) return

  const instance = new Editor({
    extensions: createTextExtensions(),
    content: props.element.content.html || '<p></p>',
    editable: !props.readOnly,
    editorProps: {
      attributes: {
        class: 'pdf-rt__prose',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: current }) => {
      emit('update', {
        content: { html: current.getHTML(), tiptapJson: current.getJSON() },
        heightMm: measureHeight(),
      })
    },
    onTransaction: () => {
      state.activeTextVersion.value += 1
    },
    onFocus: () => {
      state.setActiveEditor(instance)
    },
  })

  editor.value = instance
  state.setActiveEditor(instance)
  instance.commands.focus('end')
}

function unmount(): void {
  const instance = editor.value
  editor.value = null
  if (!instance) return
  if (state.activeEditor.value === instance) state.setActiveEditor(null)
  instance.destroy()
}

watch(
  () => props.editing,
  async (editing) => {
    if (editing) {
      await nextTick()
      mount()
    } else {
      unmount()
    }
  },
  { immediate: true },
)

onBeforeUnmount(unmount)
</script>

<template>
  <div class="pdf-rt" :class="{ 'pdf-rt--editing': editing }" :style="boxStyle">
    <EditorContent
      v-if="editing && editor"
      :editor="editor"
      class="pdf-rt__content"
    />
    <div
      v-else-if="!editing"
      class="pdf-rt__content pdf-rt__static"
      v-html="sanitizeRichTextHtml(element.content.html || '')"
    />
  </div>
</template>

<style scoped>
.pdf-rt {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: visible;
  color: #000;
  /*
   * The chrome font is a UI font; the page must look like the exported PDF.
   * `--pdf-doc-font` is set by `PdfOfficeEditor` from the declared fonts and
   * falls back to the same family the print exporter ships.
   */
  font-family: var(--pdf-doc-font, Inter);
}

.pdf-rt__content {
  width: 100%;
  height: 100%;
  outline: none;
}

.pdf-rt__content :deep(.pdf-rt__prose) {
  outline: none;
  min-height: 100%;
  font-size: 12pt;
  line-height: 1.35;
}

.pdf-rt__content :deep(p) {
  margin: 0;
}

.pdf-rt__content :deep(ul),
.pdf-rt__content :deep(ol) {
  margin: 0;
  padding-left: 5mm;
}

.pdf-rt--editing {
  cursor: text;
}

.pdf-rt__static {
  overflow: hidden;
  overflow-wrap: break-word;
  /*
   * The static view and the editing view must agree: the ribbon offers 12pt as
   * the effective size of an unformatted box, and the print exporter ships the
   * same base, so the read-only render cannot rely on the browser default.
   */
  font-size: 12pt;
  line-height: 1.35;
}
</style>
