import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Palette, Sparkles, Info } from "lucide-react";
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
}

const schemeDescriptions: Record<string, string> = {
  default: "Balanced colors for comfortable reading",
  high_contrast: "Bold, vivid colors for maximum distinction",
  pastel: "Soft, gentle colors for reduced eye strain",
};

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
}) => {
  const [showLegend, setShowLegend] = React.useState(false);

  return (
    <div className="space-y-5">
      {/* Main Toggle */}
      <div className="flex items-center justify-between p-4 bg-wit-surface rounded-wit-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-wit-primary/10">
            <Palette className="w-5 h-5 text-wit-primary" />
          </div>
          <div>
            <p className="font-display font-semibold text-wit-text text-wit-base">
              Color Coding
            </p>
            <p className="font-display text-wit-text-muted text-xs mt-0.5">
              Colors text by word type
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isProcessing && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-4 h-4 text-wit-accent" />
            </motion.div>
          )}
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>
      </div>

      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-1">
              {/* Color Scheme */}
              <div className="space-y-2">
                <label className="font-display font-medium text-wit-sm text-wit-text">
                  Color Theme
                </label>
                <Select value={scheme} onValueChange={onSchemeChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">🎨 Default</SelectItem>
                    <SelectItem value="high_contrast">🔆 High Contrast</SelectItem>
                    <SelectItem value="pastel">🌸 Pastel</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-wit-text-muted font-display">
                  {schemeDescriptions[scheme]}
                </p>
              </div>

              {/* Emphasis Level */}
              <div className="space-y-2">
                <label className="font-display font-medium text-wit-sm text-wit-text">
                  Emphasis Level
                </label>
                <Select value={emphasis} onValueChange={onEmphasisChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="medium">Medium — bolded subjects</SelectItem>
                    <SelectItem value="high">High — bold + underlines</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Function Words Toggle */}
              <div className="flex items-center justify-between p-3 bg-wit-surface/60 rounded-wit">
                <div>
                  <p className="font-display font-medium text-wit-sm text-wit-text">
                    Color Small Words
                  </p>
                  <p className="font-display text-xs text-wit-text-muted mt-0.5">
                    "the", "is", "and", etc.
                  </p>
                </div>
                <Switch
                  checked={showFunctionWords}
                  onCheckedChange={onShowFunctionWordsChange}
                />
              </div>

              {/* Legend Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLegend(!showLegend)}
                className="w-full gap-2"
              >
                <Info className="w-4 h-4" />
                {showLegend ? "Hide" : "Show"} Color Legend
              </Button>

              <AnimatePresence>
                {showLegend && legend.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-2 p-3 bg-wit-surface/40 rounded-wit">
                      {legend.map((item) => (
                        <div key={item.category} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-display text-xs text-wit-text truncate">
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
