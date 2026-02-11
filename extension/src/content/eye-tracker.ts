/**
 * Cursor Tracker – content-script side.
 *
 * Tracks the user's mouse position and feeds it into the gaze display
 * system. The focus dot follows the cursor, and word highlighting
 * activates around wherever the mouse is on the page.
 *
 * No webcam, no calibration, no iframe — just mousemove.
 */

type GazeCallback = (x: number, y: number, timestamp: number) => void;

let gazeCallback: GazeCallback | null = null;
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
let isTracking = false;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Initialize the cursor tracker.
 */
export function initCursorTracker(onGaze: GazeCallback): void {
  gazeCallback = onGaze;
}

/**
 * Start tracking the mouse cursor.
 */
export function startTracking(): void {
  if (isTracking) return;
  isTracking = true;

  mouseMoveHandler = (e: MouseEvent) => {
    gazeCallback?.(e.clientX, e.clientY, Date.now());
  };

  window.addEventListener("mousemove", mouseMoveHandler, { passive: true });
}

/**
 * Stop tracking.
 */
export function stopTracking(): void {
  if (!isTracking) return;
  isTracking = false;

  if (mouseMoveHandler) {
    window.removeEventListener("mousemove", mouseMoveHandler);
    mouseMoveHandler = null;
  }
}

/**
 * Cleanup everything.
 */
export function destroyCursorTracker(): void {
  stopTracking();
  gazeCallback = null;
}

