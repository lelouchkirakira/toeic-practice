---
title: 匿名學習者識別
type: feature
status: proposed
created: 2026-09-21
---

# 匿名學習者識別

## 變更內容

學習資料目前沒有使用者概念。`toeic_word_progress` 只有 word_id 與熟練度，`toeic_sessions` 只有分數與時間，兩張表都沒有任何欄位區分是誰產生的。網站已經有第二個人開始使用，實際後果是：別人按「會了」，你的卡片就不再抽到那個字；別人考一次，你的統計正確率跟著變動；歷史紀錄兩個人混在一起分不出來。

這次加匿名學習者識別。瀏覽器首次開啟時自動產生一組 ID 存在 localStorage，之後每次呼叫 API 都帶上，後端依此分開存放。不需要註冊或登入，點開網址就能用。

代價是清除瀏覽器資料或換裝置會從頭開始，手機與電腦的進度不會同步。這是刻意的取捨：現階段使用者是被分享連結後直接試用，加登入牆會勸退。資料結構預留了之後接 Logto 的空間，屆時登入只是把匿名 ID 的資料綁到帳號，不必重做。

## 影響範圍

### 資料（Neon）

```sql
ALTER TABLE toeic_word_progress ADD COLUMN learner_id text NOT NULL;
-- 主鍵從 word_id 改為 (learner_id, word_id)，同一個字不同人各自一筆
ALTER TABLE toeic_sessions ADD COLUMN learner_id text NOT NULL;
CREATE INDEX ON toeic_sessions (learner_id, created_at DESC);
```

現有 39 筆 `toeic_word_progress` 是測試與實際使用混在一起的，來源無法辨識，清空重來。`toeic_sessions` 與 `toeic_question_results` 目前是空的。

### 後端（dashai-go 的 toeic module）

- 新增 middleware 從 `X-Learner-Id` 標頭取值，格式限 UUID，長度上限 64
- 寫入類 endpoint（`/vocabulary/progress`、`/quiz/submit`）缺這個標頭一律回 400，不要靜默寫成共用資料
- 讀取類 endpoint（`/vocabulary/words`、`/stats`、`/stats/history`、`/vocabulary/progress/summary`）依 ID 過濾，沒帶就當成空資料回傳，不要回別人的
- 題庫與字庫本身不分人，維持原樣

### 前端

- `lib/learner.ts`：首次開啟時用 `crypto.randomUUID()` 產生並存入 localStorage，之後沿用。讀寫都要 try catch，私密模式可能丟例外
- `lib/api.ts` 的 get 與 post 自動帶上 `X-Learner-Id` 標頭
- 同源代理的 route handler 要把這個標頭轉發給後端

## 測試計畫

1. 首次開啟頁面後，localStorage 有 `toeic:learner` 且是 UUID 格式
2. 重新整理後 ID 不變
3. 網路請求都帶了 `X-Learner-Id`
4. 用兩個不同的 ID 各自標記單字熟練度，互相看不到對方的
5. 用兩個不同的 ID 各自作答，統計與歷史各自獨立
6. 不帶標頭呼叫寫入類 endpoint 回 400
7. 不帶標頭呼叫讀取類 endpoint 回空資料而不是別人的資料
8. 清掉 localStorage 後會產生新 ID，進度從零開始
9. 既有的題庫、字庫、例句、音檔不受影響

## Checklist

- [ ] schema 變更與舊資料清空
- [ ] 後端 middleware 與各 endpoint 過濾
- [ ] 前端 ID 產生與標頭帶入
- [ ] 代理轉發標頭
- [ ] 兩個 ID 互不干擾的驗證
- [ ] 線上驗證
