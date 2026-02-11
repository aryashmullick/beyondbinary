/**
 * Gaze-Contingent Display - Modifies the page display based on gaze data.
 * Reduces visual crowding around the fixation point to help dyslexic readers.
 */

import type { GazeUpdate, CrowdingReduction, GazeRegion } from "@/lib/api";

let overlayElement: HTMLElement | null = null;
let focusRingElement: HTMLElement | null = null;
let lastUpdate: GazeUpdate | null = null;
let animationFrame: number | null = null;
let isActive = false;

// Keep track of modified elements to restore them
let modifiedElements: Map<HTMLElement, { 
  originalLetterSpacing: string;
  originalWordSpacing: string;
  originalLineHeight: string;
  originalFontSize: string;
  originalOpacity: string;
}> = new Map();

/**
 * Initialize the gaze-contingent display system.
 */
export function initGazeDisplay(): void {
  // Create the radial focus overlay
  overlayElement = document.createElement("div");
  overlayElement.id = "wit-gaze-overlay";
  overlayElement.className = "wit-gaze-overlay";
  overlayElement.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none;
    z-index: 999990;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  // Focus ring indicator
  focusRingElement = document.createElement("div");
  focusRingElement.id = "wit-focus-ring";
  focusRingElement.style.cssText = `
    position: fixed;
    width: 60px; height: 60px;
    border-radius: 50%;
    border: 2px solid rgba(74, 111, 165, 0.3);
    pointer-events: none;
    z-index: 999991;
    transform: translate(-50%, -50%);
    transition: all 0.15s ease-out;
    opacity: 0;
    box-shadow: 0 0 30px rgba(74, 111, 165, 0.1);
  `;

  document.body.appendChild(overlayElement);
  document.body.appendChild(focusRingElement);
}

/**
 * Start the gaze-contingent display.
 */
export function startGazeDisplay(): void {
  isActive = true;
  if (overlayElement) overlayElement.style.opacity = "1";
  if (focusRingElement) focusRingElement.style.opacity = "1";
}

/**
 * Stop the gaze-contingent display.
 */
export function stopGazeDisplay(): void {
  isActive = false;
  if (overlayElement) overlayElement.style.opacity = "0";
  if (focusRingElement) focusRingElement.style.opacity = "0";
  restoreAllElements();
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

/**
 * Update the display based on new gaze data.
 */
export function updateGazeDisplay(update: GazeUpdate): void {
  if (!isActive) return;
  lastUpdate = update;

  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(() => applyGazeUpdate(update));
}

/**
 * Apply the gaze update to the page.
 */
function applyGazeUpdate(update: GazeUpdate): void {
  if (!update.fixation || !update.region || !update.crowding) {
    // No fixation - fade out effects
    if (focusRingElement) {
      focusRingElement.style.opacity = "0.3";
    }
    return;
  }

  const { region, crowding } = update;

  // ─── Update Focus Ring ───────────────────────────────────────────────
  if (focusRingElement) {
    focusRingElement.style.left = `${region.centerX}px`;
    focusRingElement.style.top = `${region.centerY}px`;
    focusRingElement.style.width = `${region.focusRadius * 2}px`;
    focusRingElement.style.height = `${region.focusRadius * 2}px`;
    focusRingElement.style.opacity = "1";
  }

  // ─── Update Radial Overlay (vignette effect) ─────────────────────────
  if (overlayElement) {
    const gradient = `radial-gradient(
      ellipse ${region.transitionRadius}px ${region.transitionRadius}px at ${region.centerX}px ${region.centerY}px,
      transparent 0%,
      transparent ${(region.focusRadius / region.transitionRadius * 100)}%,
      rgba(255, 249, 196, ${crowding.highlightOpacity * 0.3}) ${((region.focusRadius + 20) / region.transitionRadius * 100)}%,
      rgba(0, 0, 0, ${(1 - crowding.peripheryOpacity) * 0.15}) 100%
    )`;
    overlayElement.style.background = gradient;
  }

  // ─── Apply Crowding Reduction to Text Elements ───────────────────────
  applyCrowdingReduction(region, crowding);
}

/**
 * Apply visual crowding reduction to text elements near the gaze point.
 */
function applyCrowdingReduction(region: GazeRegion, crowding: CrowdingReduction): void {
  // First, restore previously modified elements that are now outside the region
  restoreDistantElements(region);

  // Find text elements near the gaze point
  const elements = getTextElementsInRegion(
    region.centerX,
    region.centerY,
    region.blurRadius
  );

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    const elCenterX = rect.left + rect.width / 2;
    const elCenterY = rect.top + rect.height / 2;

    const distance = Math.sqrt(
      (elCenterX - region.centerX) ** 2 +
      (elCenterY - region.centerY) ** 2
    );

    // Save original styles if not already saved
    if (!modifiedElements.has(el)) {
      modifiedElements.set(el, {
        originalLetterSpacing: el.style.letterSpacing,
        originalWordSpacing: el.style.wordSpacing,
        originalLineHeight: el.style.lineHeight,
        originalFontSize: el.style.fontSize,
        originalOpacity: el.style.opacity,
      });
    }

    if (distance <= region.focusRadius) {
      // ── Inner focus zone: enhance readability ──
      const computedStyle = window.getComputedStyle(el);
      const currentFontSize = parseFloat(computedStyle.fontSize) || 16;

      el.style.letterSpacing = `${crowding.letterSpacingBoost}em`;
      el.style.wordSpacing = `${crowding.wordSpacingBoost}em`;
      el.style.fontSize = `${currentFontSize * crowding.focusFontScale}px`;
      el.style.opacity = "1";

    } else if (distance <= region.transitionRadius) {
      // ── Transition zone: partial effect ──
      const t = (distance - region.focusRadius) / (region.transitionRadius - region.focusRadius);
      const easedT = 1 - (1 - t) * (1 - t); // ease-out

      el.style.letterSpacing = `${crowding.letterSpacingBoost * (1 - easedT)}em`;
      el.style.wordSpacing = `${crowding.wordSpacingBoost * (1 - easedT)}em`;
      el.style.opacity = String(1 - (1 - crowding.peripheryOpacity) * easedT);

    } else {
      // ── Outer zone: reduce prominence ──
      el.style.opacity = String(crowding.peripheryOpacity);
      el.style.letterSpacing = "";
      el.style.wordSpacing = "";
    }
  }
}

