(function() {
  "use strict";
  const BASE_URL = "http://127.0.0.1:8742";
  async function apiFetch(path, options) {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
  async function colorizeBatch(texts, scheme = "default", emphasis = "normal", showFunctionWords = true) {
    return apiFetch("/api/colorize/batch", {
      method: "POST",
      body: JSON.stringify({
        texts,
        scheme,
        emphasis,
        show_function_words: showFunctionWords
      })
    });
  }
  const SKIP_TAGS = /* @__PURE__ */ new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "SVG",
    "CANVAS",
    "VIDEO",
    "AUDIO",
    "IMG",
    "BR",
    "HR",
    "INPUT",
    "TEXTAREA",
    "SELECT",
    "BUTTON",
    "CODE",
    "PRE",
    "WIT-PANEL",
    "WIT-OVERLAY"
  ]);
  const SKIP_CLASSES = /* @__PURE__ */ new Set([
    "wit-colored",
    "wit-panel-container",
    "wit-gaze-overlay"
  ]);
  let coloredNodes = [];
  let isColorizing = false;
  function getTextNodes(root) {
    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node2) {
        var _a, _b;
        const parent = node2.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest("[contenteditable]")) return NodeFilter.FILTER_REJECT;
        for (const cls of SKIP_CLASSES) {
          if ((_a = parent.classList) == null ? void 0 : _a.contains(cls)) return NodeFilter.FILTER_REJECT;
        }
        if (!((_b = node2.textContent) == null ? void 0 : _b.trim())) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    return textNodes;
  }
  function batchTextNodes(nodes, maxBatchSize = 100) {
    const batches = [];
    for (let i = 0; i < nodes.length; i += maxBatchSize) {
      batches.push(nodes.slice(i, i + maxBatchSize));
    }
    return batches;
  }
  function createColoredSpan(token) {
    const span = document.createElement("span");
    span.className = "wit-colored";
    span.textContent = token.text + token.whitespace;
    span.style.color = token.color;
    span.style.fontWeight = token.fontWeight;
    span.style.opacity = String(token.opacity);
    if (token.underline) {
      span.style.textDecoration = "underline";
      span.style.textDecorationColor = token.color;
      span.style.textUnderlineOffset = "3px";
    }
    span.dataset.pos = token.pos;
    span.dataset.role = token.sentenceRole;
    return span;
  }
  function replaceTextNode(textNode, sentences) {
    const parent = textNode.parentNode;
    if (!parent) return null;
    const container = document.createDocumentFragment();
    for (const sentence of sentences) {
      for (const token of sentence.tokens) {
        const span = createColoredSpan(token);
        container.appendChild(span);
      }
    }
    if (container.childNodes.length === 0) return null;
    const wrapper = document.createElement("span");
    wrapper.className = "wit-colored-wrapper";
    wrapper.appendChild(container);
    parent.replaceChild(wrapper, textNode);
    return {
      parent,
      original: textNode,
      replacement: wrapper
    };
  }
  async function colorizeDocument(scheme = "default", emphasis = "normal", showFunctionWords = true, onProgress) {
    if (isColorizing) return;
    isColorizing = true;
    try {
      removeColorization();
      const textNodes = getTextNodes(document.body);
      if (textNodes.length === 0) {
        isColorizing = false;
        return;
      }
      const batches = batchTextNodes(textNodes, 80);
      let processed = 0;
      for (const batch of batches) {
        const texts = batch.map((node) => node.textContent || "");
        try {
          const response = await colorizeBatch(
            texts,
            scheme,
            emphasis,
            showFunctionWords
          );
          for (let i = 0; i < batch.length; i++) {
            const sentences = response.results[i];
            if (sentences && sentences.length > 0) {
              const record = replaceTextNode(batch[i], sentences);
              if (record) {
                coloredNodes.push(record);
              }
            }
          }
        } catch (err) {
          console.error("[WIT] Batch colorize error:", err);
        }
        processed += batch.length;
        onProgress == null ? void 0 : onProgress(processed / textNodes.length);
      }
    } finally {
      isColorizing = false;
    }
  }
  function removeColorization() {
    for (const record of coloredNodes) {
      try {
        if (record.replacement.parentNode) {
          record.replacement.parentNode.replaceChild(
            record.original,
            record.replacement
          );
        }
      } catch (e) {
      }
    }
    coloredNodes = [];
    document.querySelectorAll(".wit-colored-wrapper").forEach((el) => {
      var _a;
      const text = el.textContent || "";
      const textNode = document.createTextNode(text);
      (_a = el.parentNode) == null ? void 0 : _a.replaceChild(textNode, el);
    });
  }
  let recolorizeTimer = null;
  function recolorize(scheme, emphasis, showFunctionWords) {
    if (recolorizeTimer) clearTimeout(recolorizeTimer);
    recolorizeTimer = setTimeout(() => {
      colorizeDocument(scheme, emphasis, showFunctionWords);
    }, 300);
  }
  let gazeCallback = null;
  let mouseMoveHandler = null;
  let isTracking = false;
  function initCursorTracker(onGaze) {
    gazeCallback = onGaze;
  }
  function startTracking() {
    if (isTracking) return;
    isTracking = true;
    mouseMoveHandler = (e) => {
      gazeCallback == null ? void 0 : gazeCallback(e.clientX, e.clientY, Date.now());
    };
    window.addEventListener("mousemove", mouseMoveHandler, { passive: true });
  }
  function stopTracking() {
    if (!isTracking) return;
    isTracking = false;
    if (mouseMoveHandler) {
      window.removeEventListener("mousemove", mouseMoveHandler);
      mouseMoveHandler = null;
    }
  }
  function destroyCursorTracker() {
    stopTracking();
    gazeCallback = null;
  }
  const FOCUS_RADIUS = 90;
  const TRANSITION_RADIUS = 180;
  const DIM_OPACITY = 0.45;
  const RING_SIZE = 8;
  const HIGHLIGHT_BG = "rgba(255, 249, 196, 0.45)";
  const HIGHLIGHT_BG_STRONG = "rgba(255, 240, 140, 0.65)";
  const UNDERLINE_COLOR = "rgba(74, 111, 165, 0.5)";
  let intensityMult = 1;
  let focusDot = null;
  let cursorStyleEl = null;
  let isActive = false;
  let animFrame = null;
  let wordCache = [];
  let cacheValid = false;
  let scrollHandler = null;
  let resizeObserver = null;
  let highlightedWords = /* @__PURE__ */ new Set();
  function parseColor(css) {
    const el = document.createElement("div");
    el.style.color = css;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    el.remove();
    const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
  }
  function luminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  function contrastingHighlight(textColor, strong) {
    if (!textColor) {
      return {
        bg: strong ? HIGHLIGHT_BG_STRONG : HIGHLIGHT_BG,
        underline: UNDERLINE_COLOR
      };
    }
    const rgb = parseColor(textColor);
    if (!rgb) {
      return {
        bg: strong ? HIGHLIGHT_BG_STRONG : HIGHLIGHT_BG,
        underline: UNDERLINE_COLOR
      };
    }
    const lum = luminance(...rgb);
    const alpha = strong ? 0.28 : 0.18;
    if (lum > 0.4) {
      return {
        bg: `rgba(30, 40, 70, ${alpha})`,
        underline: `rgba(30, 40, 70, 0.45)`
      };
    } else if (lum > 0.15) {
      return {
        bg: `rgba(255, 249, 196, ${alpha + 0.1})`,
        underline: `rgba(120, 100, 30, 0.4)`
      };
    } else {
      return {
        bg: `rgba(255, 240, 140, ${alpha + 0.15})`,
        underline: `rgba(74, 111, 165, 0.5)`
      };
    }
  }
  function rebuildWordCache() {
    var _a, _b;
    wordCache = [];
    const colored = document.querySelectorAll("span.wit-colored");
    if (colored.length > 0) {
      for (const span of colored) {
        const r = span.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          wordCache.push({
            el: span,
            cx: r.left + r.width / 2,
            cy: r.top + r.height / 2
          });
        }
      }
      cacheValid = true;
      return;
    }
    const existing = document.querySelectorAll("span.wit-word");
    if (existing.length > 0) {
      for (const span of existing) {
        const r = span.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          wordCache.push({
            el: span,
            cx: r.left + r.width / 2,
            cy: r.top + r.height / 2
          });
        }
      }
      if (wordCache.length > 0) {
        cacheValid = true;
        return;
      }
    }
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node2) {
          const parent = node2.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest(
            "#wit-panel-container, #wit-panel-iframe, #wit-tracker-iframe, #wit-gaze-overlay, #wit-focus-dot, script, style, noscript, svg, canvas"
          ))
            return NodeFilter.FILTER_REJECT;
          if (parent.classList.contains("wit-word"))
            return NodeFilter.FILTER_REJECT;
          const text = node2.textContent;
          if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
          const rect = parent.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0)
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) textNodes.push(node);
    for (const tn of textNodes) {
      const text = tn.textContent || "";
      const parts = text.match(/\S+|\s+/g);
      if (!parts || parts.length <= 1) {
        if (text.trim()) {
          const span = document.createElement("span");
          span.className = "wit-word";
          span.textContent = text;
          (_a = tn.parentNode) == null ? void 0 : _a.replaceChild(span, tn);
          const r = span.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            wordCache.push({
              el: span,
              cx: r.left + r.width / 2,
              cy: r.top + r.height / 2
            });
          }
        }
        continue;
      }
      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          const span = document.createElement("span");
          span.className = "wit-word";
          span.textContent = part;
          frag.appendChild(span);
        }
      }
      (_b = tn.parentNode) == null ? void 0 : _b.replaceChild(frag, tn);
    }
    const allWords = document.querySelectorAll("span.wit-word");
    for (const span of allWords) {
      const r = span.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        wordCache.push({
          el: span,
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2
        });
      }
    }
    cacheValid = true;
  }
  function invalidateCache() {
    cacheValid = false;
  }
  function initGazeDisplay() {
    focusDot = document.createElement("div");
    focusDot.id = "wit-focus-dot";
    focusDot.style.cssText = `
    position: fixed;
    width: ${RING_SIZE}px; height: ${RING_SIZE}px;
    border-radius: 50%;
    background: rgba(74, 111, 165, 0.5);
    pointer-events: none;
    z-index: 999991;
    transform: translate(-50%, -50%);
    transition: left 0.06s linear, top 0.06s linear;
    opacity: 0;
    box-shadow: 0 0 6px rgba(74, 111, 165, 0.3);
  `;
    document.body.appendChild(focusDot);
    cursorStyleEl = document.createElement("style");
    cursorStyleEl.id = "wit-cursor-hide";
    cursorStyleEl.textContent = `
    html, html *, body, body * {
      cursor: none !important;
    }
  `;
    scrollHandler = () => invalidateCache();
    window.addEventListener("scroll", scrollHandler, {
      passive: true,
      capture: true
    });
    window.addEventListener("resize", scrollHandler, { passive: true });
    resizeObserver = new ResizeObserver(() => invalidateCache());
    resizeObserver.observe(document.body);
  }
  function startGazeDisplay() {
    isActive = true;
    if (focusDot) focusDot.style.opacity = "1";
    if (cursorStyleEl) document.head.appendChild(cursorStyleEl);
    cacheValid = false;
  }
  function stopGazeDisplay() {
    isActive = false;
    if (focusDot) focusDot.style.opacity = "0";
    cursorStyleEl == null ? void 0 : cursorStyleEl.remove();
    clearHighlights();
    clearDimming();
    if (animFrame) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
  }
  function setIntensity(intensity) {
    const map = { low: 0.5, medium: 1, high: 1.5 };
    intensityMult = map[intensity] ?? 1;
  }
  function updateGaze(x, y) {
    if (!isActive) return;
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(() => applyFrame(x, y));
  }
  function destroyGazeDisplay() {
    var _a;
    stopGazeDisplay();
    if (scrollHandler) {
      window.removeEventListener("scroll", scrollHandler, {
        capture: true
      });
      window.removeEventListener("resize", scrollHandler);
      scrollHandler = null;
    }
    resizeObserver == null ? void 0 : resizeObserver.disconnect();
    resizeObserver = null;
    const words = document.querySelectorAll("span.wit-word");
    for (const span of words) {
      const text = document.createTextNode(span.textContent || "");
      (_a = span.parentNode) == null ? void 0 : _a.replaceChild(text, span);
    }
    document.body.normalize();
    focusDot == null ? void 0 : focusDot.remove();
    focusDot = null;
    cursorStyleEl == null ? void 0 : cursorStyleEl.remove();
    cursorStyleEl = null;
    wordCache = [];
    cacheValid = false;
  }
  function applyFrame(gazeX, gazeY) {
    if (focusDot) {
      focusDot.style.left = `${gazeX}px`;
      focusDot.style.top = `${gazeY}px`;
    }
    if (!cacheValid) rebuildWordCache();
    const focusR = FOCUS_RADIUS * intensityMult;
    const transR = TRANSITION_RADIUS * intensityMult;
    let closestDist = Infinity;
    let closestWord = null;
    const toHighlight = [];
    const toTransition = [];
    for (const w of wordCache) {
      const dx = w.cx - gazeX;
      const dy = w.cy - gazeY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= focusR) {
        toHighlight.push({ el: w.el, dist });
        if (dist < closestDist) {
          closestDist = dist;
          closestWord = w.el;
        }
      } else if (dist <= transR) {
        toTransition.push({ el: w.el, dist });
      }
    }
    for (const el of highlightedWords) {
      el.style.background = "";
      el.style.boxShadow = "";
    }
    highlightedWords.clear();
    for (const { el } of toHighlight) {
      const textColor = el.style.color || null;
      const { bg } = contrastingHighlight(textColor, false);
      el.style.background = bg;
      highlightedWords.add(el);
    }
    if (closestWord) {
      const textColor = closestWord.style.color || null;
      const { bg, underline } = contrastingHighlight(textColor, true);
      closestWord.style.background = bg;
      closestWord.style.boxShadow = `inset 0 -2px 0 ${underline}`;
    }
    for (const { el, dist } of toTransition) {
      const t = (dist - focusR) / (transR - focusR);
      const textColor = el.style.color || null;
      const { bg } = contrastingHighlight(textColor, false);
      const alphaMatch = bg.match(/[\d.]+\)$/);
      const baseAlpha = alphaMatch ? parseFloat(alphaMatch[0]) : 0.2;
      const fadedAlpha = baseAlpha * (1 - t);
      const fadedBg = bg.replace(/[\d.]+\)$/, `${fadedAlpha.toFixed(3)})`);
      el.style.background = fadedBg;
      highlightedWords.add(el);
    }
    applyDimming(gazeX, gazeY, transR);
  }
  let dimOverlay = null;
  function applyDimming(cx, cy, radius) {
    if (!dimOverlay) {
      dimOverlay = document.createElement("div");
      dimOverlay.id = "wit-gaze-overlay";
      dimOverlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 999990;
      transition: none;
    `;
      document.body.appendChild(dimOverlay);
    }
    const innerPct = radius * 0.5 / Math.max(window.innerWidth, window.innerHeight) * 100;
    const outerPct = radius / Math.max(window.innerWidth, window.innerHeight) * 100;
    const dimAlpha = (1 - DIM_OPACITY) * 0.15 * intensityMult;
    dimOverlay.style.background = `radial-gradient(
    circle ${radius}px at ${cx}px ${cy}px,
    transparent ${innerPct}%,
    rgba(0, 0, 0, ${dimAlpha * 0.3}) ${outerPct}%,
    rgba(0, 0, 0, ${dimAlpha}) 100%
  )`;
  }
  function clearHighlights() {
    for (const el of highlightedWords) {
      el.style.background = "";
      el.style.boxShadow = "";
    }
    highlightedWords.clear();
  }
  function clearDimming() {
    dimOverlay == null ? void 0 : dimOverlay.remove();
    dimOverlay = null;
  }
  let panelIframe = null;
  let colorSettings = {
    enabled: false,
    scheme: "default",
    emphasis: "normal",
    showFunctionWords: true
  };
  let directorSettings = {
    crowdingIntensity: "medium"
  };
  function injectPanel() {
    const container = document.createElement("div");
    container.id = "wit-panel-container";
    container.className = "wit-panel-container";
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
    const panelUrl = chrome.runtime.getURL("src/panel/index.html");
    panelIframe.src = panelUrl;
    container.appendChild(panelIframe);
    document.body.appendChild(container);
  }
  function handlePanelMessage(event) {
    var _a;
    if (((_a = event.data) == null ? void 0 : _a.source) !== "wit-panel") return;
    const msg = event.data;
    switch (msg.type) {
      case "TOGGLE_COLOR_CODING":
        colorSettings = {
          enabled: msg.enabled,
          scheme: msg.scheme,
          emphasis: msg.emphasis,
          showFunctionWords: msg.showFunctionWords
        };
        if (msg.enabled) {
          sendToPanel({ source: "wit-content", type: "PROCESSING_START" });
          colorizeDocument(msg.scheme, msg.emphasis, msg.showFunctionWords).then(
            () => sendToPanel({ source: "wit-content", type: "PROCESSING_DONE" })
          ).catch(
            () => sendToPanel({ source: "wit-content", type: "PROCESSING_DONE" })
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
          setTimeout(
            () => sendToPanel({ source: "wit-content", type: "PROCESSING_DONE" }),
            2e3
          );
        }
        break;
      case "TOGGLE_DIRECTOR_MODE":
        directorSettings = {
          enabled: msg.enabled,
          crowdingIntensity: msg.crowdingIntensity
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
  function sendToPanel(msg) {
    var _a;
    (_a = panelIframe == null ? void 0 : panelIframe.contentWindow) == null ? void 0 : _a.postMessage(msg, "*");
  }
  function startDirectorMode() {
    initGazeDisplay();
    setIntensity(directorSettings.crowdingIntensity);
    initCursorTracker((x, y, _timestamp) => {
      updateGaze(x, y);
    });
    startTracking();
    startGazeDisplay();
    sendToPanel({
      source: "wit-content",
      type: "TRACKING_STATUS",
      active: true
    });
  }
  function stopDirectorMode() {
    stopTracking();
    stopGazeDisplay();
    destroyCursorTracker();
    destroyGazeDisplay();
    sendToPanel({
      source: "wit-content",
      type: "TRACKING_STATUS",
      active: false
    });
  }
  function init() {
    if (window !== window.top) return;
    if (window.location.protocol === "chrome-extension:") return;
    injectPanel();
    window.addEventListener("message", handlePanelMessage);
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
