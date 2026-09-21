import { computed, ref } from 'vue'
import { useApi } from './useApi'
import type { VocabularyFilter, VocabularyProgressSummary, Word, WordLevel } from '../types'

export function useVocabulary() {
  const api = useApi()
  const words = ref<Word[]>([])
  const currentIndex = ref(0)
  const isLoading = ref(false)
  const errorMessage = ref('')
  const summary = ref<VocabularyProgressSummary | null>(null)

  const total = computed(() => words.value.length)
  const currentWord = computed<Word | null>(() => words.value[currentIndex.value] ?? null)
  const isFinished = computed(() => total.value > 0 && currentIndex.value >= total.value)

  function buildQuery(filter: VocabularyFilter): string {
    const params = new URLSearchParams()
    if (filter.list) {
      params.set('list', filter.list)
    }
    if (filter.level) {
      params.set('level', filter.level)
    }
    params.set('band_min', String(filter.bandMin))
    params.set('band_max', String(filter.bandMax))
    params.set('count', String(filter.count))
    return params.toString()
  }

  async function loadWords(filter: VocabularyFilter) {
    isLoading.value = true
    errorMessage.value = ''
    words.value = []
    currentIndex.value = 0
    try {
      words.value = await api.get<Word[]>(`/vocabulary/words?${buildQuery(filter)}`)
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : '載入單字失敗'
    } finally {
      isLoading.value = false
    }
  }

  // 寫入熟練度後換下一張，寫入失敗也不擋住背誦流程，只把訊息留在畫面上
  async function rateWord(wordId: string, level: WordLevel) {
    try {
      await api.post<unknown>('/vocabulary/progress', { word_id: wordId, level })
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : '熟練度寫入失敗'
    }
    currentIndex.value += 1
  }

  async function loadSummary() {
    try {
      summary.value = await api.get<VocabularyProgressSummary>('/vocabulary/progress/summary')
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : '載入熟練度統計失敗'
    }
  }

  return {
    words,
    currentIndex,
    currentWord,
    total,
    isFinished,
    isLoading,
    errorMessage,
    summary,
    loadWords,
    rateWord,
    loadSummary
  }
}
