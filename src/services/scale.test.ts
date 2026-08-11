import { describe, expect, it } from 'vitest'
import { positionToValue, scaleTicks, valueToPosition } from './scale'

describe('valueToPosition — linear', () => {
  it('maps min to 0 and max to 1', () => {
    expect(valueToPosition(0, 0, 100, 'linear')).toBe(0)
    expect(valueToPosition(100, 0, 100, 'linear')).toBe(1)
  })

  it('maps the midpoint to 0.5', () => {
    expect(valueToPosition(50, 0, 100, 'linear')).toBeCloseTo(0.5, 10)
  })

  it('handles negative ranges (e.g. temperature)', () => {
    expect(valueToPosition(0, -20, 100, 'linear')).toBeCloseTo(20 / 120, 10)
  })

  it('clamps out-of-range values to [0, 1]', () => {
    expect(valueToPosition(-50, 0, 100, 'linear')).toBe(0)
    expect(valueToPosition(200, 0, 100, 'linear')).toBe(1)
  })
})

describe('valueToPosition — logarithmic', () => {
  it('maps min to 0 and max to 1', () => {
    expect(valueToPosition(1, 1, 1000, 'logarithmic')).toBe(0)
    expect(valueToPosition(1000, 1, 1000, 'logarithmic')).toBe(1)
  })

  it('places each power of ten at even intervals', () => {
    expect(valueToPosition(10, 1, 1000, 'logarithmic')).toBeCloseTo(1 / 3, 10)
    expect(valueToPosition(100, 1, 1000, 'logarithmic')).toBeCloseTo(2 / 3, 10)
  })

  it('does not place a 10x value at the linear midpoint', () => {
    // 10 on a 1..1000 log scale is at 1/3, not 0.5 — the whole point of log.
    expect(valueToPosition(10, 1, 1000, 'logarithmic')).not.toBeCloseTo(0.5, 2)
  })
})

describe('positionToValue', () => {
  it('inverts valueToPosition on a linear scale', () => {
    const v = positionToValue(0.42, -20, 100, 'linear')
    expect(valueToPosition(v, -20, 100, 'linear')).toBeCloseTo(0.42, 10)
  })

  it('inverts valueToPosition on a logarithmic scale', () => {
    const v = positionToValue(0.42, 1, 1000, 'logarithmic')
    expect(valueToPosition(v, 1, 1000, 'logarithmic')).toBeCloseTo(0.42, 10)
  })

  it('returns endpoints exactly', () => {
    expect(positionToValue(0, 1, 1000, 'logarithmic')).toBeCloseTo(1, 10)
    expect(positionToValue(1, 1, 1000, 'logarithmic')).toBeCloseTo(1000, 10)
  })
})

describe('scaleTicks', () => {
  it('spaces logarithmic gridlines unevenly in value, evenly in position', () => {
    const ticks = scaleTicks(1, 1000, 'logarithmic')
    expect(ticks.map((t) => t.value)).toEqual([10, 100])
    // A decade apart in value is a fixed distance along the track.
    expect(ticks[1].position - ticks[0].position).toBeCloseTo(1 / 3, 6)
  })

  it('is what distinguishes a log scale from a linear one on screen', () => {
    const log = scaleTicks(1, 1000, 'logarithmic')
    const linear = scaleTicks(1, 1000, 'linear')
    expect(log.map((t) => t.value)).not.toEqual(linear.map((t) => t.value))
  })

  it('puts linear gridlines on round values', () => {
    expect(scaleTicks(0, 500, 'linear').map((t) => t.value)).toEqual([100, 200, 300, 400])
  })

  it('handles a negative linear range', () => {
    const ticks = scaleTicks(-30, 150, 'linear')
    expect(ticks.length).toBeGreaterThan(1)
    expect(ticks.every((t) => t.value > -30 && t.value < 150)).toBe(true)
  })

  it('keeps gridlines clear of both ends', () => {
    for (const ticks of [
      scaleTicks(0.05, 28800, 'logarithmic', 'seconds'),
      scaleTicks(1, 1e9, 'logarithmic'),
      scaleTicks(-25, 500, 'linear'),
    ]) {
      expect(ticks.every((t) => t.position > 0.05 && t.position < 0.95)).toBe(true)
    }
  })

  it('reads durations in time units rather than decades of seconds', () => {
    const ticks = scaleTicks(0.05, 28800, 'logarithmic', 'seconds')
    // 60 and 3600, not 100 and 1000 — "16.7 min" looks like a rounding bug.
    expect(ticks.map((t) => t.value)).toContain(60)
    expect(ticks.map((t) => t.value)).toContain(3600)
  })

  it('subdivides when a span is too narrow for whole decades', () => {
    expect(scaleTicks(1, 30, 'logarithmic').length).toBeGreaterThanOrEqual(2)
  })
})
