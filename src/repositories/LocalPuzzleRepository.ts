import type { Puzzle } from '@/types/puzzle'
import { puzzles } from '@/data/puzzles'
import type { PuzzleRepository } from './PuzzleRepository'

/**
 * Serves puzzles bundled with the app. Async on purpose so the interface
 * matches a future network-backed implementation.
 */
export class LocalPuzzleRepository implements PuzzleRepository {
  private readonly data: Puzzle[]

  constructor(data: Puzzle[] = puzzles) {
    this.data = data
  }

  async getAllPuzzles(): Promise<Puzzle[]> {
    return this.data
  }

  async getPuzzleById(id: string): Promise<Puzzle | null> {
    return this.data.find((p) => p.id === id) ?? null
  }

  async getPuzzleBySlug(slug: string): Promise<Puzzle | null> {
    return this.data.find((p) => p.slug === slug) ?? null
  }
}
