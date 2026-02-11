import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, mkdirSync, readdirSync } from "fs";

// Plugin to copy public files and manifest to dist
function copyExtensionFiles() {
  return {
    name: "copy-extension-files",
    closeBundle() {
      try {
        mkdirSync(resolve(__dirname, "dist"), { recursive: true });
        copyFileSync(
          resolve(__dirname, "public/manifest.json"),
          resolve(__dirname, "dist/manifest.json"),
        );
        mkdirSync(resolve(__dirname, "dist/icons"), { recursive: true });
        const iconsDir = resolve(__dirname, "public/icons");
        for (const file of readdirSync(iconsDir)) {
          if (file.endsWith(".png")) {
            copyFileSync(
              resolve(iconsDir, file),
              resolve(__dirname, "dist/icons", file),
            );
          }
        }
        // Copy content CSS
        mkdirSync(resolve(__dirname, "dist/src/content"), { recursive: true });
        copyFileSync(
          resolve(__dirname, "src/content/content.css"),
          resolve(__dirname, "dist/src/content/content.css"),
        );
        console.log("✅ Extension files copied to dist/");
      } catch (e) {
        console.error("Failed to copy extension files:", e);
      }
    },
  };
}

// Get build target from env
const target = process.env.BUILD_TARGET;

// Content script config (IIFE, self-contained)
const contentConfig = defineConfig({
  plugins: [],
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: false,
    minify: false,
    lib: {
      entry: resolve(__dirname, "src/content/index.ts"),
      name: "WITContent",
      formats: ["iife"],
      fileName: () => "src/content/index.js",
    },
    rollupOptions: {
      output: {
        extend: true,
        assetFileNames: "src/content/content.[ext]",
      },
    },
  },
});

// Background script config (ES module - supported by MV3)
const backgroundConfig = defineConfig({
  plugins: [],
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: false,
    minify: false,
    lib: {
      entry: resolve(__dirname, "src/background/index.ts"),
      formats: ["es"],
      fileName: () => "src/background/index.js",
    },
  },
});

// Panel config (React app)
const panelConfig = defineConfig({
  plugins: [react(), copyExtensionFiles()],
  resolve: { alias: { "@": resolve(__dirname, "./src") } },
  build: {
    outDir: "dist",
    emptyOutDir: true, // Only the first build clears dist
    sourcemap: false,
    minify: false,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, "src/panel/index.html"),
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    modulePreload: false,
  },
  css: {
    modules: { localsConvention: "camelCase" },
  },
});

// Export based on build target
let config;
if (target === "content") {
  config = contentConfig;
} else if (target === "background") {
  config = backgroundConfig;
} else {
  config = panelConfig;
}

export default config;
