<script setup lang="ts">
defineProps<{
  completed: number
  total: number
}>()
</script>

<template>
  <div class="progress">
    <div class="progress__bar" role="img" :aria-label="`${completed} of ${total} puzzles completed`">
      <span class="progress__fill" :style="{ width: `${total ? (completed / total) * 100 : 0}%` }"></span>
    </div>
    <p class="progress__label">
      <strong>{{ completed }}</strong> of {{ total }} puzzles played
    </p>
  </div>
</template>

<style scoped>
.progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.progress__bar {
  height: 8px;
  border-radius: 999px;
  background: var(--line);
  overflow: hidden;
}
.progress__fill {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.4s ease;
}
.progress__label {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ink-muted);
}
.progress__label strong {
  color: var(--ink);
}
</style>
