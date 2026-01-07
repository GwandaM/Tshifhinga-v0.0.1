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
  build: {
    minify: mode === 'production' ? 'esbuild' : false,
    sourcemap: mode === 'production' ? false : true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'radix-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: "src/electron/main.ts",
        vite: {
          build: {
            minify: mode === 'production',
            sourcemap: false,
          }
        }
      },
      {
        entry: "src/electron/preload.ts",
        onstart(options) {
          // Onstart hook work like server hook.
          // Load a URL manually instead of the default.
          options.startup();
        },
        vite: {
          build: {
            minify: mode === 'production',
            sourcemap: false,
          }
        }
      },
      {
        entry: "src/electron/database.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: mode === 'production',
            sourcemap: false,
          }
        }
      },
      {
        entry: "src/electron/auth-service.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: mode === 'production',
            sourcemap: false,
          }
        }
      },
      {
        entry: "src/electron/config-service.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: mode === 'production',
            sourcemap: false,
          }
        }
      },
      {
        entry: "src/electron/logger-service.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: mode === 'production',
            sourcemap: false,
          }
        }
      },
      {
        entry: "src/electron/migration-service.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: mode === 'production',
            sourcemap: false,
          }
        }
      },
      {
        entry: "src/electron/database-connection-pool.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: mode === 'production',
            sourcemap: false,
          }
        }
      },
      {
        entry: "src/electron/validation-service.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: mode === 'production',
            sourcemap: false,
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