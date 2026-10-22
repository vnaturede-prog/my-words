import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub project Pages lives below /my-words/; root-hosted deployments use /.
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      scope: base,
      registerType: "prompt",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        id: base,
        name: "My Words 我的随身单词本",
        short_name: "My Words",
        description: "我的随身英语单词本，记录、收藏、复习，离线也能学。",
        lang: "zh-CN",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#faf9f5",
        theme_color: "#faf9f5",
        icons: [
          {
            src: `${base}pwa-192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${base}pwa-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${base}pwa-maskable-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        // Dictionary and remote audio intentionally remain network requests.
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
