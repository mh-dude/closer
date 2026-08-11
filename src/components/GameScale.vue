<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Puzzle } from '@/types/puzzle'
import type { Placements, PuzzleResult } from '@/types/session'
import { scaleTicks } from '@/services/scale'
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

/** How much of the track an end label needs to itself. */
const END_GAP = 0.1

/**
 * The axis: the scale's two endpoints and the gridlines between them.
 *
 * The endpoints are ticks like any other rather than headings floating above
 * the board — the range and its gradations are one scale, so they read as one
 * row. Generated ticks that would crowd an endpoint are dropped to a bare mark.
 */
const ticks = computed(() => {
  const { minValue, maxValue, scaleType, unit, minLabel, maxLabel } = props.puzzle

  const between = scaleTicks(minValue, maxValue, scaleType, unit)
    .filter((tick) => tick.position > END_GAP && tick.position < 1 - END_GAP)
    .map((tick) => ({ ...tick, label: formatTick(tick.value, unit), endpoint: false }))

  const all = [
    { position: 0, value: minValue, label: minLabel, endpoint: true },
    ...between,
    { position: 1, value: maxValue, label: maxLabel, endpoint: true },
  ]

  // Alternating sides doubles the room each label has, so a phone-width track
  // can keep gradations it would otherwise have to drop.
  return all.map((tick, index) => ({
    ...tick,
    side: index % 2 === 0 ? ('below' as const) : ('above' as const),
  }))
})

const axisRef = ref<HTMLElement | null>(null)

/**
 * Hide gridline labels that would collide, measuring the rendered text.
 *
 * A percentage-based rule can't do this: how much room "8 hours" needs depends
 * on the font and the track width, not on where it sits. The endpoints always
 * win — they carry the scale's range.
 */
const LABEL_GAP = 10

function layoutAxisLabels() {
  const axis = axisRef.value
  if (!axis) return
  const all = [...axis.querySelectorAll<HTMLElement>('.axis__label')]
  all.forEach((label) => (label.style.display = ''))

  // Each side crowds only against itself, which is the whole point of
  // alternating them.
  for (const side of ['below', 'above']) {
    const labels = all.filter((l) => l.dataset.side === side)
    if (labels.length < 2) continue
    let keptRight = -Infinity
    for (const label of labels) {
      const rect = label.getBoundingClientRect()
      // An endpoint always wins its slot; a gradation yields to it.
      if (rect.left < keptRight + LABEL_GAP && label.dataset.endpoint !== 'true') {
        label.style.display = 'none'
      } else {
        keptRight = rect.right
      }
    }
  }
}

watch(ticks, () => nextTick(layoutAxisLabels), { immediate: true })

