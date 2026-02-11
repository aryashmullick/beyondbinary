import React from "react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Server, Wifi, WifiOff } from "lucide-react";

interface StatusBarProps {
  backendConnected: boolean;
  gazeConnected: boolean;
  colorCodingActive: boolean;
  directorModeActive: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  backendConnected,
  gazeConnected,
  colorCodingActive,
  directorModeActive,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-wit-surface/50 border-t border-wit-border rounded-b-wit-lg">
      <div className="flex items-center gap-2">
        {/* Backend Status */}
        <div className="flex items-center gap-1.5" title={backendConnected ? "Backend connected" : "Backend offline"}>
          {backendConnected ? (
            <Wifi className="w-3 h-3 text-wit-success" />
          ) : (
            <WifiOff className="w-3 h-3 text-wit-danger" />
          )}
          <span className="font-display text-[10px] text-wit-text-muted">
            {backendConnected ? "Connected" : "Offline"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {colorCodingActive && (
          <Badge variant="outline" className="text-[10px] py-0 h-5">
            🎨 Colors
          </Badge>
        )}
        {directorModeActive && (
          <Badge variant="outline" className="text-[10px] py-0 h-5">
            👁 Director
          </Badge>
        )}
      </div>
    </div>
  );
};
