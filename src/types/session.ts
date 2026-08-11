export type ScoreBand = 'exact' | 'very-close' | 'close' | 'off' | 'far-off'

export interface ItemResult {
  itemId: string
  /** Normalized 0..1 position the player placed the marker. */
  estimatedPosition: number
  /** Normalized 0..1 position of the true value. */
  correctPosition: number
  /** Absolute normalized distance between guess and answer. */
  error: number
  score: number
  maxScore: number
  band: ScoreBand
}

export interface PuzzleResult {
  puzzleId: string
  total: number
  items: ItemResult[]
}

/** Map of itemId -> normalized 0..1 placement. */
export type Placements = Record<string, number>

export interface StoredPuzzleSession {
  puzzleId: string
  completed: boolean
  total: number
  placements: Placements
  completedAt?: number
}

export interface StoredAppState {
  /** Bumped when the stored shape changes; see useLocalStorage for migrations. */
  version: 3
  sessions: Record<string, StoredPuzzleSession>
  instructionsDismissed: boolean
}
