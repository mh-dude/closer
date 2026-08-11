<script setup lang="ts">
import { computed } from 'vue'
import type { Puzzle, PuzzleItem } from '@/types/puzzle'
import type { ItemResult } from '@/types/session'
import { BAND_LABELS } from '@/services/scoring'
import { positionToValue } from '@/services/scale'
import { formatValue } from '@/services/format'

const props = defineProps<{
  puzzle: Puzzle
  item: PuzzleItem
  result: ItemResult
}>()

const bandLabel = computed(() => BAND_LABELS[props.result.band])

/**
 * The guess read back in the puzzle's own units, so it compares against the
 * answer directly. Marker positions are what the game stores, so this runs the
 * scale mapping backwards — the value the player pointed at, not one they typed.
 */
const guessDisplay = computed(() =>
  formatValue(
    positionToValue(
      props.result.estimatedPosition,
      props.puzzle.minValue,
      props.puzzle.maxValue,
      props.puzzle.scaleType,
    ),
    props.puzzle.unit,
  ),
)

// Shape glyphs so the band is legible without relying on color.
const BAND_GLYPH: Record<string, string> = {
  exact: '★',
  'very-close': '◕',
  close: '◑',
  off: '◔',
  'far-off': '○',
}
const glyph = computed(() => BAND_GLYPH[props.result.band])
</script>

<template>
  <li class="result-item" :class="`result-item--${result.band}`">
    <div class="result-item__head">
      <span class="result-item__label">{{ item.label }}</span>
      <div class="result-item__score">
        <span class="result-item__points">{{ result.score }}</span>
        <span class="result-item__max">/ {{ result.maxScore }}</span>
      </div>
    </div>

    <!-- Same circle-vs-diamond and blue-vs-green pairing the board uses, so the
         reading carries over from the reveal without being learned twice. -->
    <div class="result-item__compare">
      <div class="result-item__reading result-item__reading--guess">
        <span class="result-item__readinghead">
          <span class="result-item__key" aria-hidden="true"></span>You said
        </span>
        <span class="result-item__readingvalue">{{ guessDisplay }}</span>
      </div>
      <div class="result-item__reading result-item__reading--answer">
        <span class="result-item__readinghead">
          <span class="result-item__key" aria-hidden="true"></span>Answer
        </span>
        <span class="result-item__readingvalue">{{ item.displayValue }}</span>
      </div>
    </div>

    <div class="result-item__band">
      <span class="result-item__glyph" aria-hidden="true">{{ glyph }}</span>
      <span class="result-item__bandlabel">{{ bandLabel }}</span>
    </div>

    <p class="result-item__fact">{{ item.fact }}</p>
    <a
      v-if="item.sourceUrl"
      class="result-item__source"
      :href="item.sourceUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ item.sourceLabel || 'Source' }}
    </a>
  </li>
</template>

<style scoped>
.result-item {
  list-style: none;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-left-width: 4px;
  border-radius: var(--radius-sm);
  background: var(--paper-raised);
}
.result-item--exact {
  border-left-color: var(--band-exact);
}
.result-item--very-close {
  border-left-color: var(--band-very-close);
}
.result-item--close {
  border-left-color: var(--band-close);
}
.result-item--off {
  border-left-color: var(--band-off);
}
.result-item--far-off {
  border-left-color: var(--band-far);
}

.result-item__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.result-item__label {
  font-weight: 600;
}
.result-item__score {
  font-family: var(--font-display);
  white-space: nowrap;
}
.result-item__points {
  font-size: 1.3rem;
  font-weight: 600;
}
.result-item__max {
  font-size: 0.85rem;
  color: var(--ink-muted);
}

/*
 * Guess and answer side by side — the comparison is the point of the card.
 * Two fixed columns rather than flex-with-gap, so "Answer" starts at the same
 * place in every card and the list reads down as two columns, not a ragged edge.
 */
.result-item__compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin-top: 10px;
}
.result-item__reading {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.result-item__readinghead {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--ink-muted);
}
.result-item__readingvalue {
  font-size: 0.95rem;
  font-weight: 600;
}
.result-item__key {
  width: 9px;
  height: 9px;
  flex-shrink: 0;
}
.result-item__reading--guess .result-item__key {
  border-radius: 50%;
  background: var(--guess);
}
.result-item__reading--guess .result-item__readingvalue {
  color: var(--guess);
}
.result-item__reading--answer .result-item__key {
  transform: rotate(45deg);
  background: var(--answer);
}
.result-item__reading--answer .result-item__readingvalue {
  color: var(--answer);
}

.result-item__band {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.result-item__glyph {
  font-size: 0.95rem;
}
.result-item--exact .result-item__band {
  color: var(--band-exact);
}
.result-item--very-close .result-item__band {
  color: var(--band-very-close);
}
.result-item--close .result-item__band {
  color: var(--band-close);
}
.result-item--off .result-item__band {
  color: var(--band-off);
}
.result-item--far-off .result-item__band {
  color: var(--band-far);
}

.result-item__fact {
  margin: 8px 0 0;
  font-size: 0.9rem;
  color: var(--ink-muted);
  line-height: 1.5;
}
.result-item__source {
  display: inline-block;
  margin-top: 6px;
  font-size: 0.78rem;
}
</style>
