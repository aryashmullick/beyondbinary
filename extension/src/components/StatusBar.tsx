import React from "react";

interface StatusBarProps {
  backendConnected: boolean;
  colorCodingActive: boolean;
  directorModeActive: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  backendConnected,
  colorCodingActive,
  directorModeActive,
}) => {
  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 rounded-b-2xl"
      style={{
        background: "#F5F0E8",
        borderTop: "1px solid #EDE6D8",
      }}
    >
      <div
        className="flex items-center gap-1.5"
        title={backendConnected ? "Backend connected" : "Backend offline"}
      >
        <span
          className="block w-[6px] h-[6px] rounded-full"
          style={{
            background: backendConnected ? "#5A8F5A" : "#C75C5C",
            boxShadow: `0 0 4px ${backendConnected ? "rgba(90,143,90,0.4)" : "rgba(199,92,92,0.4)"}`,
          }}
        />
        <span className="font-display text-[11px] text-stone-400">
          {backendConnected ? "Connected" : "Offline"}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {colorCodingActive && (
          <span
            className="px-2 py-[2px] rounded-full text-[10px] font-display font-semibold text-white"
            style={{ background: "#4A6FA5" }}
          >
            Colors
          </span>
        )}
        {directorModeActive && (
          <span
            className="px-2 py-[2px] rounded-full text-[10px] font-display font-semibold text-white"
            style={{ background: "#6B9E6B" }}
          >
            Director
          </span>
        )}
      </div>
    </div>
  );
};
