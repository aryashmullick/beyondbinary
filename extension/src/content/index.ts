/**
 * WIT Content Script - Entry point injected into every page.
 * Manages the panel iframe, coordinates colorizer, cursor tracker, and gaze display.
 */

import { colorizeDocument, removeColorization, recolorize } from "./colorizer";
import {
  initCursorTracker,
  startTracking,
  stopTracking,
  destroyCursorTracker,
} from "./eye-tracker";
import {
  initGazeDisplay,
  startGazeDisplay,
  stopGazeDisplay,
  updateGaze,
  setIntensity,
  destroyGazeDisplay,
} from "./gaze-display";

// ─── State ─────────────────────────────────────────────────────────────────────

let panelIframe: HTMLIFrameElement | null = null;

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
          .then(() =>
            sendToPanel({ source: "wit-content", type: "PROCESSING_DONE" }),
          )
          .catch(() =>
            sendToPanel({ source: "wit-content", type: "PROCESSING_DONE" }),
          );
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
        setTimeout(
          () => sendToPanel({ source: "wit-content", type: "PROCESSING_DONE" }),
          2000,
        );
      }
      break;

    case "TOGGLE_DIRECTOR_MODE":
      directorSettings = {
        enabled: msg.enabled,
        crowdingIntensity: msg.crowdingIntensity,
      };
      if (msg.enabled) {
        startDirectorMode();
      } else {
        stopDirectorMode();
      }
      break;

    case "UPDATE_DIRECTOR_SETTINGS":
      directorSettings.crowdingIntensity = msg.crowdingIntensity;
      setIntensity(msg.crowdingIntensity);
      break;
  }
}

function sendToPanel(msg: any): void {
  panelIframe?.contentWindow?.postMessage(msg, "*");
}

// ─── Director Mode ─────────────────────────────────────────────────────────────

function startDirectorMode(): void {
  // Initialize gaze display (client-side word highlighting)
  initGazeDisplay();
  setIntensity(directorSettings.crowdingIntensity);

  // Initialize cursor tracker — mouse position drives highlighting
  initCursorTracker((x, y, _timestamp) => {
    updateGaze(x, y);
  });

  // Start immediately — no webcam, no calibration
  startTracking();
  startGazeDisplay();

  sendToPanel({
    source: "wit-content",
    type: "TRACKING_STATUS",
    active: true,
  });
}

function stopDirectorMode(): void {
  stopTracking();
  stopGazeDisplay();
  destroyCursorTracker();
  destroyGazeDisplay();
  sendToPanel({
    source: "wit-content",
    type: "TRACKING_STATUS",
    active: false,
  });
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
        container.style.display =
          container.style.display === "none" ? "block" : "none";
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
