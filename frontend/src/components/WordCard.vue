<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { Word, WordLevel } from '../types'

const props = defineProps<{
  word: Word
  index: number
  total: number
}>()

const emit = defineEmits<{
  rate: [level: WordLevel]
}>()

const flipped = ref(false)

// 換字就翻回正面
watch(() => props.word.id, () => {
  flipped.value = false
})

const listNames = computed(() => Object.keys(props.word.lists ?? {}))
const inflections = computed(() => props.word.inflections ?? [])
const hasDefinition = computed(() => Boolean(props.word.definition_zh || props.word.definition_en))

function toggleFlip() {
  flipped.value = !flipped.value
}
</script>

<template>
  <div class="word-card">
    <div class="card-header">
      <Tag :value="`難度 ${word.band}`" severity="secondary" />
      <span class="progress-count">{{ index + 1 }} / {{ total }}</span>
    </div>

    <button type="button" class="card-face" @click="toggleFlip">
      <template v-if="!flipped">
        <span class="word-text">{{ word.word }}</span>
        <span v-if="word.phonetic" class="phonetic">[{{ word.phonetic }}]</span>
        <span v-if="word.pos" class="pos">{{ word.pos }}</span>
        <span class="flip-hint">點一下翻面看釋義</span>
      </template>

      <template v-else>
        <span class="word-text-back">{{ word.word }}</span>
        <span v-if="word.definition_zh" class="definition-zh">{{ word.definition_zh }}</span>
        <span v-if="word.definition_en" class="definition-en">{{ word.definition_en }}</span>
        <span v-if="!hasDefinition" class="no-definition">這個字還沒有釋義資料</span>
        <span v-if="inflections.length" class="inflections">
          詞形變化：{{ inflections.join('、') }}
        </span>
        <span class="list-tags">
          <Tag v-for="name in listNames" :key="name" :value="name" severity="info" />
        </span>
      </template>
    </button>

    <div class="rate-row">
      <Button label="不會" severity="danger" outlined @click="emit('rate', 'unknown')" />
      <Button label="模糊" severity="warn" outlined @click="emit('rate', 'fuzzy')" />
      <Button label="會了" severity="success" outlined @click="emit('rate', 'known')" />
    </div>
  </div>
</template>

<style scoped>
.word-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.progress-count {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.card-face {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  min-height: 240px;
  padding: 24px 16px;
  border: 2px dashed var(--p-surface-border);
  border-radius: 12px;
  background: var(--p-surface-ground);
  color: inherit;
  font-family: inherit;
  cursor: pointer;
  text-align: center;
}

.card-face:hover {
  border-color: var(--p-primary-color);
}

.word-text {
  font-size: 2rem;
  font-weight: 700;
  word-break: break-word;
}

.word-text-back {
  font-size: 1.375rem;
  font-weight: 700;
  word-break: break-word;
}

.phonetic {
  font-size: 1.125rem;
  color: var(--p-text-muted-color);
}

.pos {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.flip-hint {
  margin-top: 8px;
  font-size: 0.8125rem;
  color: var(--p-text-muted-color);
}

.definition-zh {
  font-size: 1.125rem;
  line-height: 1.6;
}

.definition-en {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--p-text-muted-color);
}

.no-definition,
.inflections {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.list-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.rate-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 20px;
}

.rate-row :deep(.p-button) {
  width: 100%;
}

@media (max-width: 480px) {
  .word-card {
    margin: 0 -16px;
    border-left: none;
    border-right: none;
    border-radius: 0;
  }

  .word-text {
    font-size: 1.75rem;
  }

  .rate-row {
    gap: 8px;
  }
}
</style>
