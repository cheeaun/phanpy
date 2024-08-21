import { useLingui } from '@lingui/react';
import { useMemo } from 'preact/hooks';

import { CATALOGS, DEFAULT_LANG, DEV_LOCALES, LOCALES } from '../locales';
import { activateLang } from '../utils/lang';
import localeCode2Text from '../utils/localeCode2Text';

const regionMaps = {
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
};

export default function LangSelector() {
  const { i18n } = useLingui();

  // Sorted on render, so the order won't suddenly change based on current locale
  const populatedLocales = useMemo(() => {
    return LOCALES.map((lang) => {
      // Don't need regions for now, it makes text too noisy
      // Wait till there's too many languages and there are regional clashes
      const regionlessCode = regionMaps[lang] || lang.replace(/-[a-z]+$/i, '');

      const native = localeCode2Text({
        code: regionlessCode,
        locale: lang,
        fallback: CATALOGS.find((c) => c.code === lang)?.nativeName,
      });

      // Not used when rendering because it'll change based on current locale
      // Only used for sorting on render
      const _common = localeCode2Text({
        code: regionlessCode,
        locale: i18n.locale,
        fallback: CATALOGS.find((c) => c.code === lang)?.name,
      });

      return {
        code: lang,
        regionlessCode,
        _common,
        native,
      };
    }).sort((a, b) => {
      // Sort by common name
      const order = a._common.localeCompare(b._common, i18n.locale);
      if (order !== 0) return order;
      // Sort by code (fallback)
      if (a.code < b.code) return -1;
      if (a.code > b.code) return 1;
      return 0;
    });
  }, []);

  return (
    <label class="lang-selector">
      🌐{' '}
      <select
        class="small"
        value={i18n.locale || DEFAULT_LANG}
        onChange={(e) => {
          localStorage.setItem('lang', e.target.value);
          activateLang(e.target.value);
        }}
      >
        {populatedLocales.map(({ code, regionlessCode, native }) => {
          // Common name changes based on current locale
          const common = localeCode2Text({
            code: regionlessCode,
            locale: i18n.locale,
            fallback: CATALOGS.find((c) => c.code === code)?.name,
          });
          const showCommon = !!common && common !== native;
          return (
            <option
              value={code}
              data-regionless-code={regionlessCode}
              key={code}
            >
              {showCommon ? `${native} - ${common}` : native}
            </option>
          );
        })}
        {(import.meta.env.DEV || import.meta.env.PHANPY_SHOW_DEV_LOCALES) && (
          <optgroup label="🚧 Development (<50% translated)">
            {DEV_LOCALES.map((code) => {
              if (code === 'pseudo-LOCALE') {
                return (
                  <>
                    <hr />
                    <option value={code} key={code}>
                      Pseudolocalization (test)
                    </option>
                  </>
                );
              }
              const nativeName = CATALOGS.find(
                (c) => c.code === code,
              )?.nativeName;
              const completion = CATALOGS.find(
                (c) => c.code === code,
              )?.completion;
              return (
                <option value={code} key={code}>
                  {nativeName || code} &lrm;[{completion}%]
                </option>
              );
            })}
          </optgroup>
        )}
      </select>
    </label>
  );
}
