import type { PuzzleCategory, PuzzleSource } from '@/types/puzzle'
import { KNOWN_UNITS } from '@/services/format'
import { valueToPosition } from '@/services/scale'

/**
 * Checks every authored puzzle before it ships.
 *
 * Errors are things that would break the game — a NaN marker position, a slug
 * collision, a value off the end of its own scale. Warnings are things that
 * make a bad puzzle: an item pinned to an endpoint is a free 100, and two items
 * a hair apart are two markers players can't tell from each other.
 */

export interface Finding {
  level: 'error' | 'warning'
  where: string
  message: string
}

const CATEGORIES: PuzzleCategory[] = [
  'Time',
  'Distance',
  'Weight',
  'Speed',
  'Temperature',
  'Population',
  'Age',
  'Cost',
  'Size',
  'Frequency',
]

const MIN_ITEMS = 4
const MAX_ITEMS = 6
/** Inside this much of either end, the answer is given away by the scale. */
const ENDPOINT_MARGIN = 0.03
/** Closer than this and the two markers physically overlap on a phone. */
const MIN_ITEM_GAP = 0.04
/** Items packed into less than this much of the scale make for a dull puzzle. */
const MIN_SPREAD = 0.5

export function validatePuzzles(sources: PuzzleSource[]): Finding[] {
  const findings: Finding[] = []
  const seenSlugs = new Map<string, number>()
  const seenNumbers = new Map<number, string>()

  const err = (where: string, message: string) =>
    findings.push({ level: 'error', where, message })
  const warn = (where: string, message: string) =>
    findings.push({ level: 'warning', where, message })

  for (const p of sources) {
    const where = p.slug || `#${p.number}`

    if (!p.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) {
      err(where, `slug "${p.slug}" must be lowercase kebab-case`)
    }
    if (seenSlugs.has(p.slug)) err(where, `duplicate slug (also #${seenSlugs.get(p.slug)})`)
    seenSlugs.set(p.slug, p.number)

    if (!Number.isInteger(p.number) || p.number < 1) {
      err(where, `number must be a positive integer, got ${p.number}`)
    }
    if (seenNumbers.has(p.number)) {
      err(where, `number ${p.number} already used by "${seenNumbers.get(p.number)}"`)
    }
    seenNumbers.set(p.number, p.slug)

    if (!CATEGORIES.includes(p.category)) err(where, `unknown category "${p.category}"`)
    if (!p.title?.trim()) err(where, 'missing title')
    if (!p.prompt?.trim()) err(where, 'missing prompt')
    if (!KNOWN_UNITS.includes(p.unit)) {
      warn(where, `unit "${p.unit}" has no formatter — display values fall back to plain text`)
    }

    if (!(p.minValue < p.maxValue)) {
      err(where, `minValue ${p.minValue} must be below maxValue ${p.maxValue}`)
    }
    if (p.scaleType === 'logarithmic' && p.minValue <= 0) {
      err(where, `logarithmic scale needs a positive minValue, got ${p.minValue}`)
    }

    if (p.items.length < MIN_ITEMS || p.items.length > MAX_ITEMS) {
      err(where, `${p.items.length} items — expected ${MIN_ITEMS}–${MAX_ITEMS}`)
    }

    const positions: { label: string; at: number }[] = []

    p.items.forEach((item, index) => {
      const at = `${where}[${index}] "${item.label || '?'}"`
      if (!item.label?.trim()) err(at, 'missing label')
      if (!item.fact?.trim()) err(at, 'missing fact')
      if (item.sourceUrl && !/^https?:\/\//.test(item.sourceUrl)) {
        err(at, `sourceUrl "${item.sourceUrl}" is not an absolute URL`)
      }

      if (!Number.isFinite(item.value)) {
        err(at, `value ${item.value} is not a finite number`)
        return
      }
      if (p.scaleType === 'logarithmic' && item.value <= 0) {
        err(at, `value ${item.value} is not positive on a logarithmic scale`)
        return
      }
      if (item.value < p.minValue || item.value > p.maxValue) {
        err(at, `value ${item.value} is outside the scale [${p.minValue}, ${p.maxValue}]`)
        return
      }

      const position = valueToPosition(item.value, p.minValue, p.maxValue, p.scaleType)
      if (!Number.isFinite(position)) {
        err(at, 'resolves to a non-finite position on the scale')
        return
      }
      if (position <= ENDPOINT_MARGIN || position >= 1 - ENDPOINT_MARGIN) {
        warn(at, `sits ${(Math.min(position, 1 - position) * 100).toFixed(1)}% from the end of the scale — widen the bounds`)
      }
      positions.push({ label: item.label, at: position })
    })

    if (positions.length < 2) continue

    const sorted = [...positions].sort((a, b) => a.at - b.at)
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].at - sorted[i - 1].at
      if (gap < MIN_ITEM_GAP) {
        warn(
          where,
          `"${sorted[i - 1].label}" and "${sorted[i].label}" are ${(gap * 100).toFixed(1)}% apart — their markers overlap`,
        )
      }
    }

    const spread = sorted[sorted.length - 1].at - sorted[0].at
    if (spread < MIN_SPREAD) {
      warn(where, `all items fall inside ${(spread * 100).toFixed(0)}% of the scale`)
    }
  }

  return findings
}
