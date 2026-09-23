/* Part 2 的播放串：問句、停頓、（字母）、回答，重複三次。
 *
 * 音檔在 2026-09-23 切開成問句與三個回答（scripts/split_part2_audio.py），
 * 放在網站自己的 public/audio 底下跟著部署。切開之後才能做兩件事：
 * 回答前唸出 A B C，以及每次出題打亂三個回答的順序。
 */

export const SEGMENT_BASE = "/audio/part2";
export const LETTER_BASE = "/audio/letters";
const GAP_MS = 600;
const LETTER_FILES = ["a", "b", "c"];

/** 三個回答的播放順序，例如 [2, 3, 1] 表示第一個播的是原本的第 2 個回答。 */
export function shuffledOrder(): number[] {
  const order = [1, 2, 3];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** 畫面上第幾個位置（0 起算）對應到原本題目的哪個選項字母。 */
export function originalLabel(order: number[], slot: number): string {
  return "ABC"[order[slot] - 1] ?? "";
}

export interface SequenceHandle {
  stop: () => void;
}

/**
 * 依序播完一題。全程用同一個 Audio 元件換來源，手機瀏覽器在第一次點擊之後
 * 就放行這個元件，後面接續播放不會再被擋。
 */
export function playPart2(
  id: string,
  order: number[],
  withLetters: boolean,
  handlers: {
    onEnd: () => void;
    onError: (reason: "load" | "blocked") => void;
  },
): SequenceHandle {
  const steps: (string | null)[] = [`${SEGMENT_BASE}/${id}/q.mp3`];
  order.forEach((response, slot) => {
    steps.push(null);
    if (withLetters) steps.push(`${LETTER_BASE}/${LETTER_FILES[slot]}.mp3`);
    steps.push(`${SEGMENT_BASE}/${id}/${response}.mp3`);
  });

  const audio = new Audio();
  let step = 0;
  let stopped = false;
  let timer: number | undefined;

  const fail = (reason: "load" | "blocked") => {
    if (stopped) return;
    stopped = true;
    handlers.onError(reason);
  };

  const advance = () => {
    if (stopped) return;
    if (step >= steps.length) {
      handlers.onEnd();
      return;
    }
    const url = steps[step];
    step += 1;
    if (url === null) {
      timer = window.setTimeout(advance, GAP_MS);
      return;
    }
    audio.src = url;
    const started = audio.play();
    if (started) {
      started.catch((e: unknown) => {
        const name = e instanceof DOMException ? e.name : "";
        // AbortError 是自己換來源或停止時打斷的，不是故障。
        if (name === "AbortError") return;
        fail(name === "NotAllowedError" ? "blocked" : "load");
      });
    }
  };

  audio.onended = advance;
  audio.onerror = () => fail("load");
  advance();

  return {
    stop: () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      audio.pause();
    },
  };
}
