<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Puzzle, PuzzleItem } from '@/types/puzzle'
import { usePuzzles } from '@/composables/usePuzzles'
import { usePuzzleSession } from '@/composables/usePuzzleSession'
import { useAppState } from '@/composables/useLocalStorage'
import GameScale from '@/components/GameScale.vue'
import UnplacedItemTray from '@/components/UnplacedItemTray.vue'
import PuzzleInstructions from '@/components/PuzzleInstructions.vue'
import ResultSummary from '@/components/ResultSummary.vue'

const route = useRoute()
const router = useRouter()
const { puzzles, load } = usePuzzles()
const { state, dismissInstructions } = useAppState()

const puzzle = ref<Puzzle | null>(null)
const session = shallowRef<ReturnType<typeof usePuzzleSession> | null>(null)
const notFound = ref(false)
const scaleRef = ref<InstanceType<typeof GameScale> | null>(null)

function setupPuzzle(slug: string) {
  const found = puzzles.value.find((p) => p.slug === slug) ?? null
  puzzle.value = found
  notFound.value = !found
  session.value = found ? usePuzzleSession(found) : null
}

onMounted(async () => {
  await load()
  setupPuzzle(route.params.puzzleSlug as string)
})

watch(
  () => route.params.puzzleSlug,
  (slug) => {
    if (puzzles.value.length) setupPuzzle(slug as string)
    endTrayDrag()
    armedItemId.value = null
  },
)

const s = computed(() => session.value)

/* --- Dragging an item out of the tray and onto the scale ----------------- */

interface TrayDrag {
  item: PuzzleItem
  pointerId: number
  element: HTMLElement
  startX: number
  startY: number
  x: number
  y: number
  /** False until the pointer has moved far enough to count as a drag, not a tap. */
  active: boolean
  /** 0..1 on the scale, or null when the pointer isn't over a droppable area. */
  position: number | null
}

const DRAG_THRESHOLD = 6
/** Vertical slack around the track so a drop doesn't demand pixel accuracy. */
const DROP_SLACK = 64

const trayDrag = ref<TrayDrag | null>(null)

const dropHint = computed(() => {
  const d = trayDrag.value
  if (!d?.active || d.position === null) return null
  return { label: d.item.shortLabel || d.item.label, position: d.position }
})

function positionFromDrop(clientX: number, clientY: number): number | null {
  const rect = scaleRef.value?.getTrackRect()
  if (!rect || rect.width === 0) return null
  if (clientY < rect.top - DROP_SLACK || clientY > rect.bottom + DROP_SLACK) return null
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

function onTrayGrab(item: PuzzleItem, event: PointerEvent, element: HTMLElement) {
  endTrayDrag()
  element.setPointerCapture(event.pointerId)
  trayDrag.value = {
    item,
    pointerId: event.pointerId,
    element,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    active: false,
    position: null,
  }
  element.addEventListener('pointermove', onTrayMove, { passive: false })
  element.addEventListener('pointerup', onTrayRelease)
  element.addEventListener('pointercancel', onTrayCancel)
}

function onTrayMove(event: PointerEvent) {
  const d = trayDrag.value
  if (!d || event.pointerId !== d.pointerId) return
  event.preventDefault()
  d.x = event.clientX
  d.y = event.clientY
  if (!d.active) {
    const travelled = Math.hypot(event.clientX - d.startX, event.clientY - d.startY)
    if (travelled < DRAG_THRESHOLD) return
    d.active = true
  }
  d.position = positionFromDrop(event.clientX, event.clientY)
}

function onTrayRelease(event: PointerEvent) {
  const d = trayDrag.value
  if (!d || event.pointerId !== d.pointerId) return
  const { item, active, position } = d
  endTrayDrag()

  if (!active) {
    // A click, not a drag: pick the item up and wait for a click on the scale.
    // Clicking the held item again puts it back.
    armedItemId.value = armedItemId.value === item.id ? null : item.id
  } else if (position !== null) {
    place(item.id, position)
  }
}

function onTrayCancel(event: PointerEvent) {
  if (trayDrag.value && event.pointerId !== trayDrag.value.pointerId) return
  endTrayDrag()
}

function endTrayDrag() {
  const d = trayDrag.value
  if (!d) return
  d.element.removeEventListener('pointermove', onTrayMove)
  d.element.removeEventListener('pointerup', onTrayRelease)
  d.element.removeEventListener('pointercancel', onTrayCancel)
  if (d.element.hasPointerCapture(d.pointerId)) d.element.releasePointerCapture(d.pointerId)
  trayDrag.value = null
}

/* --- Click to pick up, click again to place ------------------------------ */

/** An item lifted out of the tray, waiting for a click on the scale. */
const armedItemId = ref<string | null>(null)

/**
 * Clicking anywhere that isn't the scale or a tray chip puts the held item
 * back. Registered on the document because "somewhere else" includes the page
 * margins, the header and the results — everywhere this component isn't.
 */
function onDocumentPointerdown(event: PointerEvent) {
  if (!armedItemId.value) return
  const target = event.target as HTMLElement | null
  // The whole board, not just the track: a thumb aimed at the rail that lands
  // in the card's padding shouldn't cost you the item you were holding.
  if (target?.closest('.play__board, .tray__chip')) return
  armedItemId.value = null
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') armedItemId.value = null
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerdown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerdown)
  document.removeEventListener('keydown', onKeydown)
  endTrayDrag()
})

