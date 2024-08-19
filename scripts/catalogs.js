import fs from 'node:fs';

// Dependency from Lingui, not listed in package.json
import PO from 'pofile';

const DEFAULT_LANG = 'en';
const IGNORE_LANGS = [DEFAULT_LANG, 'pseudo-LOCALE'];

const files = fs.readdirSync('src/locales');
const catalogs = {};

const enCatalog = files.find((file) => file.endsWith('en.po'));
const enContent = fs.readFileSync(`src/locales/${enCatalog}`, 'utf8');
const enPo = PO.parse(enContent);
const total = enPo.items.length;
console.log('Total strings:', total);

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
      catalogs[code] = percentage;
    }
  }
});

// Sort by percentage
const sortedCatalogs = Object.entries(catalogs)
  .sort((a, b) => b[1] - a[1])
  .map(([code, percentage]) => {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code);
    return { code, name, percentage };
  });

console.table(sortedCatalogs);

const path = 'src/data/catalogs.json';
fs.writeFileSync(
  path,
  JSON.stringify(
    Object.entries(catalogs).map(([code, percentage]) => ({
      code,
      completion: percentage,
    })),
    null,
    2,
  ),
);
console.log('File written:', path);
