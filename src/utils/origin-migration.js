const CANONICAL_ORIGIN = 'https://bluepy.social';
const LEGACY_ORIGIN = 'https://bluepy.mosphere.at';
const MIGRATION_KEY = 'bluepy-origin-migration-v1';
const MIGRATION_TIMEOUT = 2000;

function dumpStorage(storage) {
  const entries = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key) entries.push([key, storage.getItem(key)]);
  }
  return entries;
}

function importPairs(storage, pairs) {
  if (!Array.isArray(pairs)) return;
  for (const [key, value] of pairs) {
    if (typeof key !== 'string' || typeof value !== 'string') continue;
    if (storage.getItem(key) === null) storage.setItem(key, value);
  }
}

function importMigrationPayload(payload) {
  if (
    payload?.type !== 'bluepy:storage-export' ||
    payload.version !== 1 ||
    payload.target !== CANONICAL_ORIGIN
  ) {
    return false;
  }
  importPairs(localStorage, payload.localStorage);
  importPairs(sessionStorage, payload.sessionStorage);
  localStorage.setItem(MIGRATION_KEY, 'imported');
  return true;
}

function importWindowNameMigration() {
  if (!window.name) return false;
  let payload;
  try {
    payload = JSON.parse(window.name);
  } catch (error) {
    return false;
  }
  const referrerOrigin = document.referrer
    ? new URL(document.referrer).origin
    : null;
  if (referrerOrigin !== LEGACY_ORIGIN) return false;
  window.name = '';
  return importMigrationPayload(payload);
}

export function redirectLegacyOrigin() {
  if (window.location.origin !== LEGACY_ORIGIN) return false;
  const nextURL = new URL(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
    CANONICAL_ORIGIN,
  );
  window.name = JSON.stringify({
    type: 'bluepy:storage-export',
    version: 1,
    target: CANONICAL_ORIGIN,
    localStorage: dumpStorage(localStorage),
    sessionStorage: dumpStorage(sessionStorage),
  });
  window.location.replace(nextURL.href);
  return true;
}

export function importLegacyOriginStorage() {
  if (window.location.origin !== CANONICAL_ORIGIN)
    return Promise.resolve(false);
  try {
    if (importWindowNameMigration()) return Promise.resolve(true);
  } catch (error) {
    console.warn('Failed to import legacy Bluepy storage', error);
  }
  if (localStorage.getItem(MIGRATION_KEY)) return Promise.resolve(false);
  if (localStorage.getItem('accounts')) {
    localStorage.setItem(MIGRATION_KEY, 'skipped-existing-accounts');
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    let settled = false;

    function cleanup(result) {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      iframe.remove();
      resolve(result);
    }

    function onMessage(event) {
      if (event.origin !== LEGACY_ORIGIN) return;
      try {
        if (importMigrationPayload(event.data)) cleanup(true);
      } catch (error) {
        console.warn('Failed to import legacy Bluepy storage', error);
        localStorage.setItem(MIGRATION_KEY, 'failed');
        cleanup(false);
      }
    }

    window.addEventListener('message', onMessage);
    iframe.hidden = true;
    iframe.src = `${LEGACY_ORIGIN}/migrate-storage.html?target=${encodeURIComponent(
      CANONICAL_ORIGIN,
    )}`;
    document.body.append(iframe);
    setTimeout(() => {
      try {
        localStorage.setItem(MIGRATION_KEY, 'timeout');
      } catch (error) {}
      cleanup(false);
    }, MIGRATION_TIMEOUT);
  });
}
