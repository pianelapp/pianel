import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const uiSrc = resolve(__dirname, "../../packages/ui/src");
const coreDist = resolve(__dirname, "../../packages/core/dist");

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: [
      { find: "@pianel/core", replacement: coreDist },
      { find: "@pianel/ui", replacement: uiSrc },
    ],
  },
  plugins: [
    react(),
    // PWA installability + offline app shell (Tasks 8.1–8.3).
    VitePWA({
      // injectManifest: ship our own service worker (src/sw.ts) into which
      // vite-plugin-pwa injects the precache manifest.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // Prompt-based update flow: the registration surfaces a "new version"
      // prompt; accepting messages SKIP_WAITING and reloads atomically.
      registerType: "prompt",
      // We register manually (src/host/registerPwa.ts) to drive a controlled
      // update prompt, so do not auto-inject a registration script.
      injectRegister: null,
      includeAssets: [
        "fonts/Orbitron.ttf",
        "icons/icon.svg",
        "icons/apple-touch-icon-180.png",
      ],
      manifest: {
        name: "Pianel",
        short_name: "Pianel",
        description:
          "Offline-first control surface for your Roland piano.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        // Absolute black so there is no color flash on launch (Req 6.5).
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      injectManifest: {
        // Precache the entire shell: HTML, hashed JS/CSS, the LCD font, every
        // icon, and any bundled static JSON so offline cold launches need no
        // network (Req 7.1).
        globPatterns: [
          "**/*.{js,css,html,ttf,woff,woff2,png,svg,json,ico}",
        ],
      },
      devOptions: {
        // Avoid serving stale SW caches during development.
        enabled: false,
        type: "module",
        navigateFallback: "index.html",
      },
    }),
  ],
  css: {
    postcss: resolve(__dirname, "postcss.config.cjs"),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
      },
    },
  },
});
