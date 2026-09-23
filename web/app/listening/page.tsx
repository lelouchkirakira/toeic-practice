"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Part1Runner } from "@/components/listening/part1-runner";
import { Part2Runner } from "@/components/listening/part2-runner";
import { Part3Runner } from "@/components/listening/part3-runner";

// Part 1 的照片與題目已經上架，但描述的語音要等 10 月語音額度重置後才合成。
// 語音備妥之前不露出這個分頁，免得點進去每題都是載入失敗。
// 上線步驟：跑 scripts/build_part1_audio.py，再把這裡改成 true。
const PART1_READY = process.env.NEXT_PUBLIC_PART1_READY === "1";

const ALL_PARTS = [
  { id: "1", label: "Part 1 看圖" },
  { id: "2", label: "Part 2 應答問題" },
  { id: "3", label: "Part 3 對話" },
  { id: "4", label: "Part 4 短講" },
] as const;

const PARTS = ALL_PARTS.filter((p) => p.id !== "1" || PART1_READY);

export default function ListeningPage() {
  const [part, setPart] = useState<"1" | "2" | "3" | "4">("2");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">聽力</h1>
        <div className="flex overflow-hidden rounded-md border" role="group" aria-label="題型">
          {PARTS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={part === option.id}
              data-testid={`listening-part-${option.id}`}
              className={`px-3 py-1.5 text-sm transition-colors ${
                part === option.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setPart(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* key 讓切換題型時整個重來，不會殘留上一種的作答狀態 */}
      {part === "1" ? (
        <Part1Runner key="part1" />
      ) : part === "2" ? (
        <Part2Runner key="part2" />
      ) : (
        <Part3Runner key={`part${part}`} part={part as "3" | "4"} />
      )}
    </div>
  );
}
