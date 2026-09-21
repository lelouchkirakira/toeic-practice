<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { Question, AnswerItem } from '../types'

const props = withDefaults(defineProps<{
  question: Question
  index: number
  total: number
  answered?: AnswerItem
  showFeedback?: boolean
}>(), {
  showFeedback: true
})

const emit = defineEmits<{
  answer: [questionId: string, userAnswer: string, correctAnswer: string, grammarCategory?: string]
  next: []
}>()

const selectedOption = ref<string | null>(null)
const submitted = ref(false)

watch(() => props.question.id, () => {
  if (props.answered) {
    selectedOption.value = props.answered.user_answer
    submitted.value = true
  } else {
    selectedOption.value = null
    submitted.value = false
  }
})

const isCorrect = computed(() => {
  if (!submitted.value || !selectedOption.value) return null
  return selectedOption.value === props.question.answer
})

function selectOption(opt: string) {
  if (submitted.value) return
  selectedOption.value = opt
}

function submit() {
  if (!selectedOption.value || submitted.value) return
  submitted.value = true
  emit('answer', props.question.id, selectedOption.value, props.question.answer, props.question.grammar_category)
}

function getOptionClass(opt: string): string {
  if (!submitted.value) {
    return selectedOption.value === opt ? 'selected' : ''
  }
  if (opt === props.question.answer) return 'correct'
  if (opt === selectedOption.value && opt !== props.question.answer) return 'incorrect'
  return 'disabled'
}
</script>

<template>
  <div class="question-card">
    <div class="question-header">
      <span class="question-num">Question {{ index + 1 }} / {{ total }}</span>
      <Tag v-if="question.grammar_category" :value="question.grammar_category" severity="info" />
    </div>

    <p class="sentence">{{ question.sentence }}</p>

    <div class="options">
      <button
        v-for="(opt, i) in question.options"
        :key="i"
        class="option-btn"
        :class="getOptionClass(opt)"
        @click="selectOption(opt)"
        :disabled="submitted"
      >
        <span class="option-label">{{ String.fromCharCode(65 + i) }}</span>
        <span class="option-text">{{ opt }}</span>
      </button>
    </div>

    <div v-if="!submitted && selectedOption" class="actions">
      <Button label="Submit Answer" icon="pi pi-check" @click="submit" />
    </div>

    <div v-if="submitted && showFeedback" class="feedback">
      <div :class="['feedback-banner', isCorrect ? 'correct' : 'incorrect']">
        {{ isCorrect ? 'Correct!' : 'Incorrect' }}
      </div>
      <p class="explanation">{{ question.explanation }}</p>
      <Button label="Next" icon="pi pi-arrow-right" @click="$emit('next')" class="next-btn" />
    </div>
  </div>
</template>

<style scoped>
.question-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  padding: 24px;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.question-num {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.sentence {
  font-size: 1.125rem;
  line-height: 1.6;
  margin-bottom: 24px;
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
  padding: 12px 16px;
  border: 2px solid var(--p-surface-border);
  border-radius: 8px;
  background: var(--p-surface-card);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  font-size: 1rem;
}

.option-btn:hover:not(:disabled) {
  border-color: var(--p-primary-color);
}

.option-btn.selected {
  border-color: var(--p-primary-color);
  background: var(--p-primary-50);
}

.option-btn.correct {
  border-color: var(--p-green-500);
  background: var(--p-green-50);
}

.option-btn.incorrect {
  border-color: var(--p-red-500);
  background: var(--p-red-50);
}

.option-btn.disabled {
  opacity: 0.5;
}

.option-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--p-surface-100);
  font-weight: 700;
  flex-shrink: 0;
}

.actions {
  margin-top: 24px;
  text-align: center;
}

.feedback {
  margin-top: 24px;
}

.feedback-banner {
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  font-weight: 700;
  margin-bottom: 12px;
}

.feedback-banner.correct {
  background: var(--p-green-50);
  color: var(--p-green-700);
}

.feedback-banner.incorrect {
  background: var(--p-red-50);
  color: var(--p-red-700);
}

.explanation {
  color: var(--p-text-muted-color);
  line-height: 1.6;
  margin-bottom: 16px;
}

.next-btn {
  width: 100%;
}
</style>
