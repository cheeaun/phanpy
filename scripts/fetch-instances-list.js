import fs from 'fs';

const url = 'https://api.joinmastodon.org/servers';
const results = await fetch(url);

const json = await results.json();

const domains = json.map((instance) => instance.domain);

// Write to file
const path = './src/data/instances.json';
fs.writeFileSync(path, JSON.stringify(domains, null, '\t'), 'utf8');
