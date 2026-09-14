import { defineConfig } from "vite";
export default defineConfig({
  server: {
    host: "127.0.0.1",
    fs: {
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "**/DEVELOPMENT-README.md",
      ],
    },
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/jspdf|fflate|fast-png|iobuffer/.test(id)) return "invoice-pdf";
          if (/motion/.test(id)) return "motion";
          if (/react|scheduler/.test(id)) return "react";
        },
      },
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(warning);
      },
    },
  },
});
