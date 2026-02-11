import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ColorCodingSettings } from "@/components/ColorCodingSettings";
import { StatusBar } from "@/components/StatusBar";
import { MinimizedIcon } from "@/components/MinimizedIcon";
import { checkHealth, getLegend, type LegendItem } from "@/lib/api";
import { Minus, Sparkles } from "lucide-react";

// ─── Message Types ─────────────────────────────────────────────────────────────

type MessageToContent =
  | {
      type: "TOGGLE_COLOR_CODING";
      enabled: boolean;
      scheme: string;
      emphasis: string;
      showFunctionWords: boolean;
    }
  | {
      type: "UPDATE_COLOR_SETTINGS";
      scheme: string;
      emphasis: string;
      showFunctionWords: boolean;
    }
  | {
      type: "TOGGLE_DIRECTOR_MODE";
      enabled: boolean;
      crowdingIntensity: string;
    }
  | {
      type: "UPDATE_DIRECTOR_SETTINGS";
      crowdingIntensity: string;
    }
  | { type: "GET_STATUS" };

function sendToContent(msg: MessageToContent) {
  window.parent.postMessage({ source: "wit-panel", ...msg }, "*");
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export const App: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [legend, setLegend] = useState<LegendItem[]>([]);

  const [colorCodingEnabled, setColorCodingEnabled] = useState(false);
  const [colorScheme, setColorScheme] = useState("default");
  const [emphasis, setEmphasis] = useState("normal");
  const [showFunctionWords, setShowFunctionWords] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [directorModeEnabled, setDirectorModeEnabled] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [crowdingIntensity, setCrowdingIntensity] = useState("medium");

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const check = async () => {
      const healthy = await checkHealth();
      setBackendConnected(healthy);
      if (healthy) {
        const legendData = await getLegend(colorScheme);
        setLegend(legendData);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (backendConnected) {
      getLegend(colorScheme).then(setLegend).catch(console.error);
    }
  }, [colorScheme, backendConnected]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.source !== "wit-content") return;
      switch (event.data.type) {
        case "PROCESSING_START":
          setIsProcessing(true);
          break;
        case "PROCESSING_DONE":
          setIsProcessing(false);
          break;
        case "TRACKING_STATUS":
          setIsTracking(event.data.active);
          break;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleColorToggle = useCallback(
    (enabled: boolean) => {
      setColorCodingEnabled(enabled);
      sendToContent({
        type: "TOGGLE_COLOR_CODING",
        enabled,
        scheme: colorScheme,
        emphasis,
        showFunctionWords,
      });
    },
    [colorScheme, emphasis, showFunctionWords],
  );

  const handleSchemeChange = useCallback(
    (scheme: string) => {
      setColorScheme(scheme);
      if (colorCodingEnabled) {
        sendToContent({
          type: "UPDATE_COLOR_SETTINGS",
          scheme,
          emphasis,
          showFunctionWords,
        });
      }
    },
    [colorCodingEnabled, emphasis, showFunctionWords],
  );

  const handleEmphasisChange = useCallback(
    (emp: string) => {
      setEmphasis(emp);
      if (colorCodingEnabled) {
        sendToContent({
          type: "UPDATE_COLOR_SETTINGS",
          scheme: colorScheme,
          emphasis: emp,
          showFunctionWords,
        });
      }
    },
    [colorCodingEnabled, colorScheme, showFunctionWords],
  );

  const handleShowFunctionWordsChange = useCallback(
    (show: boolean) => {
      setShowFunctionWords(show);
      if (colorCodingEnabled) {
        sendToContent({
          type: "UPDATE_COLOR_SETTINGS",
          scheme: colorScheme,
          emphasis,
          showFunctionWords: show,
        });
      }
    },
    [colorCodingEnabled, colorScheme, emphasis],
  );

  const handleDirectorToggle = useCallback(
    (enabled: boolean) => {
      setDirectorModeEnabled(enabled);
      sendToContent({
        type: "TOGGLE_DIRECTOR_MODE",
        enabled,
        crowdingIntensity,
      });
    },
    [crowdingIntensity],
  );

  const handleCrowdingChange = useCallback(
    (intensity: string) => {
      setCrowdingIntensity(intensity);
      if (directorModeEnabled) {
        sendToContent({
          type: "UPDATE_DIRECTOR_SETTINGS",
          crowdingIntensity: intensity,
        });
      }
    },
    [directorModeEnabled],
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  const isAnythingActive = colorCodingEnabled || directorModeEnabled;

  return (
    <TooltipProvider>
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed bottom-3 right-3 w-[320px] max-h-[calc(100vh-24px)] z-[999999] flex flex-col rounded-2xl overflow-hidden"
            style={{
              fontFamily: '"Inter", system-ui, sans-serif',
              background: "#FEFCF8",
              border: "1px solid #E2D9CA",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            {/* ─── Compact Title Bar ─────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-2"
              style={{ borderBottom: "1px solid #EDE6D8" }}
            >
              <div className="flex items-center gap-2">
                <h1
                  className="font-display font-extrabold text-[15px] tracking-tight"
                  style={{
                    background: "linear-gradient(135deg, #4A6FA5, #6B9E6B, #E8A838)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  WIT
                </h1>
                {isProcessing && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </motion.div>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-black/5 transition-colors text-stone-400 hover:text-stone-600"
                title="Minimize"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ─── Content ────────────────────────────────────────────── */}
            <div className="overflow-y-auto wit-scrollbar px-4 py-3">
              <ColorCodingSettings
                enabled={colorCodingEnabled}
                onToggle={handleColorToggle}
                scheme={colorScheme}
                onSchemeChange={handleSchemeChange}
                emphasis={emphasis}
                onEmphasisChange={handleEmphasisChange}
                showFunctionWords={showFunctionWords}
                onShowFunctionWordsChange={handleShowFunctionWordsChange}
                legend={legend}
                isProcessing={isProcessing}
                directorEnabled={directorModeEnabled}
                onDirectorToggle={handleDirectorToggle}
                isTracking={isTracking}
                crowdingIntensity={crowdingIntensity}
                onCrowdingIntensityChange={handleCrowdingChange}
              />
            </div>

            {/* ─── Footer ─────────────────────────────────────────────── */}
            <StatusBar
              backendConnected={backendConnected}
              colorCodingActive={colorCodingEnabled}
              directorModeActive={directorModeEnabled}
            />
          </motion.div>
        ) : (
          <MinimizedIcon
            key="icon"
            onClick={() => setIsOpen(true)}
            isActive={isAnythingActive}
          />
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
};
