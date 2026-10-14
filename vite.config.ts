import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { subscribeChecklistPlugin } from "./vite.subscribe";

export default defineConfig({
  base: "/",
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    react(),
    subscribeChecklistPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon.png", "favicon-32.png", "apple-touch-icon.png", "brand/logo.png"],
      manifest: {
        name: "Safety Prep List",
        short_name: "Safety Prep List",
        description:
          "Hope for the best. Prepare for the rest. A living preparedness system from Safety Prep List.",
        theme_color: "#1E2A1F",
        background_color: "#F4F0E5",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/app",
        scope: "/",
        categories: ["lifestyle", "utilities"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest}"],
        globIgnores: ["**/__*", "**/404.html", "downloads/**"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Every route is the same single-page app, so the precached index.html opens any page offline.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/\/[^/?]+\.[a-z0-9]+$/i],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.destination === "image" && url.origin === self.location.origin,
            handler: "CacheFirst",
            options: {
              cacheName: "spl-images",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Public rows only. Account data is kept in IndexedDB per login, never in the service worker cache.
            urlPattern: ({ url }) =>
              url.pathname.includes("/rest/v1/safety_contacts") || url.pathname.includes("/rest/v1/products"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "spl-public-v2",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
});
