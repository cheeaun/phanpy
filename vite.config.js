import preact from '@preact/preset-vite';
import { execSync } from 'child_process';
import fs from 'fs';
import { resolve } from 'path';
import { uid } from 'uid/single';
import { defineConfig, loadEnv, splitVendorChunkPlugin } from 'vite';
import generateFile from 'vite-plugin-generate-file';
import htmlPlugin from 'vite-plugin-html-config';
import { VitePWA } from 'vite-plugin-pwa';
import removeConsole from 'vite-plugin-remove-console';

const allowedEnvPrefixes = ['VITE_', 'PHANPY_'];
const { NODE_ENV } = process.env;
const {
  PHANPY_CLIENT_NAME: CLIENT_NAME,
  PHANPY_APP_ERROR_LOGGING: ERROR_LOGGING,
} = loadEnv('production', process.cwd(), allowedEnvPrefixes);

const now = new Date();
let commitHash;
let fakeCommitHash = false;
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (error) {
  // If error, means git is not installed or not a git repo (could be downloaded instead of git cloned)
  // Fallback to random hash which should be different on every build run 🤞
  commitHash = uid();
  fakeCommitHash = true;
}

const rollbarCode = fs.readFileSync(
  resolve(__dirname, './rollbar.js'),
  'utf-8',
);

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  envPrefix: allowedEnvPrefixes,
  appType: 'mpa',
  mode: NODE_ENV,
  define: {
    __BUILD_TIME__: JSON.stringify(now),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __FAKE_COMMIT_HASH__: fakeCommitHash,
  },
  server: {
    host: true,
  },
  css: {
    preprocessorMaxWorkers: 1,
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
        name: CLIENT_NAME,
        short_name: CLIENT_NAME,
        description: 'Minimalistic opinionated Mastodon web client',
        // https://github.com/cheeaun/phanpy/issues/231
        // theme_color: '#ffffff',
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
        categories: ['social', 'news'],
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
    cssCodeSplit: false,
    rollupOptions: {
      treeshake: false,
      input: {
        main: resolve(__dirname, 'index.html'),
        compose: resolve(__dirname, 'compose/index.html'),
      },
      output: {
        // manualChunks: {
        //   'intl-segmenter-polyfill': ['@formatjs/intl-segmenter/polyfill'],
        // },
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
