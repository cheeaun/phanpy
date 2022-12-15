import preact from '@preact/preset-vite';
import { resolve } from 'path';
import { defineConfig, splitVendorChunkPlugin } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), splitVendorChunkPlugin()],
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        compose: resolve(__dirname, 'compose/index.html'),
      },
    },
  },
});
