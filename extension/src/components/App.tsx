import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ColorCodingSettings } from "@/components/ColorCodingSettings";
import { DirectorMode } from "@/components/DirectorMode";
import { StatusBar } from "@/components/StatusBar";
import { MinimizedIcon } from "@/components/MinimizedIcon";
import {
  checkHealth,
  getLegend,
  type LegendItem,
} from "@/lib/api";
import {
  X,
  Minus,
  Palette,
  Eye,
  Settings,
  Sparkles,
  Heart,
} from "lucide-react";

// ─── Message Types ─────────────────────────────────────────────────────────────

type MessageToContent =
  | { type: "TOGGLE_COLOR_CODING"; enabled: boolean; scheme: string; emphasis: string; showFunctionWords: boolean }
  | { type: "UPDATE_COLOR_SETTINGS"; scheme: string; emphasis: string; showFunctionWords: boolean }
  | { type: "TOGGLE_DIRECTOR_MODE"; enabled: boolean; crowdingIntensity: string; gazeSmoothing: number }
  | { type: "UPDATE_DIRECTOR_SETTINGS"; crowdingIntensity: string; gazeSmoothing: number }
  | { type: "START_CALIBRATION" }
  | { type: "GET_STATUS" };

function sendToContent(msg: MessageToContent) {
  window.parent.postMessage({ source: "wit-panel", ...msg }, "*");
}

// ─── Main App ──────────────────────────────────────────────────────────────────

export const App: React.FC = () => {
  // Panel visibility
  const [isOpen, setIsOpen] = useState(true);

  // Backend status
  const [backendConnected, setBackendConnected] = useState(false);
  const [legend, setLegend] = useState<LegendItem[]>([]);

  // Color coding state
  const [colorCodingEnabled, setColorCodingEnabled] = useState(false);
  const [colorScheme, setColorScheme] = useState("default");
  const [emphasis, setEmphasis] = useState("normal");
  const [showFunctionWords, setShowFunctionWords] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Director mode state
  const [directorModeEnabled, setDirectorModeEnabled] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [crowdingIntensity, setCrowdingIntensity] = useState("medium");
  const [gazeSmoothing, setGazeSmoothing] = useState(5);
  const [webcamStatus, setWebcamStatus] = useState<"unavailable" | "permission_denied" | "ready" | "active">("ready");

  // ─── Effects ───────────────────────────────────────────────────────────────

  // Check backend health on mount
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

  // Update legend when scheme changes
  useEffect(() => {
    if (backendConnected) {
      getLegend(colorScheme).then(setLegend).catch(console.error);
    }
  }, [colorScheme, backendConnected]);

  // Listen for messages from content script
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
        case "WEBCAM_STATUS":
          setWebcamStatus(event.data.status);
          break;
        case "TRACKING_STATUS":
          setIsTracking(event.data.active);
          break;
        case "CALIBRATION_DONE":
          setIsCalibrating(false);
          break;
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleColorToggle = useCallback((enabled: boolean) => {
    setColorCodingEnabled(enabled);
    sendToContent({
      type: "TOGGLE_COLOR_CODING",
      enabled,
      scheme: colorScheme,
      emphasis,
      showFunctionWords,
    });
  }, [colorScheme, emphasis, showFunctionWords]);

  const handleSchemeChange = useCallback((scheme: string) => {
    setColorScheme(scheme);
    if (colorCodingEnabled) {
      sendToContent({
        type: "UPDATE_COLOR_SETTINGS",
        scheme,
        emphasis,
        showFunctionWords,
      });
    }
  }, [colorCodingEnabled, emphasis, showFunctionWords]);

  const handleEmphasisChange = useCallback((emp: string) => {
    setEmphasis(emp);
    if (colorCodingEnabled) {
      sendToContent({
        type: "UPDATE_COLOR_SETTINGS",
        scheme: colorScheme,
        emphasis: emp,
        showFunctionWords,
      });
    }
  }, [colorCodingEnabled, colorScheme, showFunctionWords]);

  const handleShowFunctionWordsChange = useCallback((show: boolean) => {
    setShowFunctionWords(show);
    if (colorCodingEnabled) {
      sendToContent({
        type: "UPDATE_COLOR_SETTINGS",
        scheme: colorScheme,
        emphasis,
        showFunctionWords: show,
      });
    }
  }, [colorCodingEnabled, colorScheme, emphasis]);

  const handleDirectorToggle = useCallback((enabled: boolean) => {
    setDirectorModeEnabled(enabled);
    sendToContent({
      type: "TOGGLE_DIRECTOR_MODE",
      enabled,
      crowdingIntensity,
      gazeSmoothing,
    });
  }, [crowdingIntensity, gazeSmoothing]);

  const handleCrowdingChange = useCallback((intensity: string) => {
    setCrowdingIntensity(intensity);
    if (directorModeEnabled) {
      sendToContent({
        type: "UPDATE_DIRECTOR_SETTINGS",
        crowdingIntensity: intensity,
        gazeSmoothing,
      });
    }
  }, [directorModeEnabled, gazeSmoothing]);

  const handleSmoothingChange = useCallback((value: number) => {
    setGazeSmoothing(value);
    if (directorModeEnabled) {
      sendToContent({
        type: "UPDATE_DIRECTOR_SETTINGS",
        crowdingIntensity,
        gazeSmoothing: value,
      });
    }
  }, [directorModeEnabled, crowdingIntensity]);

  const handleStartCalibration = useCallback(() => {
    setIsCalibrating(true);
    sendToContent({ type: "START_CALIBRATION" });
  }, []);

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
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-4 right-4 bottom-4 w-[360px] z-[999999] flex flex-col bg-wit-bg rounded-wit-lg shadow-wit-lg border border-wit-border overflow-hidden"
            style={{ fontFamily: '"Inter", system-ui, sans-serif' }}
          >
            {/* ─── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-wit-primary/5 to-wit-secondary/5 border-b border-wit-border">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-wit-primary to-wit-secondary">
                  <span className="text-white font-display font-bold text-sm">W</span>
                </div>
                <div>
                  <h1 className="font-display font-bold text-wit-text text-[1.05rem] tracking-tight">
                    WIT
                  </h1>
                  <p className="font-display text-[10px] text-wit-text-muted tracking-wide uppercase">
                    Words In Technicolor
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 text-wit-text-muted hover:text-wit-text"
                  title="Minimize"
                >
                  <Minus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* ─── Content ────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto wit-scrollbar px-4 py-4">
              <Tabs defaultValue="colors" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="colors" className="gap-1.5">
                    <Palette className="w-3.5 h-3.5" />
                    Colors
                  </TabsTrigger>
                  <TabsTrigger value="director" className="gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    Director
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="colors">
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
                  />
                </TabsContent>

                <TabsContent value="director">
                  <DirectorMode
                    enabled={directorModeEnabled}
                    onToggle={handleDirectorToggle}
                    isCalibrating={isCalibrating}
                    isTracking={isTracking}
                    onStartCalibration={handleStartCalibration}
                    crowdingIntensity={crowdingIntensity}
                    onCrowdingIntensityChange={handleCrowdingChange}
                    gazeSmoothing={gazeSmoothing}
                    onGazeSmoothingChange={handleSmoothingChange}
                    webcamStatus={webcamStatus}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* ─── Footer ─────────────────────────────────────────────── */}
            <StatusBar
              backendConnected={backendConnected}
              gazeConnected={directorModeEnabled && isTracking}
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
