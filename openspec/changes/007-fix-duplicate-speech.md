---
title: 修掉切口音與切男女聲會唸兩次
type: fix
status: proposed
created: 2026-09-21
---

# 修掉切口音與切男女聲會唸兩次

## 變更內容

單字卡上切換口音或男女聲，同一個字會被唸兩次，而且兩次音色不同。一次是
Google TTS 的音檔，一次是瀏覽器內建的語音合成。

### 成因

兩個問題疊在一起。

自動發音的 effect 把 `audioUrl` 放進相依陣列：

```
web/components/vocabulary/word-card.tsx:83
useEffect(() => { ... speak(word.word, audioUrl) },
  [word.id, word.word, audioUrl, autoSpeak, supported, speak]);
```

切口音會改變 `audioUrl`，所以按鈕自己播一次之後，effect 又播一次。

第二次播放會先 `pause()` 掉第一次，被中斷的那個 `play()` promise 丟出
`AbortError`。`use-speech.ts` 的 catch 只放行 `NotAllowedError`，其餘一律退回
語音合成，於是第一次變成合成語音唸出來，第二次的音檔照常播出。

## 影響範圍

### `web/components/vocabulary/word-card.tsx`

自動發音改成只認 `word.id`。換字才自動唸，切口音與切男女聲不再觸發，播放
交給按鈕自己處理。順帶不再因為切口音把翻面狀態重置回正面。

### `web/hooks/use-speech.ts`

- 被換掉的舊 audio 先拆掉事件再 `pause()`，避免它之後觸發 `onerror` 去叫合成
- `play()` 失敗時先比對 `audioRef` 是不是自己，已被接手就什麼都不做
- `AbortError` 與 `NotAllowedError` 一樣不退回語音合成

## 測試計畫

1. 切口音：只有一次播放，沒有合成語音
2. 切男女聲：只有一次播放
3. 連點三種口音：只聽到最後一次
4. 換到下一張卡：自動唸一次
5. 翻到背面後切口音：維持在背面
6. 音檔 404：仍然退回語音合成唸出來
7. 首次進站自動播放被瀏覽器擋下：不發出合成語音

## Checklist

- [ ] word-card 自動發音相依收斂
- [ ] use-speech 中斷與接手處理
- [ ] 線上驗證播放次數
