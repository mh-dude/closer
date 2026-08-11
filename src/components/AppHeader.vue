<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <header class="site-header">
    <div class="site-header__inner">
      <RouterLink to="/" class="wordmark" aria-label="Closer — home">
        <span class="wordmark__text">Closer</span>
        <span class="wordmark__dot" aria-hidden="true"></span>
      </RouterLink>
      <nav class="site-nav" aria-label="Primary">
        <RouterLink to="/puzzles">Puzzles</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--paper) 88%, transparent);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  position: sticky;
  top: 0;
  z-index: 20;
  padding-top: env(safe-area-inset-top);
}
.site-header__inner {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 12px max(20px, env(safe-area-inset-right)) 12px max(20px, env(safe-area-inset-left));
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wordmark {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  color: var(--ink);
}
.wordmark:hover {
  text-decoration: none;
}
.wordmark__text {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.35rem;
  letter-spacing: -0.02em;
}
.wordmark__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  display: inline-block;
}
.site-nav {
  display: flex;
  gap: 18px;
  font-size: 0.9rem;
  font-weight: 500;
}
.site-nav a {
  color: var(--ink-muted);
}
.site-nav a.router-link-active {
  color: var(--ink);
  text-decoration: none;
}
@media (hover: hover) {
  .site-nav a:hover {
    color: var(--ink);
    text-decoration: none;
  }
}
/* Phones — including landscape, which is wide but short — need the vertical
   room for the board more than a pinned nav, and it lets the play screen stick
   its own furniture to the top. */
@media (max-width: 640px), (max-height: 560px) {
  .site-header {
    position: static;
  }
}
@media (max-width: 420px) {
  .site-nav {
    gap: 14px;
    font-size: 0.85rem;
  }
}
</style>
