import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

// The 'VITE_ENTRY' environment variable allows us to run separate build passes
// for each component. This is critical for Chrome Extensions because:
// 1. Content scripts cannot use ES imports/chunks easily (they need to be self-contained IIFEs).
// 2. Separate passes prevent Vite from extracting shared 'helpers' into a separate chunk.
const entry = process.env.VITE_ENTRY || 'all';

const entries: Record<string, string> = {
  popup: resolve(__dirname, 'popup.html'),
  content_script: resolve(__dirname, 'src/content/content_script.ts'),
  background: resolve(__dirname, 'src/background/background.ts')
};

export default defineConfig({
  plugins: entry === 'popup' || entry === 'all' ? [tailwindcss()] : [],
  build: {
    outDir: 'dist',
    // Only wipe the directory on the first pass (popup/all)
    emptyOutDir: entry === 'popup' || entry === 'all',
    rollupOptions: {
      // If VITE_ENTRY is specified, build ONLY that entry.
      input: entry === 'all' ? entries : { [entry]: entries[entry] },
      output: {
        // Use ESM for the popup (Chrome supports it in popups), which allows Vite to
        // correctly replace script tags in popup.html.
        // Use IIFE for the others to ensure they are single, self-contained files.
        format: entry === 'popup' ? 'es' : 'iife',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: 'assets/[name].[ext]',
      }
    }
  }
});
