import type {
  BookmarkList,
  LookupEntries,
  DialogueQuestion,
  DialogueReview,
  ListeningQuestion,
  ListeningReview,
  MockTestPayload,
  QuizItem,
  Question,
  SessionHistory,
  SessionResult,
  StatsOverview,
  SubmitPayload,
  Word,
  WordLevel,
} from "./types";

import { learnerId } from "./learner";

// 開發接 Python 的 /api，上線接 Go 的 /toeic，去掉 base 之後的路徑兩邊一致。
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/backend/toeic";

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class ApiError extends Error {
  readonly code: string;

  constructor(message: string, code = "REQUEST_FAILED") {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // 這個站沒有登入，後端靠這個標頭把各人的進度分開。
  const headers = new Headers(init?.headers);
  const learner = learnerId();
  if (learner) headers.set("X-Learner-Id", learner);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("連不上後端服務，請確認服務有啟動", "NETWORK_ERROR");
  }

  // 後端可能在錯誤路徑回非 JSON，先取文字再解析，避免把解析錯誤蓋掉真正的狀態碼
  const raw = await res.text();
  let body: Envelope<T>;
  try {
    body = JSON.parse(raw) as Envelope<T>;
  } catch {
    throw new ApiError(`後端回應不是 JSON（HTTP ${res.status}）`, "BAD_RESPONSE");
  }

  if (!body.success) {
    throw new ApiError(
      body.error?.message ?? `後端回報失敗（HTTP ${res.status}）`,
      body.error?.code ?? `HTTP_${res.status}`,
    );
  }
  if (!res.ok) {
    throw new ApiError(`後端回傳 HTTP ${res.status}`, `HTTP_${res.status}`);
  }
  if (body.data === undefined || body.data === null) {
    throw new ApiError("後端回應缺少 data 欄位", "EMPTY_DATA");
  }
  return body.data;
}

function post<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchQuestions(part: string, count: number): Promise<QuizItem[]> {
  return request<QuizItem[]>(
    `/quiz/questions?part=${encodeURIComponent(part)}&count=${count}`,
  );
}

export function fetchVocabularyQuiz(count: number): Promise<Question[]> {
  return request<Question[]>(`/vocabulary/quiz?count=${count}`);
}

export function fetchMockTest(): Promise<MockTestPayload> {
  return request<MockTestPayload>("/quiz/mock-test");
}

export function submitAnswers(payload: SubmitPayload): Promise<SessionResult> {
  return post<SessionResult>("/quiz/submit", payload);
}

export interface WordQuery {
  list: string;
  bandMin: number;
  bandMax: number;
  level: string;
  count: number;
  /** 只抽標記過書籤的字 */
  bookmarked?: boolean;
}

export function fetchWords(query: WordQuery): Promise<Word[]> {
  const params = new URLSearchParams();
  if (query.list) params.set("list", query.list);
  if (query.level) params.set("level", query.level);
  params.set("band_min", String(query.bandMin));
  params.set("band_max", String(query.bandMax));
  params.set("count", String(query.count));
  if (query.bookmarked) params.set("bookmarked", "1");
  return request<Word[]>(`/vocabulary/words?${params.toString()}`);
}

export interface WordProgressResult {
  word_id: string;
  level: WordLevel;
  review_count: number;
  updated_at: string;
}

export function saveWordProgress(
  wordId: string,
  level: WordLevel,
): Promise<WordProgressResult> {
  return post<WordProgressResult>("/vocabulary/progress", {
    word_id: wordId,
    level,
  });
}

// 例句裡的字查釋義。查的是公共字庫，不帶個人資料。
export async function lookupTokens(tokens: string[]): Promise<LookupEntries> {
  if (tokens.length === 0) return {};
  const data = await post<{ entries: LookupEntries }>("/vocabulary/lookup", {
    tokens,
  });
  return data.entries ?? {};
}

// 書籤頁要的是穩定排序的完整清單，不能用隨機抽樣的 /vocabulary/words。
export function fetchBookmarks(limit = 200): Promise<BookmarkList> {
  return request<BookmarkList>(`/vocabulary/bookmarks?limit=${limit}`);
}

export interface BookmarkResult {
  word_id: string;
  bookmarked: boolean;
}

// 書籤跟熟練度分開存，標記不會動到熟練度也不會換卡。
export function saveBookmark(
  wordId: string,
  bookmarked: boolean,
): Promise<BookmarkResult> {
  return post<BookmarkResult>("/vocabulary/bookmark", {
    word_id: wordId,
    bookmarked,
  });
}

export function fetchStatsOverview(): Promise<StatsOverview> {
  return request<StatsOverview>("/stats");
}

export function fetchStatsHistory(limit = 20): Promise<SessionHistory[]> {
  return request<SessionHistory[]>(`/stats/history?limit=${limit}`);
}

export function fetchListeningQuestions(
  count: number,
): Promise<{ questions: ListeningQuestion[]; total: number }> {
  return request(`/listening/questions?part=2&count=${count}`);
}

export function fetchListeningReview(
  ids: string[],
): Promise<{ questions: ListeningReview[]; total: number }> {
  return post("/listening/review", { ids });
}

export function fetchDialogueQuestions(
  count: number,
  part: "3" | "4" = "3",
): Promise<{ questions: DialogueQuestion[]; total: number }> {
  return request(`/listening/questions?part=${part}&count=${count}`);
}

export function fetchDialogueReview(
  ids: string[],
): Promise<{ questions: DialogueReview[]; total: number }> {
  return post("/listening/review", { ids });
}

export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return fallback;
}
