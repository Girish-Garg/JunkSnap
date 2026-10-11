import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Mock mode reads ../contracts/fixtures.
    fs: { allow: ['..'] },
  },
  // onnxruntime-web finds its .wasm next to its own module; pre-bundling would move the module.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  worker: { format: 'es' },
  build: {
    // MapLibre is ~1 MB; its own chunk stays cached across app releases.
    chunkSizeWarningLimit: 1100,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'maplibre', test: /node_modules[\\/]maplibre-gl/ }],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Above tests/setup.ts's 10 s wait bound, so a stuck wait fails with what it looked for, not a timeout.
    // Whole-app flows (sign in, type, send) take 1 to 2 s idle and up to 9 s with three suites sharing the CPU.
    testTimeout: 30_000,
  },
});
