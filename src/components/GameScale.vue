<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Puzzle } from '@/types/puzzle'
import type { Placements, PuzzleResult } from '@/types/session'
import { minorTicks, positionToValue, scaleTicks } from '@/services/scale'
import { formatTick } from '@/services/format'
import { useScaleInteraction } from '@/composables/useScaleInteraction'
import ScaleMarker from './ScaleMarker.vue'

const props = defineProps<{
  puzzle: Puzzle
  placements: Placements
  selectedItemId: string | null
  submitted: boolean
  result: PuzzleResult | null
  /** Live position of an item being dragged in from the tray, if any. */
  dropHint: { label: string; position: number } | null
  /** Item picked up from the tray by a click, waiting for a click to land it. */
  armedItemId: string | null
}>()

const emit = defineEmits<{
  (e: 'place', itemId: string, position: number): void
  (e: 'select', itemId: string | null): void
  (e: 'nudge', itemId: string, steps: number): void
  (e: 'unplace', itemId: string): void
}>()

const trackRef = ref<HTMLElement | null>(null)

function getTrackRect(): DOMRect | null {
  return trackRef.value?.getBoundingClientRect() ?? null
}

const { startDrag } = useScaleInteraction(getTrackRect, (itemId, position) =>
  emit('place', itemId, position),
)

// The tray needs the track geometry to turn a drop point into a position.
defineExpose({ getTrackRect })

/** Labelled gridlines, plus the bare marks between them. */
const ticks = computed(() => {
  const major = scaleTicks(
    props.puzzle.minValue,
    props.puzzle.maxValue,
    props.puzzle.scaleType,
    props.puzzle.unit,
  ).map((tick, index) => ({
    ...tick,
    label: formatTick(tick.value, props.puzzle.unit),
    // Every other label is dropped on narrow screens so they don't collide.
    crowded: index % 2 === 1,
  }))
  const minor = minorTicks(
    props.puzzle.minValue,
    props.puzzle.maxValue,
    props.puzzle.scaleType,
  ).map((tick) => ({ ...tick, label: '', crowded: false }))
  return [...minor, ...major]
})

/**
 * Says outright that the scale is logarithmic, and names the value at the
 * halfway point. The midpoint is the concrete fact that breaks the linear
 * assumption: on puzzle #1 the middle is 38 seconds, not 4 hours.
 */
const scaleNote = computed(() => {
  if (props.puzzle.scaleType !== 'logarithmic') return null
  const middle = positionToValue(
    0.5,
    props.puzzle.minValue,
    props.puzzle.maxValue,
    props.puzzle.scaleType,
  )
  // Two significant figures — "240,000 years" makes the point that "244,949"
  // only muddies with false precision.
  const step = Math.pow(10, Math.floor(Math.log10(Math.abs(middle))) - 1)
  const rounded = Math.round(middle / step) * step
  return `Log scale · middle is ${formatTick(rounded, props.puzzle.unit)}`
})

const placedItems = computed(() =>
  props.puzzle.items.filter((item) => item.id in props.placements),
)

/**
 * Alternate labels between two rows above the rail so neighbours don't collide.
 *
 * Ranked by where the marker actually sits, not by the item's index — the
 * player can place items in any order, and two markers side by side on screen
 * must never share a row. Rows swap when markers cross, which the label's
 * transition smooths over.
 */
const ROWS = ['near', 'mid', 'far'] as const

const rowByItemId = computed<Record<string, (typeof ROWS)[number]>>(() => {
  const ordered = [...placedItems.value].sort(
    (a, b) => (props.placements[a.id] ?? 0) - (props.placements[b.id] ?? 0),
  )
  // Two rows still collide at six items on a phone-width track — a long label
  // like "CLE → NYC" is half the row on its own. Three puts two markers between
  // any pair that shares a row.
  const rows = ordered.length > 4 ? 3 : 2
  return Object.fromEntries(
    ordered.map((item, index) => [item.id, ROWS[(index % rows) * (rows === 2 ? 2 : 1)]]),
  )
})

