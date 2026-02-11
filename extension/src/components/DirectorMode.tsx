import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Camera, Radio, AlertCircle, CheckCircle2 } from "lucide-react";

interface DirectorModeProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  isCalibrating: boolean;
  isTracking: boolean;
  onStartCalibration: () => void;
  crowdingIntensity: string;
  onCrowdingIntensityChange: (intensity: string) => void;
  gazeSmoothing: number;
  onGazeSmoothingChange: (value: number) => void;
  webcamStatus: "unavailable" | "permission_denied" | "ready" | "active";
}

export const DirectorMode: React.FC<DirectorModeProps> = ({
  enabled,
  onToggle,
  isCalibrating,
  isTracking,
  onStartCalibration,
  crowdingIntensity,
  onCrowdingIntensityChange,
  gazeSmoothing,
  onGazeSmoothingChange,
  webcamStatus,
}) => {
  const statusColors = {
    unavailable: "bg-gray-400",
    permission_denied: "bg-wit-danger",
    ready: "bg-wit-accent",
    active: "bg-wit-success",
  };

  const statusLabels = {
    unavailable: "No Camera",
    permission_denied: "Permission Denied",
    ready: "Ready",
    active: "Tracking Active",
  };

  return (
    <div className="space-y-5">
      {/* Main Toggle */}
      <div className="flex items-center justify-between p-4 bg-wit-surface rounded-wit-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-wit-secondary/10">
            <Eye className="w-5 h-5 text-wit-secondary" />
          </div>
          <div>
            <p className="font-display font-semibold text-wit-text text-wit-base">
              Director Mode
            </p>
            <p className="font-display text-wit-text-muted text-xs mt-0.5">
              Eye tracking & focus assist
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isTracking && (
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Radio className="w-4 h-4 text-wit-success" />
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
              {/* Webcam Status */}
              <div className="flex items-center gap-3 p-3 bg-wit-surface/60 rounded-wit">
                <div className={`w-2.5 h-2.5 rounded-full ${statusColors[webcamStatus]}`} />
                <div className="flex-1">
                  <p className="font-display text-wit-sm font-medium text-wit-text">
                    Camera: {statusLabels[webcamStatus]}
                  </p>
                </div>
                {webcamStatus === "active" && (
                  <Badge variant="success" className="text-[10px]">LIVE</Badge>
                )}
              </div>

              {/* Info Box */}
              <div className="flex gap-3 p-3 bg-blue-50 rounded-wit border border-blue-100">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="font-display text-xs text-blue-700 leading-relaxed">
                  <p className="font-medium mb-1">How Director Mode works:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Uses your webcam to track eye movement</li>
                    <li>Highlights words you're looking at</li>
                    <li>Reduces visual crowding around your focus</li>
                    <li>Calibrate first for best accuracy</li>
                  </ul>
                </div>
              </div>

              {/* Calibration */}
              <Button
                variant={isCalibrating ? "secondary" : "outline"}
                size="sm"
                onClick={onStartCalibration}
                className="w-full gap-2"
                disabled={webcamStatus === "unavailable" || webcamStatus === "permission_denied"}
              >
                <Camera className="w-4 h-4" />
                {isCalibrating ? "Calibrating..." : "Start Calibration"}
              </Button>

              {/* Crowding Reduction Intensity */}
              <div className="space-y-2">
                <label className="font-display font-medium text-wit-sm text-wit-text">
                  Focus Intensity
                </label>
                <Select value={crowdingIntensity} onValueChange={onCrowdingIntensityChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Subtle — gentle focus assist</SelectItem>
                    <SelectItem value="medium">Moderate — clear focus area</SelectItem>
                    <SelectItem value="high">Strong — maximum clarity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Gaze Smoothing */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-display font-medium text-wit-sm text-wit-text">
                    Gaze Smoothing
                  </label>
                  <span className="font-display text-xs text-wit-text-muted">
                    {gazeSmoothing}
                  </span>
                </div>
                <Slider
                  value={[gazeSmoothing]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={(v) => onGazeSmoothingChange(v[0])}
                />
                <p className="font-display text-xs text-wit-text-muted">
                  Higher = smoother but slower tracking
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
