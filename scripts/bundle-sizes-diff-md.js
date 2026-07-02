#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';

const GZIP_NOISE_THRESHOLD = 100;

const refFile = process.argv[2];
const curFile = process.argv[3];

if (!refFile || !curFile) {
  console.error(
    'Usage: bundle-sizes-diff-md.js <reference-sizes.txt> <current-sizes.txt>',
  );
  process.exit(1);
}

function parseSizes(filePath) {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8');
  const rows = [];
  for (const line of content.trim().split('\n')) {
    if (!line.startsWith('dist/')) continue;
    const parts = line.split('│').map((p) => p.trim());
    const firstPart = parts[0];
    const match = firstPart.match(/^(\S+)\s+(.+)$/);
    if (!match) continue;
    const file = match[1];
    const size = match[2].trim();
    let gzip = '';
    let map = '';
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].startsWith('gzip:')) {
        gzip = parts[i].replace('gzip:', '').trim();
      } else if (parts[i].startsWith('map:')) {
        map = parts[i].replace('map:', '').trim();
      }
    }
    rows.push({ file, size, gzip, map });
  }
  return rows;
}

function parseBytes(str) {
  if (!str) return null;
  const m = str.match(/^([\d,]+(?:\.\d+)?)\s*(\w+)$/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ''));
  const u = m[2].toLowerCase();
  if (u === 'b') return v;
  if (u === 'kb') return v * 1024;
  if (u === 'mb') return v * 1024 * 1024;
  return null;
}

function formatBytes(diff) {
  if (diff === 0) return '—';
  const abs = Math.abs(diff);
  let s;
  if (abs >= 1024 * 1024) {
    s = (abs / (1024 * 1024)).toFixed(2) + ' MB';
  } else if (abs >= 1024) {
    s = (abs / 1024).toFixed(2) + ' kB';
  } else {
    s = abs.toFixed(0) + ' B';
  }
  const sign = diff > 0 ? '+' : '-';
  return `**${sign}${s}**`;
}

function normalizeName(file) {
  return file.replace(/-([A-Za-z0-9_-]{8})(\.[a-z]+)$/i, '-*$2');
}

const refRows = parseSizes(refFile);
const curRows = parseSizes(curFile);

if (refRows.length === 0 && curRows.length === 0) {
  console.log('## 📦 Bundle Size Report');
  console.log();
  console.log('No bundle files found.');
  process.exit(0);
}

const refMap = {};
for (const r of refRows) {
  const key = normalizeName(r.file);
  if (!refMap[key] || r.size > refMap[key].size) refMap[key] = r;
}

const curMap = {};
for (const r of curRows) {
  const key = normalizeName(r.file);
  if (!curMap[key] || r.size > curMap[key].size) curMap[key] = r;
}

const allKeys = [...new Set([...Object.keys(refMap), ...Object.keys(curMap)])];

allKeys.sort((a, b) => {
  const aCur = parseBytes(curMap[a]?.size) || 0;
  const aRef = parseBytes(refMap[a]?.size) || 0;
  const bCur = parseBytes(curMap[b]?.size) || 0;
  const bRef = parseBytes(refMap[b]?.size) || 0;
  return Math.max(bCur, bRef) - Math.max(aCur, aRef);
});

const changedRows = [];
let addedGzipBytes = 0;
let removedGzipBytes = 0;

for (const key of allKeys) {
  if (key.includes('.map')) continue;

  const ref = refMap[key];
  const cur = curMap[key];

  const curSize = cur ? cur.size : ref ? ref.size : '—';
  const curGzip = cur && cur.gzip ? cur.gzip : ref && ref.gzip ? ref.gzip : '—';

  let fileCol;
  let gzipDelta;
  let hasChange = false;

  if (cur && ref) {
    fileCol = `\`${key}\``;
    const cg = parseBytes(cur.gzip);
    const rg = parseBytes(ref.gzip);
    const gdiff = cg !== null && rg !== null ? cg - rg : null;
    gzipDelta =
      gdiff !== null && Math.abs(gdiff) >= GZIP_NOISE_THRESHOLD
        ? formatBytes(gdiff)
        : '—';
    if (gzipDelta !== '—') hasChange = true;
  } else if (cur && !ref) {
    fileCol = `<ins>\`${key}\`</ins>`;
    const cg = parseBytes(cur.gzip);
    gzipDelta = cg !== null ? formatBytes(cg) : '—';
    hasChange = true;
    if (cg !== null) addedGzipBytes += cg;
  } else {
    fileCol = `<del>\`${key}\`</del>`;
    const rg = parseBytes(ref.gzip);
    gzipDelta = rg !== null ? formatBytes(-rg) : '—';
    hasChange = true;
    if (rg !== null) removedGzipBytes += rg;
  }

  if (hasChange) {
    changedRows.push({ fileCol, curSize, curGzip, gzipDelta });
  }
}

console.log('## 📦 Bundle Size Report');
console.log();

if (refRows.length > 0) {
  const refTag = process.env.REF_TAG || refFile.replace('-sizes.txt', '');
  console.log(`_vs \`${refTag}\`_`);
  console.log();
}

if (changedRows.length > 0) {
  const summaryParts = [];
  if (addedGzipBytes > 0) {
    summaryParts.push(`+${(addedGzipBytes / 1024).toFixed(1)} kB (gzip)`);
  }
  if (removedGzipBytes > 0) {
    summaryParts.push(`-${(removedGzipBytes / 1024).toFixed(1)} kB (gzip)`);
  }
  if (summaryParts.length > 0) {
    console.log(summaryParts.join(' | '));
    console.log();
  }

  console.log('| File | Size | Gzip | ± Gzip |');
  console.log('|------|------|------|--------|');
  for (const row of changedRows) {
    console.log(
      `| ${row.fileCol} | ${row.curSize} | ${row.curGzip} | ${row.gzipDelta} |`,
    );
  }
} else {
  console.log('_No bundle size changes_');
}

console.log();
console.log('<details>');
console.log('<summary>Full bundle list</summary>');
console.log();
console.log('| File | Size | Gzip | Map |');
console.log('|------|------|------|-----|');
for (const row of curRows) {
  console.log(
    `| \`${row.file}\` | ${row.size} | ${row.gzip || '—'} | ${row.map || '—'} |`,
  );
}
console.log();
console.log('</details>');
