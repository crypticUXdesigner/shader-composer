/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/** Avoid browser CORS: rpc.audiotool.com preflight fails from web origins unless whitelisted client-side. */
const audiotoolRpcProxy = {
  target: 'https://rpc.audiotool.com',
  changeOrigin: true,
  secure: true,
  rewrite: (path: string) => path.replace(/^\/__audiotool_rpc__/, ''),
} as const;

export default defineConfig({
  base: '/ShaderNoice/',
  /** Prefer Svelte's client entry (`mount`/`unmount`) for Vitest + DOM environments (see `lifecycle_function_unavailable`). */
  resolve: {
    conditions: ['browser', 'module', 'import', 'default'],
  },
  plugins: [
    svelte({
      compilerOptions: {
        runes: true
      },
      dynamicCompileOptions({ filename }) {
        if (filename.includes('node_modules')) {
          return { runes: false };
        }
      },
      onwarn(warning, defaultHandler) {
        if (warning.code?.startsWith('a11y-') || warning.code?.startsWith('a11y_')) return;
        defaultHandler(warning);
      }
    })
  ],
  server: {
    port: 3000,
    /** So `http://127.0.0.1:3000` works (Audiotool OAuth forbids `localhost` in redirect URIs). */
    host: true,
    open: false,
    proxy: {
      '/__audiotool_rpc__': audiotoolRpcProxy,
    },
  },
  preview: {
    proxy: {
      '/__audiotool_rpc__': audiotoolRpcProxy,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        webgpuGoldenHarness: resolve(__dirname, 'webgpu-golden-harness.html')
      }
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
