import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const posts = [
  'https://mastodon.social/api/v1/statuses/115903453951785429',
  'https://mastodon.social/api/v1/statuses/115887242651860407',
  'https://mastodon.social/api/v1/statuses/115853890477340137',
  'https://mastodon.social/api/v1/statuses/115854031046143927',
];

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  const results = [];

  for (const url of posts) {
    console.log(`Fetching ${url}...`);
    try {
      const data = await fetchJSON(url);
      results.push(data);
    } catch (error) {
      console.error(`Error fetching ${url}:`, error.message);
    }
  }

  const outputPath = path.join(__dirname, '../src/data/mock-posts.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} posts to ${outputPath}`);
}

main().catch(console.error);
