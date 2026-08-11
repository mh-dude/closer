import { ref } from 'vue'
import type { Puzzle } from '@/types/puzzle'
import { puzzleRepository } from '@/repositories'

const puzzles = ref<Puzzle[]>([])
const loaded = ref(false)

/**
 * Loads the full puzzle set once from the active repository and caches it for
 * the session. All views share the same reactive list.
 */
export function usePuzzles() {
  async function load() {
    if (loaded.value) return
    puzzles.value = await puzzleRepository.getAllPuzzles()
    loaded.value = true
  }

  return { puzzles, loaded, load }
}
