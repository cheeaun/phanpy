// @ts-check
import { test, expect } from '@playwright/test';
import { _localeMatch as localeMatch } from '../src/utils/locale-match.js';

// https://github.com/formatjs/formatjs/blob/e11b9b57a5ed745584b169c13b0a1812ba9e6051/packages/intl-localematcher/tests/index.test.ts
test.describe('official formatjs test cases', () => {
  test('zh-HK', () => {
    expect(localeMatch(['zh-HK'], ['zh', 'zh-HANT', 'en'], 'en')).toBe(
      'zh-HANT',
    );
  });

  test('Intl.LocaleMatcher - fr-XX fallback', () => {
    expect(localeMatch(['fr-XX', 'en'], ['fr', 'en'], 'en')).toBe('fr');
  });

  test('Intl.LocaleMatcher - zh-TW to zh-Hant-TW', () => {
    expect(localeMatch(['zh-TW', 'en'], ['zh-Hant-TW', 'en'], 'en')).toBe(
      'zh-Hant-TW',
    );
  });

  test('Intl.LocaleMatcher - sr-Latn-BA complex matching', () => {
    expect(
      localeMatch(
        ['sr-Latn-BA'],
        [
          'af',
          'ak',
          'am',
          'an',
          'ar',
          'ars',
          'as',
          'asa',
          'ast',
          'az',
          'be',
          'bem',
          'bez',
          'bg',
          'bho',
          'bm',
          'bn',
          'bo',
          'br',
          'brx',
          'bs',
          'ca',
          'ce',
          'ceb',
          'cgg',
          'chr',
          'ckb',
          'cs',
          'cy',
          'da',
          'de',
          'doi',
          'dsb',
          'dv',
          'dz',
          'ee',
          'el',
          'en',
          'eo',
          'es',
          'et',
          'eu',
          'fa',
          'ff',
          'fi',
          'fil',
          'fo',
          'fr',
          'fur',
          'fy',
          'ga',
          'gd',
          'gl',
          'gsw',
          'gu',
          'guw',
          'gv',
          'ha',
          'haw',
          'he',
          'ksb',
          'ksh',
          'ku',
          'kw',
          'ky',
          'lag',
          'lb',
          'lg',
          'lij',
          'lkt',
          'ln',
          'lo',
          'lt',
          'lv',
          'mas',
          'mg',
          'mgo',
          'mk',
          'ml',
          'mn',
          'mo',
          'mr',
          'ms',
          'mt',
          'my',
          'nah',
          'naq',
          'nb',
          'nd',
          'ne',
          'nl',
          'nn',
          'nnh',
          'no',
          'nqo',
          'nr',
          'nso',
          'ny',
          'nyn',
          'om',
          'or',
          'os',
          'osa',
          'pa',
          'pap',
          'pcm',
          'pl',
          'prg',
          'ps',
          'pt-PT',
          'pt',
          'rm',
          'ro',
          'rof',
          'ru',
          'rwk',
          'sah',
          'saq',
          'sat',
          'sc',
          'scn',
          'sd',
          'sdh',
          'se',
          'seh',
          'ses',
          'sg',
          'sh',
          'shi',
          'si',
          'sk',
          'sl',
          'sma',
          'smi',
          'smj',
          'smn',
          'sms',
          'sn',
          'so',
          'sq',
          'sr',
          'ss',
          'ssy',
          'st',
          'su',
          'sv',
          'sw',
          'syr',
          'ta',
          'te',
          'teo',
          'th',
          'ti',
          'tig',
          'tk',
          'tl',
          'tn',
          'to',
          'tr',
          'ts',
          'tzm',
          'ug',
          'uk',
          'ur',
          'uz',
          've',
          'vi',
          'vo',
          'vun',
          'wa',
          'wae',
          'wo',
          'xh',
          'xog',
          'yi',
          'yo',
          'yue',
          'zh',
          'zu',
        ],
        'en',
      ),
    ).toBe('sh');
  });

  test('empty requested', () => {
    expect(localeMatch([], ['zh-Hant-TW', 'en'], 'en')).toBe('en');
  });

  test('extension', () => {
    expect(localeMatch(['fr-CA-x-foo'], ['zh-Hant-TW', 'fr', 'en'], 'en')).toBe(
      'fr',
    );
  });

  test('GH #4267', () => {
    expect(localeMatch(['fr'], ['br', 'fr'], 'en')).toBe('fr');
  });
});

// https://github.com/formatjs/formatjs/blob/e11b9b57a5ed745584b169c13b0a1812ba9e6051/packages/intl-localematcher/tests/BestFitMatcher.test.ts
test.describe('BestFitMatcher test cases', () => {
  test('BestFitMatcher basic', () => {
    expect(localeMatch(['fr-XX', 'en'], ['fr', 'en'], 'en')).toBe('fr');
  });

  test('BestFitMatcher zh-TW', () => {
    expect(localeMatch(['zh-TW'], ['zh', 'zh-Hant'], 'en')).toBe('zh-Hant');
  });

  test('BestFitMatcher en', () => {
    expect(localeMatch(['en'], ['en', 'und'], 'en')).toBe('en');
  });

  test('BestFitMatcher extension', () => {
    // Extensions should be handled transparently by the underlying matcher
    expect(localeMatch(['th-u-ca-gregory'], ['th'], 'en')).toBe('th');
  });

  test('GH #4272 - fallback behavior', () => {
    expect(localeMatch(['es'], ['fr', 'en'], 'en')).toBe('en');
    expect(localeMatch(['es'], ['en', 'fr', 'en'], 'fr')).toBe('fr');
  });

  test('GH #4258 - best fit matching', () => {
    expect(
      localeMatch(['de-DE', 'fr'], ['en', 'en-US', 'fr-FR'], 'en-US'),
    ).toBe('fr-FR');
  });

  test('GH #4237 - exact locale preference', () => {
    expect(
      localeMatch(['en-GB', 'en-US', 'en'], ['en-US', 'nl-NL', 'nl'], 'en-US'),
    ).toBe('en-US');
  });

  test('bestFitMatcher testing zh-HK', () => {
    expect(localeMatch(['zh-HK'], ['zh-Hant', 'zh-MO'], 'en')).toBe('zh-MO');
  });

  test('bestFitMatcher testing en-CA', () => {
    expect(localeMatch(['en-CA'], ['en-GB', 'en-US'], 'en-US')).toBe('en-US');
  });

  test('bestFitMatcher testing es-KY Americas', () => {
    expect(localeMatch(['es-KY'], ['es', 'en', 'es-419'], 'en')).toBe('es-419');
  });
});
