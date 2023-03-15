// Fetch https://lingva.ml/api/v1/languages/{source|target}
import fs from 'fs';

fetch('https://lingva.ml/api/v1/languages/source')
  .then((response) => response.json())
  .then((json) => {
    const file = './src/data/lingva-source-languages.json';
    console.log(`Writing ${file}...`);
    fs.writeFileSync(file, JSON.stringify(json.languages, null, '\t'), 'utf8');
  });

fetch('https://lingva.ml/api/v1/languages/target')
  .then((response) => response.json())
  .then((json) => {
    const file = './src/data/lingva-target-languages.json';
    console.log(`Writing ${file}...`);
    fs.writeFileSync(file, JSON.stringify(json.languages, null, '\t'), 'utf8');
  });
