---
title: 前端改寫 Next.js、後端遷移 dashai-go、資料遷移 Neon
type: refactor
status: proposed
created: 2026-09-21
---

# 前端改寫 Next.js、後端遷移 dashai-go、資料遷移 Neon

## 變更內容

這個專案目前是 Vue 3 + PrimeVue 前端配 FastAPI + SQLite 後端，全部只跑在本機，從未部署。三個問題要一次解決：

1. Vue 與 PrimeVue 已是凍結技術，新開發應走 Next.js App Router + shadcn
2. 後端另開 Render 服務要多付一份錢，而 dashai-go 已經在跑
3. 字庫是 CC BY-SA 4.0 資料，不能放進任何一個 proprietary repo

做法是前端改寫成 Next.js 部署 Vercel，後端邏輯改寫成 Go 併進 dashai-go 既有服務，題庫與字庫改存 Neon。

## 影響範圍

牽涉三個 repo 與一個新的 Neon 專案。

### dashai-go（新增 module）

```
internal/toeic/router.go    Router(cfg, db)，照 internal/edge 的結構
internal/toeic/handler.go   HTTP handler
internal/toeic/store.go     Neon 查詢
internal/toeic/model.go     型別
internal/toeic/quiz.go      出題與評分
cmd/server/main.go          加 r.Mount("/toeic", toeic.Router(cfg, db))
```

沿用既有慣例：錯誤回應用 `response.Err` 不是 `Error`，成功用 `response.OK`，回應外層是 `{success, data, error}`。不為了 UUID 加相依，用 `crypto/rand` 自製。module 目錄名單字無底線，Router 內路徑不含 `/toeic` 前綴。

### toeic-practice（前端改寫）

```
web/                        新的 Next.js App Router 專案
web/app/page.tsx            練習
web/app/mock-test/page.tsx  模擬考
web/app/vocabulary/page.tsx 背單字
web/app/stats/page.tsx      統計
web/components/ui/          shadcn 元件
frontend/                   舊 Vue 版，保留不刪
backend/                    舊 FastAPI 版，保留不刪
```

舊的 Vue 前端與 Python 後端都保留，作為 Go 版的對照基準，等新版驗證完再由使用者決定何時移除。這跟既有的「Python 側保留作 ground-truth 不刪」原則一致。

### Neon（新專案 toeic）

region 選 Singapore，與既有專案一致。

## 資料模型

四組表，全部放 Neon：

| 表 | 用途 | 筆數 |
|----|------|------|
| `toeic_words` | 單字庫 | 6,233 |
| `toeic_questions` | Part 5/6/7 題庫 | 60 組 |
| `toeic_sessions` | 測驗場次 | 累積 |
| `toeic_question_results` | 逐題作答紀錄 | 累積 |
| `toeic_word_progress` | 單字熟練度 | 累積 |

字庫進資料庫是必要條件不是偏好：`words.json` 衍生自 CC BY-SA 4.0 的字表，dashai-go 的 LICENSE 是 proprietary，該檔進 repo 會與授權宣告衝突；而 dashai-go 的 production 映像是 distroless，裡面沒有 Python 可以在啟動時產生字庫。放 Neon 兩個問題一起解決。

`scripts/build_vocabulary.py` 保留現有的 JSON 產出，另加一支匯入腳本把它灌進 Neon。

## API

掛在 dashai-go 的 `/toeic` 之下，全部回 `{success, data, error}` 外層。

| Endpoint | Method | 說明 |
|----------|--------|------|
| `/toeic/quiz/questions?part=5&count=10` | GET | 取練習題 |
| `/toeic/quiz/mock-test` | GET | 取完整模擬考 |
| `/toeic/quiz/submit` | POST | 送答案，回分數 |
| `/toeic/vocabulary/words?list=TSL&band=3&count=20` | GET | 依字表與難度取單字 |
| `/toeic/vocabulary/quiz?count=10&band=3` | GET | 取單字測驗題 |
| `/toeic/vocabulary/progress` | POST | 寫熟練度 |
| `/toeic/vocabulary/progress/summary` | GET | 熟練度統計 |
| `/toeic/stats` | GET | 整體正確率與弱項 |
| `/toeic/stats/history?limit=20` | GET | 歷史場次 |

前端走同源代理 `/api/backend/toeic/*`，照 ai-english-tutor 既有的 Vercel function 模式帶 `X-Origin-Key`，不讓瀏覽器直接打 Render。

## UI 規格

四個頁面的功能與現行 Vue 版一致，改用 shadcn 重畫：

- 練習：選 Part 與題數，逐題作答，送出後顯示對錯、詳解與下一題
- 模擬考：75 分鐘倒數，三個 Part 分頁與題號導覽點，最後一次評分並估 TOEIC 分數區間
- 背單字：篩選列（字表、難度區間、熟練度、張數），卡片點擊翻面顯示釋義、詞形變化與字表標籤，下方三顆按鈕寫入熟練度並換卡
- 統計：整體正確率、各 Part 拆解、弱項文法、歷史場次表

手機寬度 375 下不得有水平溢出，背單字的三顆按鈕維持等寬三欄。

## 測試計畫

### 後端

1. `go build ./...` 與 `go test ./internal/toeic/...` 通過
2. `GET /toeic/vocabulary/words?list=TSL&count=20` 回 20 筆且皆含 TSL
3. `GET /toeic/vocabulary/words?band=1` 回傳結果 band 皆為 1
4. `GET /toeic/vocabulary/quiz?count=10` 回 10 題，四選項不重複、正解唯一、無空白選項、選項長度不超過 24 字
5. `POST /toeic/vocabulary/progress` 寫入後 summary 計數增加
6. `GET /toeic/quiz/questions?part=5&count=5` 回 5 題
7. 與 Python 版逐項比對同一組輸入的輸出，欄位與語意一致
8. 既有的 9 個 module 不受影響，`/shukuyo` 與 `/jyotish` smoke 測試照常

### 資料

9. Neon 的 `toeic_words` 筆數為 6,233，抽查 30 筆釋義與本機 JSON 一致
10. `uv run scripts/check_vocabulary.py` 仍通過

### 前端

11. `npm run build` 與 `tsc` 通過
12. 四個頁面在 375 寬度下無水平溢出
13. 練習作答後顯示對錯、詳解與下一題
14. 背單字翻卡、三顆按鈕寫入進度並換卡
15. 單字測驗計分寫入統計頁
16. 線上部署後打實際網址跑完上述流程，並查 Sentry 無新錯誤

## 階段

1. Neon 專案與四組表建立，字庫與題庫匯入
2. dashai-go 的 toeic module 與 API
3. Next.js 前端改寫
4. Vercel 專案建立、同源代理接上、網域設定
5. 線上驗證

前兩階段完成後後端即可獨立驗證，不必等前端。

## Checklist

- [ ] Neon 專案與 schema
- [ ] 字庫與題庫匯入腳本
- [ ] dashai-go toeic module
- [ ] 與 Python 版輸出比對
- [ ] Next.js 專案骨架與 shadcn
- [ ] 四個頁面改寫
- [ ] Vercel 專案與同源代理
- [ ] 線上驗證與 Sentry 檢查
