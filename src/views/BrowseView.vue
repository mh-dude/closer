<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePuzzles } from '@/composables/usePuzzles'
import { useAppState } from '@/composables/useLocalStorage'

const { puzzles, load } = usePuzzles()
const { state, resetProgress } = useAppState()

onMounted(load)

const activeCategory = ref('All')

const categories = computed(() => {
  const set = new Set(puzzles.value.map((p) => p.category))
  return ['All', ...Array.from(set)]
})

const visiblePuzzles = computed(() =>
  activeCategory.value === 'All'
    ? puzzles.value
    : puzzles.value.filter((p) => p.category === activeCategory.value),
)

/** Over the puzzles, not the stored sessions — see HomeView. */
const completedCount = computed(
  () => puzzles.value.filter((p) => state.value.sessions[p.id]?.completed).length,
)

function sessionFor(id: string) {
  return state.value.sessions[id]
}

function confirmReset() {
  if (window.confirm('Reset all progress and scores? This cannot be undone.')) {
    resetProgress()
  }
}
</script>

<template>
  <main class="page browse">
    <header class="browse__header">
      <p class="eyebrow">Archive</p>
      <h1 class="browse__title">All puzzles</h1>
      <p class="browse__sub">
        {{ completedCount }} of {{ puzzles.length }} completed. Replay any puzzle to compare a new
        guess.
      </p>
    </header>

    <div class="filters" role="group" aria-label="Filter by category">
      <button
        v-for="cat in categories"
        :key="cat"
        type="button"
        class="filter"
        :class="{ 'filter--active': activeCategory === cat }"
        @click="activeCategory = cat"
      >
        {{ cat }}
      </button>
    </div>

    <ul class="browse__list">
      <li v-for="p in visiblePuzzles" :key="p.id">
        <RouterLink :to="`/play/${p.slug}`" class="puzzle-row card">
          <div class="puzzle-row__num">#{{ p.number }}</div>
          <div class="puzzle-row__body">
            <p class="puzzle-row__title">{{ p.title }}</p>
            <p class="puzzle-row__meta">
              {{ p.category }} · <span class="puzzle-row__diff">{{ p.difficulty }}</span>
            </p>
          </div>
          <div class="puzzle-row__status">
            <template v-if="sessionFor(p.id)?.completed">
              <span class="puzzle-row__score">{{ sessionFor(p.id)?.total }}</span>
              <span class="puzzle-row__scoremax">/100</span>
              <span class="puzzle-row__done" aria-label="Completed">✓ Replay</span>
            </template>
            <span v-else class="puzzle-row__play">Play →</span>
          </div>
        </RouterLink>
      </li>
    </ul>

    <div class="browse__reset">
      <button type="button" class="btn btn--ghost" @click="confirmReset">
        Reset all progress
      </button>
    </div>
  </main>
</template>

<style scoped>
.browse {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.browse__header {
  text-align: center;
}
.browse__title {
  font-size: clamp(1.8rem, 7vw, 2.4rem);
  margin: 6px 0 8px;
}
.browse__sub {
  color: var(--ink-muted);
  margin: 0;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  justify-content: center;
}
.filter {
  border: 1px solid var(--line-strong);
  background: var(--paper-raised);
  color: var(--ink-muted);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 0.82rem;
  font-weight: 600;
}
.filter--active {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
.browse__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.puzzle-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  transition: border-color 0.15s ease, transform 0.08s ease;
}
.puzzle-row:hover {
  border-color: var(--line-strong);
  text-decoration: none;
}
.puzzle-row:active {
  transform: translateY(1px);
}
.puzzle-row__num {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ink-muted);
  min-width: 34px;
}
.puzzle-row__body {
  flex: 1;
  min-width: 0;
}
.puzzle-row__title {
  margin: 0;
  font-weight: 600;
  color: var(--ink);
}
.puzzle-row__meta {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--ink-muted);
}
.puzzle-row__diff {
  text-transform: capitalize;
}
.puzzle-row__status {
  text-align: right;
  white-space: nowrap;
}
.puzzle-row__score {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--accent);
}
.puzzle-row__scoremax {
  font-size: 0.75rem;
  color: var(--ink-muted);
}
.puzzle-row__done {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--answer);
}
.puzzle-row__play {
  font-weight: 600;
  color: var(--accent-ink);
}
.browse__reset {
  text-align: center;
  margin-top: 6px;
}
</style>
