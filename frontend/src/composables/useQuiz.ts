import { ref, computed } from 'vue'
import { useApi } from './useApi'
import type { Question, Passage, QuizConfig, AnswerItem, SessionResult, SubmitPayload } from '../types'

export function useQuiz() {
  const api = useApi()
  const questions = ref<Question[]>([])
  const passages = ref<Passage[]>([])
  const currentIndex = ref(0)
  const answers = ref<Map<string, AnswerItem>>(new Map())
  const isLoading = ref(false)
  const isComplete = ref(false)
  const result = ref<SessionResult | null>(null)
  const config = ref<QuizConfig>({ part: '5', count: 10 })

  // Part 6/7 走 passages，其餘（Part 5、mixed、vocab）走單題
  const currentQuestion = computed(() => {
    if (config.value.part === '6' || config.value.part === '7') {
      return null
    }
    return questions.value[currentIndex.value] || null
  })

  const currentPassage = computed(() => {
    if (config.value.part === '6' || config.value.part === '7') {
      return passages.value[currentIndex.value] || null
    }
    return null
  })

  const totalItems = computed(() => {
    if (config.value.part === '6' || config.value.part === '7') {
      return passages.value.length
    }
    return questions.value.length
  })

  const progress = computed(() => {
    if (totalItems.value === 0) return 0
    return Math.round((answers.value.size / _totalQuestionCount()) * 100)
  })

  function _totalQuestionCount(): number {
    let count = questions.value.length
    for (const p of passages.value) {
      count += p.questions.length
    }
    return count || 1
  }

  async function startQuiz(cfg: QuizConfig) {
    config.value = cfg
    isLoading.value = true
    isComplete.value = false
    result.value = null
    answers.value = new Map()
    currentIndex.value = 0
    questions.value = []
    passages.value = []

    try {
      // 單字測驗走字庫端點，其餘走既有題庫端點
      const path = cfg.part === 'vocab'
        ? `/vocabulary/quiz?count=${cfg.count}`
        : `/quiz/questions?part=${cfg.part}&count=${cfg.count}`
      const data = await api.get<Question[] | Passage[]>(path)
      if (cfg.part === '6' || cfg.part === '7') {
        passages.value = data as Passage[]
      } else {
        // Part 5、mixed、vocab 統一以 questions 處理
        questions.value = data as Question[]
      }
    } catch (e) {
      console.error('Failed to load questions:', e)
    } finally {
      isLoading.value = false
    }
  }

  function submitAnswer(questionId: string, part: string, userAnswer: string, correctAnswer: string, grammarCategory?: string) {
    const isCorrect = userAnswer === correctAnswer
    answers.value.set(questionId, {
      question_id: questionId,
      part,
      user_answer: userAnswer,
      correct_answer: correctAnswer,
      is_correct: isCorrect,
      grammar_category: grammarCategory
    })
  }

  function nextItem() {
    if (currentIndex.value < totalItems.value - 1) {
      currentIndex.value++
    } else {
      finishQuiz()
    }
  }

  function hasAnswered(questionId: string): boolean {
    return answers.value.has(questionId)
  }

  function getAnswer(questionId: string): AnswerItem | undefined {
    return answers.value.get(questionId)
  }

  async function finishQuiz() {
    isComplete.value = true
    const answerList = Array.from(answers.value.values())

    try {
      const payload: SubmitPayload = {
        mode: 'practice',
        part: config.value.part,
        answers: answerList,
        time_spent_seconds: 0
      }
      result.value = await api.post<SessionResult>('/quiz/submit', payload)
    } catch (e) {
      console.error('Failed to submit:', e)
      // 提交失敗時在本地計算結果
      const correct = answerList.filter(a => a.is_correct).length
      result.value = {
        session_id: 0,
        mode: 'practice',
        part: config.value.part,
        total_questions: answerList.length,
        correct_count: correct,
        score: answerList.length > 0 ? Math.round(correct / answerList.length * 100 * 10) / 10 : 0,
        time_spent_seconds: 0
      }
    }
  }

  function reset() {
    questions.value = []
    passages.value = []
    currentIndex.value = 0
    answers.value = new Map()
    isComplete.value = false
    result.value = null
  }

  return {
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
    hasAnswered,
    getAnswer,
    finishQuiz,
    reset
  }
}
