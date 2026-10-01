import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "logo.svg",
        "festival.svg",
        "favicon-32.png",
        "favicon.ico",
        "icon-192.png",
        "icon-512.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Haru Cards — Learn Korean",
        short_name: "Haru Cards",
        description: "A little Korean, every day.",
        theme_color: "#642d47",
        background_color: "#fff7f3",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});
