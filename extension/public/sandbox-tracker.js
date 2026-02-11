/**
 * WIT Sandbox Tracker
 *
 * Runs inside sandbox.html which is exempt from the extension's CSP.
 * This allows WebGazer (which depends on eval() via numeric.js / TF.js)
 * to function correctly.
 *
 * Communication with the content script is via postMessage:
 *   Content → Sandbox: START, STOP, CALIBRATION_CLICK
 *   Sandbox → Content: READY, STATUS, GAZE
 */
(function () {
  "use strict";

  var isRunning = false;
  var gazeInterval = null;
  var lastGaze = null;

  function sendToParent(msg) {
    msg.source = "wit-sandbox";
    window.parent.postMessage(msg, "*");
  }

  // ── Hide any video / canvas elements WebGazer injects ──────────────────

  function hideWebGazerUI() {
    var ids = [
      "webgazerVideoFeed",
      "webgazerVideoContainer",
      "webgazerFaceOverlay",
      "webgazerFaceFeedbackBox",
      "webgazerGazeDot",
    ];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    // Observe for future additions
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1 && ids.indexOf(node.id) !== -1) {
            node.style.display = "none";
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () {
      observer.disconnect();
    }, 15000);
  }

  // ── Start WebGazer ─────────────────────────────────────────────────────

  function startTracking() {
    if (isRunning) return;

    sendToParent({ type: "STATUS", status: "requesting" });

    try {
      // Configure WebGazer (each call returns webgazer, but setGazeDot
      // was removed in newer versions — use the available API)
      webgazer.setRegression("ridge");
      webgazer.showVideoPreview(false);
      webgazer.showPredictionPoints(false);
      webgazer.showFaceOverlay(false);
      webgazer.showFaceFeedbackBox(false);

      webgazer.setGazeListener(function (data, _ts) {
        if (data && data.x != null && data.y != null) {
          lastGaze = { x: data.x, y: data.y };
        }
      });

      webgazer
        .begin()
        .then(function () {
          isRunning = true;
          hideWebGazerUI();
          sendToParent({ type: "STATUS", status: "active" });

          // Emit smoothed gaze at ~30 fps
          gazeInterval = setInterval(function () {
            if (lastGaze) {
              sendToParent({
                type: "GAZE",
                x: lastGaze.x,
                y: lastGaze.y,
                timestamp: Date.now(),
              });
            }
          }, 33);
        })
        .catch(function (err) {
          handleError(err);
        });
    } catch (err) {
      handleError(err);
    }
  }

  function handleError(err) {
    console.error("[WIT Sandbox] WebGazer error:", err);
    if (
      (err && err.name === "NotAllowedError") ||
      (err && err.message && err.message.indexOf("Permission") !== -1)
    ) {
      sendToParent({ type: "STATUS", status: "denied" });
    } else {
      sendToParent({ type: "STATUS", status: "error" });
    }
  }

  // ── Stop WebGazer ──────────────────────────────────────────────────────

  function stopTracking() {
    if (!isRunning) return;

    if (gazeInterval) {
      clearInterval(gazeInterval);
      gazeInterval = null;
    }

    try {
      webgazer.end();
    } catch (e) {
      /* ignore */
    }

    isRunning = false;
    lastGaze = null;
    sendToParent({ type: "STATUS", status: "idle" });
  }

  // ── Listen for commands from parent (content script) ───────────────────

  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "START":
        startTracking();
        break;

      case "STOP":
        stopTracking();
        break;

      case "CALIBRATION_CLICK":
        if (isRunning) {
          try {
            webgazer.recordScreenPosition(msg.x, msg.y, "click");
          } catch (e) {
            /* ignore */
          }
        }
        break;
    }
  });

  // Signal that the sandbox is loaded and ready
  sendToParent({ type: "READY" });
})();
