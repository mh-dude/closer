import { LocalPuzzleRepository } from './LocalPuzzleRepository'
import type { PuzzleRepository } from './PuzzleRepository'

/**
 * Single place that decides which data source the app uses. Swap this for a
 * SupabasePuzzleRepository later without touching any component.
 */
export const puzzleRepository: PuzzleRepository = new LocalPuzzleRepository()

export type { PuzzleRepository }