onMounted(() => {
  layoutAxisLabels()
  const observer = new ResizeObserver(layoutAxisLabels)
  if (axisRef.value) observer.observe(axisRef.value)
  onBeforeUnmount(() => observer.disconnect())
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
      <div class="rail" aria-hidden="true"></div>

      <!-- The axis hangs off both faces of the rail, alternating side by side. -->
      <div ref="axisRef" class="axis" aria-hidden="true">
        <span
          v-for="tick in ticks"
          :key="`t-${tick.value}`"
          class="axis__tick"
          :class="[
            `axis__tick--${tick.side}`,
            {
              'axis__tick--end': tick.endpoint,
              'axis__tick--first': tick.endpoint && tick.position === 0,
              'axis__tick--last': tick.endpoint && tick.position === 1,
            },
          ]"
          :style="{ left: `${tick.position * 100}%` }"
        >
          <span class="axis__label" :data-side="tick.side" :data-endpoint="tick.endpoint">{{
            tick.label
          }}</span>
        </span>
      </div>

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
/*
 * Everything is measured from the bottom of the track, through the rail.
 * The axis hangs off both faces of the rail, so the rail is not at the
 * bottom of the box — hence --rail-bottom rather than a bare 0.
 */
.scale {
  --rail-h: 28px;
  /* One axis band: a tick stub plus the label it carries. */
  --axis-band: 22px;
  --rail-bottom: var(--axis-band);
  --rail-mid: calc(var(--rail-bottom) + var(--rail-h) / 2);
  --rail-top: calc(var(--rail-bottom) + var(--rail-h));
  /* Marker labels start above the upper axis band. */
  --label-base: calc(var(--rail-top) + var(--axis-band));
  /* Label rows above that, and the label's own height. */
  --row-1: 4px;
  --row-2: 32px;
  --row-3: 60px;
  --label-h: 22px;
  width: 100%;
  margin: 0;
}

.scale__track {
  position: relative;
  height: calc(var(--label-base) + var(--row-3) + var(--label-h));
  width: 100%;
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
.scale__track--armed {
  cursor: crosshair;
}

/*
 * The rail is the interactive track, not an axis rule — it carries real
 * weight. Recessed rather than raised: the inset highlight reads as a groove
 * the markers are seated in, which also gives a fat touch target something to
 * be, rather than looking like a stray bar.
 */
.rail {
  position: absolute;
  left: 0;
  right: 0;
  bottom: var(--rail-bottom);
  height: var(--rail-h);
  border-radius: 999px;
  background: var(--line);
  box-shadow:
    inset 0 1px 3px color-mix(in srgb, var(--ink) 16%, transparent),
    inset 0 -1px 0 color-mix(in srgb, #fff 55%, transparent);
  transition: background 0.15s ease;
}
.scale__track--armed .rail {
  background: color-mix(in srgb, var(--guess) 28%, var(--line));
}


/* Axis: stubs off each face of the rail, labels beyond them. */
.axis {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.axis__tick {
  position: absolute;
  width: 1px;
  height: 6px;
  transform: translateX(-50%);
  background: var(--line-strong);
}
.axis__tick--below {
  bottom: calc(var(--rail-bottom) - 6px);
}
.axis__tick--above {
  bottom: var(--rail-top);
}
/* The two endpoints carry the scale's range, so they read a step stronger
   than the gradations between them. */
.axis__tick--end {
  height: 8px;
  background: var(--ink-muted);
}
.axis__tick--end.axis__tick--below {
  bottom: calc(var(--rail-bottom) - 8px);
}

.axis__label {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 0.68rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink-muted);
  /* Masks the marker stems that pass through the upper band. */
  background: var(--paper-raised);
  padding: 0 4px;
}
.axis__tick--below .axis__label {
  top: 8px;
}
.axis__tick--above .axis__label {
  bottom: 8px;
}
.axis__tick--end .axis__label {
  font-weight: 700;
  color: var(--ink);
}
/* Anchored inward so an end label can't overhang the track. */
.axis__tick--first .axis__label {
  left: 0;
  transform: none;
}
.axis__tick--last .axis__label {
  left: auto;
  right: 0;
  transform: none;
}

/* Error bar: sits just above the rail, spanning guess to answer. */
.error {
  position: absolute;
  bottom: calc(var(--rail-mid) - 3px);
  height: 6px;
  border-radius: 6px;
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
  bottom: var(--rail-mid);
  width: 16px;
  height: 16px;
  margin: 0 0 -8px -8px;
  transform: rotate(45deg);
  background: var(--answer);
  box-shadow:
    0 0 0 2.5px var(--paper-raised),
    0 1px 3px color-mix(in srgb, var(--ink) 25%, transparent);
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
  bottom: var(--rail-mid);
  left: 0;
  width: 20px;
  height: 20px;
  margin: 0 0 -10px -10px;
  border-radius: 50%;
  border: 2px dashed var(--guess);
  background: var(--paper-raised);
}
.drophint__label {
  position: absolute;
  bottom: calc(var(--label-base) + var(--row-1));
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
    --axis-band: 20px;
    --row-1: 2px;
    --row-2: 28px;
    --row-3: 54px;
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
    --rail-h: 22px;
    --axis-band: 18px;
    --row-1: 0px;
    --row-2: 26px;
    --row-3: 26px;
  }
}
</style>
