---
title: 全域搜尋（單字加題庫）
type: feature
status: proposed
created: 2026-09-24
---

# 全域搜尋（單字加題庫）

## 變更內容

站上沒有任何搜尋。想複習某個字或某種句型時，只能等抽卡或抽題抽到。字庫 6,228 字，題庫 211 題（Part 1 到 7）。

導覽列常駐一個搜尋框，送出後到 `/search?q=` 看結果：

- 單字：英文比對本字、詞形變化（打 went 找得到 go）、字首；中文比對中文解釋。點一筆跳到背單字頁，第一張就是那個字
- 題目：英文比對整個字（含詞形變化），中文比對解析。每筆顯示 Part、命中那一句，按一下展開整題、正解與解析

Part 1 在語音備妥前（`NEXT_PUBLIC_PART1_READY` 未設）不出現在結果裡。

## 影響範圍

- `components/site-nav.tsx`：企業橫帶那一列加搜尋框；手機寬度只顯示放大鏡，點開才出輸入框
- `app/search/page.tsx`：結果頁，查詢字串放網址，上一頁回得去
- `components/search/question-detail.tsx`：依 Part 展開整題
- `lib/api.ts`、`lib/types.ts`：`searchAll`、`SearchResult`

後端在 dashai-go `openspec/changes/toeic-search.md`。

## UI 規格

- 沿用紙本色票與襯線字，不另加顏色
- 命中的字用粗體標出
- 單字列：英文、詞性、中文解釋一行；書籤過的字標書籤圖示
- 查無結果時顯示「找不到」與原查詢字

## 測試計畫

1. 打 went 找得到 go；打 manag 找得到 manage、manager 等字首相同的字；打 approve 的題目結果只含 approve 與其變化，不含 approval
2. 打中文「批准」找得到解釋含批准的字
3. 點單字結果進背單字頁，第一張是那個字
4. 題目展開後有正解與解析，五種題型（Part 2、3/4、5、6、7）都能展開
5. 未設 `NEXT_PUBLIC_PART1_READY` 時結果不含 Part 1
6. 手機 375 寬導覽列不折行、沒有橫向捲動
7. 上一頁回到結果頁時查詢字還在

## Checklist

- [ ] 後端
- [ ] 導覽列搜尋框
- [ ] 結果頁與展開
- [ ] 線上驗證
