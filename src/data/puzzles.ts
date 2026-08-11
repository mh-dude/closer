import type { Puzzle } from '@/types/puzzle'
import { puzzleSources } from './content'
import { resolvePuzzles } from './resolve'

/**
 * The playable puzzle set, in release order.
 *
 * Authored content lives in content/puzzles/ — see the README for the format.
 * `npm run puzzles:check` validates it, and runs as part of `npm run build`.
 */
export const puzzles: Puzzle[] = resolvePuzzles(puzzleSources)
