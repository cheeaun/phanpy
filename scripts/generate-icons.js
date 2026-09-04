import fs from 'fs/promises';
import path from 'path';

import { icons } from '@iconify-json/mingcute';
import { parseIconSet, validateIconSet } from '@iconify/utils';

validateIconSet(icons);

const outputDir = path.join(process.cwd(), 'src/iconify-icons/mingcute');
await fs.mkdir(outputDir, { recursive: true });

const CONCURRENCY = 64; // Prevent EMFILE errors
const writeTasks = [];

parseIconSet(icons, (iconName, iconData) => {
  // console.log('🧬', iconName);
  writeTasks.push(() =>
    fs.writeFile(
      path.join(outputDir, `${iconName}.js`),
      `export default ${JSON.stringify(iconData)};`,
    ),
  );
});

for (let i = 0; i < writeTasks.length; i += CONCURRENCY) {
  await Promise.all(writeTasks.slice(i, i + CONCURRENCY).map((fn) => fn()));
}

console.log(
  `Generated ${Object.keys(icons.icons).length} icons in ${outputDir}`,
);
