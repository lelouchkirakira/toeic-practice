<script setup lang="ts">
import { computed } from 'vue'
import { useQuiz } from '../composables/useQuiz'
import PartSelector from '../components/PartSelector.vue'
import QuestionCard from '../components/QuestionCard.vue'
import PassageCard from '../components/PassageCard.vue'
import ScoreBoard from '../components/ScoreBoard.vue'
import ProgressBar from 'primevue/progressbar'

const {
  questions,
  passages,
  currentIndex,
  currentQuestion,
  currentPassage,
  totalItems,
  progress,
  answers,
  isLoading,
  isComplete,
  result,
  config,
  startQuiz,
  submitAnswer,
  nextItem,
  getAnswer,
  reset
} = useQuiz()

const started = computed(() => questions.value.length > 0 || passages.value.length > 0)

function handleStart(part: string, count: number) {
  startQuiz({ part: part as '5' | '6' | '7' | 'mixed' | 'vocab', count })
}
</script>

<template>
  <div class="practice-view">
    <PartSelector v-if="!started && !isComplete" @start="handleStart" />

    <div v-else-if="isLoading" class="loading">
      <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
      <p>Loading questions...</p>
    </div>

    <ScoreBoard v-else-if="isComplete && result" :result="result" @restart="reset" />

    <div v-else>
      <ProgressBar :value="progress" class="mb-4" />

      <QuestionCard
        v-if="currentQuestion"
        :question="currentQuestion"
        :index="currentIndex"
        :total="totalItems"
        :answered="getAnswer(currentQuestion.id)"
        @answer="(qid: string, ua: string, ca: string, gc?: string) => submitAnswer(qid, config.part, ua, ca, gc)"
        @next="nextItem"
      />

      <PassageCard
        v-if="currentPassage"
        :passage="currentPassage"
        :passage-index="currentIndex"
        :total-passages="totalItems"
        :answered-map="answers"
        @answer="(qid: string, part: string, ua: string, ca: string) => submitAnswer(qid, part, ua, ca)"
        @next="nextItem"
      />
    </div>
  </div>
</template>

<style scoped>
.practice-view {
  max-width: 720px;
  margin: 0 auto;
}

.loading {
  text-align: center;
  padding: 48px 0;
}

.loading i {
  margin-bottom: 16px;
}

.mb-4 {
  margin-bottom: 16px;
}
</style>