/** Keep end-of-scale labels from spilling past the track. Mirrors ScaleMarker. */
function edgeFor(position: number): 'start' | 'mid' | 'end' {
  if (position < 0.14) return 'start'
  if (position > 0.86) return 'end'
  return 'mid'
}

function positionAt(clientX: number): number | null {
  const rect = getTrackRect()
  if (!rect || rect.width === 0) return null
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

function onMarkerPointerdown(itemId: string, event: PointerEvent) {
  if (props.submitted) return
  // A held item lands wherever you click, even on top of an existing marker.
  if (props.armedItemId) {
    const position = positionAt(event.clientX)
    if (position !== null) emit('place', props.armedItemId, position)
    return
  }
  const el = (event.target as HTMLElement).closest('.marker__handle') as HTMLElement | null
  if (!el) return
  emit('select', itemId)
  startDrag(itemId, event, el)
}

function onTrackPointerdown(event: PointerEvent) {
  if (props.submitted) return

  if (props.armedItemId) {
    const position = positionAt(event.clientX)
    if (position !== null) emit('place', props.armedItemId, position)
    return
  }

  // Ignore taps that land on a marker; the marker handles those itself.
  if ((event.target as HTMLElement).closest('.marker__handle')) return

  const selected = props.selectedItemId
  if (!selected || !(selected in props.placements)) {
    emit('select', null)
    return
  }

  emit('select', selected)
  if (event.pointerType === 'touch') {
    // The track stays vertically scrollable on touch, so a tap places the
    // selected marker outright — a follow-on drag here would fight the scroll.
    const position = positionAt(event.clientX)
    if (position !== null) emit('place', selected, position)
  } else if (trackRef.value) {
    startDrag(selected, event, trackRef.value)
  }
}

/** Preview under the cursor while carrying an item. Mouse only — touch has no
 *  hover, so on a phone the first tap simply lands it. */
const armedHover = ref<number | null>(null)

function onTrackHover(event: PointerEvent) {
  if (!props.armedItemId || props.submitted || event.pointerType === 'touch') return
  armedHover.value = positionAt(event.clientX)
}

watch(
  () => props.armedItemId,
  (armed) => {
    if (!armed) armedHover.value = null
  },
)

const itemById = computed(() =>
  Object.fromEntries(props.puzzle.items.map((i) => [i.id, i])),
)

/** The drag preview wins; otherwise show where a held item would land. */
const activeHint = computed(() => {
  if (props.dropHint) return props.dropHint
  if (props.armedItemId && armedHover.value !== null) {
    const item = itemById.value[props.armedItemId]
    if (item) return { label: item.shortLabel || item.label, position: armedHover.value }
  }
  return null
})

const revealed = ref(false)
watch(
  () => props.submitted,
  (isSubmitted) => {
    if (isSubmitted) requestAnimationFrame(() => (revealed.value = true))
    else revealed.value = false
  },
  { immediate: true },
)
</script>

<template>
  <figure class="scale">
    <figcaption class="scale__caption">
      <span class="scale__end">{{ puzzle.minLabel }}</span>
      <span v-if="scaleNote" class="scale__note">{{ scaleNote }}</span>
      <span class="scale__end scale__end--max">{{ puzzle.maxLabel }}</span>
    </figcaption>

    <div
      ref="trackRef"
      class="scale__track"
      :class="{
        'scale__track--done': submitted,
        'scale__track--armed': !!armedItemId && !submitted,
      }"
      @pointerdown="onTrackPointerdown"
      @pointermove="onTrackHover"
      @pointerleave="armedHover = null"
    >
      <!-- Results: the error bar between each guess and its true answer -->
      <template v-if="submitted && result">
        <div
          v-for="r in result.items"
          :key="`c-${r.itemId}`"
          class="error"
          :class="{ 'error--in': revealed }"
          :style="{
            left: `${Math.min(r.estimatedPosition, r.correctPosition) * 100}%`,
            width: `${Math.abs(r.estimatedPosition - r.correctPosition) * 100}%`,
          }"
          aria-hidden="true"
        ></div>
      </template>

      <!-- Where the item being dragged or carried would land -->
      <div
        v-if="activeHint"
        class="drophint"
        :class="`drophint--edge-${edgeFor(activeHint.position)}`"
        :style="{ left: `${activeHint.position * 100}%` }"
        aria-hidden="true"
      >
        <span class="drophint__dot"></span>
        <span class="drophint__label">{{ activeHint.label }}</span>
      </div>

      <ScaleMarker
        v-for="item in placedItems"
        :key="item.id"
        :item="item"
        :position="placements[item.id]"
        :selected="selectedItemId === item.id"
        :row="rowByItemId[item.id]"
        :disabled="submitted"
        @pointerdown="onMarkerPointerdown(item.id, $event)"
        @select="emit('select', item.id)"
        @nudge="emit('nudge', item.id, $event)"
        @remove="emit('unplace', item.id)"
      />

      <!--
        Results: true-answer markers. Unlabelled by design — a second set of
        pills collides with the guess labels as soon as two answers are close.
        The legend below names the shapes; exact values are in the item list.
      -->
      <template v-if="submitted && result">
        <div
          v-for="r in result.items"
          :key="`a-${r.itemId}`"
          class="answer"
          :class="{ 'answer--in': revealed }"
          :style="{ left: `${r.correctPosition * 100}%` }"
          role="img"
          :aria-label="`${itemById[r.itemId]?.label}: true answer`"
        ></div>
      </template>

      <p v-if="!placedItems.length && !submitted" class="scale__empty">
        Drop each item where you think it belongs
      </p>

      <div class="rail" aria-hidden="true"></div>
    </div>

    <div class="axis" aria-hidden="true">
      <span
        v-for="tick in ticks"
        :key="`${tick.major ? 'M' : 'm'}-${tick.value}`"
        class="axis__tick"
        :class="{
          'axis__tick--minor': !tick.major,
          'axis__tick--crowded': tick.crowded,
        }"
        :style="{ left: `${tick.position * 100}%` }"
      >
        <span v-if="tick.major" class="axis__label">{{ tick.label }}</span>
      </span>
    </div>

    <!-- Two series on the board once submitted, so identity is never shape-alone. -->
    <div v-if="submitted" class="legend">
      <span class="legend__item">
        <span class="legend__key legend__key--guess" aria-hidden="true"></span>Your guess
      </span>
      <span class="legend__item">
        <span class="legend__key legend__key--answer" aria-hidden="true"></span>True answer
      </span>
      <span class="legend__item">
        <span class="legend__key legend__key--error" aria-hidden="true"></span>How far off
      </span>
    </div>
  </figure>
