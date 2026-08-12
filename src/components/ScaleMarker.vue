<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PuzzleItem } from '@/types/puzzle'

const props = defineProps<{
  item: PuzzleItem
  position: number
  selected: boolean
  /** Which of the label rows above the rail this marker uses. */
  row: 'near' | 'mid' | 'far'
  disabled: boolean
  /** What this marker currently reads, in the puzzle's own units. */
  reading: string
  /** True while a pointer is moving this marker. */
  dragging: boolean
  /** Picked up and waiting to be set down; this is where it was. */
  lifted: boolean
}>()

const emit = defineEmits<{
  (e: 'pointerdown', event: PointerEvent): void
  (e: 'select'): void
  (e: 'nudge', steps: number): void
  (e: 'remove'): void
}>()

const label = computed(() => props.item.shortLabel || props.item.label)

/*
 * The value rides along only while this marker is actually being adjusted —
 * dragged, or held by the keyboard. Showing it on every marker at rest would
 * put six numbers on the board and answer the question for the player.
 */
const focused = ref(false)
const showReading = computed(
  // Not while lifted: the drop preview is carrying the live value then, and two
  // pills quoting different numbers for one item is a puzzle of its own.
  () => !props.disabled && !props.lifted && (props.dragging || focused.value),
)
const leftStyle = computed(() => ({ left: `${props.position * 100}%` }))
const ariaValue = computed(() => Math.round(props.position * 100))

/** Anchor the label inside the track near the ends so it can't run off-screen. */
const edge = computed(() => {
  if (props.position < 0.14) return 'start'
  if (props.position > 0.86) return 'end'
  return 'mid'
})

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      event.preventDefault()
      emit('nudge', event.shiftKey ? -5 : -1)
      break
    case 'ArrowRight':
    case 'ArrowUp':
      event.preventDefault()
      emit('nudge', event.shiftKey ? 5 : 1)
      break
    case 'Home':
      event.preventDefault()
      emit('nudge', -1000)
      break
    case 'End':
      event.preventDefault()
      emit('nudge', 1000)
      break
    case 'Backspace':
    case 'Delete':
      event.preventDefault()
      emit('remove')
      break
  }
}

function onPointerdown(event: PointerEvent) {
  if (props.disabled) return
  emit('pointerdown', event)
}
</script>

<template>
  <div
    class="marker"
    :class="[
      `marker--${row}`,
      `marker--edge-${edge}`,
      { 'marker--selected': selected, 'marker--done': disabled, 'marker--lifted': lifted },
    ]"
    :style="leftStyle"
  >
    <span class="marker__label" :class="{ 'marker__label--reading': showReading }">
      <span class="marker__name">{{ label }}</span>
      <span v-if="showReading" class="marker__reading">{{ reading }}</span>
    </span>
    <span class="marker__stem" aria-hidden="true"></span>
    <!--
      Only the handle takes pointer events. The label column above it spans the
      whole marker band; if that carried `touch-action: none` too, most of the
      board would stop scrolling on a phone.
    -->
    <div
      class="marker__handle"
      role="slider"
      tabindex="0"
      :aria-label="`${item.label}. Use arrow keys to move.`"
      :aria-valuemin="0"
      :aria-valuemax="100"
      :aria-valuenow="ariaValue"
      :aria-valuetext="`${ariaValue}% along the scale`"
      @pointerdown="onPointerdown"
      @click="emit('select')"
      @focus="focused = true; emit('select')"
      @blur="focused = false"
      @keydown="onKeydown"
    >
      <span class="marker__dot" aria-hidden="true"></span>
    </div>
  </div>
</template>

<style scoped>
.marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  pointer-events: none;
  z-index: 3;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
.marker--selected {
  z-index: 6;
}

/* The grabbable part: a finger-sized target centred on the rail. */
.marker__handle {
  position: absolute;
  bottom: var(--rail-mid);
  left: 0;
  width: 44px;
  height: 44px;
  margin: 0 0 -22px -22px;
  pointer-events: auto;
  touch-action: none;
  cursor: grab;
  border-radius: 50%;
}
.marker--selected .marker__handle {
  cursor: grabbing;
}
.marker--done .marker__handle {
  cursor: default;
  touch-action: auto;
}

/* Seated in the rail and standing slightly proud of it, so a fat track reads
   as something the markers sit in rather than something they hide behind. */
.marker__dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: var(--guess);
  /* Surface ring, so a guess stays legible where it overlaps an answer. */
  box-shadow:
    0 0 0 2.5px var(--paper-raised),
    0 1px 3px color-mix(in srgb, var(--shade) 55%, transparent);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.marker--selected .marker__dot {
  transform: translate(-50%, -50%) scale(1.25);
  box-shadow:
    0 0 0 2.5px var(--paper-raised),
    0 0 0 7px color-mix(in srgb, var(--guess) 22%, transparent);
}

.marker__stem {
  position: absolute;
  left: 0;
  width: 1px;
  bottom: var(--rail-top);
  transform: translateX(-50%);
  background: var(--guess);
  opacity: 0.4;
  /* Rows swap when two markers cross; ease it so nothing snaps. */
  transition: height 0.15s ease;
}
.marker--near .marker__stem {
  height: calc(var(--axis-band) + var(--row-1));
}
.marker--mid .marker__stem {
  height: calc(var(--axis-band) + var(--row-2));
}
.marker--far .marker__stem {
  height: calc(var(--axis-band) + var(--row-3));
}

.marker__label {
  position: absolute;
  left: 0;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
  white-space: nowrap;
  max-width: 40vw;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--ink);
  background: var(--paper-raised);
  border: 1px solid var(--line-strong);
  padding: 2px 8px;
  border-radius: 999px;
  transition: bottom 0.15s ease;
}
.marker__name {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
/* Reads the same as the drop preview's value, so the number means the same
   thing whether you are placing an item or adjusting one. */
.marker__reading {
  flex: none;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
  padding-left: 7px;
  border-left: 1px solid color-mix(in srgb, currentColor 35%, transparent);
}
/* Lifted above its neighbours while it carries a value, so a wider pill can't
   be overlapped by the marker next to it. */
.marker__label--reading {
  z-index: 1;
  border-color: var(--guess);
  color: var(--guess);
}

/*
 * Lifted: the marker is in the player's hand, and what's left on the rail is
 * the socket it came out of. Faded rather than hidden, so the old position
 * stays readable while a new one is being chosen — and the hollow dot says
 * "nothing is here right now" without inventing a new colour.
 */
.marker--lifted {
  opacity: 0.4;
}
.marker--lifted .marker__dot {
  background: transparent;
  box-shadow:
    0 0 0 2.5px var(--paper-raised),
    inset 0 0 0 2px var(--guess);
}
.marker--lifted .marker__label {
  border-style: dashed;
}
.marker--near .marker__label {
  bottom: calc(var(--label-base) + var(--row-1));
}
.marker--mid .marker__label {
  bottom: calc(var(--label-base) + var(--row-2));
}
.marker--far .marker__label {
  bottom: calc(var(--label-base) + var(--row-3));
}
.marker--edge-start .marker__label {
  left: -6px;
  transform: none;
}
.marker--edge-end .marker__label {
  left: auto;
  right: -6px;
  transform: none;
}
.marker--selected .marker__label {
  border-color: var(--guess);
  color: var(--guess);
}

@media (max-width: 480px) {
  .marker__label {
    font-size: 0.7rem;
    padding: 2px 6px;
  }
}
</style>
