export type PartKey = "5" | "6" | "7" | "mixed" | "vocab";

export interface Question {
  id: string;
  sentence: string;
  options: string[];
  answer: string;
  explanation: string;
  /** Part 5 專有 */
  grammar_category?: string;
  /** 單字測驗專有 */
  word?: string;
  band?: number;
}

export interface PassageQuestion {
  /** Part 6 有，答案是選項文字本身 */
  blank_number?: number;
  /** Part 7 有，答案是 1 起算的選項序號 */
  question?: string;
  options: string[];
  answer: string | number;
  explanation?: string;
}

export interface Passage {
  id: string;
  passage_type: string;
  passage: string;
  questions: PassageQuestion[];
}

export type QuizItem = Question | Passage;

export function isPassage(item: QuizItem): item is Passage {
  return Array.isArray((item as Passage).questions);
}

export interface MockTestPayload {
  part5: Question[];
  part6: Passage[];
  part7: Passage[];
  total_questions: number;
}

export interface AnswerItem {
  question_id: string;
  part: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  grammar_category?: string;
}

export interface SubmitPayload {
  mode: "practice" | "mock";
  part: string;
  answers: AnswerItem[];
  time_spent_seconds: number;
}

export interface SessionResult {
  session_id: number;
  mode: string;
  part: string;
  total_questions: number;
  correct_count: number;
  score: number;
  time_spent_seconds: number;
  estimated_toeic_score?: string;
}

export interface WordListEntry {
  rank: number;
  band?: number;
}

export interface Word {
  id: string;
  word: string;
  pos: string;
  phonetic: string;
  definition_en: string;
  definition_zh: string;
  lists: Record<string, WordListEntry>;
  band: number;
  inflections: string[];
  examples: WordExample[];
}

/** 例句。英文句子裡的目標單字用 **星號** 標出來，供前端 highlight。 */
export interface WordExample {
  en: string;
  zh: string;
}

/** 作答後寫入的熟練度 */
export type WordLevel = "unknown" | "fuzzy" | "known";

/** 抽卡時的熟練度篩選 */
export type WordLevelFilter = "new" | "learning" | "known";

export interface VocabularyFilter {
  list: string;
  bandMin: number;
  bandMax: number;
  level: string;
  count: number;
}

export interface StatsOverview {
  total_sessions: number;
  total_questions: number;
  overall_accuracy: number;
  part_accuracy: Record<string, number>;
  weak_categories: string[];
}

export interface SessionHistory {
  id: number;
  mode: string;
  part: string;
  score: number;
  total_questions: number;
  correct_count: number;
  time_spent_seconds: number;
  created_at: string;
}

/** 作答中的聽力題。刻意不含題目文字與答案，那些要作答完才拿得到。 */
export interface ListeningQuestion {
  id: string;
  part: string;
  audio: string;
  option_labels: string[];
}

/** 作答結束後的檢討內容。 */
export interface ListeningReview {
  id: string;
  part: string;
  audio: string;
  prompt: string;
  options: { label: string; text: string }[];
  answer: string;
  question_type: string;
  explanation: string;
}

/** 作答中的 Part 3 對話。題目與四個選項要顯示，所以照實給；正解與逐字稿不給。 */
export interface DialogueQuestion {
  id: string;
  part: string;
  audio: string;
  questions: {
    number: number;
    text: string;
    options: { label: string; text: string }[];
  }[];
}

/** 作答結束後的檢討，含逐字稿與解析。 */
export interface DialogueReview {
  id: string;
  part: string;
  audio: string;
  topic: string;
  turns: { speaker: string; voice: string; text: string }[];
  questions: {
    number: number;
    text: string;
    options: { label: string; text: string }[];
    answer: string;
    explanation: string;
  }[];
}
