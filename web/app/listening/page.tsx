"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Part2Runner } from "@/components/listening/part2-runner";
import { Part3Runner } from "@/components/listening/part3-runner";

const PARTS = [
  { id: "2", label: "Part 2 應答問題" },
  { id: "3", label: "Part 3 對話" },
  { id: "4", label: "Part 4 短講" },
] as const;

export default function ListeningPage() {
  const [part, setPart] = useState<"2" | "3" | "4">("2");

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
      {part === "2" ? (
        <Part2Runner key="part2" />
      ) : (
        <Part3Runner key={`part${part}`} part={part} />
      )}
    </div>
  );
}
