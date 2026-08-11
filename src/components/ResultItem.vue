<script setup lang="ts">
import { computed } from 'vue'
import type { PuzzleItem } from '@/types/puzzle'
import type { ItemResult } from '@/types/session'
import { BAND_LABELS } from '@/services/scoring'

const props = defineProps<{
  item: PuzzleItem
  result: ItemResult
}>()

const bandLabel = computed(() => BAND_LABELS[props.result.band])

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
      <div class="result-item__title">
        <span class="result-item__label">{{ item.label }}</span>
        <span class="result-item__value">{{ item.displayValue }}</span>
      </div>
      <div class="result-item__score">
        <span class="result-item__points">{{ result.score }}</span>
        <span class="result-item__max">/ {{ result.maxScore }}</span>
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
.result-item__title {
  display: flex;
  flex-direction: column;
}
.result-item__label {
  font-weight: 600;
}
.result-item__value {
  font-size: 0.85rem;
  color: var(--ink-muted);
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
