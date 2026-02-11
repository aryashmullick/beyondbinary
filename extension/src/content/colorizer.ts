/**
 * DOM Colorizer - Applies NLP-based color coding to text nodes in the page.
 * Walks the DOM, extracts text, sends to backend for analysis, and applies colors.
 */

import { colorizeBatch, type ColorizedSentence, type ColorizedToken } from "@/lib/api";

// Elements to skip
const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT", "EMBED",
  "SVG", "CANVAS", "VIDEO", "AUDIO", "IMG", "BR", "HR",
  "INPUT", "TEXTAREA", "SELECT", "BUTTON", "CODE", "PRE",
  "WIT-PANEL", "WIT-OVERLAY",
]);

const SKIP_CLASSES = new Set(["wit-colored", "wit-panel-container", "wit-gaze-overlay"]);

// Store original state for cleanup
interface OriginalNode {
  parent: Node;
  original: Node;
  replacement: Node;
}

let coloredNodes: OriginalNode[] = [];
let isColorizing = false;

/**
 * Extract text content from visible text nodes.
 */
function getTextNodes(root: Node): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest("[contenteditable]")) return NodeFilter.FILTER_REJECT;
        for (const cls of SKIP_CLASSES) {
          if (parent.classList?.contains(cls)) return NodeFilter.FILTER_REJECT;
        }
        // Skip empty/whitespace-only nodes
        if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
        // Skip hidden elements
        const style = window.getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    textNodes.push(node);
  }
  return textNodes;
}

/**
 * Group text nodes into batches for efficient API calls.
 */
function batchTextNodes(nodes: Text[], maxBatchSize: number = 100): Text[][] {
  const batches: Text[][] = [];
  for (let i = 0; i < nodes.length; i += maxBatchSize) {
    batches.push(nodes.slice(i, i + maxBatchSize));
  }
  return batches;
}

/**
 * Create a colored span element from a token.
 */
function createColoredSpan(token: ColorizedToken): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "wit-colored";
  span.textContent = token.text + token.whitespace;

  // Apply styles
  span.style.color = token.color;
  span.style.fontWeight = token.fontWeight;
  span.style.opacity = String(token.opacity);

  if (token.underline) {
    span.style.textDecoration = "underline";
    span.style.textDecorationColor = token.color;
    span.style.textUnderlineOffset = "3px";
  }

  // Data attributes for debugging/interaction
  span.dataset.pos = token.pos;
  span.dataset.role = token.sentenceRole;

  return span;
}

/**
 * Replace a text node with colored spans.
 */
function replaceTextNode(
  textNode: Text,
  sentences: ColorizedSentence[]
): OriginalNode | null {
  const parent = textNode.parentNode;
  if (!parent) return null;

  const container = document.createDocumentFragment();

  for (const sentence of sentences) {
    for (const token of sentence.tokens) {
      const span = createColoredSpan(token);
      container.appendChild(span);
    }
  }

  // Only replace if we have content
  if (container.childNodes.length === 0) return null;

  // Create a wrapper span to replace the text node
  const wrapper = document.createElement("span");
  wrapper.className = "wit-colored-wrapper";
  wrapper.appendChild(container);

  parent.replaceChild(wrapper, textNode);

  return {
    parent,
    original: textNode,
    replacement: wrapper,
  };
}

/**
 * Main colorize function - processes all visible text on the page.
 */
export async function colorizeDocument(
  scheme: string = "default",
  emphasis: string = "normal",
  showFunctionWords: boolean = true,
  onProgress?: (progress: number) => void
): Promise<void> {
  if (isColorizing) return;
  isColorizing = true;

  try {
    // First, clean up any previous colorization
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
        const response = await colorizeBatch(texts, scheme, emphasis, showFunctionWords);

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
      onProgress?.(processed / textNodes.length);
    }
  } finally {
    isColorizing = false;
  }
}

/**
 * Remove all colorization and restore original text nodes.
 */
export function removeColorization(): void {
  for (const record of coloredNodes) {
    try {
      if (record.replacement.parentNode) {
        record.replacement.parentNode.replaceChild(
          record.original,
          record.replacement
        );
      }
    } catch (e) {
      // Node may have been removed from DOM
    }
  }
  coloredNodes = [];

  // Also clean up any orphaned wit-colored elements
  document.querySelectorAll(".wit-colored-wrapper").forEach((el) => {
    const text = el.textContent || "";
    const textNode = document.createTextNode(text);
    el.parentNode?.replaceChild(textNode, el);
  });
}

/**
 * Re-colorize with new settings (debounced).
 */
let recolorizeTimer: ReturnType<typeof setTimeout> | null = null;

export function recolorize(
  scheme: string,
  emphasis: string,
  showFunctionWords: boolean
): void {
  if (recolorizeTimer) clearTimeout(recolorizeTimer);
  recolorizeTimer = setTimeout(() => {
    colorizeDocument(scheme, emphasis, showFunctionWords);
  }, 300);
}

/**
 * Check if colorization is currently active.
 */
export function isColorized(): boolean {
  return coloredNodes.length > 0;
}
