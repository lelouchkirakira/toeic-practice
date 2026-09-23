---
title: 例句小卡跳去那個字的單字卡
type: feature
status: proposed
created: 2026-09-23
---

# 例句小卡跳去那個字的單字卡

## 變更內容

例句裡點開的小卡只給釋義，看到想學的字沒有辦法接著背。這次在小卡加一個按鈕，按了就把那個字換成現在這張卡，評完之後回到原本那個字，這一輪的進度不會被打斷。

## 影響範圍

### 前端

- `components/vocabulary/word-popover.tsx`：加一顆「去背這個字」，按下去呼叫外面傳進來的 handler
- `components/vocabulary/word-card.tsx`：新增 `onJump` 往上傳，按完關掉小卡
- `app/vocabulary/page.tsx`：把那個字插進目前這一輪的當前位置，原本那張往後挪一格；如果那個字本來就在這一輪裡，是移動不是複製，不會出現兩張一樣的卡
- 插進來的字不重抽、不打 API，資料就是小卡本來拿到的那筆

### 後端（dashai-go 的 toeic module）

`POST /vocabulary/lookup` 目前一律回 `bookmarked: false`。前端的 API client 每個請求本來就帶 `X-Learner-Id`，所以改成有帶代號時順便標上書籤狀態，跳過去的那張卡才不會把已經標過的字顯示成沒標。沒帶代號的行為不變。

## 測試計畫

1. 例句點一個字，小卡出現「去背這個字」，按下去卡片換成那個字，小卡關閉
2. 換過去之後評分，下一張回到原本那個字，這一輪總數不變
3. 跳過去的字如果本來就在這一輪裡，不會變成兩張
4. 已經標過書籤的字跳過去時，書籤圖示是實心
5. 手機點一下出現底部面板，一樣有這顆按鈕且按得到
6. 只抽書籤模式下跳進來的字不影響篩選結果
7. 後端不帶 `X-Learner-Id` 呼叫 lookup 仍然回 `bookmarked: false`

## Checklist

- [ ] 後端 lookup 帶書籤狀態
- [ ] 小卡按鈕與往上傳
- [ ] 插卡邏輯
- [ ] 本地驗證
- [ ] 線上驗證
