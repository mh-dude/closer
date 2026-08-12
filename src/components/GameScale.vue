<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Puzzle } from '@/types/puzzle'
import type { Placements, PuzzleResult } from '@/types/session'
import { scaleTicks, positionToValue } from '@/services/scale'
import { formatTick, formatValue } from '@/services/format'
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
  (e: 'pickup', itemId: string): void
  (e: 'select', itemId: string | null): void
  (e: 'nudge', itemId: string, steps: number): void
  (e: 'unplace', itemId: string): void
}>()

const trackRef = ref<HTMLElement | null>(null)

function getTrackRect(): DOMRect | null {
  return trackRef.value?.getBoundingClientRect() ?? null
}

const { startDrag, draggingId, moving } = useScaleInteraction(
  getTrackRect,
  (itemId, position) => emit('place', itemId, position),
  // Tapped, not dragged: lift the marker into the player's hand, the same way
  // tapping a tray chip does. The next tap on the rail sets it down.
  (itemId) => emit('pickup', itemId),
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
  const el = (event.target as HTMLElement).closest('.marker__handle') as HTMLElement | null
  // Anywhere but the handle is track, and the track will place the held item.
  if (!el) return
  /*
   * Grabbing the marker wins over dropping the held item on top of it. Placing
   * one item hands over the next, so something is in hand for the whole run —
   * and reaching back to adjust what you just placed has to keep working.
   */
  emit('select', itemId)
  armedPreview.value = null
  startDrag(itemId, event, el)
}

function onTrackPointerdown(event: PointerEvent) {
  if (props.submitted) return

  /*
   * Taps that land on a marker belong to the marker, held item or not. Since
   * placing one item hands over the next, something is in hand for the whole
   * run — and without this, reaching back to nudge a marker you just placed
   * would drop the next item on top of it instead.
   */
  if ((event.target as HTMLElement).closest('.marker__handle')) return

  if (props.armedItemId) {
    beginArmedPlacement(event)
    return
  }

  /*
   * Nothing in hand, so the rail has nothing to receive. Moving a placed marker
   * now goes through picking it up first — pressing bare track used to teleport
   * whichever marker happened to be selected, which is a different rule from
   * the one the rest of the board follows.
   */
  emit('select', null)
  beginProbe(event)
}

/*
 * Reading the rail with nothing in hand: press anywhere on it and the value
 * under the finger appears, following it until you lift. Nothing is placed and
 * nothing is selected — it's the scale answering "what is here?", which on a
 * touch screen is the only way to ask, there being no pointer to hover with.
 */
const probePosition = ref<number | null>(null)
const probePointerId = ref(-1)

function beginProbe(event: PointerEvent) {
  const track = trackRef.value
  if (!track || probePointerId.value !== -1) return
  probePointerId.value = event.pointerId
  track.setPointerCapture(event.pointerId)
  probePosition.value = positionAt(event.clientX)
}

function endProbe() {
  const track = trackRef.value
  if (track?.hasPointerCapture(probePointerId.value)) {
    track.releasePointerCapture(probePointerId.value)
  }
  probePointerId.value = -1
  probePosition.value = null
}

/**
 * Where a held item would land, previewed before anything commits.
 *
 * A mouse gets this on hover. Touch has no hover, so the preview appears the
 * moment a finger lands on the track and follows it from there — the placement
 * commits on lift, which leaves room to slide into position first.
 */
const armedPreview = ref<number | null>(null)

/** The pointer currently choosing a spot for the held item; -1 when none. */
const placingPointerId = ref(-1)

function beginArmedPlacement(event: PointerEvent) {
  const track = trackRef.value
  // A press on a marker reaches this twice — once from the marker, once as it
  // bubbles to the track — and only the first should take the pointer.
  if (!track || placingPointerId.value !== -1) return
  placingPointerId.value = event.pointerId
  // Captured on the track, so the preview keeps following a finger that
  // wanders off it mid-gesture.
  track.setPointerCapture(event.pointerId)
  armedPreview.value = positionAt(event.clientX)
}

function endArmedPlacement() {
  const track = trackRef.value
  if (track?.hasPointerCapture(placingPointerId.value)) {
    track.releasePointerCapture(placingPointerId.value)
  }
  placingPointerId.value = -1
}

