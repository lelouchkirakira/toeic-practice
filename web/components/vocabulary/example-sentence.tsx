"use client";

import { useEffect, useRef, useState } from "react";
import type { LookupEntries, Word } from "@/lib/types";
import type { PopoverAnchor } from "./word-popover";

/** 句子拆成一段段：粗體的目標字、可點的字、其餘照原樣輸出的字元。 */
type Piece =
  | { kind: "target"; text: string }
  | { kind: "token"; text: string }
  | { kind: "plain"; text: string };

const BOLD = /(\*\*[^*]+\*\*)/g;
const TOKEN = /([A-Za-z][A-Za-z'’-]*)/g;

export function splitSentence(sentence: string): Piece[] {
  const pieces: Piece[] = [];
  for (const segment of sentence.split(BOLD)) {
    if (!segment) continue;
    if (segment.startsWith("**") && segment.endsWith("**")) {
      pieces.push({ kind: "target", text: segment.slice(2, -2) });
      continue;
    }
    for (const part of segment.split(TOKEN)) {
      if (!part) continue;
      pieces.push({ kind: TOKEN.test(part) && /^[A-Za-z]/.test(part) ? "token" : "plain", text: part });
      TOKEN.lastIndex = 0;
    }
  }
  return pieces;
}

/** 送去查詢的形式。例句用的是彎引號，字庫與後端用直引號。 */
export function lookupKey(token: string): string {
  return token.replace(/’/g, "'");
}

export function collectTokens(sentences: string[]): string[] {
  const seen = new Set<string>();
  for (const sentence of sentences) {
    for (const piece of splitSentence(sentence)) {
      if (piece.kind === "token") seen.add(lookupKey(piece.text));
    }
  }
  return [...seen];
}

/* 一句例句。查得到的字是按鈕，查不到的維持純文字，粗體的目標字不可點。
 *
 * 鍵盤只給這一句一個 Tab 停留點，進來之後用左右鍵在字之間移動。一句話十幾個字
 * 各自佔一個停留點的話，鍵盤使用者要按很多次才能走到下面的熟練度按鈕。
 */
export function ExampleSentence({
  sentence,
  entries,
  onPick,
  onLeave,
}: {
  sentence: string;
  entries: LookupEntries;
  onPick: (word: Word, anchor: PopoverAnchor | null, hover: boolean) => void;
  onLeave: () => void;
}) {
  const pieces = splitSentence(sentence);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const [active, setActive] = useState(0);

  // 滑過開卡走原生事件委派，不用 React 的 onMouseEnter：同一句十幾個相鄰按鈕時
  // 那個合成事件不一定送得到（2026-09-23 在這個專案實測，點擊會進、移入不會）。
  const handlers = useRef({ entries, onPick, onLeave });
  useEffect(() => {
    handlers.current = { entries, onPick, onLeave };
  });

  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    const scope = line;

    function over(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>("button[data-token]");
      if (!button || !scope.contains(button)) return;
      const entry = handlers.current.entries[button.dataset.token ?? ""];
      if (!entry) return;
      const rect = button.getBoundingClientRect();
      handlers.current.onPick(entry, { left: rect.left, bottom: rect.bottom, width: rect.width }, true);
    }
    function leave() {
      handlers.current.onLeave();
    }

    line.addEventListener("mouseover", over);
    line.addEventListener("mouseleave", leave);
    return () => {
      line.removeEventListener("mouseover", over);
      line.removeEventListener("mouseleave", leave);
    };
  }, []);

  const clickable: number[] = [];
  pieces.forEach((piece, index) => {
    if (piece.kind === "token" && entries[lookupKey(piece.text)]) clickable.push(index);
  });

  function move(from: number, step: number) {
    const at = clickable.indexOf(from);
    if (at === -1) return;
    const next = clickable[(at + step + clickable.length) % clickable.length];
    setActive(next);
    refs.current[next]?.focus();
  }

  function anchorOf(index: number): PopoverAnchor | null {
    const node = refs.current[index];
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { left: rect.left, bottom: rect.bottom, width: rect.width };
  }

  return (
    <p ref={lineRef} className="text-sm leading-7">
      {pieces.map((piece, index) => {
        if (piece.kind === "target") {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {piece.text}
            </strong>
          );
        }
        const entry = piece.kind === "token" ? entries[lookupKey(piece.text)] : undefined;
        if (!entry) return <span key={index}>{piece.text}</span>;

        const isFirst = clickable[0] === index;
        return (
          <button
            key={index}
            type="button"
            ref={(node) => {
              refs.current[index] = node;
            }}
            tabIndex={active === index || (active === 0 && isFirst) ? 0 : -1}
            data-testid={`example-token-${piece.text.toLowerCase()}`}
            data-token={lookupKey(piece.text)}
            className="rounded px-0.5 underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            onFocus={() => setActive(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                move(index, -1);
              }
            }}
            onClick={() => onPick(entry, anchorOf(index), false)}
          >
            {piece.text}
          </button>
        );
      })}
    </p>
  );
}
