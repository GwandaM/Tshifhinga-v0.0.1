/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 8080,
    open: false,
  },
  plugins: [
    react(),
    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: "src/electron/main.ts",
      },
      {
        entry: "src/electron/preload.ts",
        onstart(options) {
          // Onstart hook work like server hook.
          // Load a URL manually instead of the default.
          options.startup();
        },
      },
      {
        entry: "src/electron/database.ts",
        vite: {
          build: {
            outDir: "dist-electron"
          }
        }
      },
      {
        entry: "src/electron/auth-service.ts",
        vite: {
          build: {
            outDir: "dist-electron"
          }
        }
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
  }
}));