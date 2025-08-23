import { execSync } from 'child_process';
import fs from 'fs';
import { resolve } from 'path';

import { lingui } from '@lingui/vite-plugin';
import preact from '@preact/preset-vite';
import Sonda from 'sonda/vite';
import { uid } from 'uid/single';
import { defineConfig, loadEnv } from 'vite';
import generateFile from 'vite-plugin-generate-file';
import htmlPlugin from 'vite-plugin-html-config';
import { VitePWA } from 'vite-plugin-pwa';
import removeConsole from 'vite-plugin-remove-console';
import { run } from 'vite-plugin-run';

import { ALL_LOCALES } from './src/locales';

const allowedEnvPrefixes = ['VITE_', 'PHANPY_'];
const { NODE_ENV } = process.env;
const {
  PHANPY_WEBSITE: WEBSITE,
  PHANPY_CLIENT_NAME: CLIENT_NAME,
  PHANPY_APP_ERROR_LOGGING: ERROR_LOGGING,
  PHANPY_REFERRER_POLICY: REFERRER_POLICY,
  PHANPY_DISALLOW_ROBOTS: DISALLOW_ROBOTS,
  PHANPY_DEV,
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
    preact({
      // Force use Babel instead of ESBuild due to this change: https://github.com/preactjs/preset-vite/pull/114
      // Else, a bug will happen with importing variables from import.meta.env
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
    lingui(),
    run({
      silent: false,
      input: [
        {
          name: 'messages:extract:clean',
          run: ['npm', 'run', 'messages:extract:clean'],
          pattern: 'src/**/*.{js,jsx,ts,tsx}',
        },
        // {
        //   name: 'update-catalogs',
        //   run: ['node', 'scripts/catalogs.js'],
        //   pattern: 'src/locales/*.po',
        // },
      ],
    }),
    removeConsole({
      includes: ['log', 'debug', 'info', 'warn', 'error'],
    }),
    htmlPlugin({
      metas: [
        // Learn more: https://web.dev/articles/referrer-best-practices
        {
          name: 'referrer',
          content: REFERRER_POLICY || 'origin',
        },
      ],
      headScripts: ERROR_LOGGING ? [rollbarCode] : [],
      links: [
        ...ALL_LOCALES.map((lang) => ({
          rel: 'alternate',
          hreflang: lang,
          // *Fully-qualified* URLs
          href: `${WEBSITE}/?lang=${lang}`,
        })),
        // https://developers.google.com/search/docs/specialty/international/localized-versions#xdefault
        {
          rel: 'alternate',
          hreflang: 'x-default',
          href: `${WEBSITE}`,
        },
      ],
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
      ...(DISALLOW_ROBOTS
        ? [
            {
              type: 'raw',
              output: './robots.txt',
              data: 'User-agent: *\nDisallow: /',
            },
          ]
        : []),
    ]),
    VitePWA({
      manifest: {
        name: CLIENT_NAME,
        short_name: CLIENT_NAME,
        description: 'Minimalistic opinionated Mastodon web client',
        // https://github.com/cheeaun/phanpy/issues/231
        theme_color: undefined,
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
    Sonda({
      deep: true,
      brotli: true,
      open: false,
    }),
  ],
  build: {
    sourcemap: true,
    // Note: In Vite 6, if cssCodeSplit = false, it will show error "Cannot read properties of undefined (reading 'includes')"
    // TODO: Revisit this when this issue is fixed
    // cssCodeSplit: false,
    rollupOptions: {
      treeshake: false,
      input: {
        main: resolve(__dirname, 'index.html'),
        compose: resolve(__dirname, 'compose/index.html'),
      },
      output: {
        // NOTE: Comment this for now. This messes up async imports.
        // Without SplitVendorChunkPlugin, pushing everything to vendor is not "smart" enough
        // manualChunks: (id, { getModuleInfo }) => {
        //   // if (id.includes('@formatjs/intl-segmenter/polyfill')) return 'intl-segmenter-polyfill';
        //   if (/tiny.*light/.test(id)) return 'tinyld-light';

        //   // Implement logic similar to splitVendorChunkPlugin
        //   if (id.includes('node_modules')) {
        //     // Check if this module is dynamically imported
        //     const moduleInfo = getModuleInfo(id);
        //     if (moduleInfo) {
        //       // If it's imported dynamically, don't put in vendor
        //       const isDynamicOnly =
        //         moduleInfo.importers.length === 0 &&
        //         moduleInfo.dynamicImporters.length > 0;
        //       if (isDynamicOnly) return null;
        //     }
        //     return 'vendor';
        //   }
        // },
        chunkFileNames: (chunkInfo) => {
          const { facadeModuleId } = chunkInfo;
          if (facadeModuleId && facadeModuleId.includes('icon')) {
            return 'assets/icons/[name]-[hash].js';
          }
          if (facadeModuleId && facadeModuleId.includes('locales')) {
            return 'assets/locales/[name]-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
        assetFileNames: (assetInfo) => {
          const { originalFileNames } = assetInfo;
          if (originalFileNames?.[0]?.includes('assets/sandbox')) {
            return 'assets/sandbox/[name]-[hash].[ext]';
          }
          return 'assets/[name]-[hash].[ext]';
        },
      },
      plugins: [
        {
          name: 'exclude-sandbox',
          generateBundle(_, bundle) {
            if (!PHANPY_DEV) {
              Object.entries(bundle).forEach(([name, chunk]) => {
                if (name.includes('sandbox')) {
                  delete bundle[name];
                }
              });
            }
          },
        },
      ],
    },
  },
});
