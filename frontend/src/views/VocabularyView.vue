<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'
import WordCard from '../components/WordCard.vue'
import { useVocabulary } from '../composables/useVocabulary'
import type { WordLevel } from '../types'

const {
  currentIndex,
  currentWord,
  total,
  isFinished,
  isLoading,
  errorMessage,
  loadWords,
  rateWord
} = useVocabulary()

// PrimeVue Select 把空字串當成未選取，所以「全部」用 all 當哨兵值
const ALL = 'all'

const selectedList = ref(ALL)
const bandMin = ref(1)
const bandMax = ref(12)
const selectedLevel = ref(ALL)
const selectedCount = ref(20)

const listOptions = [
  { label: '全部字表', value: ALL },
  { label: 'TSL 多益字', value: 'TSL' },
  { label: 'BSL 商業字', value: 'BSL' },
  { label: 'NAWL 學術字', value: 'NAWL' },
  { label: 'NGSL-GR 核心字', value: 'NGSL-GR' }
]

const bandOptions = Array.from({ length: 12 }, (_, i) => ({
  label: `第 ${i + 1} 級`,
  value: i + 1
}))

const levelOptions = [
  { label: '全部', value: ALL },
  { label: '未學', value: 'new' },
  { label: '學習中', value: 'learning' },
  { label: '已熟', value: 'known' }
]

const countOptions = [
  { label: '20 張', value: 20 },
  { label: '40 張', value: 40 },
  { label: '60 張', value: 60 }
]

function start() {
  if (bandMax.value < bandMin.value) {
    bandMax.value = bandMin.value
  }
  loadWords({
    list: selectedList.value === ALL ? '' : selectedList.value,
    bandMin: bandMin.value,
    bandMax: bandMax.value,
    level: selectedLevel.value === ALL ? '' : selectedLevel.value,
    count: selectedCount.value
  })
}

function handleRate(level: WordLevel) {
  if (currentWord.value) {
    rateWord(currentWord.value.id, level)
  }
}

onMounted(start)
</script>

<template>
  <div class="vocabulary-view">
    <h1>背單字</h1>

    <div class="filter-row">
      <div class="field">
        <label>字表</label>
        <Select v-model="selectedList" :options="listOptions" optionLabel="label" optionValue="value" />
      </div>
      <div class="field">
        <label>難度起</label>
        <Select v-model="bandMin" :options="bandOptions" optionLabel="label" optionValue="value" />
      </div>
      <div class="field">
        <label>難度迄</label>
        <Select v-model="bandMax" :options="bandOptions" optionLabel="label" optionValue="value" />
      </div>
      <div class="field">
        <label>熟練度</label>
        <Select v-model="selectedLevel" :options="levelOptions" optionLabel="label" optionValue="value" />
      </div>
      <div class="field">
        <label>張數</label>
        <Select v-model="selectedCount" :options="countOptions" optionLabel="label" optionValue="value" />
      </div>
      <Button label="重新抽卡" icon="pi pi-refresh" class="reload-btn" @click="start" />
    </div>

    <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

    <div v-if="isLoading" class="loading">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
    </div>

    <Message v-else-if="total === 0" severity="info" :closable="false">
      沒有符合條件的單字，換個篩選條件再試一次。
    </Message>

    <div v-else-if="isFinished" class="finish-panel">
      <h2>這一輪 {{ total }} 張看完了</h2>
      <Button label="再抽一輪" icon="pi pi-refresh" @click="start" />
    </div>

    <WordCard
      v-else-if="currentWord"
      :word="currentWord"
      :index="currentIndex"
      :total="total"
      @rate="handleRate"
    />
  </div>
</template>

<style scoped>
.vocabulary-view {
  max-width: 720px;
  margin: 0 auto;
}

.vocabulary-view h1 {
  margin-bottom: 20px;
  font-size: 1.5rem;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 24px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 120px;
  flex: 1 1 120px;
}

.field label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.reload-btn {
  flex: 1 1 120px;
}

.loading {
  text-align: center;
  padding: 48px 0;
}

.finish-panel {
  text-align: center;
  padding: 48px 0;
}

.finish-panel h2 {
  margin-bottom: 24px;
  font-size: 1.25rem;
}

@media (max-width: 480px) {
  .field {
    flex: 1 1 calc(50% - 6px);
    min-width: 0;
  }

  .reload-btn {
    flex: 1 1 100%;
  }
}
</style>
