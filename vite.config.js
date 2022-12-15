import preact from '@preact/preset-vite';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { defineConfig, splitVendorChunkPlugin } from 'vite';

const commitHash = execSync('git rev-parse --short HEAD').toString().trim();

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(Date.now()),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
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
