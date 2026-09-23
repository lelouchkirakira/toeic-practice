---
title: 換成紙本教科書視覺樣式
type: feature
status: proposed
created: 2026-09-23
---

# 換成紙本教科書視覺樣式

## 變更內容

目前的配色是 shadcn 的預設灰階，看起來像還沒挑過樣式。比稿五種樣式之後選定紙本教科書：米色紙底、襯線字、細線分隔、磚紅色當唯一重點色。樣式稿在 session scratchpad 的 style/ 目錄，四個畫面都套過。

做法是改 token 不是改元件。`app/globals.css` 的 `:root` 與 `.dark` 是 shadcn 的單一來源，改值就會傳到所有元件；元件裡寫死的顏色另外收成語意 token。

## 影響範圍

### app/globals.css

- `:root` 換成紙本色票：底 `#f7f2e7`、卡片 `#fffdf7`、字 `#2f2a22`、次要字 `#6e6557`、線 `#ddd3c0`、重點 `#9c3b2e`
- `.dark` 換成同一組色的暖色深色版，不是灰黑：底 `#201d17`、卡片 `#2a261e`、字 `#ece4d5`、重點 `#d3806b`
- `--radius` 由 `0.625rem` 改為 `0`，紙本樣式不用圓角
- 字型改襯線：`Georgia, "Songti TC", "Noto Serif TC", serif`
- 新增三個語意 token 給對錯與分數用：`--tone-good` `--tone-fair` `--tone-poor`，深淺兩套各一組

### 元件裡寫死的顏色改讀 token

`lib/format.ts` 的分數三個 class 對照表、`components/vocabulary/word-card.tsx` 的熟練度三顆、`components/quiz/option-button.tsx`、`components/quiz/feedback-panel.tsx`、`components/mock-test/countdown-badge.tsx`、`components/listening/part3-runner.tsx`，原本寫 `emerald-500` `amber-500` `rose-500` 這類固定色，改成讀上面的語意 token，深色模式跟著換不用各寫一次。

### app/layout.tsx

移除 Geist 與 Geist Mono 兩個 next/font 載入。字型改襯線之後這兩個不會出現在畫面上，留著等於白下載。

### 不動的部分

版面、元件結構、互動邏輯、路由全部不動。這次只換顏色、字型與圓角。

## 測試計畫

1. 五個頁面（練習、模擬考、背單字、書籤、聽力、統計）在淺色模式下底色、卡片、線條、重點色與樣式稿一致
2. 深色模式下每頁文字與底色對比足夠，沒有任何一處是灰黑色殘留
3. 作答正確與錯誤的顏色仍然分得出來，不是同一個色
4. 統計頁的分數徽章與長條圖三個等級分得出來
5. 模擬考倒數計時的三段警示色仍然分得出來
6. 手機 390 寬與桌機 1280 寬都沒有橫向捲動
7. 沒有任何頁面還在下載 Geist 字型
8. `npm run build` 與型別檢查通過，eslint 問題數不增加

## Checklist

- [ ] globals.css token 與字型
- [ ] 元件寫死顏色改 token
- [ ] 移除未使用字型
- [ ] 本地六頁視覺驗證（深淺兩色）
- [ ] 線上驗證
