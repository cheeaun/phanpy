import fs from 'fs';

const url = 'https://mastodon.social/';

const html = await fetch(url).then((res) => res.text());

// Extract the JSON between <script id="initial-state" type="application/json"></script>
const json = html.match(
  /<script id="initial-state" type="application\/json">(.*)<\/script>/,
)[1];

const initialState = JSON.parse(json);
const { languages } = initialState;

console.log(`Found ${languages.length} languages`);

// Write to file
const path = './src/data/status-supported-languages.json';
fs.writeFileSync(path, JSON.stringify(languages, null, '\t'), 'utf8');
console.log(`Wrote ${path}`);
