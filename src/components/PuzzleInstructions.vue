<script setup lang="ts">
defineProps<{
  dismissed: boolean
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()
</script>

<template>
  <aside v-if="!dismissed" class="instructions" aria-label="How to play">
    <div class="instructions__body">
      <h2 class="instructions__title">How to play</h2>
      <ol class="instructions__steps">
        <li>Pick up an item from below, then choose its spot on the scale — or drag it
          straight there.</li>
        <li>Nudge its marker by dragging, tapping the scale, or using the arrow keys.</li>
        <li>
          Read the gridline labels before you place anything — many scales are logarithmic, so
          the middle is nowhere near the halfway value.
        </li>
        <li>Place every item, then submit to reveal how close you were.</li>
      </ol>
    </div>
    <button type="button" class="instructions__dismiss" @click="emit('dismiss')">
      Got it
    </button>
  </aside>
</template>

<style scoped>
.instructions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  background: color-mix(in srgb, var(--accent) 7%, var(--paper-raised));
  border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--line));
  border-radius: var(--radius);
  padding: 14px 16px;
}
.instructions__title {
  font-size: 1rem;
  margin-bottom: 6px;
}
.instructions__steps {
  margin: 0;
  padding-left: 18px;
  font-size: 0.88rem;
  color: var(--ink-muted);
  display: grid;
  gap: 3px;
}
.instructions__dismiss {
  flex-shrink: 0;
  border: 1px solid var(--line-strong);
  background: var(--paper-raised);
  color: var(--ink);
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.85rem;
}
@media (hover: hover) {
  .instructions__dismiss:hover {
    border-color: var(--ink);
  }
}
@media (max-width: 480px) {
  .instructions {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .instructions__dismiss {
    align-self: flex-end;
  }
}
</style>