</template>

<style scoped>
.scale {
  --rail-h: 8px;
  /* Label rows above the rail, measured from the top of the rail. */
  --row-1: 16px;
  --row-2: 44px;
  --row-3: 72px;
  --marker-band: 102px;
  width: 100%;
  margin: 0;
}

/* Caption: the scale's range, and what kind of scale it is. */
.scale__caption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}
.scale__end {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
}
.scale__end--max {
  text-align: right;
}
.scale__note {
  flex: 0 1 auto;
  min-width: 0;
  text-align: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--accent-ink);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  border-radius: 999px;
  padding: 2px 9px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scale__track {
  position: relative;
  height: var(--marker-band);
  width: 100%;
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
.scale__track--armed {
  cursor: crosshair;
}

/* The rail is the interactive track, so it carries real weight — not the
   hairline an axis rule would use. */
.rail {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--rail-h);
  border-radius: var(--rail-h);
  background: var(--line-strong);
}
.scale__track--armed .rail {
  background: color-mix(in srgb, var(--guess) 45%, var(--line-strong));
}

/* The marker band is empty until the first item lands; say what goes there
   rather than leaving a void above the rail. */
.scale__empty {
  position: absolute;
  left: 50%;
  bottom: calc(var(--rail-h) + 18px);
  transform: translateX(-50%);
  margin: 0;
  white-space: nowrap;
  font-size: 0.8rem;
  color: var(--ink-muted);
  opacity: 0.75;
  pointer-events: none;
}

