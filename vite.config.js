import { execSync } from 'child_process';
import fs from 'fs';
import { resolve } from 'path';

import { lingui } from '@lingui/vite-plugin';
import preact from '@preact/preset-vite';
import Sonda from 'sonda/vite';
import { uid } from 'uid/single';
import { createLogger, defineConfig, loadEnv } from 'vite';
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
let commitTime;
let fakeCommitHash = false;
try {
  const gitResult = execSync('git log -1 --format="%h %cI"').toString().trim();
  const [hash, time] = gitResult.split(' ');
  commitHash = hash;
  commitTime = new Date(time);
} catch (error) {
  // If error, means git is not installed or not a git repo (could be downloaded instead of git cloned)
  // Fallback to random hash which should be different on every build run 🤞
  commitHash = uid();
  commitTime = now;
  fakeCommitHash = true;
}

const rollbarCode = fs.readFileSync(
  resolve(__dirname, './rollbar.js'),
  'utf-8',
);

// https://github.com/vitejs/vite/issues/9597#issuecomment-1209305107
const excludedPostCSSWarnings = [
  ':is()', // This IS fine
  'display: box;', // Browsers are kinda late for the ellipsis support
];
const logger = createLogger();
const originalWarn = logger.warn;
logger.warn = (msg, options) => {
  if (
    msg.includes('vite:css') &&
    excludedPostCSSWarnings.some((str) => msg.includes(str))
  ) {
    return;
  }
  originalWarn(msg, options);
};

// https://vitejs.dev/config/
export default defineConfig({
  customLogger: logger,
  base: './',
  envPrefix: allowedEnvPrefixes,
  appType: 'mpa',
  mode: NODE_ENV,
  define: {
    __BUILD_TIME__: JSON.stringify(now),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __COMMIT_TIME__: JSON.stringify(commitTime),
    __FAKE_COMMIT_HASH__: fakeCommitHash,
  },
  server: {
    host: true,
    watch: {
      awaitWriteFinish: {
        pollInterval: 1000,
      },
    },
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
        // Metacrap https://broken-links.com/2015/12/01/little-less-metacrap/
        ...(WEBSITE
          ? [
              {
                property: 'twitter:card',
                content: 'summary_large_image',
              },
              {
                property: 'og:url',
                content: WEBSITE,
              },
              {
                property: 'og:title',
                content: CLIENT_NAME,
              },
              {
                property: 'og:description',
                content: 'Minimalistic opinionated Mastodon web client',
              },
              {
                property: 'og:image',
                content: `${WEBSITE}/og-image-2.jpg`,
              },
            ]
          : []),
      ],
      headScripts: ERROR_LOGGING ? [rollbarCode] : [],
      links: !!WEBSITE
        ? [
            {
              rel: 'canonical',
              href: WEBSITE,
            },
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
          ]
        : [],
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
    {
      // https://developers.cloudflare.com/pages/configuration/early-hints/
      name: 'generate-headers',
      writeBundle(_, bundle) {
        const cssFiles = Object.keys(bundle).filter((file) =>
          file.endsWith('.css'),
        );
        if (cssFiles.length > 0) {
          const links = cssFiles
            .map((file) => `  Link: <${file}>; rel=preload; as=style`)
            .join('\n');
          fs.writeFileSync(resolve(__dirname, 'dist/_headers'), `/\n${links}`);
        }
      },
    },
    VitePWA({
      manifest: {
        id: './', // Cannot be empty string for Web Install API to work
        start_url: './',
        scope: './',
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
    {
      name: 'css-ordering-plugin',
      transformIndexHtml(html) {
        const stylesheets = [];
        html = html.replace(
          /<link[^>]*rel=["']stylesheet["'][^>]*>/g,
          (match) => {
            stylesheets.push(match);
            return '';
          },
        );

        // Try to place before first <link> tag, fallback to after last <meta> tag
        const linkRegex = /<link[^>]*>/;
        if (linkRegex.test(html)) {
          return html.replace(linkRegex, (match) => {
            return stylesheets.join('') + match;
          });
        } else {
          return html.replace(/(<meta[^>]*>)(?![\s\S]*<meta)/, (match) => {
            return match + stylesheets.join('');
          });
        }
      },
    },
  ],
  build: {
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      treeshake: false,
      external: ['@xmldom/xmldom'], // exifreader's optional dependency, not needed
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
        {
          name: 'remove-chunk-sourcemaps',
          generateBundle(_, bundle) {
            // Remove .js.map files and sourcemap references for specific chunks
            Object.keys(bundle).forEach((fileName) => {
              const shouldRemoveSourcemap =
                fileName.includes('locales/') || fileName.includes('icons/');

              if (fileName.endsWith('.js.map') && shouldRemoveSourcemap) {
                delete bundle[fileName];
              } else if (fileName.endsWith('.js') && shouldRemoveSourcemap) {
                const chunk = bundle[fileName];
                if (chunk.type === 'chunk' && chunk.code) {
                  // Remove sourceMappingURL comment
                  chunk.code = chunk.code.replace(
                    /\/\/# sourceMappingURL=.+\.js\.map\n?$/,
                    '',
                  );
                }
              }
            });
          },
        },
      ],
    },
  },
});
