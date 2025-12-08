#!/usr/bin/env node

// Converts vite build output to markdown table
// Input: vite build output lines starting with "dist/"
// Output: markdown table with File, Size, Gzip, Map columns

import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  terminal: false,
});

const rows = [];

rl.on('line', (line) => {
  if (!line.startsWith('dist/')) return;

  // Parse line like: dist/assets/main-xxx.js   357.39 kB │ gzip: 111.67 kB │ map: 1,503.67 kB
  const parts = line.split('│').map((p) => p.trim());

  // First part: "dist/assets/file.js   357.39 kB"
  const firstPart = parts[0];
  const match = firstPart.match(/^(\S+)\s+(.+)$/);
  if (!match) return;

  const file = match[1];
  const size = match[2].trim();

  // Optional gzip and map
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
});

rl.on('close', () => {
  console.log('## 📦 Bundle Size Report\n');
  console.log('| File | Size | Gzip | Map |');
  console.log('|------|------|------|-----|');
  for (const row of rows) {
    console.log(`| ${row.file} | ${row.size} | ${row.gzip} | ${row.map} |`);
  }
});
