<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePuzzles } from '@/composables/usePuzzles'
import { useAppState } from '@/composables/useLocalStorage'
import { getDailyPuzzle } from '@/services/daily'
import PuzzleProgress from '@/components/PuzzleProgress.vue'

const router = useRouter()
const { puzzles, loaded, load } = usePuzzles()
const { state } = useAppState()

onMounted(load)

const dailyPuzzle = computed(() =>
  loaded.value && puzzles.value.length ? getDailyPuzzle(puzzles.value) : null,
)

/**
 * Counted over the puzzles, not the stored sessions: the v1 migration carries
 * forward entries keyed by ids no puzzle has any more, and counting those reads
 * as "31 of 28 played".
 */
const completedCount = computed(
  () => puzzles.value.filter((p) => state.value.sessions[p.id]?.completed).length,
)

const dailyDone = computed(() =>
  dailyPuzzle.value ? state.value.sessions[dailyPuzzle.value.id]?.completed : false,
)

const nextUnplayed = computed(() =>
  puzzles.value.find((p) => !state.value.sessions[p.id]?.completed),
)

function playDaily() {
  if (dailyPuzzle.value) router.push(`/play/${dailyPuzzle.value.slug}`)
}

function continuePlaying() {
  const target = nextUnplayed.value ?? puzzles.value[0]
  if (target) router.push(`/play/${target.slug}`)
}
</script>

<template>
  <main class="page home">
    <section class="hero">
      <p class="eyebrow">A daily estimation game</p>
      <h1 class="hero__title">Closer</h1>
      <p class="hero__tagline">
        Place each item where you think it belongs. The closer your estimate, the higher your
        score.
      </p>

      <div v-if="dailyPuzzle" class="hero__cta">
        <button type="button" class="btn btn--primary btn--block hero__play" @click="playDaily">
          {{ dailyDone ? "Replay today's puzzle" : "Play today's puzzle" }}
        </button>
        <p class="hero__daily-meta">
          Puzzle #{{ dailyPuzzle.number }} · {{ dailyPuzzle.category }} ·
          {{ dailyPuzzle.difficulty }}
        </p>
      </div>
    </section>

    <section class="panel card">
      <PuzzleProgress :completed="completedCount" :total="puzzles.length" />
      <div class="panel__links">
        <button
          v-if="nextUnplayed && completedCount > 0"
          type="button"
          class="btn btn--block"
          @click="continuePlaying"
        >
          Continue — next unplayed puzzle
        </button>
        <RouterLink to="/puzzles" class="btn btn--ghost btn--block">
          Browse all puzzles
        </RouterLink>
      </div>
    </section>

    <section class="how card">
      <h2 class="how__title">How to play</h2>
      <ol class="how__steps">
        <li>Each puzzle lays several items along one scale — say, from a blink to a long flight.</li>
        <li>Drop each item onto the scale and slide it to where you think it belongs.</li>
        <li>Submit to reveal the true answers and see how close you were, out of 100.</li>
      </ol>
      <RouterLink to="/about" class="how__more">Read more about Closer →</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.hero {
  text-align: center;
  padding: 20px 0 8px;
}
.hero__title {
  font-size: clamp(3rem, 14vw, 4.5rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 4px 0 10px;
}
.hero__tagline {
  color: var(--ink-muted);
  font-size: 1.05rem;
  max-width: 30ch;
  margin: 0 auto 22px;
}
.hero__cta {
  max-width: 360px;
  margin: 0 auto;
}
.hero__play {
  font-size: 1.05rem;
  padding: 15px 18px;
}
.hero__daily-meta {
  margin: 10px 0 0;
  font-size: 0.82rem;
  color: var(--ink-muted);
  text-transform: capitalize;
}
.panel {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.panel__links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.how {
  padding: 20px;
}
.how__title {
  font-size: 1.2rem;
  margin-bottom: 10px;
}
.how__steps {
  margin: 0 0 12px;
  padding-left: 20px;
  color: var(--ink-muted);
  display: grid;
  gap: 6px;
}
.how__more {
  font-size: 0.9rem;
  font-weight: 600;
}
</style>