/**
 * Get text-containing elements near a screen coordinate.
 */
function getTextElementsInRegion(
  x: number,
  y: number,
  radius: number
): HTMLElement[] {
  const elements: HTMLElement[] = [];
  const checked = new Set<HTMLElement>();

  // Use elementsFromPoint at several positions in the region
  const samplePoints = [
    { x, y },
    { x: x - radius * 0.5, y },
    { x: x + radius * 0.5, y },
    { x, y: y - radius * 0.5 },
    { x, y: y + radius * 0.5 },
    { x: x - radius * 0.3, y: y - radius * 0.3 },
    { x: x + radius * 0.3, y: y - radius * 0.3 },
    { x: x - radius * 0.3, y: y + radius * 0.3 },
    { x: x + radius * 0.3, y: y + radius * 0.3 },
  ];

  for (const point of samplePoints) {
    const els = document.elementsFromPoint(point.x, point.y);
    for (const el of els) {
      if (!(el instanceof HTMLElement)) continue;
      if (checked.has(el)) continue;
      checked.add(el);

      // Check if this element contains text
      if (isTextElement(el)) {
        elements.push(el);
      }
    }
  }

  // Also check nearby elements via parent traversal
  const centerEl = document.elementFromPoint(x, y);
  if (centerEl instanceof HTMLElement) {
    let parent: HTMLElement | null = centerEl;
    for (let i = 0; i < 5 && parent; i++) {
      const children = parent.children;
      for (let j = 0; j < children.length; j++) {
        const child = children[j];
        if (!(child instanceof HTMLElement) || checked.has(child)) continue;
        checked.add(child);

        const rect = child.getBoundingClientRect();
        const dist = Math.sqrt(
          (rect.left + rect.width / 2 - x) ** 2 +
          (rect.top + rect.height / 2 - y) ** 2
        );

        if (dist <= radius && isTextElement(child)) {
          elements.push(child);
        }
      }
      parent = parent.parentElement;
    }
  }

  return elements;
}

/**
 * Check if an element primarily contains text.
 */
function isTextElement(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (["P", "SPAN", "A", "LI", "TD", "TH", "H1", "H2", "H3", "H4", "H5", "H6",
       "LABEL", "STRONG", "EM", "B", "I", "U", "SMALL", "BLOCKQUOTE", "CITE",
       "DD", "DT", "FIGCAPTION", "MARK", "S", "SUB", "SUP", "TIME"].includes(tag)) {
    return true;
  }
  // Check if element has direct text content
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      return true;
    }
  }
  return false;
}

/**
 * Restore elements that are far from the current gaze region.
 */
function restoreDistantElements(region: GazeRegion): void {
  for (const [el, original] of modifiedElements) {
    const rect = el.getBoundingClientRect();
    const dist = Math.sqrt(
      (rect.left + rect.width / 2 - region.centerX) ** 2 +
      (rect.top + rect.height / 2 - region.centerY) ** 2
    );

    if (dist > region.blurRadius * 1.5) {
      el.style.letterSpacing = original.originalLetterSpacing;
      el.style.wordSpacing = original.originalWordSpacing;
      el.style.lineHeight = original.originalLineHeight;
      el.style.fontSize = original.originalFontSize;
      el.style.opacity = original.originalOpacity;
      modifiedElements.delete(el);
    }
  }
}

/**
 * Restore all modified elements to their original state.
 */
function restoreAllElements(): void {
  for (const [el, original] of modifiedElements) {
    try {
      el.style.letterSpacing = original.originalLetterSpacing;
      el.style.wordSpacing = original.originalWordSpacing;
      el.style.lineHeight = original.originalLineHeight;
      el.style.fontSize = original.originalFontSize;
      el.style.opacity = original.originalOpacity;
    } catch {}
  }
  modifiedElements.clear();
}

/**
 * Clean up all gaze display elements.
 */
export function destroyGazeDisplay(): void {
  stopGazeDisplay();
  overlayElement?.remove();
  focusRingElement?.remove();
  overlayElement = null;
  focusRingElement = null;
}
