"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PartKey } from "@/lib/types";

const PART_OPTIONS: { value: PartKey; label: string }[] = [
  { value: "5", label: "Part 5 單句填空" },
  { value: "6", label: "Part 6 段落填空" },
  { value: "7", label: "Part 7 閱讀測驗" },
  { value: "mixed", label: "綜合題" },
  { value: "vocab", label: "單字測驗" },
];

const COUNT_OPTIONS = [5, 10, 15];

export function PartSelector({
  onStart,
}: {
  onStart: (part: PartKey, count: number) => void;
}) {
  const [part, setPart] = useState<PartKey>("5");
  const [count, setCount] = useState(10);

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">選擇練習內容</h1>
          <p className="text-sm text-muted-foreground">
            逐題作答，送出後立刻看到對錯與詳解。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="part-select">題型</Label>
            <Select
              value={part}
              onValueChange={(value) => setPart(value as PartKey)}
            >
              <SelectTrigger id="part-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PART_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="count-select">題數</Label>
            <Select
              value={String(count)}
              onValueChange={(value) => setCount(Number(value))}
            >
              <SelectTrigger id="count-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNT_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value} 題
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          size="lg"
          className="h-11 w-full"
          data-testid="start-practice"
          onClick={() => onStart(part, count)}
        >
          <Play data-icon="inline-start" />
          開始練習
        </Button>
      </CardContent>
    </Card>
  );
}
