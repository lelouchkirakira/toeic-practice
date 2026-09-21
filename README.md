# TOEIC Practice

Standalone TOEIC Reading section drill app. Covers Part 5 (Incomplete Sentences), Part 6 (Text Completion), and Part 7 (Reading Comprehension) with offline question bank, timed mock tests, and score tracking.

Originally extracted from [ai-english-tutor](https://github.com/seikaikyo/ai-english-tutor) -- the tutor keeps voice conversation practice, this app handles the multiple-choice test drilling with a proper quiz UI.

## Screenshots

**Practice mode** -- pick a Part, answer questions with immediate feedback and explanations

![Practice](docs/question.png)

**Mock test** -- 75-minute timed simulation across all three Parts, graded at the end with TOEIC score estimation

![Mock Test](docs/mock-test.png)

**Statistics** -- score trends, per-Part accuracy breakdown, weak grammar category detection

![Stats](docs/stats.png)

## Features

- **Practice mode**: Part 5/6/7 or mixed, choose 5/10/15 questions, instant correct/incorrect feedback with grammar explanations
- **Mock test mode**: 75-minute countdown timer, Part 5/6/7 section tabs with question navigation dots, deferred grading, TOEIC score range estimation (450-495 down to Below 300)
- **Score tracking**: SQLite-backed session history, per-Part accuracy, weak grammar category identification (< 60% on 3+ attempts)
- **124 questions**: 30 Part 5 sentences, 15 Part 6 passages (56 blanks), 15 Part 7 passages (38 comprehension questions)
- **6,233-word vocabulary**: flashcards with English definitions, Traditional Chinese glosses, phonetics and inflected forms, filterable by source list and difficulty band, plus a four-choice vocabulary quiz that feeds the same score tracking

## Architecture

```
frontend/                        backend/
Vue 3 + TypeScript + PrimeVue    FastAPI + SQLModel + SQLite
              |                           |
              +--- /api proxy (Vite) -----+
                                          |
                            +-------------+-------------+
                            |                           |
                      question_bank/               vocabulary/
                      part5.json                   words.json
                      part6.json                   (6,233 headwords)
                      part7.json
```

No external AI API needed, all questions come from local JSON data. The backend handles quiz session management, answer grading, vocabulary lookup, and statistics aggregation.

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | Vue 3.5, TypeScript 5.9, Vite 7, PrimeVue 4 (Aura), Chart.js |
| Backend | FastAPI, SQLModel, SQLite, Uvicorn |
| Data | Structured JSON question bank (Part 5/6/7) and vocabulary list |

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/quiz/questions?part=5&count=10` | GET | Fetch practice questions |
| `/api/quiz/mock-test` | GET | Fetch full mock test (30 + 8 + 10 passages) |
| `/api/quiz/submit` | POST | Submit answers, get score |
| `/api/stats` | GET | Overall accuracy, per-Part breakdown, weak categories |
| `/api/stats/history?limit=20` | GET | Recent session history |
| `/api/vocabulary/words?list=TSL&band=3&count=20` | GET | Fetch vocabulary, filterable by list and band |
| `/api/vocabulary/quiz?count=10&band=3` | GET | Fetch four-choice vocabulary questions |
| `/api/vocabulary/progress` | POST | Record how well a word is known |
| `/api/vocabulary/progress/summary` | GET | Progress counts per band and per list |
| `/api/status` | GET | Question bank and vocabulary health check |

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8003
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`, proxies `/api` to backend on port 8003.

## Question bank format

**Part 5** (sentence completion):
```json
{ "id", "sentence", "options": [4], "answer", "explanation", "grammar_category" }
```

**Part 6** (text completion):
```json
{ "id", "passage_type", "passage", "questions": [{ "blank_number", "options", "answer", "explanation" }] }
```

**Part 7** (reading comprehension):
```json
{ "id", "passage_type", "passage", "questions": [{ "question", "options", "answer" }] }
```

## Vocabulary

6,233 headwords merged and deduplicated from four corpus-based word lists:

| List | Words | Scope |
|------|-------|-------|
| NGSL-GR 1.0 | 5,050 | Core general English, covers 98% of general text |
| TSL 1.2 | 1,250 | TOEIC-specific, built from a 1.5M-word corpus of TOEIC material |
| BSL 1.2 | 1,744 | Business English, covers 97% of business text |
| NAWL 1.2 | 957 | Academic words not already in the general list |

TSL combined with the general list covers 98.5% of the TOEIC tests.

Coverage of the merged list: 6,222 entries have an English definition, 6,232 have a Traditional Chinese gloss, 6,163 have phonetics, 4,593 have inflected forms.

Entry format:

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

`lists` maps each source list to that word's rank within it. The top-level `band` is a unified difficulty level from 1 to 12, following the NGSL-GR banding (400 words per band for 1 to 8, 600 for 9 to 11); band 12 holds words outside the core general list.

### Building the vocabulary

`words.json` is not tracked in git. It is derived from CC BY-SA 4.0 data, and that license's ShareAlike term does not fit this repository's proprietary license, so the file is generated locally instead. Build it before the first run, and again whenever a source list is updated:

```bash
uv run scripts/build_vocabulary.py      # download, merge, dedupe, gloss, convert
uv run scripts/check_vocabulary.py      # coverage and Traditional Chinese checks
```

Until it exists the vocabulary endpoints return 503; the Part 5/6/7 question bank works without it.

The build downloads the four word lists plus the ECDICT dictionary (63 MB) into `.cache/vocabulary/`, which is git-ignored. English definitions come from the official easy-English definition files where available (4,777 entries) and from ECDICT for the rest. Chinese glosses come from ECDICT and are converted from Simplified to Traditional Chinese with OpenCC `s2twp` plus a supplementary term map for cases OpenCC gets wrong for Taiwan usage.

## Data sources and licensing

The source code is proprietary, see [LICENSE](LICENSE). The bundled data is not covered by it: each dataset stays under its own open license, listed in [NOTICE](NOTICE) with full attribution.

| Data | Source | License |
|------|--------|---------|
| Word lists, ranks, bands, English definitions | [New General Service List Project](https://www.newgeneralservicelist.com/) | CC BY-SA 4.0 |
| Chinese glosses, phonetics, part of speech | [ECDICT](https://github.com/skywind3000/ECDICT) | MIT |

The word list data carries a ShareAlike term: any redistribution of `backend/data/vocabulary/words.json`, modified or not, must keep the CC BY-SA 4.0 license and the attribution in [backend/data/vocabulary/LICENSE](backend/data/vocabulary/LICENSE).

TOEIC is a registered trademark of Educational Testing Service (ETS). This project is not affiliated with, endorsed by, or sponsored by ETS. The word lists come from published corpus research, not from ETS material.
