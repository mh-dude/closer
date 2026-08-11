import type { ScaleType } from '@/types/puzzle'

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/**
 * Convert a real value into a normalized 0..1 position along the scale.
 *
 * - linear: evenly spaced values.
 * - logarithmic: evenly spaced orders of magnitude (requires positive min/max).
 */
export function valueToPosition(
  value: number,
  min: number,
  max: number,
  scaleType: ScaleType,
): number {
  if (scaleType === 'logarithmic') {
    const logMin = Math.log(min)
    const logMax = Math.log(max)
    return clamp01((Math.log(value) - logMin) / (logMax - logMin))
  }
  return clamp01((value - min) / (max - min))
}

/**
 * Convert a normalized 0..1 position back into a real value on the scale.
 * Inverse of valueToPosition for a given scaleType.
 */
export function positionToValue(
  position: number,
  min: number,
  max: number,
  scaleType: ScaleType,
): number {
  const p = clamp01(position)
  if (scaleType === 'logarithmic') {
    const logMin = Math.log(min)
    const logMax = Math.log(max)
    return Math.exp(logMin + p * (logMax - logMin))
  }
  return min + p * (max - min)
}

export interface ScaleTick {
  /** 0..1 along the track. */
  position: number
  /** The real value at that point, so it can be labelled. */
  value: number
  /** Major ticks are labelled; minor ticks are bare marks between them. */
  major: boolean
}

/** Round up to the next 1, 2 or 5 times a power of ten. */
function niceUp(v: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(v)))
  const m = v / power
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * power
}

/**
 * Gridline values a unit reads naturally in. Decades of seconds land on
 * "16.7 min", which looks like a rounding bug; the time ladder gives "10 min".
 */
const TICK_LADDERS: Record<string, number[]> = {
  seconds: [0.001, 0.01, 0.1, 1, 10, 60, 600, 3600, 86400, 604800, 2592000],
}

/** Thin a list down to at most `limit` entries, keeping the spacing even. */
function thin<T>(values: T[], limit: number): T[] {
  if (values.length <= limit) return values
  const stride = Math.ceil(values.length / limit)
  return values.filter((_, i) => i % stride === 0)
}

/**
 * Gridline values for the scale, as real numbers rather than bare positions.
 *
 * The labels these carry are the only thing distinguishing a logarithmic scale
 * from a linear one on screen. Without them a player reads any scale as linear
 * and places every marker in the wrong third of the board.
 */
export function scaleTicks(
  min: number,
  max: number,
  scaleType: ScaleType,
  unit = '',
  maxTicks = 6,
): ScaleTick[] {
  const at = (value: number, major = true): ScaleTick => ({
    position: valueToPosition(value, min, max, scaleType),
    value,
    major,
  })
  /** Keep clear of the ends, where a label would crowd the end label or
   *  overhang the track. */
  const inside = (v: number) => {
    const p = valueToPosition(v, min, max, scaleType)
    return p > 0.05 && p < 0.95
  }

  if (scaleType === 'logarithmic') {
    const ladder = TICK_LADDERS[unit]?.filter(inside) ?? []
    if (ladder.length >= 3) return thin(ladder, maxTicks).map((v) => at(v))

    const lo = Math.ceil(Math.log10(min))
    const hi = Math.floor(Math.log10(max))
    const stride = Math.max(1, Math.ceil((hi - lo + 1) / maxTicks))
    const decades: number[] = []
    for (let e = lo; e <= hi; e += stride) decades.push(Math.pow(10, e))

    const usable = decades.filter(inside)
    if (usable.length >= 2) return usable.map((v) => at(v))

    // A single decade inside the range reads as a lone stray line — subdivide.
    const fine: number[] = []
    for (let e = lo - 1; e <= hi + 1; e++) {
      for (const m of [1, 2, 5]) fine.push(m * Math.pow(10, e))
    }
    return thin(fine.filter(inside), maxTicks).map((v) => at(v))
  }

  const step = niceUp((max - min) / maxTicks)
  const ticks: ScaleTick[] = []
  for (let v = Math.ceil(min / step) * step; v < max; v += step) {
    if (inside(v)) ticks.push(at(v))
  }
  return ticks
}

