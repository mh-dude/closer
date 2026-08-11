import type { PuzzleSource } from '@/types/puzzle'

/**
 * Every authored puzzle in content/puzzles/, picked up by filename.
 *
 * Adding a puzzle means adding a file — there is no index to keep in step.
 * Files are named <number>-<slug>.json so the glob returns them in release
 * order, but resolvePuzzles sorts by `number` regardless.
 */
const modules = import.meta.glob<{ default: PuzzleSource }>('../../content/puzzles/*.json', {
  eager: true,
})

export const puzzleSources: PuzzleSource[] = Object.keys(modules)
  .sort()
  .map((path) => modules[path].default)
