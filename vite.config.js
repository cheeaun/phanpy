import preact from '@preact/preset-vite';
import { execSync } from 'child_process';
import fs from 'fs';
import { resolve } from 'path';
import { defineConfig, loadEnv, splitVendorChunkPlugin } from 'vite';
import generateFile from 'vite-plugin-generate-file';
import htmlPlugin from 'vite-plugin-html-config';
import { VitePWA } from 'vite-plugin-pwa';
import removeConsole from 'vite-plugin-remove-console';

const { NODE_ENV } = process.env;
const {
  VITE_CLIENT_NAME: CLIENT_NAME,
  VITE_CLIENT_ID: CLIENT_ID,
  VITE_APP_ERROR_LOGGING: ERROR_LOGGING,
} = loadEnv('production', process.cwd());

const now = new Date();
const commitHash = execSync('git rev-parse --short HEAD').toString().trim();

const rollbarCode = fs.readFileSync(
  resolve(__dirname, './rollbar.js'),
  'utf-8',
);

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  mode: NODE_ENV,
  define: {
    __BUILD_TIME__: JSON.stringify(now),
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  server: {
    host: true,
  },
  plugins: [
    preact(),
    splitVendorChunkPlugin(),
    removeConsole({
      includes: ['log', 'debug', 'info', 'warn', 'error'],
    }),
    htmlPlugin({
      headScripts: ERROR_LOGGING ? [rollbarCode] : [],
    }),
    generateFile([
      {
        type: 'json',
        output: './version.json',
        data: {
          buildTime: now,
          commitHash,
        },
      },
    ]),
    VitePWA({
      manifest: {
        id: CLIENT_ID,
        name: CLIENT_NAME,
        short_name: CLIENT_NAME,
        description: 'Minimalistic opinionated Mastodon web client',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'logo-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'logo-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      strategies: 'injectManifest',
      injectRegister: 'inline',
      injectManifest: {
        // Prevent "Unable to find a place to inject the manifest" error
        injectionPoint: undefined,
      },
      devOptions: {
        enabled: NODE_ENV === 'development',
        type: 'module',
      },
    }),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      treeshake: false,
      input: {
        main: resolve(__dirname, 'index.html'),
        compose: resolve(__dirname, 'compose/index.html'),
      },
      output: {
        chunkFileNames: (chunkInfo) => {
          const { facadeModuleId } = chunkInfo;
          if (facadeModuleId && facadeModuleId.includes('icon')) {
            return 'assets/icons/[name]-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
