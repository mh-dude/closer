<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'

const route = useRoute()
</script>

<template>
  <div class="app-shell">
    <AppHeader />
    <RouterView v-slot="{ Component }">
      <component :is="Component" />
    </RouterView>
    <footer class="site-footer" :class="{ 'site-footer--tucked': route.name === 'play' }">
      <p>Closer — a daily estimation game</p>
    </footer>
  </div>
</template>

<style scoped>
.site-footer {
  flex-shrink: 0;
  text-align: center;
  padding: 24px max(20px, env(safe-area-inset-right)) calc(40px + env(safe-area-inset-bottom))
    max(20px, env(safe-area-inset-left));
  color: var(--ink-muted);
  font-size: 0.8rem;
  border-top: 1px solid var(--line);
}
.site-footer p {
  margin: 0;
}
/* On a phone the play screen sticks its board to the top and its tray to the
   bottom; a footer below them is dead weight that lets both scroll out of
   reach at the end of the page. */
@media (max-width: 640px), (max-height: 560px) {
  .site-footer--tucked {
    display: none;
  }
}
</style>
