import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/shader-composer/',
  plugins: [
    svelte({
      compilerOptions: {
        runes: true
      },
      onwarn(warning, defaultHandler) {
        // Suppress all aria/a11y warnings
        if (warning.code?.startsWith('a11y-') || warning.code?.startsWith('a11y_')) return;
        defaultHandler(warning);
      }
    })
  ],
  server: {
    port: 3000,
    open: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});

