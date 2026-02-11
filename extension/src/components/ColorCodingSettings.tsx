import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Palette, MousePointer2, Radio, ChevronDown } from "lucide-react";
import type { LegendItem } from "@/lib/api";

interface ColorCodingSettingsProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  scheme: string;
  onSchemeChange: (scheme: string) => void;
  emphasis: string;
  onEmphasisChange: (emphasis: string) => void;
  showFunctionWords: boolean;
  onShowFunctionWordsChange: (show: boolean) => void;
  legend: LegendItem[];
  isProcessing: boolean;
  directorEnabled: boolean;
  onDirectorToggle: (enabled: boolean) => void;
  isTracking: boolean;
  crowdingIntensity: string;
  onCrowdingIntensityChange: (intensity: string) => void;
}

// ─── Pill ──────────────────────────────────────────────────────────────────────

const Pill: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}> = ({ active, onClick, children, color }) => (
  <button
    onClick={onClick}
    className="flex-1 py-[6px] rounded-lg text-[13px] font-display font-semibold transition-all duration-200"
    style={
      active
        ? {
            background: color || "#4A6FA5",
            color: "#fff",
            boxShadow: `0 2px 8px ${color || "#4A6FA5"}33`,
          }
        : {
            background: "#F5F0E8",
            color: "#8A8078",
            border: "1px solid #E8E0D4",
          }
    }
  >
    {children}
  </button>
);

// ─── Section Label ─────────────────────────────────────────────────────────────

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    className="font-display font-semibold text-[11px] uppercase tracking-wider mb-2"
    style={{ color: "#B0A89C" }}
  >
    {children}
  </p>
);

// ─── Component ─────────────────────────────────────────────────────────────────

