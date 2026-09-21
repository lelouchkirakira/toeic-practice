"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* 單字發音。用瀏覽器內建的 Web Speech API，不需要音檔也不需要 API 費用。
 *
 * 要知道的限制：唸出來的聲音來自「使用者自己的裝置」，不是我們決定的。
 * macOS 與 iOS 會挑到 Samantha，Chrome 與 Android 是 Google US English，
 * Windows 是微軟那幾個。所以每個人聽到的音色不一樣，也無法保證品質一致。
 * 要跨裝置一致就得改用雲端 TTS 或預先產生音檔。
 */

// 依序找第一個存在的。前面是各平台的預設英文語音，品質與自然度較好；
// 找不到就退回任何 en-US，再退回任何英文。
const PREFERRED_VOICES = [
  "Samantha", // macOS / iOS 的預設美式語音
  "Google US English", // Chrome / Android
  "Microsoft Aria", // Windows 11
  "Microsoft Zira", // Windows 10
  "Alex", // 較舊的 macOS
  "Daniel", // 英式
];

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.startsWith("en"));
  if (english.length === 0) return null;

  for (const name of PREFERRED_VOICES) {
    const hit = english.find((v) => v.name.includes(name));
    if (hit) return hit;
  }
  return english.find((v) => v.lang === "en-US") ?? english[0];
}

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);

    // getVoices 在 Chrome 第一次呼叫可能是空的，要等 voiceschanged。
    const load = () => {
      voiceRef.current = pickVoice(window.speechSynthesis.getVoices());
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);

    // iOS Safari 只允許在使用者手勢裡開始播放，先用一段無聲的解鎖。
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      const silent = new SpeechSynthesisUtterance("");
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    };
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("click", unlock, { once: true });

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        !text.trim()
      ) {
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      // 比正常語速稍慢，單字才聽得清楚。
      utterance.rate = 0.85;
      utterance.lang = "en-US";
      if (voiceRef.current) utterance.voice = voiceRef.current;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      // iOS 上 cancel 之後立刻 speak 有機會被吃掉，隔一個 tick 再送。
      window.setTimeout(() => window.speechSynthesis.speak(utterance), 50);
    },
    [],
  );

  return { supported, speaking, speak, stop };
}
