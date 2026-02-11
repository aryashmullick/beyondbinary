/**
 * Gaze-Contingent Display – highlights individual WORDS near the cursor.
 *
 * Works with BOTH the colorizer's `.wit-colored` spans and its own
 * `.wit-word` spans (when color coding is off).  When a word already
 * has an NLP-assigned color, the highlight is picked to contrast with
 * that color.  When color coding is off, a warm-yellow highlight is used.
 *
 * Visual effects:
 *  - Words within the focus zone get a background highlight
 *  - The single closest word gets a stronger highlight + subtle underline
 *  - Words in the transition zone get a lighter highlight
 *  - Surrounding text dims slightly so focus words pop
 *  - A thin focus dot follows the cursor
 *  - The real mouse cursor is hidden while Director Mode is active
 *  - No font-size changes (avoids layout thrashing)
 */

// ─── Configuration ─────────────────────────────────────────────────────────

const FOCUS_RADIUS = 90; // px – inner highlight zone
const TRANSITION_RADIUS = 180; // px – gradual fade zone
const DIM_OPACITY = 0.45; // opacity for text outside transition
const RING_SIZE = 8; // px – small dot

// Fallback colours (no NLP color on word)
const HIGHLIGHT_BG = "rgba(255, 249, 196, 0.45)"; // warm yellow
const HIGHLIGHT_BG_STRONG = "rgba(255, 240, 140, 0.65)";
const UNDERLINE_COLOR = "rgba(74, 111, 165, 0.5)";

// Intensity multiplier (set via config)
let intensityMult = 1.0;

// ─── State ─────────────────────────────────────────────────────────────────

let focusDot: HTMLElement | null = null;
let cursorStyleEl: HTMLStyleElement | null = null;
let isActive = false;
let animFrame: number | null = null;

// Cached word rects – rebuilt on scroll / resize, reused between frames
let wordCache: { el: HTMLElement; cx: number; cy: number }[] = [];
let cacheValid = false;
let scrollHandler: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;

// Track highlighted words so we can clear them
let highlightedWords = new Set<HTMLElement>();
let primaryWord: HTMLElement | null = null;

// ─── Colour helpers ────────────────────────────────────────────────────────

/**
 * Parse any CSS colour (rgb, rgba, hex, named) into [r, g, b].
 * Returns null if it can't parse.
 */
function parseColor(css: string): [number, number, number] | null {
  // Use a temporary element to resolve any CSS color string
  const el = document.createElement("div");
  el.style.color = css;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  el.remove();
  const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
}

/** Relative luminance (WCAG). */
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * For a given NLP text colour, return a contrasting highlight background
 * and underline colour that is readable.
 */
function contrastingHighlight(
  textColor: string | null,
  strong: boolean,
): { bg: string; underline: string } {
  if (!textColor) {
    return {
      bg: strong ? HIGHLIGHT_BG_STRONG : HIGHLIGHT_BG,
      underline: UNDERLINE_COLOR,
    };
  }

  const rgb = parseColor(textColor);
  if (!rgb) {
    return {
      bg: strong ? HIGHLIGHT_BG_STRONG : HIGHLIGHT_BG,
      underline: UNDERLINE_COLOR,
    };
  }

  const lum = luminance(...rgb);
  const alpha = strong ? 0.28 : 0.18;

  if (lum > 0.4) {
    // Light text colour → use dark-ish highlight
    return {
      bg: `rgba(30, 40, 70, ${alpha})`,
      underline: `rgba(30, 40, 70, 0.45)`,
    };
  } else if (lum > 0.15) {
    // Medium text colour → use a warm light highlight
    return {
      bg: `rgba(255, 249, 196, ${alpha + 0.1})`,
      underline: `rgba(120, 100, 30, 0.4)`,
    };
  } else {
    // Dark text colour → use a light bright highlight
    return {
      bg: `rgba(255, 240, 140, ${alpha + 0.15})`,
      underline: `rgba(74, 111, 165, 0.5)`,
    };
  }
}

// ─── Word discovery ────────────────────────────────────────────────────────

/**
 * Rebuild the wordCache.
 *
 * Strategy:
 *  1. If the colorizer has run, words are wrapped in `span.wit-colored`.
 *     Use those directly — no need to re-wrap.
 *  2. Otherwise fall back to discovering / wrapping with `span.wit-word`.
 *
 * All rects are viewport-relative (getBoundingClientRect), which matches
 * the cursor's clientX/clientY.  Cache is invalidated on scroll & resize
 * so the positions stay correct.
 */
