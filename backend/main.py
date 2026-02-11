"""
WIT Backend - FastAPI server for dyslexia reading assistance.
Provides NLP-based text analysis, color coding, and gaze processing.
"""

import os
import time
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
import orjson

from analysis.sentence_analyzer import analyze_text, analyze_batch
from analysis.color_engine import (
    colorize_text,
    colorize_batch,
    get_available_schemes,
    get_legend,
)
from analysis.gaze_processor import (
    GazeProcessor,
    compute_crowding_reduction,
    gaze_region_to_dict,
)


# ─── Pydantic Models ───────────────────────────────────────────────────────────

class ColorizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    scheme: str = Field(default="default", pattern=r"^(default|high_contrast|pastel)$")
    emphasis: str = Field(default="normal", pattern=r"^(normal|medium|high)$")
    show_function_words: bool = True


class BatchColorizeRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=200)
    scheme: str = Field(default="default")
    emphasis: str = Field(default="normal")
    show_function_words: bool = True


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)


class GazeDataPoint(BaseModel):
    x: float
    y: float
    timestamp: Optional[float] = None


class GazeConfigRequest(BaseModel):
    fixation_threshold_px: float = 30.0
    fixation_min_duration_ms: float = 100.0
    smoothing_window: int = 5
    crowding_intensity: str = Field(default="medium", pattern=r"^(low|medium|high)$")


# ─── App Lifecycle ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Download NLTK data on startup for fast first requests."""
    from analysis.sentence_analyzer import ensure_nltk_data
    print("[WIT] Downloading NLTK data...")
    ensure_nltk_data()
    print("[WIT] NLTK ready. Server ready.")
    yield
    print("[WIT] Shutting down WIT backend.")


# ─── FastAPI App ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="WIT - Words In Technicolor",
    description="Backend API for the WIT dyslexia reading assistance extension",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow extension to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Chrome extensions use chrome-extension:// origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files (WebGazer + tracker page)
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Store active gaze processors per WebSocket connection
gaze_processors: dict[str, tuple[GazeProcessor, str]] = {}


# ─── Eye Tracker Page ──────────────────────────────────────────────────────────

@app.get("/eye-tracker", response_class=HTMLResponse)
async def eye_tracker_page():
    """
    Serve the WebGazer eye-tracker page.
    Runs on localhost (secure context → getUserMedia works)
    with no extension CSP (eval() from TF.js / numeric.js is allowed).
    """
    html_path = STATIC_DIR / "eye-tracker.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


# ─── Health & Info ──────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "WIT Backend",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": time.time()}


# ─── Color Coding Endpoints ────────────────────────────────────────────────────

@app.post("/api/colorize")
async def colorize(request: ColorizeRequest):
    """
    Colorize text using NLP sentence-level analysis.
    Returns colored tokens grouped by sentence.
    """
    start = time.time()

    result = colorize_text(
        text=request.text,
        scheme=request.scheme,
        emphasis=request.emphasis,
        show_function_words=request.show_function_words,
    )

    elapsed = round((time.time() - start) * 1000, 1)

    return {
        "sentences": result,
        "processing_time_ms": elapsed,
        "scheme": request.scheme,
    }


@app.post("/api/colorize/batch")
async def colorize_batch_endpoint(request: BatchColorizeRequest):
    """
    Batch colorize multiple text blocks efficiently.
    Used when processing large pages with many text nodes.
    """
    start = time.time()

    results = colorize_batch(
        texts=request.texts,
        scheme=request.scheme,
        emphasis=request.emphasis,
        show_function_words=request.show_function_words,
    )

    elapsed = round((time.time() - start) * 1000, 1)

    return {
        "results": results,
        "count": len(results),
        "processing_time_ms": elapsed,
    }


@app.post("/api/analyze")
async def analyze(request: AnalyzeRequest):
    """
    Analyze text without colorizing. Returns raw NLP analysis.
    Useful for debugging or building custom color schemes.
    """
    sentences = analyze_text(request.text)
    return {
        "sentences": [s.to_dict() for s in sentences],
    }


@app.get("/api/schemes")
async def schemes():
    """Get all available color schemes."""
    return {"schemes": get_available_schemes()}


@app.get("/api/legend")
async def legend(scheme: str = "default"):
    """Get the color legend for a specific scheme."""
    return {"legend": get_legend(scheme)}


# ─── Gaze Tracking WebSocket ───────────────────────────────────────────────────

@app.websocket("/ws/gaze")
async def gaze_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time gaze data processing.
    
    Client sends gaze coordinates, server responds with:
    - Fixation detection results
    - Visual crowding reduction parameters
    - Gaze region information for display modification
    """
    await websocket.accept()
    
    # Create a processor for this connection
    connection_id = str(id(websocket))
    processor = GazeProcessor()
    crowding_intensity = "medium"
    gaze_processors[connection_id] = (processor, crowding_intensity)

    try:
        while True:
            data = await websocket.receive_text()
            message = orjson.loads(data)

            msg_type = message.get("type", "gaze")

            if msg_type == "config":
                # Update processor configuration
                config = message.get("config", {})
                processor = GazeProcessor(
                    fixation_threshold_px=config.get("fixationThreshold", 30.0),
                    fixation_min_duration_ms=config.get("fixationMinDuration", 100.0),
                    smoothing_window=config.get("smoothingWindow", 5),
                )
                crowding_intensity = config.get("crowdingIntensity", "medium")
                gaze_processors[connection_id] = (processor, crowding_intensity)

                await websocket.send_text(orjson.dumps({
                    "type": "config_ack",
                    "status": "ok",
                }).decode())

            elif msg_type == "gaze":
                # Process gaze point
                x = message.get("x", 0)
                y = message.get("y", 0)
                ts = message.get("timestamp")

                region = processor.add_gaze_point(x, y, ts)

                if region:
                    crowding = compute_crowding_reduction(region, crowding_intensity)
                    await websocket.send_text(orjson.dumps({
                        "type": "gaze_update",
                        "region": gaze_region_to_dict(region),
                        "crowding": crowding.to_dict(),
                        "fixation": True,
                    }).decode())
                else:
                    await websocket.send_text(orjson.dumps({
                        "type": "gaze_update",
                        "fixation": False,
                    }).decode())

            elif msg_type == "reset":
                processor.reset()
                await websocket.send_text(orjson.dumps({
                    "type": "reset_ack",
                    "status": "ok",
                }).decode())

    except WebSocketDisconnect:
        pass
    finally:
        gaze_processors.pop(connection_id, None)


# ─── Entry Point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("WIT_PORT", 8742))
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=port,
        reload=True,
        log_level="info",
    )
