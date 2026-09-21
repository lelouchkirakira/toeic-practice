const STORAGE_KEY = "toeic:learner";

/* 匿名學習者代號。
 *
 * 學習進度存在後端，但這個站沒有登入，所以需要一個東西把各人的資料分開。
 * 首次開啟時在瀏覽器產生一組 UUID 存起來，之後每次呼叫 API 都帶上，後端
 * 據此分流。不用註冊、不用登入，點開網址就能用。
 *
 * 代價是清掉瀏覽器資料或換裝置就從頭開始，兩邊也不會同步。之後要接登入
 * 時，把這組 id 底下的資料綁到帳號即可，不必重做。
 */

let cached: string | null = null;

function isValid(value: string | null): value is string {
  return Boolean(value) && /^[0-9a-fA-F-]{8,64}$/.test(value as string);
}

function generate(): string {
  // randomUUID 在非安全連線的舊瀏覽器可能不存在或丟例外，退回自己組。
  try {
    return crypto.randomUUID();
  } catch {
    // 落到下面的備案
  }

  const bytes = new Uint8Array(16);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function learnerId(): string {
  if (cached) return cached;
  if (typeof window === "undefined") return "";

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isValid(saved)) {
      cached = saved;
      return cached;
    }
  } catch {
    // 私密模式讀不到就當作沒有
  }

  const created = generate();
  cached = created;
  try {
    window.localStorage.setItem(STORAGE_KEY, created);
  } catch {
    // 存不了的話這次瀏覽仍可用，只是重新整理後會換一組
  }
  return created;
}
