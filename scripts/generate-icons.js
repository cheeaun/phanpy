import fs from 'fs/promises';
import path from 'path';

import { parseIconSet, validateIconSet } from '@iconify/utils';
import { icons } from '@iconify-json/mingcute';

validateIconSet(icons);

const outputDir = path.join(process.cwd(), 'src/iconify-icons/mingcute');
await fs.mkdir(outputDir, { recursive: true });

const writePromises = [];

parseIconSet(icons, (iconName, iconData) => {
  // console.log('🧬', iconName);
  writePromises.push(
    fs.writeFile(
      path.join(outputDir, `${iconName}.js`),
      `export default ${JSON.stringify(iconData)};`,
    ),
  );
});

await Promise.all(writePromises);

console.log(
  `Generated ${Object.keys(icons.icons).length} icons in ${outputDir}`,
);
