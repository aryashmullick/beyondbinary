/**
 * Eye Tracker - WebGazer.js integration for eye tracking.
 * Handles webcam initialization, calibration, and gaze data streaming.
 */

// WebGazer types (minimal)
declare global {
  interface Window {
    webgazer?: {
      setGazeListener: (callback: (data: { x: number; y: number } | null, elapsedTime: number) => void) => any;
      begin: () => Promise<any>;
      end: () => void;
      pause: () => void;
      resume: () => void;
      showVideoPreview: (show: boolean) => any;
      showPredictionPoints: (show: boolean) => any;
      showFaceOverlay: (show: boolean) => any;
      showFaceFeedbackBox: (show: boolean) => any;
      setRegression: (type: string) => any;
      setTracker: (type: string) => any;
      isReady: () => boolean;
      clearData: () => void;
      addMouseEventListeners: () => void;
      removeMouseEventListeners: () => void;
      params: {
        showVideoPreview: boolean;
      };
    };
  }
}

type GazeCallback = (x: number, y: number, timestamp: number) => void;
type StatusCallback = (status: "unavailable" | "permission_denied" | "ready" | "active") => void;

let gazeCallback: GazeCallback | null = null;
let statusCallback: StatusCallback | null = null;
let isInitialized = false;
let isTracking = false;

/**
 * Load WebGazer.js dynamically.
 */
async function loadWebGazer(): Promise<void> {
  if (window.webgazer) return;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://webgazer.cs.brown.edu/webgazer.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load WebGazer.js"));
    document.head.appendChild(script);
  });
}

/**
 * Initialize the eye tracker.
 */
export async function initEyeTracker(
  onGaze: GazeCallback,
  onStatus: StatusCallback
): Promise<boolean> {
  gazeCallback = onGaze;
  statusCallback = onStatus;

  try {
    await loadWebGazer();

    if (!window.webgazer) {
      onStatus("unavailable");
      return false;
    }

    // Check webcam permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      onStatus("permission_denied");
      return false;
    }

    // Configure WebGazer
    window.webgazer
      .setRegression("ridge")
      .showVideoPreview(false)
      .showPredictionPoints(false)
      .showFaceOverlay(false)
      .showFaceFeedbackBox(false);

    // Set gaze listener
    window.webgazer.setGazeListener((data, elapsedTime) => {
      if (data == null) return;
      gazeCallback?.(data.x, data.y, Date.now());
    });

    isInitialized = true;
    onStatus("ready");
    return true;
  } catch (err) {
    console.error("[WIT] Eye tracker init error:", err);
    onStatus("unavailable");
    return false;
  }
}

/**
 * Start eye tracking.
 */
export async function startTracking(): Promise<boolean> {
  if (!isInitialized || !window.webgazer) return false;

  try {
    await window.webgazer.begin();
    isTracking = true;
    statusCallback?.("active");

    // Hide the video preview that WebGazer shows
    const videoEl = document.getElementById("webgazerVideoFeed");
    if (videoEl) {
      videoEl.style.display = "none";
    }
    const videoContainer = document.getElementById("webgazerVideoContainer");
    if (videoContainer) {
      videoContainer.style.display = "none";
    }

    return true;
  } catch (err) {
    console.error("[WIT] Start tracking error:", err);
    return false;
  }
}

/**
 * Stop eye tracking.
 */
export function stopTracking(): void {
  if (!window.webgazer) return;
  try {
    window.webgazer.end();
  } catch {}
  isTracking = false;
  statusCallback?.("ready");
}

/**
 * Pause tracking (e.g., during calibration UI).
 */
export function pauseTracking(): void {
  if (!window.webgazer || !isTracking) return;
  window.webgazer.pause();
}

/**
 * Resume tracking.
 */
export function resumeTracking(): void {
  if (!window.webgazer || !isTracking) return;
  window.webgazer.resume();
}

/**
 * Run calibration sequence.
 * Shows dots for the user to look at and click.
 */
export async function runCalibration(onComplete: () => void): Promise<void> {
  if (!window.webgazer || !isTracking) {
    onComplete();
    return;
  }

  // Calibration points (9-point grid)
  const points = [
    { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 },
    { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
    { x: 10, y: 90 }, { x: 50, y: 90 }, { x: 90, y: 90 },
  ];

  // Create calibration overlay
  const overlay = document.createElement("div");
  overlay.id = "wit-calibration-overlay";
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    z-index: 9999999; background: rgba(0, 0, 0, 0.85);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Inter', system-ui, sans-serif;
  `;

  // Instructions
  const instructions = document.createElement("div");
  instructions.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    color: white; font-size: 1.25rem; text-align: center; z-index: 2;
    max-width: 400px; line-height: 1.6;
  `;
  instructions.innerHTML = `
    <div style="font-size: 2rem; margin-bottom: 16px;">👁️</div>
    <p style="font-weight: 600; margin-bottom: 8px;">Calibration</p>
    <p style="font-size: 0.9rem; opacity: 0.8;">Look at each dot and click it. This helps track your eyes accurately.</p>
    <p style="font-size: 0.8rem; opacity: 0.6; margin-top: 12px;">Click anywhere to begin</p>
  `;
  overlay.appendChild(instructions);

  document.body.appendChild(overlay);

  // Wait for user to click to start
  await new Promise<void>((resolve) => {
    overlay.addEventListener("click", () => resolve(), { once: true });
  });

  instructions.remove();

  // Show calibration points one by one
  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    const dot = document.createElement("div");
    dot.style.cssText = `
      position: absolute;
      left: ${point.x}%; top: ${point.y}%;
      transform: translate(-50%, -50%);
      width: 30px; height: 30px;
      border-radius: 50%;
      background: radial-gradient(circle, #4A6FA5 0%, #7B9E6B 100%);
      cursor: pointer;
      transition: transform 0.2s;
      box-shadow: 0 0 20px rgba(74, 111, 165, 0.5);
    `;

    // Counter
    const counter = document.createElement("div");
    counter.style.cssText = `
      position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
      color: white; font-size: 0.85rem; opacity: 0.6;
    `;
    counter.textContent = `${i + 1} / ${points.length}`;

    overlay.appendChild(dot);
    overlay.appendChild(counter);

    // Wait for click
    await new Promise<void>((resolve) => {
      dot.addEventListener("click", () => {
        dot.style.transform = "translate(-50%, -50%) scale(0.5)";
        dot.style.opacity = "0.3";
        setTimeout(() => {
          dot.remove();
          counter.remove();
          resolve();
        }, 200);
      });
    });
  }

  // Done
  const doneMsg = document.createElement("div");
  doneMsg.style.cssText = `
    position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
    color: white; font-size: 1.5rem; font-weight: 600; text-align: center;
  `;
  doneMsg.innerHTML = "✅ Calibration Complete!";
  overlay.appendChild(doneMsg);

  setTimeout(() => {
    overlay.remove();
    onComplete();
  }, 1200);
}

/**
 * Check if tracking is currently active.
 */
export function isTrackingActive(): boolean {
  return isTracking;
}

/**
 * Cleanup everything.
 */
export function destroyEyeTracker(): void {
  stopTracking();
  gazeCallback = null;
  statusCallback = null;
  isInitialized = false;
}
