<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Button from 'primevue/button'
import type { Passage, AnswerItem } from '../types'

const props = withDefaults(defineProps<{
  passage: Passage
  passageIndex: number
  totalPassages: number
  answeredMap: Map<string, AnswerItem>
  showFeedback?: boolean
}>(), {
  showFeedback: true
})

const emit = defineEmits<{
  answer: [questionId: string, part: string, userAnswer: string, correctAnswer: string]
  next: []
}>()

const selectedAnswers = ref<Map<number, string>>(new Map())
const submittedQuestions = ref<Set<number>>(new Set())

watch(() => props.passage.id, () => {
  selectedAnswers.value = new Map()
  submittedQuestions.value = new Set()
})

const allAnswered = computed(() => {
  return submittedQuestions.value.size === props.passage.questions.length
})

function selectAnswer(qIdx: number, answer: string) {
  if (submittedQuestions.value.has(qIdx)) return
  selectedAnswers.value.set(qIdx, answer)
}

function submitQuestion(qIdx: number) {
  const q = props.passage.questions[qIdx]
  if (!q) return
  const userAnswer = selectedAnswers.value.get(qIdx)
  if (!userAnswer) return

  submittedQuestions.value.add(qIdx)

  const correctAnswer = String(q.answer)
  const questionId = `${props.passage.id}_q${qIdx + 1}`
  const part = q.blank_number ? '6' : '7'

  emit('answer', questionId, part, userAnswer, correctAnswer)
}

function isCorrect(qIdx: number): boolean | null {
  if (!submittedQuestions.value.has(qIdx)) return null
  const q = props.passage.questions[qIdx]
  if (!q) return null
  const userAnswer = selectedAnswers.value.get(qIdx)
  return userAnswer === String(q.answer)
}

function getOptionValue(q: typeof props.passage.questions[0], optIdx: number): string {
  // Part 6: answer 是選項文字本身，Part 7: answer 是 1-based 索引
  if (q.blank_number) {
    return q.options[optIdx] ?? ''
  }
  return String(optIdx + 1)
}

function getCorrectAnswer(q: typeof props.passage.questions[0]): string {
  if (q.blank_number) {
    return String(q.answer)
  }
  return String(q.answer)
}
</script>

<template>
  <div class="passage-card">
    <div class="passage-header">
      <span>Passage {{ passageIndex + 1 }} / {{ totalPassages }}</span>
      <span class="passage-type">{{ passage.passage_type }}</span>
    </div>

    <div class="passage-text">
      <pre class="passage-content">{{ passage.passage }}</pre>
    </div>

    <div class="questions-section">
      <div v-for="(q, qIdx) in passage.questions" :key="qIdx" class="passage-question">
        <p class="q-label">
          <strong>{{ q.blank_number ? `Blank (${q.blank_number})` : `Q${qIdx + 1}. ${q.question}` }}</strong>
        </p>

        <div class="options">
          <button
            v-for="(opt, optIdx) in q.options"
            :key="optIdx"
            class="option-btn"
            :class="{
              selected: selectedAnswers.get(qIdx) === getOptionValue(q, optIdx) && !submittedQuestions.has(qIdx),
              correct: submittedQuestions.has(qIdx) && getOptionValue(q, optIdx) === getCorrectAnswer(q),
              incorrect: submittedQuestions.has(qIdx) && selectedAnswers.get(qIdx) === getOptionValue(q, optIdx) && getOptionValue(q, optIdx) !== getCorrectAnswer(q),
              disabled: submittedQuestions.has(qIdx) && getOptionValue(q, optIdx) !== getCorrectAnswer(q) && selectedAnswers.get(qIdx) !== getOptionValue(q, optIdx)
            }"
            @click="selectAnswer(qIdx, getOptionValue(q, optIdx))"
            :disabled="submittedQuestions.has(qIdx)"
          >
            <span class="option-label">{{ optIdx + 1 }}</span>
            <span class="option-text">{{ opt }}</span>
          </button>
        </div>

        <div v-if="selectedAnswers.has(qIdx) && !submittedQuestions.has(qIdx)" class="q-actions">
          <Button label="Confirm" size="small" @click="submitQuestion(qIdx)" />
        </div>

        <div v-if="submittedQuestions.has(qIdx) && showFeedback" class="q-feedback">
          <div :class="['feedback-banner', isCorrect(qIdx) ? 'correct' : 'incorrect']">
            {{ isCorrect(qIdx) ? 'Correct!' : 'Incorrect' }}
          </div>
          <p v-if="q.explanation" class="explanation">{{ q.explanation }}</p>
        </div>
      </div>
    </div>

    <div v-if="allAnswered" class="passage-actions">
      <Button label="Next Passage" icon="pi pi-arrow-right" @click="$emit('next')" class="w-full" />
    </div>
  </div>
</template>

<style scoped>
.passage-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  padding: 24px;
}

.passage-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.passage-type {
  text-transform: capitalize;
}

.passage-text {
  background: var(--p-surface-50);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.passage-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  font-size: 0.9375rem;
  line-height: 1.7;
  margin: 0;
}

.questions-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.passage-question {
  padding-top: 16px;
  border-top: 1px solid var(--p-surface-border);
}

.q-label {
  margin-bottom: 12px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 2px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-card);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  font-size: 0.9375rem;
}

.option-btn:hover:not(:disabled) {
  border-color: var(--p-primary-color);
}

.option-btn.selected { border-color: var(--p-primary-color); background: var(--p-primary-50); }
.option-btn.correct { border-color: var(--p-green-500); background: var(--p-green-50); }
.option-btn.incorrect { border-color: var(--p-red-500); background: var(--p-red-50); }
.option-btn.disabled { opacity: 0.5; }

.option-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--p-surface-100);
  font-weight: 700;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.q-actions { margin-top: 12px; }
.q-feedback { margin-top: 12px; }

.feedback-banner {
  padding: 8px 12px;
  border-radius: 8px;
  text-align: center;
  font-weight: 700;
  font-size: 0.875rem;
  margin-bottom: 8px;
}

.feedback-banner.correct { background: var(--p-green-50); color: var(--p-green-700); }
.feedback-banner.incorrect { background: var(--p-red-50); color: var(--p-red-700); }

.explanation {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
  line-height: 1.5;
}

.passage-actions {
  margin-top: 24px;
}
</style>
