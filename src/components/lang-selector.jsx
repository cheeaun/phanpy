import { useLingui } from '@lingui/react';
import { useMemo } from 'preact/hooks';

import { DEFAULT_LANG, LOCALES } from '../locales';
import { activateLang } from '../utils/lang';
import localeCode2Text from '../utils/localeCode2Text';

export default function LangSelector() {
  const { i18n } = useLingui();

  const populatedLocales = useMemo(() => {
    return LOCALES.map((lang) => {
      const native = localeCode2Text({ code: lang, locale: lang });
      const common = localeCode2Text(lang);
      const showCommon = !!common && common !== native;
      return {
        code: lang,
        native,
        common,
        showCommon,
      };
    }).sort((a, b) => {
      // If pseudo-LOCALE, always put it at the bottom
      if (a.code === 'pseudo-LOCALE') return 1;
      if (b.code === 'pseudo-LOCALE') return -1;
      // Sort by code
      if (a.code < b.code) return -1;
      if (a.code > b.code) return 1;
      return 0;
    });
  }, [i18n.locale]);

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
        {populatedLocales.map(({ code, native, common, showCommon }) => {
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
          return (
            <option value={code} key={code}>
              {showCommon ? `${native} - ${common}` : native}
            </option>
          );
        })}
      </select>
    </label>
  );
}
