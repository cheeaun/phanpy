import fs from 'node:fs';

// Dependency from Lingui, not listed in package.json
import PO from 'pofile';

let listedLocales = [];
try {
  listedLocales = JSON.parse(
    fs.readFileSync('src/data/listed-locales.json', 'utf8'),
  );
} catch (e) {}

const DEFAULT_LANG = 'en';
const IGNORE_LANGS = [DEFAULT_LANG, 'pseudo-LOCALE'];

const files = fs.readdirSync('src/locales');
const catalogs = {};

const enCatalog = files.find((file) => file.endsWith('en.po'));
const enContent = fs.readFileSync(`src/locales/${enCatalog}`, 'utf8');
const enPo = PO.parse(enContent);
const total = enPo.items.length;
console.log('Total strings:', total);

const codeMaps = {
  'kab-KAB': 'kab',
};

files.forEach((file) => {
  if (file.endsWith('.po')) {
    const code = file.replace(/\.po$/, '');
    if (IGNORE_LANGS.includes(code)) return;
    const content = fs.readFileSync(`src/locales/${file}`, 'utf8');
    const po = PO.parse(content);
    const { items } = po;
    // Percentage of translated strings
    const translated = items.filter(
      (item) => item.msgstr !== '' && item.msgstr[0] !== '',
    ).length;
    const percentage = Math.round((translated / total) * 100);
    po.percentage = percentage;
    if (percentage > 0) {
      // Ignore empty catalogs
      catalogs[codeMaps[code] || code] = percentage;
    }
  }
});

const regionMaps = {
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
};

function IDN(inputCode, outputCode) {
  let result;
  const regionlessInputCode =
    regionMaps[inputCode] || inputCode.replace(/-[a-z]+$/i, '');
  const regionlessOutputCode =
    regionMaps[outputCode] || outputCode.replace(/-[a-z]+$/i, '');
  const inputCodes =
    regionlessInputCode !== inputCode
      ? [inputCode, regionlessInputCode]
      : [inputCode];
  const outputCodes =
    regionlessOutputCode !== outputCode
      ? [regionlessOutputCode, outputCode]
      : [outputCode];

  for (const inputCode of inputCodes) {
    for (const outputCode of outputCodes) {
      try {
        result = new Intl.DisplayNames([inputCode], {
          type: 'language',
        }).of(outputCode);
        break;
      } catch (e) {}
    }
    if (result) break;
  }
  return result;
}

const fullCatalogs = Object.entries(catalogs)
  // sort by key
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([code, completion]) => {
    const nativeName = IDN(code, code);
    const name = IDN('en', code);
    return { code, nativeName, name, completion };
  });

// Set listed: true if completion > PERCENTAGE_THRESHOLD
const PERCENTAGE_THRESHOLD = 50;
const listedCatalogs = fullCatalogs.map((catalog) => ({
  ...catalog,
  // Once listed, always listed
  // A locale may exceed percentage threshold today, but not tomorrow
  // So it should't suddenly become unlisted
  listed:
    listedLocales.includes(catalog.code) ||
    catalog.completion >= PERCENTAGE_THRESHOLD,
}));

// Sort by completion
const sortedCatalogs = [...listedCatalogs].sort(
  (a, b) => b.completion - a.completion,
);

console.table(sortedCatalogs);
console.log(
  `Total listed/unlisted: ${listedCatalogs.filter((c) => c.listed).length}/${
    listedCatalogs.filter((c) => !c.listed).length
  }`,
);

const path = 'src/data/catalogs.json';
fs.writeFileSync(path, JSON.stringify(listedCatalogs, null, 2));
console.log('File written:', path);

const path2 = 'src/data/listed-locales.json';
const codes = listedCatalogs.filter((c) => c.listed).map((c) => c.code);
if (codes.length >= listedLocales.length) {
  fs.writeFileSync(path2, JSON.stringify(codes, null, 2));
  console.log('File written:', path2);
} else {
  console.error(
    `Number of listed locales reduced from ${listedLocales.length} to ${codes.length}.`,
  );
}
