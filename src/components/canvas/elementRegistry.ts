import type { PdfCanvasElement } from '@/types/editor'
import ImageElement from '../elements/ImageElement.vue'
import RichTextElement from '../elements/RichTextElement.vue'
import ShapeElement from '../elements/ShapeElement.vue'
import TableElement from '../elements/TableElement.vue'

/**
 * One canvas element type maps to one renderer. The page and its miniature share
 * this table so a new element type can never render on the sheet and be missing
 * from the preview.
 */
export function resolveElementComponent(element: PdfCanvasElement) {
  switch (element.type) {
    case 'image':
      return ImageElement
    case 'shape':
      return ShapeElement
    case 'table':
      return TableElement
    default:
      return RichTextElement
  }
}
