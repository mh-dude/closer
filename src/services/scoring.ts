import type { Puzzle } from '@/types/puzzle'
import type { ItemResult, Placements, PuzzleResult, ScoreBand } from '@/types/session'
import { valueToPosition } from './scale'

export const TOTAL_SCORE = 100

/**
 * Scoring curve mapping normalized error (0..1) to a fraction of full credit (0..1).
 *
 * We use a Gaussian falloff: forgiving near the correct position, with an
 * increasingly steep penalty as the guess drifts away. Chosen so that:
 *   error 0.00 -> ~1.00   (perfect)
 *   error 0.05 -> ~0.94   (a near miss still feels great)
 *   error 0.10 -> ~0.78
 *   error 0.20 -> ~0.37
 *   error 0.35 -> ~0.05   (wildly off earns almost nothing)
 * The spread SIGMA controls how quickly credit falls away.
 */
const SIGMA = 0.2

export function scoringCurve(error: number): number {
  const e = Math.min(1, Math.max(0, error))
  return Math.exp(-((e / SIGMA) ** 2))
}

/**
 * Mean credit a uniformly random guess earns under the curve above, averaged
 * across the puzzle set (per-puzzle it sits between 0.281 and 0.335).
 *
 * Without subtracting this, scattering markers at random averages ~31/100 and
 * parking every marker on the midpoint scores more still, so the bottom third
 * of the range is unreachable and every total reads flatteringly high.
 */
const CHANCE_BASELINE = 0.313

/** Credit earned above pure chance, rescaled so a perfect guess still reads 1. */
export function skillCredit(error: number): number {
  return Math.max(0, (scoringCurve(error) - CHANCE_BASELINE) / (1 - CHANCE_BASELINE))
}

export function bandForError(error: number): ScoreBand {
  if (error <= 0.02) return 'exact'
  if (error <= 0.06) return 'very-close'
  if (error <= 0.12) return 'close'
  if (error <= 0.25) return 'off'
  return 'far-off'
}

export const BAND_LABELS: Record<ScoreBand, string> = {
  exact: 'Exact',
  'very-close': 'Very close',
  close: 'Close',
  off: 'Off',
  'far-off': 'Far off',
}

/**
 * Score a full puzzle from the player's normalized placements.
 * Every item carries an equal share of the 100 points.
 * Per-item scores are rounded for display; the total is derived from the
 * unrounded sum so a perfect game reads exactly 100.
 */
export function scorePuzzle(puzzle: Puzzle, placements: Placements): PuzzleResult {
  const maxItemScore = TOTAL_SCORE / puzzle.items.length
  let rawTotal = 0

  const items: ItemResult[] = puzzle.items.map((item) => {
    const correctPosition = valueToPosition(
      item.value,
      puzzle.minValue,
      puzzle.maxValue,
      puzzle.scaleType,
    )
    const placed = placements[item.id]
    // An unplaced item is not a guess at the far left, which would hand out
    // near-full credit for whichever item belongs down there.
    const error = placed == null ? 1 : Math.abs(placed - correctPosition)
    const estimatedPosition = placed ?? 0
    const rawScore = maxItemScore * skillCredit(error)
    rawTotal += rawScore

    return {
      itemId: item.id,
      estimatedPosition,
      correctPosition,
      error,
      score: Math.round(rawScore),
      maxScore: Math.round(maxItemScore),
      band: bandForError(error),
    }
  })

  return {
    puzzleId: puzzle.id,
    total: Math.round(rawTotal),
    items,
  }
}