function rebuildWordCache(): void {
  wordCache = [];

  // ── Try .wit-colored first (color coding is on) ──────────────────────
  const colored = document.querySelectorAll<HTMLElement>("span.wit-colored");
  if (colored.length > 0) {
    for (const span of colored) {
      const r = span.getBoundingClientRect();
      if (
        r.width > 0 &&
        r.height > 0 &&
        r.bottom >= -200 &&
        r.top <= window.innerHeight + 200
      ) {
        wordCache.push({
          el: span,
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
        });
      }
    }
    cacheValid = true;
    return;
  }

  // ── Fall back to .wit-word (no colour coding) ────────────────────────
  const existing = document.querySelectorAll<HTMLElement>("span.wit-word");
  if (existing.length > 0) {
    for (const span of existing) {
      const r = span.getBoundingClientRect();
      if (
        r.width > 0 &&
        r.height > 0 &&
        r.bottom >= -200 &&
        r.top <= window.innerHeight + 200
      ) {
        wordCache.push({
          el: span,
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
        });
      }
    }
    if (wordCache.length > 0) {
      cacheValid = true;
      return;
    }
  }

  // ── First time with no colour coding — wrap text nodes ───────────────
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (
        parent.closest(
          "#wit-panel-container, #wit-panel-iframe, #wit-tracker-iframe, " +
            "#wit-gaze-overlay, #wit-focus-dot, script, style, noscript, svg, canvas",
        )
      )
        return NodeFilter.FILTER_REJECT;
      if (parent.classList.contains("wit-word")) return NodeFilter.FILTER_REJECT;
      const text = node.textContent;
      if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return NodeFilter.FILTER_REJECT;
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200)
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) textNodes.push(node as Text);

  for (const tn of textNodes) {
    const text = tn.textContent || "";
    const parts = text.match(/\S+|\s+/g);
    if (!parts || parts.length <= 1) {
      if (text.trim()) {
        const span = document.createElement("span");
        span.className = "wit-word";
        span.textContent = text;
        tn.parentNode?.replaceChild(span, tn);
        const r = span.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          wordCache.push({ el: span, cx: r.left + r.width / 2, cy: r.top + r.height / 2 });
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
    tn.parentNode?.replaceChild(frag, tn);
  }

  const allWords = document.querySelectorAll<HTMLElement>("span.wit-word");
  for (const span of allWords) {
    const r = span.getBoundingClientRect();
    if (
      r.width > 0 &&
      r.height > 0 &&
      r.bottom >= -200 &&
      r.top <= window.innerHeight + 200
    ) {
      wordCache.push({ el: span, cx: r.left + r.width / 2, cy: r.top + r.height / 2 });
    }
  }
  cacheValid = true;
}

function invalidateCache(): void {
  cacheValid = false;
}

// ─── Public API ────────────────────────────────────────────────────────────

export function initGazeDisplay(): void {
  // Focus dot
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

  // Hide the real cursor while Director Mode is active
  cursorStyleEl = document.createElement("style");
  cursorStyleEl.id = "wit-cursor-hide";
  cursorStyleEl.textContent = `
    html, html *, body, body * {
      cursor: none !important;
    }
  `;

  // Invalidate cache on scroll / resize
  scrollHandler = () => invalidateCache();
  window.addEventListener("scroll", scrollHandler, { passive: true, capture: true });
  window.addEventListener("resize", scrollHandler, { passive: true });

  // Also watch for DOM mutations (e.g. lazy-loaded content)
  resizeObserver = new ResizeObserver(() => invalidateCache());
  resizeObserver.observe(document.body);
}

export function startGazeDisplay(): void {
  isActive = true;
  if (focusDot) focusDot.style.opacity = "1";
  if (cursorStyleEl) document.head.appendChild(cursorStyleEl);
  cacheValid = false;
}

export function stopGazeDisplay(): void {
  isActive = false;
  if (focusDot) focusDot.style.opacity = "0";
  cursorStyleEl?.remove();
  clearHighlights();
  clearDimming();
  if (animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
}

export function setIntensity(intensity: string): void {
  const map: Record<string, number> = { low: 0.5, medium: 1.0, high: 1.5 };
  intensityMult = map[intensity] ?? 1.0;
}

/**
 * Called every frame with the cursor position (clientX, clientY).
 */
export function updateGaze(x: number, y: number): void {
  if (!isActive) return;
  if (animFrame) cancelAnimationFrame(animFrame);
  animFrame = requestAnimationFrame(() => applyFrame(x, y));
}

export function destroyGazeDisplay(): void {
  stopGazeDisplay();

  if (scrollHandler) {
    window.removeEventListener("scroll", scrollHandler, { capture: true } as any);
    window.removeEventListener("resize", scrollHandler);
    scrollHandler = null;
  }
  resizeObserver?.disconnect();
  resizeObserver = null;

  // Remove wit-word spans (only the ones we created, NOT wit-colored)
  const words = document.querySelectorAll<HTMLElement>("span.wit-word");
  for (const span of words) {
    const text = document.createTextNode(span.textContent || "");
    span.parentNode?.replaceChild(text, span);
  }
  document.body.normalize();

  focusDot?.remove();
  focusDot = null;
  cursorStyleEl?.remove();
  cursorStyleEl = null;
  wordCache = [];
  cacheValid = false;
}

// ─── Frame rendering ───────────────────────────────────────────────────────

function applyFrame(gazeX: number, gazeY: number): void {
  // 1. Move focus dot
  if (focusDot) {
    focusDot.style.left = `${gazeX}px`;
    focusDot.style.top = `${gazeY}px`;
  }

  // 2. Rebuild cache if stale
  if (!cacheValid) rebuildWordCache();

  // 3. Classify words by distance
  const focusR = FOCUS_RADIUS * intensityMult;
  const transR = TRANSITION_RADIUS * intensityMult;

  let closestDist = Infinity;
  let closestWord: HTMLElement | null = null;

  const toHighlight: { el: HTMLElement; dist: number }[] = [];
  const toTransition: { el: HTMLElement; dist: number }[] = [];

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

  // 4. Clear previous highlights
  for (const el of highlightedWords) {
    el.style.background = "";
    el.style.boxShadow = "";
  }
  highlightedWords.clear();
  primaryWord = null;

  // 5. Highlight focus-zone words (contrast-aware)
  for (const { el } of toHighlight) {
    const textColor = el.style.color || null;
    const { bg } = contrastingHighlight(textColor, false);
    el.style.background = bg;
    highlightedWords.add(el);
  }

  // 6. Strongest highlight + underline on closest word
  if (closestWord) {
    const textColor = closestWord.style.color || null;
    const { bg, underline } = contrastingHighlight(textColor, true);
    closestWord.style.background = bg;
    closestWord.style.boxShadow = `inset 0 -2px 0 ${underline}`;
    primaryWord = closestWord;
  }

  // 7. Transition zone — lighter highlight
  for (const { el, dist } of toTransition) {
    const t = (dist - focusR) / (transR - focusR);
    const textColor = el.style.color || null;
    const { bg } = contrastingHighlight(textColor, false);
    // Parse the bg rgba to reduce its alpha further
    const alphaMatch = bg.match(/[\d.]+\)$/);
    const baseAlpha = alphaMatch ? parseFloat(alphaMatch[0]) : 0.2;
    const fadedAlpha = baseAlpha * (1 - t);
    const fadedBg = bg.replace(/[\d.]+\)$/, `${fadedAlpha.toFixed(3)})`);
    el.style.background = fadedBg;
    highlightedWords.add(el);
  }

  // 8. Dim the rest of the page
  applyDimming(gazeX, gazeY, transR);
}

// ─── Page dimming ──────────────────────────────────────────────────────────

let dimOverlay: HTMLElement | null = null;

function applyDimming(cx: number, cy: number, radius: number): void {
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

  const innerPct =
    ((radius * 0.5) / Math.max(window.innerWidth, window.innerHeight)) * 100;
  const outerPct =
    (radius / Math.max(window.innerWidth, window.innerHeight)) * 100;
  const dimAlpha = (1 - DIM_OPACITY) * 0.15 * intensityMult;

  dimOverlay.style.background = `radial-gradient(
    circle ${radius}px at ${cx}px ${cy}px,
    transparent ${innerPct}%,
    rgba(0, 0, 0, ${dimAlpha * 0.3}) ${outerPct}%,
    rgba(0, 0, 0, ${dimAlpha}) 100%
  )`;
}

function clearHighlights(): void {
  for (const el of highlightedWords) {
    el.style.background = "";
    el.style.boxShadow = "";
  }
  highlightedWords.clear();
  primaryWord = null;
}

function clearDimming(): void {
  dimOverlay?.remove();
  dimOverlay = null;
}
