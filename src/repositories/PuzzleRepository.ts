import type { Puzzle } from '@/types/puzzle'

/**
 * Data-access seam for puzzles. The game components depend only on this
 * interface, so the local JSON source can later be swapped for Supabase
 * without touching gameplay code.
 */
export interface PuzzleRepository {
  getAllPuzzles(): Promise<Puzzle[]>
  getPuzzleById(id: string): Promise<Puzzle | null>
  getPuzzleBySlug(slug: string): Promise<Puzzle | null>
}
