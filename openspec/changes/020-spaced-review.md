---
title: 學習歷程與間隔複習
type: feature
status: proposed
created: 2026-09-23
---

# 學習歷程與間隔複習

## 變更內容

現在按「不會」「模糊」「會了」只是覆寫一列紀錄，抽卡仍然純隨機，按過不會的字下次出現的機率跟其他 6,228 個字一樣。而且每次評分都覆寫同一列，過程沒留下來，所以算不出「上週二背了幾個字」或「這個字從不會變成會了花了幾次」。

這次做兩件互相依賴的事：把每次評分當事件記下來，以及依照評分安排下次該出現的時間。

## 影響範圍

### 資料（Neon）

```sql
CREATE TABLE toeic_word_events (
  id         bigserial PRIMARY KEY,
  learner_id text NOT NULL,
  word_id    text NOT NULL REFERENCES toeic_words(id) ON DELETE CASCADE,
  level      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON toeic_word_events (learner_id, created_at DESC);

ALTER TABLE toeic_word_progress ADD COLUMN due_at timestamptz;
ALTER TABLE toeic_word_progress ADD COLUMN streak  integer NOT NULL DEFAULT 0;
```

事件表只增不改，是之後所有歷程統計的來源。`toeic_word_progress` 仍然是「現在的狀態」，多了下次該出現的時間與連續答對次數。

### 間隔規則

| 評分 | 下次出現 | 連續次數 |
|---|---|---|
| 不會 | 1 天後 | 歸零 |
| 模糊 | 3 天後 | 歸零 |
| 會了 | 依連續次數 14、30、60、120、180 天 | 加一 |

規則刻意簡單而且看得懂，不套現成的 SM-2。之後要調整區間時，事件表裡有完整歷史可以回頭驗證。

### 後端（dashai-go 的 toeic module）

- `SaveProgress` 一併寫事件、算 `due_at` 與 `streak`
- 抽卡預設混合：沒有指定熟練度也沒開書籤篩選時，先抽已經到期的字（最多佔一半），不足的再用原本的隨機補滿。使用者不必自己去挑篩選條件
- `/vocabulary/words` 的 `level` 參數新增 `due`，只抽到期的
- 新增 `GET /vocabulary/activity?days=30`：回最近 N 天每天的評分次數、今天已評、目前到期待複習的數量

### 前端

- 背單字頁側欄「這一輪」下面加「待複習」數字，並顯示今天已評幾個
- 熟練度下拉新增「該複習的」
- 統計頁加最近三十天的活動長條與連續天數

## 測試計畫

1. 評「不會」之後該字的 `due_at` 是明天，事件表多一列
2. 連續評三次「會了」，間隔依序是 14、30、60 天，`streak` 累加
3. 評「不會」之後 `streak` 歸零
4. 把某字的 `due_at` 手動改成昨天，預設抽卡會抽到它
5. 到期的字不足一半時，其餘用隨機補滿，總數仍等於要求的張數
6. `level=due` 只回到期的字
7. `/vocabulary/activity` 的每日次數與事件表一致，換代號看不到別人的
8. 沒帶代號時抽卡行為與現在相同，不報錯
9. 側欄與統計頁的數字跟 API 回的一致

## Checklist

- [ ] 資料表與欄位
- [ ] 後端排程與事件
- [ ] 混合抽卡與 due 篩選
- [ ] activity endpoint
- [ ] 前端側欄、篩選、統計
- [ ] 本地與線上驗證