function place(itemId: string, position: number) {
  s.value?.place(itemId, position)
  s.value?.select(itemId)
  if (armedItemId.value === itemId) armedItemId.value = null
}

/** Keyboard activation drops the item mid-scale, where arrow keys take over —
 *  there is no pointer to follow up with. */
function onPick(itemId: string) {
  armedItemId.value = null
  place(itemId, 0.5)
}

function nextPuzzle() {
  const current = puzzle.value
  if (!current) return
  const startIndex = puzzles.value.findIndex((p) => p.id === current.id)
  // Prefer the next unplayed puzzle after this one, wrapping around.
  for (let offset = 1; offset <= puzzles.value.length; offset++) {
    const candidate = puzzles.value[(startIndex + offset) % puzzles.value.length]
    if (!state.value.sessions[candidate.id]?.completed) {
      router.push(`/play/${candidate.slug}`)
      return
    }
  }
  router.push('/puzzles')
}
</script>

<template>
  <main class="page play">
    <div v-if="notFound" class="notfound card">
      <h1>Puzzle not found</h1>
      <p>We couldn't find that puzzle.</p>
      <RouterLink to="/puzzles" class="btn">Browse puzzles</RouterLink>
    </div>

    <template v-else-if="s && puzzle">
      <header class="play__header">
        <p class="eyebrow">
          Puzzle #{{ puzzle.number }} · {{ puzzle.category }}
          <span class="play__diff chip">{{ puzzle.difficulty }}</span>
        </p>
        <h1 class="play__title">{{ puzzle.title }}</h1>
        <p class="play__prompt">{{ puzzle.prompt }}</p>
      </header>

      <PuzzleInstructions
        v-if="!s.submitted.value"
        :dismissed="state.instructionsDismissed"
        @dismiss="dismissInstructions"
      />

      <section class="play__board card" :class="{ 'play__board--live': !s.submitted.value }">
        <GameScale
          ref="scaleRef"
          :puzzle="puzzle"
          :placements="s.placements.value"
          :selected-item-id="s.selectedItemId.value"
          :submitted="s.submitted.value"
          :result="s.result.value"
          :drop-hint="dropHint"
          :armed-item-id="armedItemId"
          @place="place"
          @select="s.select"
          @nudge="s.nudge"
          @unplace="s.unplace"
        />
      </section>

      <!-- Tray, hint and actions travel together so the drag source stays on
           screen next to the board on a short phone. -->
      <div v-if="!s.submitted.value" class="play__dock">
        <UnplacedItemTray
          :items="s.unplacedItems.value"
          :dragging-id="trayDrag?.active ? trayDrag.item.id : null"
          :armed-id="armedItemId"
          @pick="onPick"
          @grab="onTrayGrab"
        />

        <p class="play__kbd">
          Keyboard: focus a marker, then use ← → to move it (hold Shift for bigger steps).
        </p>

        <div class="play__actions">
          <button
            type="button"
            class="btn btn--primary"
            :disabled="!s.allPlaced.value"
            @click="s.submit"
          >
            {{ s.allPlaced.value ? 'Submit guesses' : `Place all ${puzzle.items.length} items` }}
          </button>
          <button
            type="button"
            class="btn btn--ghost"
            :disabled="s.placedCount.value === 0"
            @click="s.reset"
          >
            Clear
          </button>
        </div>
      </div>

      <ResultSummary
        v-else-if="s.result.value"
        :puzzle="puzzle"
        :result="s.result.value"
        @next="nextPuzzle"
        @try-again="s.reset"
      />
    </template>

    <!-- Follows the pointer while an item is dragged out of the tray. Hidden
         once it's over the scale, where the drop preview takes over. -->
    <div
      v-if="trayDrag?.active && trayDrag.position === null"
      class="ghost"
      :style="{ left: `${trayDrag.x}px`, top: `${trayDrag.y}px` }"
      aria-hidden="true"
    >
      {{ trayDrag.item.label }}
    </div>
  </main>
