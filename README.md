# WIT — Words In Technicolor

A Chrome extension that helps dyslexic readers by color-coding text on any webpage using NLP, with an optional **Director Mode** that highlights words near your cursor to reduce visual crowding.

---

## Prerequisites

| Tool              | Version            | Download                                        |
| ----------------- | ------------------ | ----------------------------------------------- |
| **Python**        | 3.10 or later      | [python.org](https://www.python.org/downloads/) |
| **Node.js**       | 18 or later        | [nodejs.org](https://nodejs.org/)               |
| **Google Chrome** | Any recent version | [chrome.com](https://www.google.com/chrome/)    |

> **Windows users:** make sure "Add Python to PATH" is checked during Python installation.

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/aryashmullick/beyondbinary.git
cd beyondbinary
```

### 2. Install and start the backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

On first run the server will download the required NLTK data automatically.  
The backend runs at **http://127.0.0.1:8742** — keep this terminal open.

You should see:

```
[WIT] Server starting on http://127.0.0.1:8742
```

### 3. Build the Chrome extension

Open a **new terminal** (keep the backend running):

```bash
cd extension
npm install
npm run build
```

This outputs a ready-to-load extension in the `extension/dist` folder.

### 4. Load the extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `extension/dist` folder
5. The WIT icon will appear in your toolbar

### 5. Use it

1. Make sure the **backend terminal is still running**
2. Navigate to any webpage with text
3. The WIT panel appears in the bottom-right corner
4. Toggle **Color Coding** to colorize the page text by part of speech
5. Optionally enable **Director Mode** to highlight words near your cursor

---

## Features

### Color Coding

Analyzes every sentence on the page using NLP (NLTK) and colors each word by its grammatical role:

- **Nouns** → blue
- **Verbs** → green
- **Adjectives** → amber/orange
- **Adverbs** → purple
- **Function words** (the, is, and…) → optionally dimmed

Settings in the panel:

| Setting            | Options                  |
| ------------------ | ------------------------ |
| **Theme**          | Default · Vivid · Pastel |
| **Emphasis**       | Light · Medium · Strong  |
| **Function Words** | Show or dim              |

New content loaded dynamically (infinite scroll, AJAX) is colored automatically.

### Director Mode

Reduces visual crowding by highlighting only the words near your mouse cursor. Everything else fades out, letting you focus on one area at a time.

| Intensity  | Effect                          |
| ---------- | ------------------------------- |
| **Subtle** | Gentle dimming of distant words |
| **Medium** | Moderate focus area             |
| **Strong** | Tight spotlight around cursor   |

---

## Project Structure

```
WIT-new/
├── backend/                  ← Python FastAPI server
│   ├── main.py               ← Server entry point (port 8742)
│   ├── analysis/
│   │   ├── sentence_analyzer.py  ← NLTK NLP pipeline
│   │   ├── color_engine.py       ← Color assignment logic
│   │   └── gaze_processor.py     ← Cursor-based crowding processor
│   └── requirements.txt
├── extension/                ← Chrome Extension (Manifest V3)
│   ├── public/
│   │   └── manifest.json
│   ├── src/
│   │   ├── background/      ← Service worker
│   │   ├── content/          ← Content scripts
│   │   │   ├── colorizer.ts      ← DOM text colorization + MutationObserver
│   │   │   ├── eye-tracker.ts    ← Cursor position tracker
│   │   │   ├── gaze-display.ts   ← Word highlighting near cursor
│   │   │   └── index.ts          ← Content script coordinator
│   │   ├── components/       ← React UI
│   │   │   ├── App.tsx
│   │   │   ├── ColorCodingSettings.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── MinimizedIcon.tsx
│   │   ├── lib/
│   │   │   └── api.ts        ← Backend API client
│   │   └── panel/            ← Panel HTML entry
│   └── package.json
└── data/                     ← Word databases (CSV)
```

---

## Troubleshooting

| Problem                          | Fix                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------- |
| Panel says **"Backend Offline"** | Make sure `python main.py` is running in the `backend/` folder                |
| `pip install` fails              | Try `pip3 install -r requirements.txt` or use a virtual environment           |
| `npm install` fails              | Make sure Node.js 18+ is installed — check with `node -v`                     |
| Extension not showing on page    | Click the WIT icon in the Chrome toolbar, or refresh the page                 |
| Colors don't appear              | Check that the backend terminal has no errors and the panel shows "Connected" |
| Changes after build not showing  | Go to `chrome://extensions/` and click the refresh ↻ button on the WIT card   |

---

## Tech Stack

- **Backend:** Python, FastAPI, NLTK, uvicorn
- **Extension:** TypeScript, React 18, Vite, Tailwind CSS, Framer Motion, Radix UI
- **Chrome:** Manifest V3
- Real-time **connection status** indicator

---

## 🔧 API Reference

| Endpoint              | Method    | Description                         |
| --------------------- | --------- | ----------------------------------- |
| `/api/colorize`       | POST      | Colorize text with NLP analysis     |
| `/api/colorize/batch` | POST      | Batch colorize multiple text blocks |
| `/api/analyze`        | POST      | Raw NLP analysis without colors     |
| `/api/schemes`        | GET       | Available color schemes             |
| `/api/legend`         | GET       | Color legend for a scheme           |
| `/ws/gaze`            | WebSocket | Real-time gaze data processing      |
| `/health`             | GET       | Health check                        |

---

## 📦 Tech Stack

| Component     | Technology                                       |
| ------------- | ------------------------------------------------ |
| Backend       | Python, FastAPI, spaCy, uvicorn                  |
| Extension     | Chrome Manifest V3                               |
| Frontend      | React, TypeScript, Vite                          |
| Styling       | Tailwind CSS, shadcn/ui, Framer Motion           |
| NLP           | spaCy (en_core_web_sm)                           |
| Communication | REST API + WebSocket                             |
