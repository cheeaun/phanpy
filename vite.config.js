import preact from '@preact/preset-vite';
import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        compose: resolve(__dirname, 'compose/index.html'),
      },
    },
  },
});
