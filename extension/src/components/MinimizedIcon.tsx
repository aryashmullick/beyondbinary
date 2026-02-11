import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface MinimizedIconProps {
  onClick: () => void;
  isActive: boolean;
}

export const MinimizedIcon: React.FC<MinimizedIconProps> = ({ onClick, isActive }) => {
  return (
    <motion.button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-[999998] flex items-center justify-center w-14 h-14 rounded-full shadow-wit-lg cursor-pointer border-0 outline-none focus:outline-none"
      style={{
        background: isActive
          ? "linear-gradient(135deg, #4A6FA5 0%, #7B9E6B 100%)"
          : "linear-gradient(135deg, #6B6560 0%, #4A6FA5 100%)",
      }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
      title="Open WIT Panel"
    >
      {/* Animated ring when active */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-white/30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Icon */}
      <div className="relative">
        <span className="text-white font-display font-bold text-lg tracking-tight">
          W
        </span>
        <motion.div
          className="absolute -top-1 -right-2"
          animate={isActive ? { rotate: [0, 15, -15, 0] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="w-3 h-3 text-yellow-300" />
        </motion.div>
      </div>
    </motion.button>
  );
};
