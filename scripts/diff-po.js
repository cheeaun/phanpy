#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const PO_FILE = path.join(REPO_ROOT, 'src', 'locales', 'en.po');

function parsePO(content) {
  const entries = [];
  let i = 0;
  const lines = content.split(/\r?\n/);

  while (i < lines.length) {
    while (
      i < lines.length &&
      (lines[i].trim() === '' || lines[i].startsWith('#'))
    ) {
      i++;
    }
    if (i >= lines.length) break;

    let ctx = null;
    let id = null;
    let str = null;

    if (lines[i].startsWith('msgctxt')) {
      ctx = parseQuoted(lines[i]);
      i++;
    }

    if (lines[i].startsWith('msgid')) {
      const result = parseMultiLine(lines, i);
      id = result.value;
      i = result.nextIndex;
    } else {
      i++;
      continue;
    }

    if (i < lines.length && lines[i].startsWith('msgstr')) {
      const result = parseMultiLine(lines, i);
      str = result.value;
      i = result.nextIndex;
    }

    entries.push({ id, str, ctx });
  }

  return entries;
}

function parseQuoted(line) {
  const match = line.match(/^\s*(?:\w+\s+)?"((?:[^"\\]|\\.)*)"/);
  return match ? unescapePO(match[1]) : '';
}

function parseMultiLine(lines, startIndex) {
  let value = parseQuoted(lines[startIndex]);
  let i = startIndex + 1;
  while (i < lines.length && /^\s*"/.test(lines[i])) {
    value += parseQuoted(lines[i]);
    i++;
  }
  return { value, nextIndex: i };
}

function unescapePO(s) {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function keyFor(entry) {
  return entry.ctx ? `ctx:${entry.ctx}\0${entry.id}` : entry.id;
}

function buildMap(entries) {
  const map = new Map();
  for (const entry of entries) {
    map.set(keyFor(entry), entry);
  }
  return map;
}

function displayText(entry) {
  return entry.str || entry.id;
}

function truncate(str, maxLen = 120) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

const C = {
  reset: '\x1B[0m',
  dim: '\x1B[2m',
  green: '\x1B[32m',
  red: '\x1B[31m',
  gray: '\x1B[90m',
};

function run() {
  const relPath = path.relative(REPO_ROOT, PO_FILE);
  let oldContent;
  try {
    oldContent = execSync(`git show HEAD:"${relPath}"`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    console.error(`Error reading ${relPath} from git HEAD:`, e.message);
    process.exit(1);
  }
  const newContent = fs.readFileSync(PO_FILE, 'utf-8');

  const oldEntries = parsePO(oldContent);
  const newEntries = parsePO(newContent);
  const oldMap = buildMap(oldEntries);
  const newMap = buildMap(newEntries);

  const added = [];
  const removed = [];
  const changed = [];

  for (const [k, entry] of newMap) {
    if (!oldMap.has(k)) {
      added.push(entry);
    } else if (oldMap.get(k).str !== entry.str) {
      changed.push({ entry, oldStr: oldMap.get(k).str });
    }
  }

  for (const [k, entry] of oldMap) {
    if (!newMap.has(k)) {
      removed.push(entry);
    }
  }

  if (added.length) {
    console.log(`\n${C.dim}=== Added (${added.length}) ===${C.reset}\n`);
    for (const e of added) {
      console.log(`${C.green}+ ${truncate(displayText(e))}${C.reset}`);
    }
  }

  if (removed.length) {
    console.log(`\n${C.dim}=== Removed (${removed.length}) ===${C.reset}\n`);
    for (const e of removed) {
      console.log(`${C.red}- ${truncate(displayText(e))}${C.reset}`);
    }
  }

  if (changed.length) {
    console.log(`\n${C.dim}=== Changed (${changed.length}) ===${C.reset}\n`);
    for (const { entry, oldStr } of changed) {
      console.log(`${C.red}- ${truncate(oldStr || entry.id)}${C.reset}`);
      console.log(`${C.green}+ ${truncate(entry.str || entry.id)}${C.reset}`);
    }
  }

  if (!added.length && !removed.length && !changed.length) {
    console.log('No differences found.');
  } else {
    console.log(
      `\n${C.gray}Summary: ${added.length} added, ${removed.length} removed, ${changed.length} changed${C.reset}`,
    );
  }
}

run();
