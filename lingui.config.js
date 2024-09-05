import { ALL_LOCALES } from './src/locales';

const config = {
  locales: ALL_LOCALES,
  sourceLocale: 'en',
  pseudoLocale: 'pseudo-LOCALE',
  fallbackLocales: {
    default: 'en',
  },
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}',
      include: ['src'],
    },
  ],
  // compileNamespace: 'es',
  orderBy: 'origin',
};

export default config;
