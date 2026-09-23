"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { learnerId } from "@/lib/learner";

const LINKS = [
  { href: "/", label: "練習" },
  { href: "/mock-test", label: "模擬考" },
  { href: "/vocabulary", label: "背單字" },
  { href: "/bookmarks", label: "書籤" },
  { href: "/listening", label: "聽力" },
  { href: "/stats", label: "統計" },
] as const;

// 公司名與課程名由環境變數帶，沒設就顯示佔位字。賣給不同公司只要改變數。
const ORG = process.env.NEXT_PUBLIC_ORG_NAME || "公司名稱";
const PROGRAM = process.env.NEXT_PUBLIC_ORG_PROGRAM || "指派課程";

export function SiteNav() {
  const pathname = usePathname();
  const [code, setCode] = useState("");

  // 代號存在瀏覽器，伺服器端算不出來，掛載後才補上，免得兩邊對不起來。
  useEffect(() => {
    const id = learnerId();
    queueMicrotask(() => setCode(id.slice(0, 4)));
  }, []);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
        <span
          aria-hidden
          className="grid size-5 place-items-center border border-foreground text-[10px] text-foreground"
        >
          {ORG.slice(0, 1)}
        </span>
        <span>{ORG}</span>
        <span aria-hidden className="text-border">
          /
        </span>
        <span>{PROGRAM}</span>
        <span className="ml-auto tabular-nums" data-testid="learner-code">
          學員{code ? ` ${code}` : ""}
        </span>
      </div>
      <nav
        aria-label="主要導覽"
        className="mx-auto flex w-full max-w-5xl items-center gap-1 px-4 pb-1"
      >
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                // 六個項目在 375px 寬時每格只剩 54px，橫向內距要收窄，
                // 不然三個字的項目會在格子裡折成兩行、整條導覽列變兩倍高。
                "flex-1 border-b-2 px-1 py-2 text-center text-sm font-medium whitespace-nowrap transition-colors sm:px-2",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
