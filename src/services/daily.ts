import type { Puzzle } from '@/types/puzzle'

/**
 * Launch day. Day 0 serves puzzle number 1, day 1 serves number 2, and so on.
 *
 * Moving this constant renumbers the whole schedule, so freeze it at launch:
 * a player's "Closer #47" has to mean the same puzzle as everyone else's.
 */
export const ANCHOR_DATE = '2026-08-11'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function daysSinceAnchor(today: Date, anchor: string = ANCHOR_DATE): number {
  const anchorMidnight = Date.parse(`${anchor}T00:00:00`)
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.floor((todayMidnight - anchorMidnight) / MS_PER_DAY)
}

/**
 * The release number due on a given date. Puzzles are served by their own
 * `number`, not by their position in the set, so appending a puzzle never
 * disturbs what any past or future date resolves to.
 */
export function dailyNumber(today: Date, anchor: string = ANCHOR_DATE): number {
  return daysSinceAnchor(today, anchor) + 1
}

/**
 * Today's puzzle. Once the schedule outruns the library it rotates the archive
 * deterministically rather than showing nothing — still stable per date, but
 * no longer a first run, so `number` and the date stop agreeing.
 */
export function getDailyPuzzle(
  puzzles: Puzzle[],
  today: Date = new Date(),
  anchor: string = ANCHOR_DATE,
): Puzzle | null {
  if (!puzzles.length) return null

  const due = dailyNumber(today, anchor)
  const scheduled = puzzles.find((p) => p.number === due)
  if (scheduled) return scheduled

  const ordered = [...puzzles].sort((a, b) => a.number - b.number)
  const index = (((due - 1) % ordered.length) + ordered.length) % ordered.length
  return ordered[index]
}

/** True when the date falls inside the library's own release run. */
export function isScheduledRun(puzzles: Puzzle[], today: Date = new Date()): boolean {
  return puzzles.some((p) => p.number === dailyNumber(today))
}
