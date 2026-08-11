<script setup lang="ts">
import type { PuzzleItem } from '@/types/puzzle'

defineProps<{
  items: PuzzleItem[]
  draggingId: string | null
  /** Lifted out of the tray by a click, waiting to be placed on the scale. */
  armedId: string | null
}>()

const emit = defineEmits<{
  (e: 'pick', itemId: string): void
  (e: 'grab', item: PuzzleItem, event: PointerEvent, element: HTMLElement): void
}>()

function onPointerdown(item: PuzzleItem, event: PointerEvent) {
  emit('grab', item, event, event.currentTarget as HTMLElement)
}
</script>

<template>
  <div v-if="items.length" class="tray" aria-label="Items still to place">
    <p class="tray__hint">
      <template v-if="armedId">
        <span class="tray__fine"
          >Now click the scale to place it — or click anywhere else to put it back.</span
        >
        <span class="tray__coarse"
          >Touch the scale and slide to aim, then lift to place — or tap it again to put it
          back.</span
        >
      </template>
      <template v-else>
        <span class="tray__count">{{ items.length }}</span>
        <span class="tray__fine"> to place — click one, then click where it belongs. Dragging works too.</span>
        <span class="tray__coarse"> to place — tap one, then tap the scale. Dragging works too.</span>
      </template>
    </p>
    <ul class="tray__list">
      <li v-for="item in items" :key="item.id">
        <button
          type="button"
          class="tray__chip"
          :class="{
            'tray__chip--dragging': draggingId === item.id,
            'tray__chip--armed': armedId === item.id,
          }"
          :aria-pressed="armedId === item.id"
          @pointerdown="onPointerdown(item, $event)"
          @keydown.enter.prevent="emit('pick', item.id)"
          @keydown.space.prevent="emit('pick', item.id)"
        >
          {{ item.label }}
        </button>
      </li>
    </ul>
  </div>
  <p v-else class="tray tray--empty">All items placed — adjust them, then submit your guesses.</p>
</template>

<style scoped>
.tray {
  background: var(--paper-raised);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 16px;
}
.tray--empty {
  color: var(--ink-muted);
  font-size: 0.9rem;
  text-align: center;
}
.tray__hint {
  margin: 0 0 10px;
  font-size: 0.85rem;
  color: var(--ink-muted);
}
.tray__count {
  font-weight: 700;
  color: var(--ink);
}
/* Same instruction, in the verb that matches the pointer you actually have. */
.tray__coarse {
  display: none;
}
@media (pointer: coarse) {
  .tray__fine {
    display: none;
  }
  .tray__coarse {
    display: inline;
  }
}
.tray__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tray__chip {
  border: 1px solid var(--line-strong);
  background: var(--paper);
  color: var(--ink);
  padding: 9px 13px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.9rem;
  min-height: 44px;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.08s ease,
    opacity 0.15s ease;
  /* The chip owns the gesture so an upward drag onto the scale isn't stolen by
     the page scroll. Scrolling still works from anywhere else in the tray. */
  touch-action: none;
  cursor: grab;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
@media (hover: hover) {
  .tray__chip:hover {
    border-color: var(--guess);
    color: var(--guess);
  }
}
.tray__chip:active {
  transform: translateY(1px);
}
.tray__chip--dragging {
  opacity: 0.35;
  border-style: dashed;
  cursor: grabbing;
}
/* Held: literally picked up off the tray, and following the next tap. */
.tray__chip--armed,
.tray__chip--armed:active {
  background: var(--guess);
  border-color: var(--guess);
  color: #fff;
  transform: translateY(-4px) scale(1.06);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--guess) 22%, transparent),
    var(--shadow-md);
}
@media (hover: hover) {
  .tray__chip--armed:hover {
    color: #fff;
  }
}
</style>
