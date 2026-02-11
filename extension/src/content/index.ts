/**
 * WIT Content Script - Entry point injected into every page.
 * Manages the panel iframe, coordinates colorizer, eye tracker, and gaze display.
 */

import { colorizeDocument, removeColorization, recolorize } from "./colorizer";
import { initEyeTracker, startTracking, stopTracking, runCalibration, destroyEyeTracker } from "./eye-tracker";
import { initGazeDisplay, startGazeDisplay, stopGazeDisplay, updateGazeDisplay, destroyGazeDisplay } from "./gaze-display";
import { GazeWebSocket, type GazeUpdate } from "@/lib/api";

// ─── State ─────────────────────────────────────────────────────────────────────

let panelIframe: HTMLIFrameElement | null = null;
let gazeWs: GazeWebSocket | null = null;

// Settings
let colorSettings = {
  enabled: false,
  scheme: "default",
  emphasis: "normal",
  showFunctionWords: true,
};

let directorSettings = {
  enabled: false,
  crowdingIntensity: "medium",
  gazeSmoothing: 5,
};

// ─── Panel Injection ───────────────────────────────────────────────────────────

function injectPanel(): void {
  // Create panel container
  const container = document.createElement("div");
  container.id = "wit-panel-container";
  container.className = "wit-panel-container";

  // Create iframe for the panel (isolates styles)
  panelIframe = document.createElement("iframe");
  panelIframe.id = "wit-panel-iframe";
  panelIframe.style.cssText = `
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: 400px;
    height: 100vh;
    border: none;
    z-index: 999999;
    background: transparent;
    pointer-events: auto;
    color-scheme: light;
  `;

  // Get the panel HTML URL from the extension
  const panelUrl = chrome.runtime.getURL("src/panel/index.html");
  panelIframe.src = panelUrl;

  container.appendChild(panelIframe);
  document.body.appendChild(container);
}

// ─── Message Handling ──────────────────────────────────────────────────────────

function handlePanelMessage(event: MessageEvent): void {
  if (event.data?.source !== "wit-panel") return;

  const msg = event.data;

  switch (msg.type) {
    case "TOGGLE_COLOR_CODING":
      colorSettings = {
        enabled: msg.enabled,
        scheme: msg.scheme,
        emphasis: msg.emphasis,
        showFunctionWords: msg.showFunctionWords,
      };
      if (msg.enabled) {
        sendToPanel({ source: "wit-content", type: "PROCESSING_START" });
        colorizeDocument(msg.scheme, msg.emphasis, msg.showFunctionWords)
          .then(() => sendToPanel({ source: "wit-content", type: "PROCESSING_DONE" }))
          .catch(() => sendToPanel({ source: "wit-content", type: "PROCESSING_DONE" }));
      } else {
        removeColorization();
      }
      break;

    case "UPDATE_COLOR_SETTINGS":
      colorSettings.scheme = msg.scheme;
      colorSettings.emphasis = msg.emphasis;
      colorSettings.showFunctionWords = msg.showFunctionWords;
      if (colorSettings.enabled) {
        sendToPanel({ source: "wit-content", type: "PROCESSING_START" });
        recolorize(msg.scheme, msg.emphasis, msg.showFunctionWords);
        // The recolorize is debounced, we'll just clear processing after a delay
        setTimeout(() => sendToPanel({ source: "wit-content", type: "PROCESSING_DONE" }), 2000);
      }
      break;

    case "TOGGLE_DIRECTOR_MODE":
      directorSettings = {
        enabled: msg.enabled,
        crowdingIntensity: msg.crowdingIntensity,
        gazeSmoothing: msg.gazeSmoothing,
      };
      if (msg.enabled) {
        startDirectorMode();
      } else {
        stopDirectorMode();
      }
      break;

    case "UPDATE_DIRECTOR_SETTINGS":
      directorSettings.crowdingIntensity = msg.crowdingIntensity;
      directorSettings.gazeSmoothing = msg.gazeSmoothing;
      // Update WebSocket config
      gazeWs?.sendConfig({
        crowdingIntensity: msg.crowdingIntensity,
        smoothingWindow: msg.gazeSmoothing,
      });
      break;

    case "START_CALIBRATION":
      runCalibration(() => {
        sendToPanel({ source: "wit-content", type: "CALIBRATION_DONE" });
      });
      break;
  }
}

function sendToPanel(msg: any): void {
  panelIframe?.contentWindow?.postMessage(msg, "*");
}

// ─── Director Mode ─────────────────────────────────────────────────────────────

async function startDirectorMode(): Promise<void> {
  // Initialize gaze display
  initGazeDisplay();

  // Initialize gaze WebSocket
  gazeWs = new GazeWebSocket();
  gazeWs.connect((update: GazeUpdate) => {
    updateGazeDisplay(update);
  });

  // Initialize eye tracker
  const success = await initEyeTracker(
    // Gaze callback - send to backend via WebSocket
    (x, y, timestamp) => {
      gazeWs?.sendGaze(x, y, timestamp);
    },
    // Status callback
    (status) => {
      sendToPanel({ source: "wit-content", type: "WEBCAM_STATUS", status });
    }
  );

  if (success) {
    const trackingStarted = await startTracking();
    if (trackingStarted) {
      startGazeDisplay();
      sendToPanel({ source: "wit-content", type: "TRACKING_STATUS", active: true });

      // Configure gaze processing
      gazeWs?.sendConfig({
        crowdingIntensity: directorSettings.crowdingIntensity,
        smoothingWindow: directorSettings.gazeSmoothing,
      });
    }
  }
}

function stopDirectorMode(): void {
  stopTracking();
  stopGazeDisplay();
  gazeWs?.disconnect();
  gazeWs = null;
  destroyEyeTracker();
  destroyGazeDisplay();
  sendToPanel({ source: "wit-content", type: "TRACKING_STATUS", active: false });
}

// ─── Initialization ────────────────────────────────────────────────────────────

function init(): void {
  // Don't inject into extension pages or iframes
  if (window !== window.top) return;
  if (window.location.protocol === "chrome-extension:") return;

  // Inject the panel
  injectPanel();

  // Listen for messages from the panel
  window.addEventListener("message", handlePanelMessage);

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "TOGGLE_PANEL") {
      const container = document.getElementById("wit-panel-container");
      if (container) {
        container.style.display = container.style.display === "none" ? "block" : "none";
      }
      sendResponse({ success: true });
    }
  });

  console.log("[WIT] Content script initialized");
}

// Run on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