function onTrackPointermove(event: PointerEvent) {
  if (props.submitted) return

  if (probePointerId.value !== -1) {
    if (event.pointerId !== probePointerId.value) return
    // Deliberately not preventDefault: a probe must never cost the player the
    // ability to scroll the page off a gesture that started on the rail.
    probePosition.value = positionAt(event.clientX)
    return
  }

  if (!props.armedItemId) return
  // Repositioning a marker: that's the thing following the pointer, so the
  // held item's preview stands still rather than chasing it too.
  if (draggingId.value) return
  if (placingPointerId.value !== -1) {
    if (event.pointerId !== placingPointerId.value) return
    if (event.cancelable) event.preventDefault()
    armedPreview.value = positionAt(event.clientX)
    return
  }
  if (event.pointerType === 'touch') return
  armedPreview.value = positionAt(event.clientX)
}

function onTrackPointerup(event: PointerEvent) {
  if (event.pointerId === probePointerId.value) {
    endProbe()
    return
  }
  if (event.pointerId !== placingPointerId.value) return
  const itemId = props.armedItemId
  const position = positionAt(event.clientX)
  endArmedPlacement()
  if (itemId && position !== null) emit('place', itemId, position)
}

/** The gesture became a scroll: drop the preview, keep holding the item. */
function onTrackPointercancel(event: PointerEvent) {
  if (event.pointerId === probePointerId.value) {
    endProbe()
    return
  }
  if (event.pointerId !== placingPointerId.value) return
  endArmedPlacement()
  armedPreview.value = null
}

function onTrackPointerleave() {
  if (placingPointerId.value === -1) armedPreview.value = null
}

watch(
  () => props.armedItemId,
  (armed) => {
    if (armed) return
    endArmedPlacement()
    armedPreview.value = null
  },
)

const itemById = computed(() =>
  Object.fromEntries(props.puzzle.items.map((i) => [i.id, i])),
)

/**
 * What the guess would read as if it landed here — the same value the results
 * will quote back, so the estimate is made against the number rather than
 * against the gap between two gridlines.
 */
function readingAt(position: number) {
  const { minValue, maxValue, scaleType, unit } = props.puzzle
  return formatValue(positionToValue(position, minValue, maxValue, scaleType), unit)
}

/** The drag preview wins; otherwise show where a held item would land. */
const activeHint = computed(() => {
  if (props.dropHint) {
    return { ...props.dropHint, reading: readingAt(props.dropHint.position), live: false }
  }
  if (props.armedItemId && armedPreview.value !== null && !draggingId.value) {
    const item = itemById.value[props.armedItemId]
    if (item) {
      return {
        label: item.shortLabel || item.label,
        position: armedPreview.value,
        reading: readingAt(armedPreview.value),
        // A finger is on the track choosing the spot, so commit to showing it.
        live: placingPointerId.value !== -1,
      }
    }
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
    <!--
      Only on log scales: it's the one case where reading the rail the obvious
      way gives the wrong answer, and a "linear scale" note on the other puzzles
      would be noise on a board that already reads correctly.
    -->
    <figcaption v-if="puzzle.scaleType === 'logarithmic'" class="scale__note">
      <span class="scale__note-lead">Logarithmic scale</span>
      <span class="scale__note-body">equal steps multiply rather than add</span>
    </figcaption>

    <div
      ref="trackRef"
      class="scale__track"
      :class="{
        'scale__track--done': submitted,
        'scale__track--armed': !!armedItemId && !submitted,
      }"
      @pointerdown="onTrackPointerdown"
      @pointermove="onTrackPointermove"
      @pointerup="onTrackPointerup"
      @pointercancel="onTrackPointercancel"
      @pointerleave="onTrackPointerleave"
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

      <!-- Reading the rail with an empty hand: value only, no commitment. -->
      <div
        v-if="probePosition !== null"
        class="probe"
        :class="`probe--edge-${edgeFor(probePosition)}`"
        :style="{ left: `${probePosition * 100}%` }"
        aria-hidden="true"
      >
        <span class="probe__guide"></span>
        <span class="probe__value">{{ readingAt(probePosition) }}</span>
      </div>

      <!-- Where the item being dragged or carried would land -->
      <div
        v-if="activeHint"
        class="drophint"
        :class="[
          `drophint--edge-${edgeFor(activeHint.position)}`,
          { 'drophint--live': activeHint.live },
        ]"
        :style="{ left: `${activeHint.position * 100}%` }"
        aria-hidden="true"
      >
        <span class="drophint__guide"></span>
        <span class="drophint__dot"></span>
        <span class="drophint__label">
          <span class="drophint__name">{{ activeHint.label }}</span>
          <span class="drophint__reading">{{ activeHint.reading }}</span>
        </span>
      </div>

      <ScaleMarker
        v-for="item in placedItems"
        :key="item.id"
        :item="item"
        :position="placements[item.id]"
        :selected="selectedItemId === item.id"
        :row="rowByItemId[item.id]"
        :disabled="submitted"
        :reading="readingAt(placements[item.id])"
        :dragging="draggingId === item.id && moving"
        :lifted="armedItemId === item.id"
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

/*
 * Sits above the track rather than inside its empty top band: that band is the
 * third row of marker labels, so anything parked there collides as soon as
 * three markers land near each other.
 */
.scale__note {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  gap: 4px 7px;
  margin-bottom: 14px;
  font-size: 0.72rem;
  line-height: 1.35;
  text-align: center;
  color: var(--ink-muted);
}
.scale__note-lead {
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink);
}
/* An em dash the copy doesn't have to carry, and that disappears when the two
   halves wrap onto separate lines. */
