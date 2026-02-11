/**
 * WIT Eye Tracker — served by the Python backend on localhost.
 *
 * localhost is a secure context (getUserMedia works) and has no extension
 * CSP restrictions (eval() from TF.js / numeric.js is allowed).
 *
 * Communication with the content script is via postMessage:
 *   Content → Tracker: START, STOP, CALIBRATION_CLICK
 *   Tracker → Content: READY, STATUS, GAZE
 */
(function () {
  "use strict";

  var isRunning = false;
  var gazeInterval = null;
  var lastGaze = null;
  var lastGazeUpdateTime = 0; // when lastGaze was last FRESHLY set
  var faceDetected = false;
  var STALE_MS = 300; // gaze older than this = face probably lost

  function sendToParent(msg) {
    msg.source = "wit-tracker";
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
      webgazer.setRegression("ridge");
      webgazer.showVideoPreview(false);
      webgazer.showPredictionPoints(false);
      webgazer.showFaceOverlay(false);
      webgazer.showFaceFeedbackBox(false);

      webgazer.setGazeListener(function (data, _ts) {
        if (data && data.x != null && data.y != null) {
          lastGaze = { x: data.x, y: data.y };
          lastGazeUpdateTime = Date.now();
          if (!faceDetected) {
            faceDetected = true;
            sendToParent({ type: "FACE", detected: true });
          }
        } else {
          // WebGazer returns null when it can't find the face
          if (faceDetected) {
            faceDetected = false;
            sendToParent({ type: "FACE", detected: false });
          }
        }
      });

      webgazer
        .begin()
        .then(function () {
          isRunning = true;
          hideWebGazerUI();
          sendToParent({ type: "STATUS", status: "active" });

          // Emit gaze at ~30 fps — ONLY when data is fresh
          gazeInterval = setInterval(function () {
            if (!lastGaze) return;
            var age = Date.now() - lastGazeUpdateTime;
            if (age > STALE_MS) {
              // Face probably lost — don't send stale coordinates
              if (faceDetected) {
                faceDetected = false;
                sendToParent({ type: "FACE", detected: false });
              }
              return;
            }
            sendToParent({
              type: "GAZE",
              x: lastGaze.x,
              y: lastGaze.y,
              timestamp: Date.now(),
            });
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
    console.error("[WIT Tracker] WebGazer error:", err);
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
    lastGazeUpdateTime = 0;
    faceDetected = false;
    sendToParent({ type: "STATUS", status: "idle" });
  }

  // ── Listen for commands from the content script ────────────────────────

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

  // Signal that the tracker page is loaded and ready
  sendToParent({ type: "READY" });
})();
