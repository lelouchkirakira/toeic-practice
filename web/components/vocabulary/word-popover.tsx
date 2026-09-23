"use client";

import { useEffect, useRef } from "react";
import { GraduationCap, Volume2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Word } from "@/lib/types";

export interface PopoverAnchor {
  left: number;
  bottom: number;
  width: number;
}

/* 例句點字之後出現的小卡。
 *
 * 桌機貼在那個字下面，手機從底部升起整條面板：手機上浮在字旁邊的小氣泡會蓋住
 * 正在讀的那一行，底部面板不會。內容兩邊共用。
 */
export function WordPopover({
  word,
  anchor,
  hoverCapable,
  canSpeak,
  onSpeak,
  onJump,
  onClose,
  onPointerEnter,
  onPointerLeave,
}: {
  word: Word;
  anchor: PopoverAnchor | null;
  hoverCapable: boolean;
  canSpeak: boolean;
  onSpeak: () => void;
  onJump?: () => void;
  onClose: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef({ onPointerEnter, onPointerLeave });
  useEffect(() => {
    pointer.current = { onPointerEnter, onPointerLeave };
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 滑進小卡時要取消關閉計時器。跟例句那邊同一個理由用原生事件，不用 React 的
  // onMouseEnter：實測合成的移入事件不一定送得到，小卡會在滑過去的半路自己關掉。
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const enter = () => pointer.current.onPointerEnter?.();
    const leave = () => pointer.current.onPointerLeave?.();
    node.addEventListener("mouseenter", enter);
    node.addEventListener("mouseover", enter);
    node.addEventListener("mouseleave", leave);
    return () => {
      node.removeEventListener("mouseenter", enter);
      node.removeEventListener("mouseover", enter);
      node.removeEventListener("mouseleave", leave);
    };
  }, []);

  const definition =
    word.definition_zh || word.definition_en || "這個字還沒有釋義資料";
  const inflections = word.inflections ?? [];

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-base font-semibold break-words">{word.word}</span>
          {word.phonetic ? (
            <span className="text-sm text-muted-foreground break-words">
              [{word.phonetic}]
            </span>
          ) : null}
          {word.pos ? (
            <span className="text-sm text-muted-foreground">{word.pos}</span>
          ) : null}
          <Badge variant="secondary">難度 {word.band}</Badge>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canSpeak ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`播放 ${word.word} 的發音`}
              data-testid="popover-speak"
              onClick={onSpeak}
            >
              <Volume2 className="size-4" aria-hidden />
            </Button>
          ) : null}
          {hoverCapable ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="關閉"
              data-testid="popover-close"
              onClick={onClose}
            >
              <X className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm leading-relaxed break-words">{definition}</p>
      {inflections.length > 0 ? (
        <p className="text-xs text-muted-foreground break-words">
          詞形變化：{inflections.join("、")}
        </p>
      ) : null}
      {onJump ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          data-testid="popover-jump"
          onClick={onJump}
        >
          <GraduationCap data-icon="inline-start" />
          去背這個字
        </Button>
      ) : null}
    </>
  );

  if (!hoverCapable) {
    return (
      <div
        ref={ref}
        role="dialog"
        aria-label={`${word.word} 的解釋`}
        data-testid="word-popover"
        className="fixed inset-x-0 bottom-0 z-30 space-y-2 border-t border-border bg-background p-4 shadow-lg"
      >
        {body}
      </div>
    );
  }

  // 貼在字的下方，右緣超出畫面就往左收。
  const width = 288;
  const left = anchor
    ? Math.min(Math.max(8, anchor.left), Math.max(8, window.innerWidth - width - 8))
    : 8;
  const top = anchor ? anchor.bottom + 6 : 0;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${word.word} 的解釋`}
      data-testid="word-popover"
      style={{ left, top, width }}
      className="fixed z-30 space-y-2 rounded-xl border border-border bg-background p-3 shadow-lg"
    >
      {body}
    </div>
  );
}
