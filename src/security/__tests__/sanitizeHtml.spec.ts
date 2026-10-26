import { describe, expect, it } from 'vitest'

import { hasExecutableMarkup, sanitizeRichTextHtml } from '../sanitizeHtml'

describe('sanitizeRichTextHtml', () => {
  it('keeps formatting markup untouched', () => {
    const html = '<p>Hola <strong>mundo</strong> <span style="color: red">!</span></p>'
    expect(sanitizeRichTextHtml(html)).toBe(html)
  })

  it('removes script blocks with their content', () => {
    const html = '<p>ok</p><script>alert("x")</script>'
    expect(sanitizeRichTextHtml(html)).toBe('<p>ok</p>')
  })

  it('removes self-closing and unclosed dangerous tags', () => {
    expect(sanitizeRichTextHtml('<iframe src="x"></iframe><p>ok</p>')).toBe('<p>ok</p>')
    expect(sanitizeRichTextHtml('<p>ok</p><style>body{}</style>')).toBe('<p>ok</p>')
    expect(sanitizeRichTextHtml('<embed src="x"><p>ok</p>')).toBe('<p>ok</p>')
  })

  it('strips inline event handlers', () => {
    const html = '<p onclick="steal()" onmouseover=\'x()\'>text</p>'
    expect(sanitizeRichTextHtml(html)).toBe('<p>text</p>')
  })

  it('neutralises javascript urls but keeps normal links', () => {
    const html =
      '<a href="javascript:alert(1)">x</a><a href="https://ok.example">y</a><img src="data:image/png;base64,AA" />'
    const sanitized = sanitizeRichTextHtml(html)

    expect(sanitized).not.toContain('javascript:')
    expect(sanitized).toContain('https://ok.example')
    expect(sanitized).toContain('data:image/png;base64,AA')
  })

  it('handles empty input', () => {
    expect(sanitizeRichTextHtml('')).toBe('')
  })

  it('reports whether the markup had to change', () => {
    expect(hasExecutableMarkup('<p>ok</p>')).toBe(false)
    expect(hasExecutableMarkup('<script>x</script>')).toBe(true)
  })
})
