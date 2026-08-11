import type { Puzzle } from '@/types/puzzle'
import type { PuzzleRepository } from './PuzzleRepository'

/**
 * Placeholder implementation showing how puzzles could later be served from
 * Supabase without changing any gameplay code. Intentionally not wired up:
 * the POC runs entirely from local data and requires no environment variables.
 *
 * To enable later:
 *   1. npm install @supabase/supabase-js
 *   2. Create tables: puzzles, puzzle_items (see README).
 *   3. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 *   4. Implement the methods below and select this repository in the app
 *      composition root.
 *
 * Example shape:
 *
 *   import { createClient } from '@supabase/supabase-js'
 *   const client = createClient(
 *     import.meta.env.VITE_SUPABASE_URL,
 *     import.meta.env.VITE_SUPABASE_ANON_KEY,
 *   )
 *   const { data } = await client.from('puzzles').select('*, items:puzzle_items(*)')
 */
export class SupabasePuzzleRepository implements PuzzleRepository {
  async getAllPuzzles(): Promise<Puzzle[]> {
    throw new Error('SupabasePuzzleRepository is not implemented in the POC.')
  }

  async getPuzzleById(_id: string): Promise<Puzzle | null> {
    throw new Error('SupabasePuzzleRepository is not implemented in the POC.')
  }

  async getPuzzleBySlug(_slug: string): Promise<Puzzle | null> {
    throw new Error('SupabasePuzzleRepository is not implemented in the POC.')
  }
}
