---
title: 聽力 Part 3 對話
type: feature
status: proposed
created: 2026-09-21
---

# 聽力 Part 3 對話

## 變更內容

Part 2 做完之後，聽力還缺 Part 1、3、4。依官方 Examinee Handbook，聽力四個部分是：

```
Part 1  Photographs        6 題
Part 2  Question-Response  25 題          已完成
Part 3  Conversations      39 題；13 段對話，每段 3 題
Part 4  Talks              30 題；10 篇短講，每篇 3 題
```

Part 3 與 Part 4 合計 69 題，佔聽力近七成，也是一般人對聽力測驗的主要印象。這次做 Part 3。

### 與 Part 2 的差別

Part 2 是一問三答、全程只能聽、畫面不顯示任何文字。Part 3 不同：

- 一段兩到三人的對話配三題，每題**四個**選項
- 題目與選項**要顯示在畫面上**，而且實際考試會先給時間讀題再播放
- 對話裡的說話者刻意來自不同國家，所以角色要配不同口音

因此播放流程是：先顯示三題讓人讀，按下播放後對話播一次，播完才開放作答，三題一次答完再進下一段。

## 影響範圍

### 資料（Neon）

`toeic_questions` 的 `part` 新增值 `3`，payload：

```json
{
  "id": "toeic_part3_001",
  "audio": "part3/toeic_part3_001.mp3",
  "topic": "rescheduling a client visit",
  "turns": [
    {"speaker": "W", "voice": "us-f", "text": "..."},
    {"speaker": "M", "voice": "gb-m", "text": "..."}
  ],
  "questions": [
    {
      "number": 1,
      "text": "What are the speakers mainly discussing?",
      "options": [
        {"label": "A", "text": "..."},
        {"label": "B", "text": "..."},
        {"label": "C", "text": "..."},
        {"label": "D", "text": "..."}
      ],
      "answer": "B",
      "explanation": "..."
    }
  ]
}
```

`turns` 是逐字稿，作答階段不回傳，檢討時才給。

### 音檔

一段對話一個音檔。每一輪用該角色的聲音合成，輪與輪之間插入短停頓再串接，做法與 Part 2 相同，差別在角色數與輪數較多。13 段對話約 8,000 字元，佔 Neural2 每月免費額度不到 1%。

腳本沿用 `scripts/build_listening_audio.py`，擴充成能處理多輪對話。

### 後端（dashai-go 的 toeic module）

`/toeic/listening/questions?part=3&count=3` 回傳對話與題目，含選項文字（因為畫面要顯示），但**不含 answer 與 turns**。`/toeic/listening/review` 回傳完整內容含逐字稿與解析。既有的 Part 2 行為不變。

### 前端

`/listening` 加題型切換（Part 2 應答問題／Part 3 對話）。Part 3 的流程：

1. 顯示三題與四個選項，一顆「開始播放」
2. 播放中選項維持停用，畫面提示播放中
3. 播完三題同時開放作答
4. 三題都選完才能進下一段
5. 全部結束顯示結果與逐題檢討，檢討含逐字稿與重聽

## 測試計畫

1. 音檔產出並上傳，抽一段實聽：角色聲音不同、輪次之間停頓合理、沒有截斷
2. `GET /toeic/listening/questions?part=3&count=3` 回傳題目與選項，**不含** answer 與 turns
3. `POST /toeic/listening/review` 回傳完整內容含 turns 與解析
4. 前端 Part 3 流程：讀題、播放、作答三題、進下一段
5. 播完不出現重播鍵
6. 三題沒答完不能進下一段
7. 結果寫入統計，part 記為 3
8. 檢討畫面顯示逐字稿與正解標記
9. 375px 下四個選項不溢出
10. Part 2 的行為完全不受影響

## Checklist

- [ ] 13 段對話內容與題目
- [ ] 音檔腳本擴充與產出
- [ ] 後端 Part 3 支援
- [ ] 前端題型切換與 Part 3 流程
- [ ] 線上驗證
