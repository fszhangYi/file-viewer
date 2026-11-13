import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/** file:// (Electron loadFile) rejects module/link tags with crossorigin. */
function stripCrossOriginForElectron() {
  return {
    name: 'strip-crossorigin-for-electron',
    transformIndexHtml(html: string) {
      return html.replace(/\s+crossorigin(?:="[^"]*")?/gi, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), stripCrossOriginForElectron()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  assetsInclude: ['**/*.wasm'],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    // Prebundle CJS → ESM so `import occt from 'occt-import-js'` works in dev.
    include: ['occt-import-js'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  base: './',
});
