import { describe, expect, it } from 'vitest'
import type { Puzzle } from '@/types/puzzle'
import { valueToPosition } from './scale'
import { bandForError, scorePuzzle, scoringCurve, skillCredit, TOTAL_SCORE } from './scoring'

const puzzle: Puzzle = {
  id: 't1',
  number: 1,
  slug: 'test',
  title: 'Test',
  prompt: '',
  category: 'Time',
  unit: 's',
  scaleType: 'linear',
  minValue: 0,
  maxValue: 100,
  minLabel: '0',
  maxLabel: '100',
  difficulty: 'easy',
  items: [
    { id: 'a', label: 'A', value: 25, displayValue: '25', fact: '' },
    { id: 'b', label: 'B', value: 50, displayValue: '50', fact: '' },
    { id: 'c', label: 'C', value: 75, displayValue: '75', fact: '' },
    { id: 'd', label: 'D', value: 100, displayValue: '100', fact: '' },
  ],
}

/** Perfect placements: each item at its true normalized position. */
function perfectPlacements() {
  return Object.fromEntries(
    puzzle.items.map((i) => [
      i.id,
      valueToPosition(i.value, puzzle.minValue, puzzle.maxValue, puzzle.scaleType),
    ]),
  )
}

describe('scoringCurve', () => {
  it('gives full credit at zero error', () => {
    expect(scoringCurve(0)).toBeCloseTo(1, 10)
  })

  it('stays generous for small errors', () => {
    expect(scoringCurve(0.1)).toBeGreaterThan(0.75)
  })

  it('penalizes large errors heavily', () => {
    expect(scoringCurve(0.5)).toBeLessThan(0.1)
  })

  it('is monotonically decreasing', () => {
    expect(scoringCurve(0.1)).toBeGreaterThan(scoringCurve(0.2))
    expect(scoringCurve(0.2)).toBeGreaterThan(scoringCurve(0.4))
  })
})

describe('skillCredit', () => {
  it('still pays full credit for a perfect guess', () => {
    expect(skillCredit(0)).toBeCloseTo(1, 10)
  })

  it('pays nothing for a chance-level guess', () => {
    // Credit hits the chance baseline around 0.216 of the track.
    expect(skillCredit(0.25)).toBe(0)
    expect(skillCredit(1)).toBe(0)
  })

  it('is never negative', () => {
    for (let e = 0; e <= 1; e += 0.05) expect(skillCredit(e)).toBeGreaterThanOrEqual(0)
  })
})

describe('bandForError', () => {
  it('classifies bands by distance', () => {
    expect(bandForError(0)).toBe('exact')
    expect(bandForError(0.05)).toBe('very-close')
    expect(bandForError(0.1)).toBe('close')
    expect(bandForError(0.2)).toBe('off')
    expect(bandForError(0.6)).toBe('far-off')
  })

  // The bands and the curve drifted apart once already: "Off" ran past the
  // point where credit reaches zero, so its upper half paid the same nothing
  // as "Far off".
  it('reserves far-off for errors that earn nothing, and pays every other band', () => {
    for (let e = 0; e <= 1; e += 0.005) {
      if (bandForError(e) === 'far-off') expect(skillCredit(e)).toBe(0)
      else expect(skillCredit(e)).toBeGreaterThan(0)
    }
  })
})

describe('scorePuzzle', () => {
  it('awards a perfect 100 for perfect placements', () => {
    const result = scorePuzzle(puzzle, perfectPlacements())
    expect(result.total).toBe(TOTAL_SCORE)
    expect(result.items.every((i) => i.band === 'exact')).toBe(true)
  })

  it('never returns a negative total', () => {
    // Place everything at the wrong extreme.
    const placements = Object.fromEntries(puzzle.items.map((i) => [i.id, 0]))
    const result = scorePuzzle(puzzle, placements)
    expect(result.total).toBeGreaterThanOrEqual(0)
  })

  it('scores wildly incorrect answers near zero', () => {
    // True positions are 0.25..1.0; place them all at 0 for maximum error.
    const placements = Object.fromEntries(puzzle.items.map((i) => [i.id, 0]))
    const result = scorePuzzle(puzzle, placements)
    expect(result.total).toBeLessThan(20)
  })

  it('scores a missing placement as zero rather than a guess at the far left', () => {
    const result = scorePuzzle(puzzle, {})
    expect(result.items).toHaveLength(puzzle.items.length)
    expect(result.total).toBe(0)
    expect(result.items.every((i) => i.score === 0)).toBe(true)
  })

  it('does not reward leaving the lowest-value item unplaced', () => {
    const p = perfectPlacements()
    delete p['a']
    const result = scorePuzzle(puzzle, p)
    expect(result.items.find((i) => i.itemId === 'a')!.score).toBe(0)
  })

  it('sums the item scores to the total', () => {
    const p = perfectPlacements()
    p['a'] = (p['a'] as number) + 0.07
    p['c'] = (p['c'] as number) - 0.13
    const result = scorePuzzle(puzzle, p)
    const summed = result.items.reduce((t, i) => t + i.score, 0)
    expect(Math.abs(summed - result.total)).toBeLessThanOrEqual(1)
  })

  it('is deterministic', () => {
    const p = perfectPlacements()
    expect(scorePuzzle(puzzle, p)).toEqual(scorePuzzle(puzzle, p))
  })

  it('gives partial credit for near misses', () => {
    const p = perfectPlacements()
    p['a'] = (p['a'] as number) + 0.08
    const result = scorePuzzle(puzzle, p)
    const itemA = result.items.find((i) => i.itemId === 'a')!
    expect(itemA.score).toBeGreaterThan(0)
    expect(itemA.score).toBeLessThan(itemA.maxScore)
  })
})
