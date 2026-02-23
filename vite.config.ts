import path from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import createHtmlPlugin from "vite-plugin-simple-html";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      open: process.env.NODE_ENV !== "CI",
      filename: "./dist/stats.html",
    }),
    createHtmlPlugin({
      minify: true,
      inject: {
        data: {
          mainScript: `src/main.tsx`,
        },
      },
    }),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
      },
      manifest: false, // Use existing manifest.json from public/
    }),
  ],
  define:
    process.env.NODE_ENV === "production" && process.env.VITE_SUPABASE_URL
      ? {
          "import.meta.env.VITE_IS_DEMO": JSON.stringify(
            process.env.VITE_IS_DEMO,
          ),
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
            process.env.VITE_SUPABASE_URL,
          ),
          "import.meta.env.VITE_SB_PUBLISHABLE_KEY": JSON.stringify(
            process.env.VITE_SB_PUBLISHABLE_KEY,
          ),
          "import.meta.env.VITE_INBOUND_EMAIL": JSON.stringify(
            process.env.VITE_INBOUND_EMAIL,
          ),
        }
      : undefined,
  base: "./",
  esbuild: {
    keepNames: true,
  },
  build: {
    sourcemap: true,
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: ["hubio-crm.fuchs-soehne.de"],
  },
  optimizeDeps: {
    include: [
      "react-dom/client",
      "ra-core",
      "react-router",
      "@tanstack/react-query",
      "@tanstack/react-query-persist-client",
      "@tanstack/query-async-storage-persister",
      "lucide-react",
      "ra-i18n-polyglot",
      "ra-language-german",
      "ra-supabase-language-english",
      "react-error-boundary",
      "react-hook-form",
      "ra-supabase-core",
      "jsonexport/dist",
      "date-fns",
      "date-fns/locale",
      "sonner",
      "@radix-ui/react-slot",
      "class-variance-authority",
      "@radix-ui/react-label",
      "clsx",
      "tailwind-merge",
      "@radix-ui/react-tabs",
      "@radix-ui/react-separator",
      "lodash",
      "lodash/get",
      "lodash/get.js",
      "lodash/matches",
      "lodash/pickBy",
      "lodash/isEqual",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-toggle-group",
      "@supabase/supabase-js",
      "@radix-ui/react-accordion",
      "@radix-ui/react-avatar",
      "papaparse",
      "react-dropzone",
      "@radix-ui/react-dialog",
      "@radix-ui/react-checkbox",
      "query-string",
      "@radix-ui/react-tooltip",
      "inflection",
      "react-cropper",
      "@streamparser/json-whatwg",
      "mime/lite",
      "@radix-ui/react-select",
      "@radix-ui/react-toggle",
      "diacritic",
      "@radix-ui/react-popover",
      "cmdk",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-switch",
      "vaul",
      "dompurify",
      "marked",
      "@nivo/bar",
      "@radix-ui/react-progress",
    ],
  },
});
