import type { Puzzle } from '@/types/puzzle'
import type { PuzzleResult } from '@/types/session'

/**
 * Emoji band per item, based on the fraction of full points earned.
 * The squares communicate performance only — never the identity or ordering
 * of the items — so sharing stays spoiler-free.
 */
function itemSquare(fraction: number): string {
  if (fraction >= 0.85) return '🟩'
  if (fraction >= 0.5) return '🟨'
  return '🟥'
}

export function buildShareText(puzzle: Puzzle, result: PuzzleResult): string {
  const squares = result.items
    .map((item) => itemSquare(item.maxScore > 0 ? item.score / item.maxScore : 0))
    .join('')

  return `Closer #${puzzle.number}\n${result.total}/100\n\n${squares}`
}

export interface ShareOutcome {
  method: 'share' | 'clipboard'
  ok: boolean
}

/**
 * Share via the native Web Share API when available, otherwise copy to clipboard.
 * Returns which path was taken so the UI can announce the right feedback.
 */
export async function shareResult(text: string): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ text })
      return { method: 'share', ok: true }
    } catch {
      // User dismissed the sheet or share failed — fall through to clipboard.
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    return { method: 'clipboard', ok: true }
  } catch {
    return { method: 'clipboard', ok: false }
  }
}
