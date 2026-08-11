import type { Puzzle, PuzzleItem, PuzzleSource } from '@/types/puzzle'
import { formatValue } from '@/services/format'

/**
 * Fills in everything an authored puzzle leaves out, so the game only ever
 * sees fully-resolved puzzles.
 *
 * Item ids derive from position, which means the item order of a *published*
 * puzzle is load-bearing: reordering it would orphan saved placements in
 * localStorage. Items are authored in ascending value order, so in practice
 * this only bites if you insert into a puzzle players have already seen.
 */
export function resolvePuzzle(source: PuzzleSource): Puzzle {
  const items: PuzzleItem[] = source.items.map((item, index) => ({
    id: `${source.slug}-${index}`,
    label: item.label,
    shortLabel: item.shortLabel,
    value: item.value,
    displayValue:
      item.displayValue ??
      `${item.approximate ? '~' : ''}${formatValue(item.value, source.unit)}`,
    fact: item.fact,
    sourceLabel: item.sourceLabel,
    sourceUrl: item.sourceUrl,
  }))

  return {
    id: source.slug,
    number: source.number,
    slug: source.slug,
    title: source.title,
    prompt: source.prompt,
    category: source.category,
    unit: source.unit,
    scaleType: source.scaleType,
    minValue: source.minValue,
    maxValue: source.maxValue,
    minLabel: source.minLabel ?? formatValue(source.minValue, source.unit),
    maxLabel: source.maxLabel ?? formatValue(source.maxValue, source.unit),
    difficulty: source.difficulty,
    items,
  }
}

export function resolvePuzzles(sources: PuzzleSource[]): Puzzle[] {
  return [...sources].sort((a, b) => a.number - b.number).map(resolvePuzzle)
}