.scale__note-body::before {
  content: '— ';
}
@media (max-width: 420px) {
  .scale__note-body::before {
    content: none;
  }
  .scale__note {
    gap: 1px 7px;
    margin-bottom: 10px;
  }
}
/*
 * Landscape phone: the board and the tray are already fighting for the same
 * few hundred pixels, so the caption keeps the warning and drops the
 * explanation rather than taking another line off the board.
 */
@media (max-height: 560px) {
  .scale__note {
    margin-bottom: 8px;
    font-size: 0.68rem;
  }
  .scale__note-body {
    display: none;
  }
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
  /* While holding an item the track owns the gesture outright, so sliding a
     finger across it previews a position instead of scrolling the page away. */
  touch-action: none;
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
    inset 0 1px 3px color-mix(in srgb, var(--shade) 55%, transparent),
    inset 0 -1px 0 var(--sheen);
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
    0 1px 3px color-mix(in srgb, var(--shade) 55%, transparent);
  opacity: 0;
  transition: opacity 0.35s ease;
  z-index: 4;
}
.answer--in {
  opacity: 1;
}

/*
 * Probe: the value under a finger that is only reading, not placing. Ink
 * rather than guess-blue, because nothing here is anybody's guess yet, and it
 * rides above the rail so a thumb resting on the track can't cover it.
 */
.probe {
  position: absolute;
  bottom: 0;
  width: 0;
  z-index: 6;
  pointer-events: none;
}
.probe__guide {
  position: absolute;
  bottom: var(--rail-top);
  left: 0;
  width: 1px;
  height: var(--axis-band);
  transform: translateX(-50%);
  background: var(--ink-muted);
  opacity: 0.55;
}
.probe__value {
  position: absolute;
  bottom: calc(var(--label-base) + var(--row-1));
  left: 0;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 0.74rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  background: var(--paper-raised);
  border: 1px solid var(--line-strong);
  padding: 2px 9px;
  border-radius: 999px;
  box-shadow: var(--shadow-sm);
}
/* Anchored inward at the ends so the bubble can't hang off the board. */
.probe--edge-start .probe__value {
  left: -6px;
  transform: none;
}
.probe--edge-end .probe__value {
  left: auto;
  right: -6px;
  transform: none;
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
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
/*
 * Stem up to the label, so a finger sitting on the rail can still see which
 * gradation it has picked out — the fingertip covers the dot itself.
 */
.drophint__guide {
  position: absolute;
  bottom: var(--rail-top);
  left: 0;
  width: 1px;
  height: calc(var(--axis-band) + var(--row-1));
  transform: translateX(-50%);
  background: var(--guess);
  opacity: 0;
  transition: opacity 0.12s ease;
}
.drophint__label {
  position: absolute;
  bottom: calc(var(--label-base) + var(--row-1));
  left: 0;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
  white-space: nowrap;
  max-width: 40vw;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--guess);
  background: var(--paper-raised);
  border: 1px dashed var(--guess);
  padding: 2px 8px;
  border-radius: 999px;
}
.drophint__name {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
/*
 * The live value. Tabular figures so the digits don't shuffle the pill left and
 * right as it tracks the pointer — the pill is centred on the position, so any
 * width change moves both its edges.
 */
.drophint__reading {
  flex: none;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
  padding-left: 7px;
  border-left: 1px solid color-mix(in srgb, currentColor 35%, transparent);
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

/* A finger is down and choosing: the preview stops being a hint and starts
   looking like the marker it is about to become. */
.drophint--live .drophint__guide {
  opacity: 0.5;
}
.drophint--live .drophint__dot {
  border-style: solid;
  background: color-mix(in srgb, var(--guess) 20%, var(--paper-raised));
  transform: scale(1.1);
  box-shadow: 0 0 0 7px color-mix(in srgb, var(--guess) 14%, transparent);
}
.drophint--live .drophint__label {
  border-style: solid;
  background: var(--guess);
  color: var(--guess-fg);
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
