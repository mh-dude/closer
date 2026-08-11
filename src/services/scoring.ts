import type { Puzzle } from '@/types/puzzle'
import type { ItemResult, Placements, PuzzleResult, ScoreBand } from '@/types/session'
import { valueToPosition } from './scale'

export const TOTAL_SCORE = 100

/**
 * Scoring curve mapping normalized error (0..1) to a fraction of full points (0..1).
 *
 * We use a Gaussian falloff: forgiving near the correct position, with an
 * increasingly steep penalty as the guess drifts away. Chosen so that:
 *   error 0.00 -> ~1.00   (perfect)
 *   error 0.10 -> ~0.89   (very close still feels great)
 *   error 0.25 -> ~0.47   (roughly half credit)
 *   error 0.50 -> ~0.05   (wildly off earns almost nothing)
 * The spread SIGMA controls how quickly points fall away.
 */
const SIGMA = 0.288

export function scoringCurve(error: number): number {
  const e = Math.min(1, Math.max(0, error))
  return Math.exp(-((e / SIGMA) ** 2))
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
    const estimatedPosition = placements[item.id] ?? 0
    const error = Math.abs(estimatedPosition - correctPosition)
    const rawScore = maxItemScore * scoringCurve(error)
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
