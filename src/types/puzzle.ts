export type ScaleType = 'linear' | 'logarithmic'

export type Difficulty = 'easy' | 'medium' | 'hard'

export type PuzzleCategory =
  | 'Time'
  | 'Distance'
  | 'Weight'
  | 'Speed'
  | 'Temperature'
  | 'Population'
  | 'Age'
  | 'Cost'
  | 'Size'
  | 'Frequency'

/* ---------------------------------------------------------------------------
 * Authored shape — what a file in content/puzzles/ contains.
 *
 * Everything derivable is optional here and filled in by resolvePuzzle(): ids,
 * display values and end labels all come from the value plus the unit unless a
 * puzzle needs wording the formatter can't produce.
 * ------------------------------------------------------------------------- */

export interface PuzzleItemSource {
  label: string
  /** Optional shorter label used on the compact scale marker. */
  shortLabel?: string
  value: number
  /** Marks a figure that is rounded or source-dependent; renders as "~450 kg". */
  approximate?: boolean
  /** Overrides the formatted value shown after submission, e.g. "2 hr 15 min". */
  displayValue?: string
  /** A short, surprising or educational fact revealed with the answer. */
  fact: string
  sourceLabel?: string
  sourceUrl?: string
}

export interface PuzzleSource {
  /** Release number. Day N of the schedule serves the puzzle numbered N. */
  number: number
  slug: string
  title: string
  prompt: string
  category: PuzzleCategory
  /** Drives value formatting; see services/format.ts for the units it knows. */
  unit: string
  scaleType: ScaleType
  minValue: number
  maxValue: number
  /** Overrides the formatted label at each end of the scale. */
  minLabel?: string
  maxLabel?: string
  difficulty: Difficulty
  items: PuzzleItemSource[]
}

/* ---------------------------------------------------------------------------
 * Runtime shape — what the game consumes. Every field is resolved.
 * ------------------------------------------------------------------------- */

export interface PuzzleItem {
  id: string
  label: string
  shortLabel?: string
  value: number
  displayValue: string
  fact: string
  sourceLabel?: string
  sourceUrl?: string
}

export interface Puzzle {
  /** Equal to the slug — the slug is the stable identifier. */
  id: string
  number: number
  slug: string
  title: string
  prompt: string
  category: PuzzleCategory
  unit: string
  scaleType: ScaleType
  minValue: number
  maxValue: number
  minLabel: string
  maxLabel: string
  difficulty: Difficulty
  items: PuzzleItem[]
}
