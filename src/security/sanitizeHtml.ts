/**
 * Defensive HTML sanitiser for rich text.
 *
 * The editor only produces markup through TipTap, but documents can be imported
 * from the host application or restored from a database, so the HTML that
 * reaches `v-html` (and the exported document) is treated as untrusted.
 *
 * This is a conservative allow-list-free scrubber: it removes executable
 * elements, inline event handlers and script-capable URLs while leaving the
 * formatting markup intact. It is defence in depth, not a replacement for
 * server-side sanitisation of third-party templates.
 */

const BLOCKED_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
]

export function sanitizeRichTextHtml(html: string): string {
  if (!html) return ''

  let output = html

  for (const tag of BLOCKED_TAGS) {
    const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
    const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi')
    output = output.replace(paired, '').replace(selfClosing, '')
  }

  // Inline event handlers: on*="..." / on*='...' / on*=value
  output = output
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')

  // Script-capable URLs in href/src attributes.
  output = output.replace(
    /\b(href|src|xlink:href)\s*=\s*(["'])\s*(?:javascript|vbscript|data:text\/html)[^"']*\2/gi,
    '$1=$2#$2',
  )

  return output
}

export function hasExecutableMarkup(html: string): boolean {
  return sanitizeRichTextHtml(html) !== html
}
