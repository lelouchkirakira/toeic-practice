export interface Question {
  id: string
  sentence: string
  options: string[]
  answer: string
  explanation: string
  grammar_category?: string
}

export interface PassageQuestion {
  blank_number?: number
  question?: string
  options: string[]
  answer: string | number
  explanation: string
}

export interface Passage {
  id: string
  passage_type: string
  passage: string
  questions: PassageQuestion[]
}

export type QuizItem = Question | Passage

export interface QuizConfig {
  part: '5' | '6' | '7' | 'mixed' | 'vocab'
  count: number
}

export interface WordListEntry {
  rank: number
  band?: number
}

export interface Word {
  id: string
  word: string
  pos: string
  phonetic: string
  definition_en: string
  definition_zh: string
  lists: Record<string, WordListEntry>
  band: number
  inflections: string[]
}

export type WordLevel = 'unknown' | 'fuzzy' | 'known'

export interface VocabularyFilter {
  list: string
  bandMin: number
  bandMax: number
  level: string
  count: number
}

export interface WordLevelCount {
  unknown: number
  fuzzy: number
  known: number
  total: number
}

export interface VocabularyProgressSummary {
  total_tracked: number
  total_reviews: number
  by_level: Record<WordLevel, number>
  by_band: Record<string, WordLevelCount>
  by_list: Record<string, WordLevelCount>
}

export interface SubmitPayload {
  mode: 'practice' | 'mock'
  part: string
  answers: AnswerItem[]
  time_spent_seconds: number
}

export interface AnswerItem {
  question_id: string
  part: string
  user_answer: string
  correct_answer: string
  is_correct: boolean
  grammar_category?: string
}

export interface SessionResult {
  session_id: number
  mode: string
  part: string
  total_questions: number
  correct_count: number
  score: number
  time_spent_seconds: number
  estimated_toeic_score?: string
}

export interface StatsOverview {
  total_sessions: number
  total_questions: number
  overall_accuracy: number
  part_accuracy: Record<string, number>
  weak_categories: string[]
}

export interface SessionHistory {
  id: number
  mode: string
  part: string
  score: number
  total_questions: number
  correct_count: number
  time_spent_seconds: number
  created_at: string
}
