import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'

/**
 * TipTap extensions available inside every text box.
 *
 * `StarterKit` already ships underline, link and the local undo history;
 * `TextStyleKit` bundles TextStyle, Color, FontFamily, FontSize,
 * BackgroundColor and LineHeight so the ribbon can drive every mark.
 *
 * The factory lives in `composables` because the ribbon also formats a text
 * box that is merely selected: it reparses the stored HTML with the very same
 * extensions instead of keeping a hidden, second set of rules.
 */
export function createTextExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    TextStyleKit.configure({
      fontSize: { types: ['textStyle'] },
    }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
  ]
}
