/**
 * API client for communicating with the WIT Python backend.
 */

const BASE_URL = "http://127.0.0.1:8742";
const WS_URL = "ws://127.0.0.1:8742";

export interface ColorizedToken {
  text: string;
  color: string;
  background: string;
  fontWeight: string;
  opacity: number;
  underline: boolean;
  pos: string;
  sentenceRole: string;
  whitespace: string;
}

export interface ColorizedSentence {
  text: string;
  tokens: ColorizedToken[];
  complexity: string;
}

export interface ColorizeResponse {
  sentences: ColorizedSentence[];
  processing_time_ms: number;
  scheme: string;
}

export interface BatchColorizeResponse {
  results: ColorizedSentence[][];
  count: number;
  processing_time_ms: number;
}

export interface GazeRegion {
  centerX: number;
  centerY: number;
  focusRadius: number;
  transitionRadius: number;
  blurRadius: number;
  fixationDuration: number;
}

export interface CrowdingReduction {
  letterSpacingBoost: number;
  wordSpacingBoost: number;
  lineHeightBoost: number;
  peripheryOpacity: number;
  focusFontScale: number;
  highlightColor: string;
  highlightOpacity: number;
}

export interface GazeUpdate {
  type: "gaze_update";
  region?: GazeRegion;
  crowding?: CrowdingReduction;
  fixation: boolean;
}

export interface LegendItem {
  category: string;
  label: string;
  color: string;
  hsl: string;
}

// ─── HTTP API ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await apiFetch<{ status: string }>("/health");
    return res.status === "ok";
  } catch {
    return false;
  }
}

export async function colorizeText(
  text: string,
  scheme: string = "default",
  emphasis: string = "normal",
  showFunctionWords: boolean = true
): Promise<ColorizeResponse> {
  return apiFetch<ColorizeResponse>("/api/colorize", {
    method: "POST",
    body: JSON.stringify({
      text,
      scheme,
      emphasis,
      show_function_words: showFunctionWords,
    }),
  });
}

export async function colorizeBatch(
  texts: string[],
  scheme: string = "default",
  emphasis: string = "normal",
  showFunctionWords: boolean = true
): Promise<BatchColorizeResponse> {
  return apiFetch<BatchColorizeResponse>("/api/colorize/batch", {
    method: "POST",
    body: JSON.stringify({
      texts,
      scheme,
      emphasis,
      show_function_words: showFunctionWords,
    }),
  });
}

export async function getLegend(scheme: string = "default"): Promise<LegendItem[]> {
  const res = await apiFetch<{ legend: LegendItem[] }>(`/api/legend?scheme=${scheme}`);
  return res.legend;
}

export async function getSchemes(): Promise<Record<string, any>> {
  const res = await apiFetch<{ schemes: Record<string, any> }>("/api/schemes");
  return res.schemes;
}

// ─── WebSocket Gaze API ────────────────────────────────────────────────────────

export class GazeWebSocket {
  private ws: WebSocket | null = null;
  private onUpdate: ((update: GazeUpdate) => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionallyClosed = false;

  connect(onUpdate: (update: GazeUpdate) => void): void {
    this.onUpdate = onUpdate;
    this.isIntentionallyClosed = false;
    this._connect();
  }

  private _connect(): void {
    if (this.isIntentionallyClosed) return;

    try {
      this.ws = new WebSocket(`${WS_URL}/ws/gaze`);

      this.ws.onopen = () => {
        console.log("[WIT] Gaze WebSocket connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as GazeUpdate;
          this.onUpdate?.(data);
        } catch (e) {
          console.error("[WIT] Failed to parse gaze message:", e);
        }
      };

      this.ws.onclose = () => {
        if (!this.isIntentionallyClosed) {
          console.log("[WIT] Gaze WebSocket disconnected, reconnecting...");
          this.reconnectTimer = setTimeout(() => this._connect(), 2000);
        }
      };

      this.ws.onerror = (err) => {
        console.error("[WIT] Gaze WebSocket error:", err);
      };
    } catch (e) {
      console.error("[WIT] Failed to create WebSocket:", e);
    }
  }

  sendGaze(x: number, y: number, timestamp?: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "gaze",
        x,
        y,
        timestamp: timestamp ?? Date.now(),
      }));
    }
  }

  sendConfig(config: {
    fixationThreshold?: number;
    fixationMinDuration?: number;
    smoothingWindow?: number;
    crowdingIntensity?: string;
  }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "config",
        config,
      }));
    }
  }

  reset(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "reset" }));
    }
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
