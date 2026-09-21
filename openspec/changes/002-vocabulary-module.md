---
title: 多益單字庫與背單字模組
type: feature
status: proposed
created: 2026-09-21
---

# 多益單字庫與背單字模組

## 變更內容

現有題庫只有 Part 5/6/7 的選擇題，沒有單字層。這次加入 6,233 字的多益單字庫，以及背單字卡片與單字測驗兩個功能。

### 字表來源與字數

全部採用 New General Service List Project 的語料庫字表，授權為 CC BY-SA 4.0，官方明文允許商業使用。

| 字表 | 字數 | 說明 |
|------|------|------|
| NGSL-GR 1.0 | 5,050 | 一般英語核心字，含 NGSL 1.2 的 2,809 字，涵蓋一般英語 98% |
| TSL 1.2 | 1,250 | 以 150 萬字多益教材語料建立，配 NGSL 涵蓋多益 98.5% |
| BSL 1.2 | 1,744 | 商業英語字，涵蓋商業英語 97% |
| NAWL 1.2 | 957 | 學術字，補 NGSL 未收的學術語境詞 |

四表去重後為 6,233 個 headword，此為本模組的字庫規模。

使用者原本設想的 7,000 字無法在授權乾淨的前提下達成。市面「多益 7000 單」多為出版社編纂並享有著作權；台灣慣稱的 7000 字是大考中心《高中英文參考詞彙表》，著作權屬大考中心基金會且明文限非營利使用，與本 repo 的 MIT 授權衝突，且該表是高中學測導向，缺商業職場詞。故採 6,233 字的開源組合。

### 釋義來源

英文定義以官方 easy English 定義檔優先：

| 來源檔 | 可用定義數 |
|--------|-----------|
| NGSL_12_with_English_definitions.xlsx | 2,809 |
| TSL_12_definitions.xlsx | 1,246 |
| NAWL_12_with_en_definitions.csv | 959 |

去重後覆蓋目標字庫的 4,777 字，占 76.6%。其餘 1,457 字（主要落在 BSL 與 NGSL-GR 擴充區）官方沒有定義檔，改由 ECDICT 的 definition 欄補齊。

正體中文釋義全部取自 ECDICT（MIT 授權，約 76 萬詞條），該資料為簡體，需經 OpenCC s2twp 轉為正體並套台灣用語，轉換後必須人工抽查支語殘留。

### 分級

NGSL-GR 附 rank，依官方分級切為 11 個 band：第 1 至 8 band 各 400 字，第 9 至 11 band 各 600 字。TSL、BSL、NAWL 各自附 rank 與 band，一併保留。單字卡與單字測驗都可依 band 選範圍。

### 授權標示

字表資料為 CC BY-SA 4.0，帶有 ShareAlike 條款，衍生的字庫檔必須以同授權釋出。程式碼維持 MIT。需在 repo 新增 NOTICE 檔並於 README 標明兩者分離，字庫檔目錄另放一份授權說明與出處。

## 影響範圍

### 新增

```
scripts/build_vocabulary.py          字庫建置腳本（下載、合併、去重、補釋義、轉繁、產 JSON）
backend/data/vocabulary/words.json   產出字庫
backend/data/vocabulary/LICENSE      字庫授權與出處
backend/app/services/vocabulary.py   字庫載入與查詢
backend/app/routers/vocabulary.py    單字 API
frontend/src/views/VocabularyView.vue     背單字卡片頁
frontend/src/components/WordCard.vue      單字卡元件
frontend/src/composables/useVocabulary.ts 單字資料存取
NOTICE                               第三方資料授權聲明
```

### 修改

```
backend/app/main.py            掛載 vocabulary router、啟動時載入字庫、status 加字庫健康檢查
backend/app/models/database.py 新增 WordProgress 資料表記錄單字熟練度
backend/app/routers/quiz.py    新增單字測驗題型
backend/app/services/stats_service.py  統計加入單字進度
frontend/src/router/index.ts   新增 /vocabulary 路由
frontend/src/types/index.ts    新增 Word、WordProgress 型別
frontend/src/App.vue           導覽列加入單字入口
README.md                      功能說明、字庫來源、授權章節
```

ECDICT 原始檔 62.88 MB，不進 repo。建置腳本負責下載到暫存目錄、抽出所需字詞後即產出精簡 JSON，預估 2 MB 上下。

## 資料格式