</template>

<style scoped>
.play {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.play__header {
  text-align: center;
}
.play__diff {
  margin-left: 6px;
  text-transform: capitalize;
}
.play__title {
  font-size: clamp(1.6rem, 6vw, 2.2rem);
  margin: 6px 0 8px;
}
.play__prompt {
  color: var(--ink-muted);
  margin: 0;
  max-width: 44ch;
  margin-inline: auto;
}
.play__board {
  padding: 28px 14px 18px;
}
.play__dock {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.play__kbd {
  font-size: 0.8rem;
  color: var(--ink-muted);
  text-align: center;
  margin: 0;
}
@media (pointer: coarse) {
  .play__kbd {
    display: none;
  }
}
.play__actions {
  display: flex;
  gap: 10px;
}
.play__actions .btn {
  flex: 1;
}
.notfound {
  padding: 40px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.ghost {
  position: fixed;
  z-index: 40;
  /* Lifted clear of the fingertip so the label stays readable while dragging. */
  transform: translate(-50%, -190%);
  pointer-events: none;
  white-space: nowrap;
  max-width: 70vw;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 9px 13px;
  border-radius: 999px;
  background: var(--paper-raised);
  border: 1px solid var(--line-strong);
  color: var(--ink);
  box-shadow: var(--shadow-md);
}

/* Phone-shaped: narrow, or short-and-wide when a phone is turned sideways. */
@media (max-width: 640px), (max-height: 560px) {
  .play {
    gap: 14px;
    padding-bottom: 16px;
  }
  .play__title {
    margin: 4px 0 6px;
  }
  /* Board pinned to the top, tray pinned to the bottom: on a 667pt phone the
     two would otherwise never share the screen, and you can't scroll mid-drag.
     The title and instructions scroll between them. */
  .play__board {
    padding: 20px 14px 14px;
  }
  /* Only while playing — once submitted, the results list wants the screen. */
  .play__board--live {
    position: sticky;
    top: 0;
    z-index: 9;
  }
  .play__actions .btn--primary {
    flex: 2;
  }
  .play__dock {
    position: sticky;
    bottom: 0;
    z-index: 10;
    gap: 10px;
    background: var(--paper);
    padding: 10px 0 calc(10px + env(safe-area-inset-bottom));
    margin-bottom: calc(-1 * env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
  }
}

/* Landscape phone: the title is the question, so it stays — everything around
   it gives way to the board and the tray. */
@media (max-height: 560px) {
  .play {
    padding-top: 12px;
  }
  .play__header .eyebrow,
  .play__prompt {
    display: none;
  }
  .play__title {
    font-size: 1.3rem;
    margin: 0;
  }
}
</style>
