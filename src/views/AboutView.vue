<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="page about">
    <header class="about__header">
      <p class="eyebrow">About</p>
      <h1 class="about__title">What is Closer?</h1>
    </header>

    <div class="about__body">
      <p>
        Closer is a daily game about estimation. Each puzzle lays several things along one scale —
        how long events last, how far apart places are, how much things weigh — and asks you to
        place each one where you think it belongs.
      </p>
      <p>
        You don't type numbers. You reason: this is faster than that, this is roughly a tenth of
        the way along. Submit, and Closer reveals the true positions and scores how close you were,
        out of 100.
      </p>

      <h2>Scoring</h2>
      <p>
        Every item is worth an equal share of 100 points. Your score for an item depends only on
        the visual distance between your marker and the true answer — never the raw numbers — so it
        works the same on linear and logarithmic scales. The curve is forgiving near the answer and
        drops away sharply as you drift: land it and you get full marks; a wild miss earns almost
        nothing.
      </p>

      <h2>Linear vs. logarithmic scales</h2>
      <p>
        When values are spread fairly evenly — temperatures, everyday speeds — the scale is linear.
        When they span orders of magnitude — from a bowling lane to the Moon — it's logarithmic, so
        every part of the scale stays playable. You never need to think about the math; the scale
        just presents the values sensibly.
      </p>

      <h2>A new puzzle each day</h2>
      <p>
        Today's puzzle is the same one for everyone, and it advances once per calendar day. Every
        puzzle released so far stays playable from the
        <RouterLink to="/puzzles">puzzle browser</RouterLink>. Progress is saved in your browser
        only.
      </p>
    </div>
  </main>
</template>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.about__header {
  text-align: center;
  margin-bottom: 6px;
}
.about__title {
  font-size: clamp(1.8rem, 7vw, 2.4rem);
  margin-top: 6px;
}
.about__body {
  max-width: 60ch;
  margin: 0 auto;
}
.about__body h2 {
  font-size: 1.15rem;
  margin: 22px 0 6px;
}
.about__body p {
  color: var(--ink);
  margin: 0 0 12px;
  line-height: 1.65;
}
</style>
