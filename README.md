# WIT - Words In Technicolor

> **Dyslexia reading assistance browser extension** — Color-coded text, eye tracking, and gaze-contingent display to help dyslexic readers navigate the web.

---

## 🏗️ Architecture

```
WIT-new/
├── backend/           ← Python FastAPI server (NLP engine)
│   ├── main.py        ← API server entry point
│   ├── analysis/
│   │   ├── sentence_analyzer.py   ← spaCy NLP pipeline
│   │   ├── color_engine.py        ← Color assignment engine
│   │   └── gaze_processor.py      ← Eye tracking processor
│   └── requirements.txt
├── extension/         ← Chrome Extension (React + Vite + Tailwind)
│   ├── public/
│   │   └── manifest.json          ← Manifest V3
│   ├── src/
│   │   ├── background/            ← Service worker
│   │   ├── content/               ← Content scripts (DOM manipulation)
│   │   │   ├── colorizer.ts       ← Text color coding
│   │   │   ├── eye-tracker.ts     ← WebGazer.js integration
│   │   │   └── gaze-display.ts    ← Gaze-contingent display
│   │   ├── components/            ← React UI components
│   │   │   ├── App.tsx            ← Main panel
│   │   │   ├── ColorCodingSettings.tsx
│   │   │   ├── DirectorMode.tsx
│   │   │   └── ui/               ← shadcn/ui components
│   │   ├── lib/
│   │   │   ├── api.ts             ← Backend API client
│   │   │   └── utils.ts           ← Utilities
│   │   └── panel/                 ← Panel HTML entry
│   └── package.json
└── data/              ← Word databases (CSV)
```

## 🚀 Quick Start

### 1. Start the Backend

```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python main.py
```

Backend runs at `http://127.0.0.1:8742`

### 2. Build the Extension

```bash
cd extension
npm install
npm run build
```

### 3. Load in Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load Unpacked**
4. Select the `extension/dist` folder

---

## ✨ Features

### 🎨 Feature 1: Intelligent Color Coding
- **Sentence-level NLP analysis** — not just word database lookup
- Uses spaCy for POS tagging, dependency parsing, and named entity recognition
- Colors reflect **word type** (nouns=blue, verbs=green, adjectives=amber, etc.)
- Sentence **role** modulates color shade (subjects darker, objects lighter)
- **3 color schemes**: Default, High Contrast, Pastel
- **3 emphasis levels**: Normal, Medium (bolded subjects), High (bold + underlines)
- Option to dim function words (the, is, and...) for focus on content words

### 👁️ Feature 2: Director Mode (Eye Tracking)
- **WebGazer.js** webcam-based eye tracking
- Real-time **gaze-contingent display** to reduce visual crowding
- **Fixation detection** with velocity-threshold algorithm
- When you fixate on text:
  - Focused words get **increased letter/word spacing**
  - Focused text gets a **subtle size boost**
  - Peripheral text gets **reduced opacity**
  - A gentle **vignette effect** draws focus
- 9-point **calibration** UI
- Adjustable **focus intensity** and **gaze smoothing**

### 🎯 UI
- **Side panel** that auto-opens on any website
- **Minimizable** to a floating circular icon
- Built with **shadcn/ui + Radix UI + Framer Motion + Tailwind**
- **Dyslexia-friendly** design: warm colors, large text, clear contrast
- Real-time **connection status** indicator

---

## 🔧 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/colorize` | POST | Colorize text with NLP analysis |
| `/api/colorize/batch` | POST | Batch colorize multiple text blocks |
| `/api/analyze` | POST | Raw NLP analysis without colors |
| `/api/schemes` | GET | Available color schemes |
| `/api/legend` | GET | Color legend for a scheme |
| `/ws/gaze` | WebSocket | Real-time gaze data processing |
| `/health` | GET | Health check |

---

## 📦 Tech Stack

| Component | Technology |
|---|---|
| Backend | Python, FastAPI, spaCy, uvicorn |
| Extension | Chrome Manifest V3 |
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, Framer Motion |
| Eye Tracking | WebGazer.js (client) + custom processor (server) |
| NLP | spaCy (en_core_web_sm) |
| Communication | REST API + WebSocket |
