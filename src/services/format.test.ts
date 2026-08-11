import { describe, expect, it } from 'vitest'
import { formatValue } from './format'

describe('formatValue', () => {
  it('formats durations by magnitude', () => {
    expect(formatValue(0.1, 'seconds')).toBe('0.1 sec')
    expect(formatValue(165, 'seconds')).toBe('2 min 45 sec')
    expect(formatValue(1320, 'seconds')).toBe('22 min')
    expect(formatValue(8100, 'seconds')).toBe('2 hr 15 min')
  })

  it('converts lengths without losing sub-unit precision', () => {
    expect(formatValue(0.15, 'meters')).toBe('15 cm')
    expect(formatValue(214, 'meters')).toBe('214 m')
    // Regression: rounding to whole km turned 42.195 km into "42 km".
    expect(formatValue(42195, 'meters')).toBe('42.2 km')
  })

  it('converts masses', () => {
    expect(formatValue(0.19, 'kilograms')).toBe('190 g')
    expect(formatValue(62, 'kilograms')).toBe('62 kg')
    expect(formatValue(150000, 'kilograms')).toBe('150 t')
  })

  it('uses words past a million', () => {
    expect(formatValue(15000, 'people')).toBe('15,000')
    expect(formatValue(8300000, 'people')).toBe('8.3 million')
    expect(formatValue(1430000000, 'people')).toBe('1.4 billion')
  })

  it('formats currency', () => {
    expect(formatValue(4.5, 'US dollars')).toBe('$4.50')
    expect(formatValue(18000, 'US dollars')).toBe('$18,000')
    expect(formatValue(110000000, 'US dollars')).toBe('$110 million')
  })

  it('falls back to plain text for an unknown unit', () => {
    expect(formatValue(42, 'bananas')).toBe('42 bananas')
  })
})
