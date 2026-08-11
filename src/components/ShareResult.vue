<script setup lang="ts">
import { ref } from 'vue'
import type { Puzzle } from '@/types/puzzle'
import type { PuzzleResult } from '@/types/session'
import { buildShareText, shareResult } from '@/services/sharing'

const props = defineProps<{
  puzzle: Puzzle
  result: PuzzleResult
}>()

const status = ref('')

async function onShare() {
  const text = buildShareText(props.puzzle, props.result)
  const outcome = await shareResult(text)
  if (outcome.method === 'cancelled') {
    // They closed the sheet; saying anything about it is noise.
    status.value = ''
    return
  }
  if (!outcome.ok) {
    status.value = 'Could not copy — select the text below to copy it manually.'
    return
  }
  status.value = outcome.method === 'share' ? 'Shared.' : 'Copied to clipboard.'
}
</script>

<template>
  <div class="share">
    <button type="button" class="btn btn--block" @click="onShare">
      Share result
    </button>
    <pre class="share__preview" aria-label="Spoiler-free share preview">{{
      buildShareText(puzzle, result)
    }}</pre>
    <p class="share__status" role="status" aria-live="polite">{{ status }}</p>
  </div>
</template>

<style scoped>
.share {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.share__preview {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 0.9rem;
  line-height: 1.5;
  text-align: center;
  white-space: pre-wrap;
  background: var(--paper);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-sm);
  padding: 12px;
  color: var(--ink);
}
.share__status {
  margin: 0;
  min-height: 1.2em;
  font-size: 0.82rem;
  color: var(--accent-ink);
  text-align: center;
}
</style>
