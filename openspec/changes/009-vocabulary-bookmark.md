---
title: 單字書籤與書籤複習
type: feature
status: proposed
created: 2026-09-23
---

# 單字書籤與書籤複習

## 變更內容

背單字現在只有三段熟練度（未學 / 學習中 / 已熟），而且按下去就換下一張。使用者回報的缺口是：看到一個想之後再回來看的字，沒有地方標記，除非當場按「不熟」把它留在學習中那一堆裡，但那堆有上百個字，回頭找不到當初想記的那幾個。

這次加書籤。卡片上一個書籤按鈕，點一下標記、再點一下取消，標記不影響熟練度也不會換卡。篩選列加一個「只抽書籤」的開關，打開之後抽卡只從標記過的字裡面抽，這就是複習路徑。

書籤存在後端，跟熟練度一樣用匿名學習者代號分人，換頁或隔天回來都還在。不存 localStorage 的原因是熟練度已經在後端，兩套資料分兩個地方存會在之後接登入時要搬兩次。

## 影響範圍

### 資料（Neon 專案 silent-darkness-53723538）

```sql
CREATE TABLE toeic_word_bookmarks (
  learner_id text NOT NULL,
  word_id    text NOT NULL REFERENCES toeic_words(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, word_id)
);
```

不加進 `toeic_word_progress`，因為那張表的 `level` 是 NOT NULL，標記一個還沒評過熟練度的字會被迫塞一個假的熟練度，連帶讓「未學」篩選（判斷有沒有進度列）與統計數字失真。分開一張表就沒有這個牽連。

### 後端（dashai-go 的 toeic module）

- `POST /vocabulary/bookmark`：body 收 `word_id` 與 `bookmarked`，true 寫入、false 刪除，回傳 `{word_id, bookmarked}`。缺 `X-Learner-Id` 回 400，字庫查無此字回 404，與 `/vocabulary/progress` 一致
- `GET /vocabulary/words` 新增 `bookmarked=1` 參數，帶了就只抽標記過的字
- 每筆 `Word` 加 `bookmarked` 欄位。取字後多一次 `word_id = ANY(...)` 查詢標記狀態再標回去，不動 `wordColumns` 與共用的 scan，避免影響干擾選項那兩條查詢

### 前端（web/）

- `lib/types.ts`：`Word` 加 `bookmarked?: boolean`
- `lib/api.ts`：`saveBookmark(wordId, bookmarked)`；`WordQuery` 加 `bookmarked`
- `components/vocabulary/word-card.tsx`：卡片右上角加書籤按鈕
- `app/vocabulary/page.tsx`：篩選列加「只抽書籤」開關，抽卡帶上這個條件

### UI 規格

- 書籤按鈕用 lucide 的 `Bookmark`，位置在卡片右上角、與「第幾張 / 共幾張」同一行。未標記是空心線條，已標記是實心填滿
- `aria-pressed` 跟著狀態，`aria-label` 在「加入書籤」與「移除書籤」之間切換，鍵盤可聚焦
- 點下去先改畫面再送請求，請求失敗就退回原狀並顯示錯誤，不讓使用者對著沒反應的按鈕連點
- 標記不換卡、不動熟練度、不影響自動發音
- 篩選列的開關與自動發音按鈕同一排，一樣用書籤圖示加 `aria-pressed`，標題文字寫「只抽書籤的字」
- 開關打開但一個書籤都沒有時，空狀態文字寫「還沒有標記任何單字，先在卡片上點書籤」

## 測試計畫

1. 在卡片上點書籤，圖示變實心，卡片不換張，熟練度沒有被寫入
2. 重新整理後同一個字仍是實心
3. 再點一次取消，重新整理後是空心
4. 打開「只抽書籤」後重新抽卡，抽到的每一張都是標記過的
5. 一個書籤都沒有時打開開關並抽卡，顯示空狀態提示而不是錯誤
6. 換一組學習者代號（清掉 localStorage）後，看不到前一組的書籤
7. 沒帶 `X-Learner-Id` 呼叫書籤 endpoint 回 400
8. 標記一個不存在的 word_id 回 404
9. 後端斷線時點書籤，圖示退回原狀並顯示錯誤訊息
10. 鍵盤 Tab 可以聚焦書籤按鈕，Enter 可以切換，螢幕報讀器唸得出狀態
11. 既有的熟練度、統計、測驗、聽力不受影響

## Checklist

- [ ] Neon 建表
- [ ] 後端 endpoint 與查詢參數
- [ ] 前端 API 與型別
- [ ] 卡片書籤按鈕
- [ ] 篩選列開關與空狀態
- [ ] 本地驗證
- [ ] 線上驗證
