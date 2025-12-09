import mem from './mem';
import store from './store';

const DTFLOCALE_CACHE_KEY = 'dtflocale';

function _getDtfLocale() {
  try {
    const cachedDtf = store.session.get(DTFLOCALE_CACHE_KEY);
    if (cachedDtf) return cachedDtf;
    const dtfLocale = new Intl.DateTimeFormat().resolvedOptions().locale;
    store.session.set(DTFLOCALE_CACHE_KEY, dtfLocale);
    return dtfLocale;
  } catch (e) {
    return null;
  }
}
export const getDtfLocale = mem(_getDtfLocale);

export function clearDtfLocaleCache() {
  store.session.del(DTFLOCALE_CACHE_KEY);
}
