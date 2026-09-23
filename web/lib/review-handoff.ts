/* 書籤頁跳去背單字時的一次性旗標。
 *
 * 不用查詢字串是因為 /vocabulary 目前是靜態預先產生的頁面，改讀 useSearchParams
 * 要加 Suspense 並讓整頁轉成動態算繪。旗標由背單字頁在首次載入時讀取並立刻清掉，
 * 所以之後自己點導覽列進去不會黏住上一次的條件。
 */
export const REVIEW_FLAG = "toeic:review-bookmarks";

export function takeReviewFlag(): boolean {
  try {
    const value = window.sessionStorage.getItem(REVIEW_FLAG);
    if (value) window.sessionStorage.removeItem(REVIEW_FLAG);
    return value === "1";
  } catch {
    return false;
  }
}

const STUDY_KEY = "toeic:study-word";

/** 從別的頁面指定背單字頁的第一張。存整筆，讀完就清掉。 */
export function setStudyWord(word: unknown): void {
  try {
    window.sessionStorage.setItem(STUDY_KEY, JSON.stringify(word));
  } catch {
    // 存不了就只是沒有指定，背單字頁照常抽卡
  }
}

export function takeStudyWord<T>(): T | null {
  try {
    const raw = window.sessionStorage.getItem(STUDY_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STUDY_KEY);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
