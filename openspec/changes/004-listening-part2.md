---
title: 聽力 Part 2 應答問題
type: feature
status: proposed
created: 2026-09-21
---

# 聽力 Part 2 應答問題

## 變更內容

現在的題庫只有 Part 5 到 7，全部是閱讀。多益是聽力一百題加閱讀一百題，各佔 495 分，所以這個站目前只有半套，聽力一分都練不到。

這次做 Part 2 應答問題。四個聽力部分裡只有它不需要照片、不需要多角色對話、也不需要在畫面上印題目，是唯一能獨立成立的部分。做完就驗證了整條線：音檔產生、只播一次的考試模式、作答與計分。Part 3 與 Part 4 之後只是內容量的差別，Part 1 卡在照片授權，最後處理。

### Part 2 的規則

一句問句或陳述，接三個回答選項 A、B、C，全部用聽的，題目與選項都不印在畫面上。只播一次。25 題。

考點不只是聽懂字面，而是聽出干擾選項：重複問句裡的字但答非所問、發音相近但語意無關、答了一個沒被問的問題。題目要刻意設計這三種干擾。

## 影響範圍

### 資料（Neon）

`toeic_questions` 沿用現有結構，`part` 欄位新增值 `2`，`payload` 放：

```json
{
  "id": "toeic_part2_001",
  "prompt": "Where did you put the quarterly report?",
  "options": [
    {"label": "A", "text": "On your desk, next to the printer."},
    {"label": "B", "text": "It was a quarterly meeting."},
    {"label": "C", "text": "Yes, I reported it yesterday."}
  ],
  "answer": "A",
  "question_type": "where",
  "explanation": "B 重複了問句裡的 quarterly 但答非所問，C 用 report 的動詞形式製造發音干擾，兩個都是典型的 Part 2 陷阱。",
  "audio": "part2/toeic_part2_001.mp3",
  "voices": {"prompt": "us-f", "responses": "gb-m"}
}
```

`prompt` 與 `options` 的文字**不會回傳給前端的考試模式**，只在作答後的檢討畫面用。

### 音檔

一題一個音檔，內容是問句、停頓、A、停頓、B、停頓、C，跟實際考試的播放方式一致。

問句與回答由不同人講，所以要分兩次合成再串接：問句用一個聲音，三個回答用另一個聲音，中間插入靜音。串接用 ffmpeg（本機 8.0.1 已有）。聲音從現有的六個裡挑，問句與回答刻意用不同口音，對應多益讓不同國家的人對話的設計。

25 題約 3,500 字元，Neural2 每月免費額度一百萬，佔 0.35%。音檔估計 25 到 30 MB。

腳本 `scripts/build_listening_audio.py`，重跑時跳過已存在的檔案，跟單字音檔同一套做法。

### 後端（dashai-go 的 toeic module）

| Endpoint | Method | 說明 |
|----------|--------|------|
| `/toeic/listening/questions?part=2&count=10` | GET | 取聽力題。考試模式下不回傳 prompt、options 的文字與 answer |
| `/toeic/listening/review` | POST | 送出答案後取回完整內容與解析 |

既有的 `/toeic/quiz/submit` 沿用，`part` 記為 `2`。

### 前端

新增 `/listening` 路由與播放器元件：

- 進入後顯示題號與一顆開始鍵，按下才播放，避免自動播放被瀏覽器擋
- 播放中不顯示任何文字，只有波形或進度指示與「播放中」狀態
- 播完自動顯示 A、B、C 三顆按鈕供作答
- **一題只播一次**，播完不提供重播，與實際考試一致
- 作答後進下一題，全部答完一次顯示結果與逐題檢討
- 檢討畫面才顯示問句與選項的文字、正解、解析，並可重播音檔

練習模式（非考試）允許重播與逐句聽，之後再做，這次先做考試模式。

## UI 規格

```
  第 7 題 / 共 10 題

  +--------------------------------+
  |                                |
  |        [ 播放中 ... ]          |
  |                                |
  +--------------------------------+

     [  A  ]   [  B  ]   [  C  ]
```

- 播放前是一顆「開始播放」大按鈕，播放中三顆選項鍵維持 disabled，播完才啟用
- 手機寬度 375 下三顆選項鍵等寬一排
- 音檔載入失敗要明說「音檔載入失敗」並允許跳過該題，不要靜默卡住

## 測試計畫

1. `uv run scripts/build_listening_audio.py` 產出 25 個音檔並上傳，重跑會跳過已存在的
2. 抽三個音檔實聽：問句與回答是不同聲音、停頓長度合理、沒有截斷
3. `GET /toeic/listening/questions?part=2&count=10` 回 10 題，**不含** prompt、options、answer 三個欄位
4. `POST /toeic/listening/review` 回傳完整內容與解析
5. `POST /toeic/quiz/submit` 以 part=2 寫入，統計頁看得到
6. 前端 `/listening` 播放一題、作答、進下一題，全程不顯示文字
7. 播完不出現重播鍵
8. 全部答完顯示結果與逐題檢討，檢討畫面看得到文字與解析
9. 音檔 404 時顯示錯誤訊息且可跳過
10. 375px 下三顆選項鍵不溢出
11. `npm run build` 與 `vue-tsc` 等價檢查通過
12. 既有的閱讀題型與單字功能不受影響

## Checklist

- [ ] 25 題內容（問句、三選項、正解、干擾設計、解析）
- [ ] 音檔產生腳本與串接
- [ ] 音檔上傳與抽聽
- [ ] 後端 endpoint 與考試模式的欄位遮蔽
- [ ] 前端播放器與作答
- [ ] 檢討畫面
- [ ] 線上驗證
