"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "練習" },
  { href: "/mock-test", label: "模擬考" },
  { href: "/vocabulary", label: "背單字" },
  { href: "/bookmarks", label: "書籤" },
  { href: "/listening", label: "聽力" },
  { href: "/stats", label: "統計" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <nav
        aria-label="主要導覽"
        className="mx-auto flex w-full max-w-3xl items-center gap-1 px-4 py-2"
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
                "flex-1 rounded-lg px-1 py-2 text-center text-sm font-medium whitespace-nowrap transition-colors sm:px-2",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
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
