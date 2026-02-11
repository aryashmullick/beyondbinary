/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        // Dyslexia-friendly palette
        wit: {
          bg: "#FFFEF7", // Warm cream background
          surface: "#FFF8E7", // Slightly warmer surface
          border: "#E8DCC8", // Warm border
          text: "#2D2A26", // Warm dark text (not pure black)
          "text-muted": "#6B6560", // Muted text
          primary: "#4A6FA5", // Calm blue
          "primary-hover": "#3D5D8A",
          secondary: "#7B9E6B", // Gentle green
          accent: "#E8A838", // Warm amber
          danger: "#C75C5C", // Soft red
          success: "#6B9E6B", // Success green
        },
      },
      fontFamily: {
        // OpenDyslexic is commonly recommended for dyslexia
        dyslexic: [
          '"OpenDyslexic"',
          '"Comic Sans MS"',
          '"Lexie Readable"',
          "Verdana",
          "sans-serif",
        ],
        display: ['"Inter"', "system-ui", "sans-serif"],
      },
      fontSize: {
        // Slightly larger base sizes for readability
        "wit-sm": ["0.9375rem", { lineHeight: "1.6" }],
        "wit-base": ["1.0625rem", { lineHeight: "1.75" }],
        "wit-lg": ["1.1875rem", { lineHeight: "1.75" }],
        "wit-xl": ["1.375rem", { lineHeight: "1.6" }],
      },
      spacing: {
        "wit-xs": "0.375rem",
        "wit-sm": "0.625rem",
        "wit-md": "1rem",
        "wit-lg": "1.5rem",
      },
      borderRadius: {
        wit: "0.75rem",
        "wit-lg": "1rem",
        "wit-full": "9999px",
      },
      boxShadow: {
        wit: "0 2px 12px rgba(45, 42, 38, 0.08)",
        "wit-lg": "0 4px 24px rgba(45, 42, 38, 0.12)",
        "wit-glow": "0 0 20px rgba(74, 111, 165, 0.15)",
      },
      animation: {
        "wit-pulse": "wit-pulse 2s ease-in-out infinite",
        "wit-slide-in": "wit-slide-in 0.3s ease-out",
        "wit-slide-out": "wit-slide-out 0.3s ease-in",
        "wit-fade-in": "wit-fade-in 0.2s ease-out",
        "wit-bounce-in": "wit-bounce-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "wit-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.05)", opacity: "0.9" },
        },
        "wit-slide-in": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "wit-slide-out": {
          from: { transform: "translateX(0)", opacity: "1" },
          to: { transform: "translateX(100%)", opacity: "0" },
        },
        "wit-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "wit-bounce-in": {
          from: { transform: "scale(0.3)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
