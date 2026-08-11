import { ref, watch } from 'vue'
import type { StoredAppState, StoredPuzzleSession } from '@/types/session'

const STORAGE_KEY = 'closer:app-state'
const VERSION = 2

function emptyState(): StoredAppState {
  return { version: VERSION, sessions: {}, instructionsDismissed: false }
}

/**
 * Reads stored state, migrating older versions forward.
 *
 * Anything we can't recognize starts clean, but a recognized older version is
 * carried over — losing a player's history on a schema change is not an option
 * once the game has an audience.
 */
function loadState(): StoredAppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()

    // The version is widened to a plain number so older payloads are comparable.
    const parsed = JSON.parse(raw) as Omit<Partial<StoredAppState>, 'version'> & {
      version?: number
    }

    // v1 carried a `feedback` array from the playtest build; drop it and keep
    // the sessions. v1 keyed sessions by 'p01'-style ids rather than slugs, so
    // those entries are inert — harmless, and cleared by Reset all progress.
    if (parsed?.version === 1 || parsed?.version === VERSION) {
      return {
        version: VERSION,
        sessions: parsed.sessions ?? {},
        instructionsDismissed: parsed.instructionsDismissed ?? false,
      }
    }
  } catch {
    // Corrupt or unavailable storage — fall through to a clean state.
  }
  return emptyState()
}

const state = ref<StoredAppState>(loadState())

watch(
  state,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Storage may be full or blocked (private mode); the game still works in-memory.
    }
  },
  { deep: true },
)

/** Shared, reactive, persisted application state plus mutators. */
export function useAppState() {
  return {
    state,

    getSession(puzzleId: string): StoredPuzzleSession | undefined {
      return state.value.sessions[puzzleId]
    },

    saveSession(session: StoredPuzzleSession) {
      state.value.sessions[session.puzzleId] = session
    },

    clearSession(puzzleId: string) {
      delete state.value.sessions[puzzleId]
    },

    dismissInstructions() {
      state.value.instructionsDismissed = true
    },

    resetProgress() {
      state.value = emptyState()
    },
  }
}
