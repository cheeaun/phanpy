import fs from 'fs';

fetch('https://translang.phanpy.social/api/v1/languages')
  .then((response) => response.json())
  .then((json) => {
    const file = './src/data/translang-languages.json';
    console.log(`Writing ${file}...`);
    fs.writeFileSync(file, JSON.stringify(json, null, '\t'), 'utf8');
  });
