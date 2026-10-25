import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
  plugins: [
    react(),
    // Installable PWA. Service-worker registration and the post-deploy update
    // flow live in src/lib/pwa-update.ts, so the plugin doesn't inject its own.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Responsibilities App",
        short_name: "Responsibilities App",
        description: "Chores, goals and rewards for the whole family.",
        theme_color: "#FBF8F3",
        background_color: "#FBF8F3",
        display: "standalone",
        orientation: "any",
        scope: "/",
        start_url: "/",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,svg,png,ico}"],
        globIgnores: ["**/*.html"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "app-html",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: null,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
  build: {
    target: "es2022",
    minify: mode === "production" ? "terser" : "esbuild",
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@supabase")) return "vendor-supabase";
          if (/react|@radix-ui|cmdk|vaul|sonner|@tanstack/.test(id) && !/recharts|react-smooth/.test(id)) return "vendor";
          return undefined;
        },
      },
    },
  },
}));
