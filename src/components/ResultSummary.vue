<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Puzzle } from '@/types/puzzle'
import type { PuzzleResult } from '@/types/session'
import ResultItem from './ResultItem.vue'
import ShareResult from './ShareResult.vue'

const props = defineProps<{
  puzzle: Puzzle
  result: PuzzleResult
}>()

defineEmits<{
  (e: 'next'): void
  (e: 'try-again'): void
}>()

const itemById = computed(() =>
  Object.fromEntries(props.puzzle.items.map((i) => [i.id, i])),
)

// Calibrated against the scored-above-chance range: ranking the items right
// but guessing the magnitudes lands around 59, a sharp player around 82.
const headline = computed(() => {
  const t = props.result.total
  if (t >= 85) return 'Superb.'
  if (t >= 65) return 'Great instincts.'
  if (t >= 45) return 'Solid guessing.'
  if (t >= 25) return 'Room to sharpen.'
  return 'A tough one.'
})

const animatedTotal = ref(0)

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

onMounted(() => {
  const target = props.result.total
  if (prefersReducedMotion()) {
    animatedTotal.value = target
    return
  }
  const duration = 850
  let startTime: number | null = null
  const step = (now: number) => {
    if (startTime === null) startTime = now
    const progress = Math.min(1, (now - startTime) / duration)
    // Ease-out for a satisfying settle.
    const eased = 1 - (1 - progress) ** 3
    animatedTotal.value = Math.round(target * eased)
    if (progress < 1) requestAnimationFrame(step)
    else animatedTotal.value = target
  }
  requestAnimationFrame(step)
})
</script>

<template>
  <section class="result" aria-label="Your results">
    <div class="result__score card">
      <p class="result__headline">{{ headline }}</p>
      <p class="result__total">
        <span class="result__number" aria-hidden="true">{{ animatedTotal }}</span>
        <span class="result__outof">/ 100</span>
      </p>
      <p class="sr-only" role="status" aria-live="polite">
        You scored {{ result.total }} out of 100.
      </p>
    </div>

    <div class="result__actions">
      <button type="button" class="btn btn--primary" @click="$emit('next')">
        Next puzzle
      </button>
      <button type="button" class="btn btn--ghost" @click="$emit('try-again')">
        Try again
      </button>
    </div>

    <ShareResult :puzzle="puzzle" :result="result" />

    <h3 class="result__breakdown-title">Item by item</h3>
    <ul class="result__list">
      <ResultItem
        v-for="r in result.items"
        :key="r.itemId"
        :item="itemById[r.itemId]"
        :result="r"
      />
    </ul>
  </section>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.result__score {
  text-align: center;
  padding: 22px 20px;
}
.result__headline {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 4px;
}
.result__total {
  margin: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
}
.result__number {
  font-family: var(--font-display);
  font-size: 3.6rem;
  font-weight: 600;
  line-height: 1;
  color: var(--accent);
}
.result__outof {
  font-size: 1.1rem;
  color: var(--ink-muted);
}
.result__actions {
  display: flex;
  gap: 10px;
}
.result__actions .btn {
  flex: 1;
}
.result__breakdown-title {
  font-size: 1.05rem;
  margin-top: 4px;
}
.result__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