```json
{
  "id": "w_00028",
  "word": "acceptance",
  "pos": "n",
  "phonetic": "əkˈseptəns",
  "definition_en": "state of being okay with something or someone",
  "definition_zh": "n. 接受, 驗收, 承兌",
  "lists": {"NGSL-GR": {"rank": 3110}, "TSL": {"rank": 698}, "BSL": {"rank": 1188, "band": 3}},
  "band": 3,
  "inflections": ["acceptances"]
}
```

`lists` 是物件不是陣列，key 為字表名稱，value 帶該字在那份字表的 rank，BSL 與 NAWL 另帶該表自己的 band。此欄供前端篩選多益專用字（TSL）或商業字（BSL）。

頂層 `band` 是統一難度分級 1 到 12，與各字表自己的 band 不同，前端篩選一律用頂層這個。

實際產出覆蓋率：英文定義 6,222 筆、中文釋義 6,232 筆、音標 6,163 筆、詞形變化 4,593 筆。`definition_en`、`phonetic`、`inflections` 仍可能為空，前端須容許。

## UI 規格

### 背單字卡片頁 `/vocabulary`

- 頂部為篩選列：字表（全部／TSL／BSL／NAWL／NGSL-GR）、band 區間、熟練度（未學／學習中／已熟）
- 主體為單張卡片，正面顯示單字與音標，點擊翻面顯示英文定義、正體中文釋義、詞形變化、所屬字表標籤
- 卡片下方三個按鈕：不會、模糊、會了，寫入 WordProgress 並自動換下一張
- 右上角顯示本輪進度，例如 12 / 40
- 沿用 PrimeVue Aura 主題與現有 global.css 的色票，不另外引入 UI 套件
- 手機寬度下卡片滿版、按鈕改為橫向等寬三欄

### 單字測驗

併入現有 practice 流程，於 PartSelector 新增「單字」選項。題型為四選一中譯英與英譯中各半，干擾選項自同 band 隨機取三個，答錯即時顯示該字完整釋義。計分與作答紀錄沿用 TestSession 與 QuestionResult，part 欄位記為 `vocab`。

## API

| Endpoint | Method | 說明 |
|----------|--------|------|
| `/api/vocabulary/words?list=TSL&band=3&count=20` | GET | 依字表與 band 取單字 |
| `/api/vocabulary/quiz?count=10&band=3` | GET | 取單字測驗題 |
| `/api/vocabulary/progress` | POST | 寫入熟練度 |
| `/api/vocabulary/progress/summary` | GET | 各 band 與各字表的熟練度統計 |

## 測試計畫

1. `python scripts/build_vocabulary.py` 完整跑完，產出 words.json 且 headword 數為 6,233
2. 產出檔抽查 30 字，確認英文定義與正體中文釋義都存在且對應正確
3. 中文釋義以支語黑名單掃描，可判定的支語複合詞（計算機輔助、一般水平、同等水平、競賽專案等）命中數為 0。餘下命中須逐筆判讀確認是語境正確的用法：質量限物理語境、水平限幾何語境、程序限步驟語境
4. `uv run scripts/check_vocabulary.py` 通過。簡體偵測取 OpenCC STCharacters 中不在自己繁體對應清單裡的字，扣掉群、床、秘、峰、灶、痴這些台灣標準字後，命中僅作資訊回報不阻斷。禁用 Big5 可編碼性當判準，那個字集收字不全會把正體字判成非正體；OpenCC 的 s2t 會把台灣標準字轉成異體字，s2twp 對已轉換文字重跑會產生疊字，兩者都不是有效判準
5. `GET /api/vocabulary/words?list=TSL&count=20` 回傳 20 筆且皆含 TSL 標籤
6. `GET /api/vocabulary/words?band=1` 回傳結果的 band 皆為 1
7. `GET /api/vocabulary/quiz?count=10` 回傳 10 題，每題四個選項且正解唯一
8. `POST /api/vocabulary/progress` 寫入後，summary 的計數同步增加
9. 前端 `/vocabulary` 可翻卡、三個按鈕都能寫入進度並換卡
10. 手機寬度 375px 下卡片與按鈕不溢出
11. 單字測驗可從 PartSelector 進入，作答後計分正確並寫入統計
12. `npm run build` 與 `tsc` 通過
13. `GET /api/status` 顯示字庫載入筆數

## Checklist

- [ ] 建置腳本與字庫產出
- [ ] 字庫品質抽查與支語掃描
- [ ] NOTICE 與授權標示
- [ ] 後端 service 與 API
- [ ] WordProgress 資料表
- [ ] 前端單字卡片頁
- [ ] 單字測驗併入 practice
- [ ] README 更新
