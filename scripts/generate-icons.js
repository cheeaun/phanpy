import fs from 'fs/promises';
import path from 'path';

import { icons } from '@iconify-json/mingcute';
import { getIconData, validateIconSet } from '@iconify/utils';

validateIconSet(icons);

const outputDir = path.join(process.cwd(), 'src/iconify-icons/mingcute');

const iconsSourcePath = path.join(process.cwd(), 'src/components/ICONS.jsx');
let usedNames;
try {
  const iconsSource = await fs.readFile(iconsSourcePath, 'utf8');
  const names = new Set();
  for (const match of iconsSource.matchAll(
    /iconify-icons\/mingcute\/([a-z0-9-]+)\.js/g,
  )) {
    names.add(match[1]);
  }
  usedNames = [...names].sort();
  if (!usedNames.length) {
    throw new Error(`No icons found in ${iconsSourcePath}`);
  }
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.warn(
      `Icons source not found: ${iconsSourcePath}\nFalling back to generating all icons.`,
    );
    usedNames = Object.keys(icons.icons);
  } else {
    throw error;
  }
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const CONCURRENCY = 64; // Prevent EMFILE errors
const missing = [];

for (let i = 0; i < usedNames.length; i += CONCURRENCY) {
  await Promise.all(
    usedNames.slice(i, i + CONCURRENCY).map(async (iconName) => {
      const iconData = getIconData(icons, iconName);
      if (!iconData) {
        missing.push(iconName);
        return;
      }
      await fs.writeFile(
        path.join(outputDir, `${iconName}.js`),
        `export default ${JSON.stringify(iconData)};`,
      );
    }),
  );
}

if (missing.length) {
  console.error(`Missing icons: ${missing.join(', ')}`);
  process.exitCode = 1;
}

console.log(
  `Generated ${usedNames.length - missing.length} icons in ${outputDir}`,
);
