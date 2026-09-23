---
title: 刪掉舊的 Vue 前端
type: chore
status: proposed
created: 2026-09-23
---

# 刪掉舊的 Vue 前端

## 變更內容

`frontend/` 是 2026-09-21 改寫成 Next.js 之前的 Vue 3 版本，29 個檔、約 4,457 行，之後沒有再動過也不再部署。003 的提案當時寫「保留不刪」，這次推翻那個決定。

推翻的理由有兩個。Vue 與 PrimeVue 在技術選型上已經凍結，這份程式碼不會再被撿回來用。開啟 Dependabot 之後掃出 16 個漏洞（高 9、中 6、低 1）全部落在 `frontend/package-lock.json`，等於每次通知都是在講一個不會執行的東西，留著會讓真正要看的警示被淹掉。

## 影響範圍

- 刪除 `frontend/` 整個目錄
- `README.md` 的 Previous stack 段落改寫：只剩 `backend/` 是舊版參考
- 關掉 Dependabot 為 `frontend/` 開的四個 PR（#1 到 #4）

### 不動的部分

`backend/`（FastAPI + SQLite 舊版）留著。`backend/data/` 底下的字庫與題庫 JSON 仍然被 `scripts/` 的四支腳本讀取，CC BY-SA 4.0 的 LICENSE 也放在那裡。`backend/app/` 那 13 個檔確實已經沒有任何引用，但那是 Python 側的東西，這次不一併處理。

## 測試計畫

1. `git ls-files frontend` 為空
2. `npm run build` 在 `web/` 通過，線上四個頁面正常
3. `scripts/` 的四支腳本讀得到 `backend/data/`
4. Dependabot 警示歸零，四個 PR 關閉
5. README 沒有殘留指向 `frontend/` 的敘述

## Checklist

- [ ] 刪除目錄
- [ ] README 改寫
- [ ] 關閉 PR
- [ ] 驗證