/* Axis: short ticks hanging below the rail, labels under them. */
.axis {
  position: relative;
  height: 30px;
  margin-top: 2px;
}
.axis__tick {
  position: absolute;
  top: 0;
  width: 1px;
  height: 7px;
  transform: translateX(-50%);
  background: var(--line-strong);
}
.axis__tick--minor {
  height: 4px;
  opacity: 0.55;
}
.axis__label {
  position: absolute;
  top: 9px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 0.68rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink-muted);
}

/* Error bar: sits just above the rail, spanning guess to answer. */
.error {
  position: absolute;
  bottom: calc(var(--rail-h) + 3px);
  height: 3px;
  border-radius: 3px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left center;
  opacity: 0;
  transition: transform 0.45s ease, opacity 0.3s ease;
  z-index: 2;
}
.error--in {
  transform: scaleX(1);
  opacity: 0.85;
}

/* True answer: a diamond on the rail. Shape carries identity alongside hue. */
.answer {
  position: absolute;
  bottom: calc(var(--rail-h) / 2);
  width: 14px;
  height: 14px;
  margin: 0 0 -7px -7px;
  transform: rotate(45deg);
  background: var(--answer);
  box-shadow: 0 0 0 2px var(--paper-raised);
  opacity: 0;
  transition: opacity 0.35s ease;
  z-index: 4;
}
.answer--in {
  opacity: 1;
}

/* Drop preview */
.drophint {
  position: absolute;
  bottom: 0;
  width: 0;
  z-index: 5;
  pointer-events: none;
}
.drophint__dot {
  position: absolute;
  bottom: calc(var(--rail-h) / 2);
  left: 0;
  width: 16px;
  height: 16px;
  margin: 0 0 -8px -8px;
  border-radius: 50%;
  border: 2px dashed var(--guess);
  background: var(--paper-raised);
}
.drophint__label {
  position: absolute;
  bottom: calc(var(--rail-h) + 16px);
  left: 0;
  transform: translateX(-50%);
  white-space: nowrap;
  max-width: 40vw;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--guess);
  background: var(--paper-raised);
  border: 1px dashed var(--guess);
  padding: 2px 8px;
  border-radius: 999px;
}
.drophint--edge-start .drophint__label {
  left: -6px;
  transform: none;
}
.drophint--edge-end .drophint__label {
  left: auto;
  right: -6px;
  transform: none;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 18px;
  margin-top: 14px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-muted);
}
.legend__item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.legend__key {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
}
.legend__key--guess {
  border-radius: 50%;
  background: var(--guess);
}
.legend__key--answer {
  transform: rotate(45deg);
  background: var(--answer);
}
.legend__key--error {
  height: 3px;
  width: 16px;
  border-radius: 3px;
  background: var(--accent);
}

@media (max-width: 640px) {
  .scale {
    --row-1: 14px;
    --row-2: 39px;
    --row-3: 64px;
    --marker-band: 92px;
  }
  .axis__tick--crowded .axis__label {
    display: none;
  }
  .scale__note {
    font-size: 0.66rem;
    padding: 2px 7px;
  }
  .legend {
    gap: 4px 14px;
    font-size: 0.72rem;
  }
}

/* Landscape phone: plenty of width, almost no height. Wide enough that two
   label rows are sufficient, so the third is folded away. */
@media (max-height: 560px) {
  .scale {
    --row-1: 14px;
    --row-2: 39px;
    --row-3: 39px;
    --marker-band: 68px;
  }
}
</style>
