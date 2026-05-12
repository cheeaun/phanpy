import mem from './mem';
import store from './store';

const DTFLOCALE_CACHE_KEY = 'dtflocale';

function getDtfLocaleFromCache(): string | null {
  try {
    const cachedDtf = store.session.get(DTFLOCALE_CACHE_KEY);
    if (cachedDtf !== null && cachedDtf !== '') {
      return cachedDtf;
    }
    const dtfLocale = new Intl.DateTimeFormat().resolvedOptions().locale;
    store.session.set(DTFLOCALE_CACHE_KEY, dtfLocale);
    return dtfLocale;
  } catch {
    return null;
  }
}
const getDtfLocale = mem(getDtfLocaleFromCache);

function clearDtfLocaleCache(): void {
  store.session.del(DTFLOCALE_CACHE_KEY);
}

export { clearDtfLocaleCache, getDtfLocale };
