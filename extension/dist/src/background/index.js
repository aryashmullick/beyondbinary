chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
  } catch (err) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content/index.js"]
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["src/content/content.css"]
      });
    } catch (injectErr) {
      console.error("[WIT] Failed to inject content script:", injectErr);
    }
  }
});
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[WIT] Extension installed");
    chrome.storage.local.set({
      colorCoding: {
        enabled: false,
        scheme: "default",
        emphasis: "normal",
        showFunctionWords: true
      },
      directorMode: {
        enabled: false,
        crowdingIntensity: "medium",
        gazeSmoothing: 5
      },
      backendUrl: "http://127.0.0.1:8742"
    });
  }
});
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
  });
});
