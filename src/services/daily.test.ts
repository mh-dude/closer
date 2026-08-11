import { describe, expect, it } from 'vitest'
import { dailyNumber, daysSinceAnchor, getDailyPuzzle, isScheduledRun } from './daily'
import type { Puzzle } from '@/types/puzzle'

const ANCHOR = '2026-01-01'

const makeSet = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, number: i + 1 }) as Puzzle)

describe('daysSinceAnchor', () => {
  it('is 0 on the anchor day', () => {
    expect(daysSinceAnchor(new Date(2026, 0, 1), ANCHOR)).toBe(0)
  })

  it('counts whole days forward', () => {
    expect(daysSinceAnchor(new Date(2026, 0, 8), ANCHOR)).toBe(7)
  })

  it('ignores the time of day', () => {
    expect(daysSinceAnchor(new Date(2026, 0, 3, 23, 59), ANCHOR)).toBe(2)
    expect(daysSinceAnchor(new Date(2026, 0, 3, 0, 1), ANCHOR)).toBe(2)
  })
})

describe('dailyNumber', () => {
  it('serves puzzle 1 on launch day and advances by one a day', () => {
    expect(dailyNumber(new Date(2026, 0, 1), ANCHOR)).toBe(1)
    expect(dailyNumber(new Date(2026, 0, 2), ANCHOR)).toBe(2)
    expect(dailyNumber(new Date(2026, 0, 31), ANCHOR)).toBe(31)
  })
})

describe('getDailyPuzzle', () => {
  it('selects by release number, not by position', () => {
    const puzzles = makeSet(5)
    expect(getDailyPuzzle(puzzles, new Date(2026, 0, 3), ANCHOR)?.number).toBe(3)
  })

  it('is unaffected by the order puzzles are listed in', () => {
    const shuffled = [...makeSet(5)].reverse()
    expect(getDailyPuzzle(shuffled, new Date(2026, 0, 4), ANCHOR)?.number).toBe(4)
  })

  it('is stable for the same date', () => {
    const puzzles = makeSet(5)
    const date = new Date(2026, 2, 10)
    expect(getDailyPuzzle(puzzles, date, ANCHOR)).toBe(getDailyPuzzle(puzzles, date, ANCHOR))
  })

  it('keeps every past date pointing at the same puzzle when the set grows', () => {
    const dates = [new Date(2026, 0, 1), new Date(2026, 0, 3), new Date(2026, 0, 5)]
    const before = dates.map((d) => getDailyPuzzle(makeSet(5), d, ANCHOR)?.number)
    const after = dates.map((d) => getDailyPuzzle(makeSet(6), d, ANCHOR)?.number)
    expect(after).toEqual(before)
  })

  it('rotates the archive once the schedule outruns the library', () => {
    const puzzles = makeSet(5)
    // Day 6 has no puzzle 6, so it wraps to the first.
    expect(getDailyPuzzle(puzzles, new Date(2026, 0, 6), ANCHOR)?.number).toBe(1)
    expect(isScheduledRun(puzzles, new Date(2026, 0, 6))).toBe(false)
  })

  it('handles dates before the anchor without crashing', () => {
    const puzzles = makeSet(5)
    expect(getDailyPuzzle(puzzles, new Date(2025, 0, 1), ANCHOR)).not.toBeNull()
  })

  it('returns null for an empty set', () => {
    expect(getDailyPuzzle([], new Date(2026, 0, 1), ANCHOR)).toBeNull()
  })
})
