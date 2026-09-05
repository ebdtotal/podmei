import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["pdfjs-dist", "xlsx"],
  },
  server: {
    host: true,
    port: 5175,
    strictPort: true,
    open: "http://127.0.0.1:5175/",
    watch: {
      ignored: ["**/podmei-dist.zip", "**/*.zip"],
    },
  },
});
