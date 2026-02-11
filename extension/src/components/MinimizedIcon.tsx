import React from "react";
import { motion } from "framer-motion";
import { APP_NAME, APP_COLOR } from "@/lib/config";

interface MinimizedIconProps {
  onClick: () => void;
  isActive: boolean;
}

export const MinimizedIcon: React.FC<MinimizedIconProps> = ({
  onClick,
  isActive,
}) => {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-[999998] flex items-center justify-center w-10 h-10 rounded-xl cursor-pointer border-0 outline-none focus:outline-none"
      style={{
        background: isActive ? "#FEFCF8" : "#F5F0E8",
        boxShadow: isActive
          ? "0 4px 16px rgba(0,0,0,0.1), 0 0 0 1px #E2D9CA"
          : "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px #E8E0D4",
      }}
      whileHover={{ scale: 1.12, rotate: 3 }}
      whileTap={{ scale: 0.9 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
      title={`Open ${APP_NAME} Panel`}
    >
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-xl"
          style={{ border: "1.5px solid rgba(74,111,165,0.25)" }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <span
        className="font-display font-extrabold text-sm"
        style={{ color: APP_COLOR }}
      >
        {APP_NAME.charAt(0)}
      </span>
    </motion.button>
  );
};
