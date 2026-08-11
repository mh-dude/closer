import { computed, ref } from 'vue'
import type { Puzzle } from '@/types/puzzle'
import type { Placements, PuzzleResult } from '@/types/session'
import { scorePuzzle } from '@/services/scoring'
import { useAppState } from './useLocalStorage'

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))

/** Keyboard nudge step as a fraction of the full scale width. */
export const NUDGE_STEP = 0.01

/**
 * Owns the play state for a single puzzle: placements, selection, submission,
 * and scoring. Rehydrates a completed session from storage so revisiting a
 * finished puzzle shows the results again.
 */
export function usePuzzleSession(puzzle: Puzzle) {
  const { getSession, saveSession, clearSession } = useAppState()

  const placements = ref<Placements>({})
  const selectedItemId = ref<string | null>(null)
  const submitted = ref(false)
  const result = ref<PuzzleResult | null>(null)

  const existing = getSession(puzzle.id)
  if (existing?.completed) {
    placements.value = { ...existing.placements }
    submitted.value = true
    result.value = scorePuzzle(puzzle, placements.value)
  }

  const placedCount = computed(() => Object.keys(placements.value).length)
  const allPlaced = computed(() => placedCount.value === puzzle.items.length)
  const unplacedItems = computed(() =>
    puzzle.items.filter((item) => !(item.id in placements.value)),
  )
  const placedItems = computed(() =>
    puzzle.items.filter((item) => item.id in placements.value),
  )

  function place(itemId: string, position: number) {
    if (submitted.value) return
    placements.value[itemId] = clamp01(position)
  }

  function unplace(itemId: string) {
    if (submitted.value) return
    delete placements.value[itemId]
    if (selectedItemId.value === itemId) selectedItemId.value = null
  }

  function select(itemId: string | null) {
    selectedItemId.value = itemId
  }

  function nudge(itemId: string, steps: number) {
    if (submitted.value) return
    const current = placements.value[itemId]
    if (current == null) return
    placements.value[itemId] = clamp01(current + steps * NUDGE_STEP)
  }

  function submit() {
    if (submitted.value || !allPlaced.value) return
    const scored = scorePuzzle(puzzle, placements.value)
    result.value = scored
    submitted.value = true
    selectedItemId.value = null
    saveSession({
      puzzleId: puzzle.id,
      completed: true,
      total: scored.total,
      placements: { ...placements.value },
      completedAt: Date.now(),
    })
  }

  /** Clear everything for a fresh attempt (used by "Try again"). */
  function reset() {
    placements.value = {}
    selectedItemId.value = null
    submitted.value = false
    result.value = null
    clearSession(puzzle.id)
  }

  return {
    puzzle,
    placements,
    selectedItemId,
    submitted,
    result,
    placedCount,
    allPlaced,
    unplacedItems,
    placedItems,
    place,
    unplace,
    select,
    nudge,
    submit,
    reset,
  }
}
