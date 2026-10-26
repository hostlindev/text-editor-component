import { describe, expect, it } from 'vitest'

import { DEFAULT_SNAP_THRESHOLD_MM, snapMove } from '../useSnapping'
import { createDocument, createTextElement, normalizeDocument } from '@/types/editor'

const page = { pageWidthMm: 210, pageHeightMm: 297 }

describe('snapMove', () => {
  it('does not move a box that has no alignment target nearby', () => {
    const result = snapMove({ xMm: 20, yMm: 40, widthMm: 10, heightMm: 10 }, page)

    expect(result.xMm).toBe(20)
    expect(result.yMm).toBe(40)
    expect(result.guides).toEqual([])
  })

  it('snaps the page centre', () => {
    const result = snapMove({ xMm: 99.5, yMm: 50, widthMm: 10, heightMm: 10 }, page)

    expect(result.xMm).toBe(100)
    expect(result.guides).toContainEqual({
      axis: 'x',
      positionMm: 105,
      kind: 'center',
    })
  })

  it('snaps to the page left edge', () => {
    const result = snapMove({ xMm: 1.2, yMm: 60, widthMm: 10, heightMm: 10 }, page)

    expect(result.xMm).toBe(0)
    expect(result.guides).toContainEqual({ axis: 'x', positionMm: 0, kind: 'page' })
  })

  it('snaps element edges to sibling edges', () => {
    const result = snapMove(
      { xMm: 32.5, yMm: 20, widthMm: 10, heightMm: 10 },
      page,
      [{ xMm: 42, yMm: 100, widthMm: 20, heightMm: 20 }],
    )

    expect(result.xMm).toBe(32)
    expect(result.guides).toContainEqual({ axis: 'x', positionMm: 42, kind: 'element' })
  })

  it('snaps to the page margins when provided', () => {
    const result = snapMove(
      { xMm: 16, yMm: 100, widthMm: 40, heightMm: 10 },
      {
        ...page,
        marginsMm: { top: 15, right: 15, bottom: 15, left: 15 },
      },
    )

    expect(result.xMm).toBe(15)
    expect(result.guides).toContainEqual({ axis: 'x', positionMm: 15, kind: 'margin' })
  })

  it('respects a custom threshold', () => {
    const rect = { xMm: 5, yMm: 100, widthMm: 10, heightMm: 10 }

    expect(snapMove(rect, { ...page, thresholdMm: 1 }).xMm).toBe(5)
    expect(snapMove(rect, { ...page, thresholdMm: 6 }).xMm).toBe(0)
  })

  it('picks the closest target when several are in range', () => {
    const result = snapMove(
      { xMm: 9, yMm: 20, widthMm: 10, heightMm: 10 },
      page,
      [{ xMm: 20.5, yMm: 100, widthMm: 10, heightMm: 10 }],
    )

    // right edge 19 -> 20.5 is 1.5mm away; left edge 9 -> 0 is 9mm away.
    expect(result.xMm).toBe(10.5)
  })

  it('snaps both axes at once', () => {
    const result = snapMove(
      { xMm: 0.6, yMm: 286.5, widthMm: 10, heightMm: 10 },
      page,
    )

    expect(result.xMm).toBe(0)
    expect(result.yMm).toBe(287)
    expect(result.guides).toHaveLength(2)
  })

  it('uses a 1.5 mm default threshold', () => {
    expect(DEFAULT_SNAP_THRESHOLD_MM).toBe(1.5)
  })
})

describe('snapping against a real document', () => {
  it('accepts sibling elements coming from the document schema', () => {
    const doc = normalizeDocument(
      createDocument({
        pages: [
          {
            id: 'p1',
            elements: [
              createTextElement({ id: 'a', xMm: 20, yMm: 20, widthMm: 40, heightMm: 20 }),
            ],
          },
        ],
      }),
    )

    const sibling = doc.pages[0]!.elements[0]!
    const result = snapMove(
      { xMm: 61, yMm: 20, widthMm: 10, heightMm: 10 },
      page,
      [sibling],
    )

    expect(result.xMm).toBe(60)
  })
})
