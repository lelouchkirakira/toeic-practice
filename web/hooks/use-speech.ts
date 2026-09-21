"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* 單字發音。
 *
 * 優先播預先產生好的音檔（Google Cloud TTS，存在 Vercel Blob），所有人聽到
 * 的是同一個聲音。音檔缺漏或載不到時才退回瀏覽器內建的 Web Speech API，
 * 那個唸出來的聲音來自使用者自己的裝置，macOS 是 Samantha，Windows 與
 * Android 各有各的，品質與音色都不一致，所以只當備援。
 */

// 依序找第一個存在的，都找不到就用任何英文語音。
const PREFERRED_VOICES = [
  "Samantha", // macOS / iOS 的預設美式語音
  "Google US English", // Chrome / Android
  "Microsoft Aria", // Windows 11
  "Microsoft Zira", // Windows 10
  "Alex", // 較舊的 macOS
  "Daniel", // 英式
];

const AUDIO_BASE = process.env.NEXT_PUBLIC_WORD_AUDIO_BASE ?? "";

/* 多益聽力有美、英、加、澳四種口音。Google TTS 沒有獨立的加拿大英語，
   而加拿大腔與美式同屬北美音，所以這裡提供三種。 */
const ALL_ACCENTS = [
  { id: "us", label: "美", title: "美式發音" },
  { id: "gb", label: "英", title: "英式發音" },
  { id: "au", label: "澳", title: "澳洲發音" },
] as const;

export type AccentId = (typeof ALL_ACCENTS)[number]["id"];

/* 哪幾種口音的音檔已經備妥。音檔是分批產生的，還沒產完的口音先不要露出來，
   免得使用者點了只得到 404 與一個音色不同的備援語音。 */
const ENABLED = (process.env.NEXT_PUBLIC_ENABLED_ACCENTS ?? "us")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const ACCENTS = ALL_ACCENTS.filter((accent) => ENABLED.includes(accent.id));

export const DEFAULT_ACCENT: AccentId = "us";

export function audioUrlFor(wordId: string, accent: AccentId): string | null {
  if (!AUDIO_BASE || !wordId) return null;
  return `${AUDIO_BASE}/${accent}/${wordId}.mp3`;
}

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
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthAvailable = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    synthAvailable.current = true;

    // getVoices 在 Chrome 第一次呼叫可能是空的，要等 voiceschanged。
    const load = () => {
      voiceRef.current = pickVoice(window.speechSynthesis.getVoices());
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speakWithSynth = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.lang = "en-US";
    if (voiceRef.current) utterance.voice = voiceRef.current;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    // iOS Safari 只接受在使用者手勢的同步堆疊裡呼叫 speak，包進 setTimeout
    // 會被拒絕而完全沒聲音。沒有東西在播時直接送出。
    if (!synth.speaking && !synth.pending) {
      synth.speak(utterance);
      return;
    }
    synth.cancel();
    window.setTimeout(() => synth.speak(utterance), 50);
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  /** text 是要唸的字，audioUrl 是預先產生好的音檔，沒有就退回瀏覽器語音。 */
  const speak = useCallback(
    (text: string, audioUrl?: string | null) => {
      if (typeof window === "undefined" || !text.trim()) return;

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();

      if (!audioUrl) {
        speakWithSynth(text);
        return;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onplaying = () => setSpeaking(true);
      audio.onended = () => setSpeaking(false);
      // 音檔還沒產生好或網路不通時不要無聲失敗，改用瀏覽器語音。
      audio.onerror = () => {
        setSpeaking(false);
        audioRef.current = null;
        speakWithSynth(text);
      };

      const started = audio.play();
      if (started) {
        started.catch(() => {
          setSpeaking(false);
          audioRef.current = null;
          speakWithSynth(text);
        });
      }
    },
    [speakWithSynth],
  );

  // 有音檔就一定播得出來，沒有音檔才取決於裝置有沒有語音引擎。
  const supported = Boolean(AUDIO_BASE) || synthAvailable.current;

  return { supported, speaking, speak, stop };
}