export const ColorCodingSettings: React.FC<ColorCodingSettingsProps> = ({
  enabled,
  onToggle,
  scheme,
  onSchemeChange,
  emphasis,
  onEmphasisChange,
  showFunctionWords,
  onShowFunctionWordsChange,
  legend,
  isProcessing,
  directorEnabled,
  onDirectorToggle,
  isTracking,
  crowdingIntensity,
  onCrowdingIntensityChange,
}) => {
  const [showLegend, setShowLegend] = React.useState(false);

  return (
    <div className="space-y-4">
      {/* ─── Main Toggle ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300"
        style={{
          background: enabled
            ? "linear-gradient(135deg, rgba(74,111,165,0.08), rgba(107,158,107,0.06))"
            : "#F5F0E8",
          border: `1px solid ${enabled ? "rgba(74,111,165,0.15)" : "#E8E0D4"}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{
              background: enabled
                ? "linear-gradient(135deg, #4A6FA5, #6B9E6B)"
                : "#E2D9CA",
            }}
          >
            <Palette
              className={`w-[18px] h-[18px] ${enabled ? "text-white" : "text-stone-400"}`}
            />
          </div>
          <div>
            <p className="font-display font-bold text-[15px] leading-tight text-stone-800">
              Color Coding
            </p>
            <p
              className="font-display text-[12px] mt-0.5"
              style={{ color: enabled ? "#5A8F5A" : "#B0A89C" }}
            >
              {enabled ? (isProcessing ? "Processing\u2026" : "Active") : "Off"}
            </p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>

      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-4">
              {/* ─── Theme ────────────────────────────────────────── */}
              <div>
                <Label>Theme</Label>
                <div className="flex gap-2">
                  <Pill
                    active={scheme === "default"}
                    onClick={() => onSchemeChange("default")}
                    color="#4A6FA5"
                  >
                    Default
                  </Pill>
                  <Pill
                    active={scheme === "high_contrast"}
                    onClick={() => onSchemeChange("high_contrast")}
                    color="#C75C5C"
                  >
                    Vivid
                  </Pill>
                  <Pill
                    active={scheme === "pastel"}
                    onClick={() => onSchemeChange("pastel")}
                    color="#9B7DC4"
                  >
                    Pastel
                  </Pill>
                </div>
              </div>

              {/* ─── Emphasis ─────────────────────────────────────── */}
              <div>
                <Label>Emphasis</Label>
                <div className="flex gap-2">
                  <Pill
                    active={emphasis === "normal"}
                    onClick={() => onEmphasisChange("normal")}
                    color="#4A8A4A"
                  >
                    Light
                  </Pill>
                  <Pill
                    active={emphasis === "medium"}
                    onClick={() => onEmphasisChange("medium")}
                    color="#D4952E"
                  >
                    Medium
                  </Pill>
                  <Pill
                    active={emphasis === "high"}
                    onClick={() => onEmphasisChange("high")}
                    color="#C75C5C"
                  >
                    Strong
                  </Pill>
                </div>
              </div>

              {/* ─── Compact buttons row ──────────────────────────── */}
              <div className="flex gap-2">
                <button
                  onClick={() => onShowFunctionWordsChange(!showFunctionWords)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-[6px] rounded-lg text-[13px] font-display font-medium transition-all"
                  style={{
                    background: showFunctionWords
                      ? "rgba(232,168,56,0.12)"
                      : "#F5F0E8",
                    color: showFunctionWords ? "#C8922A" : "#B0A89C",
                    border: `1px solid ${showFunctionWords ? "rgba(232,168,56,0.25)" : "#E8E0D4"}`,
                  }}
                >
                  {showFunctionWords ? "\u2713 " : ""}Small words
                </button>
                <button
                  onClick={() => setShowLegend(!showLegend)}
                  className="flex-1 flex items-center justify-center gap-1 py-[6px] rounded-lg text-[13px] font-display font-medium transition-colors"
                  style={{
                    background: "#F5F0E8",
                    color: "#B0A89C",
                    border: "1px solid #E8E0D4",
                  }}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${showLegend ? "rotate-180" : ""}`}
                  />
                  Legend
                </button>
              </div>

              {/* ─── Legend ────────────────────────────────────────── */}
              <AnimatePresence>
                {showLegend && legend.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 py-2.5 rounded-lg"
                      style={{
                        background: "#F9F5EE",
                        border: "1px solid #E8E0D4",
                      }}
                    >
                      {legend.map((item) => (
                        <div
                          key={item.category}
                          className="flex items-center gap-2"
                        >
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-display text-[12px] text-stone-600 truncate">
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ─── Director Mode ────────────────────────────────── */}
              <div
                className="rounded-xl overflow-hidden transition-all duration-300"
                style={{
                  background: directorEnabled
                    ? "rgba(107,158,107,0.06)"
                    : "#F5F0E8",
                  border: `1px solid ${directorEnabled ? "rgba(107,158,107,0.2)" : "#E8E0D4"}`,
                }}
              >
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <MousePointer2
                      className={`w-4 h-4 ${directorEnabled ? "text-green-600" : "text-stone-400"}`}
                    />
                    <span className="font-display font-semibold text-[14px] text-stone-800">
                      Director
                    </span>
                    {isTracking && (
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <Radio className="w-3.5 h-3.5 text-green-600" />
                      </motion.div>
                    )}
                  </div>
                  <Switch
                    checked={directorEnabled}
                    onCheckedChange={onDirectorToggle}
                  />
                </div>

                <AnimatePresence>
                  {directorEnabled && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3">
                        <div className="flex gap-2">
                          <Pill
                            active={crowdingIntensity === "low"}
                            onClick={() => onCrowdingIntensityChange("low")}
                            color="#4A8A4A"
                          >
                            Subtle
                          </Pill>
                          <Pill
                            active={crowdingIntensity === "medium"}
                            onClick={() => onCrowdingIntensityChange("medium")}
                            color="#4A6FA5"
                          >
                            Medium
                          </Pill>
                          <Pill
                            active={crowdingIntensity === "high"}
                            onClick={() => onCrowdingIntensityChange("high")}
                            color="#D4952E"
                          >
                            Strong
                          </Pill>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
