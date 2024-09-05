// Find for <!-- i18n volunteers start --><!-- i18n volunteers end --> and inject list of i18n volunteers in between

import fs from 'fs';

const i18nVolunteers = JSON.parse(fs.readFileSync('i18n-volunteers.json'));

const readme = fs.readFileSync('README.md', 'utf8');

const i18nVolunteersStart = '<!-- i18n volunteers start -->';
const i18nVolunteersEnd = '<!-- i18n volunteers end -->';

const i18nVolunteersList = i18nVolunteers
  .map((member) => {
    return `- <img src="${member.avatarUrl}" alt="" width="16" height="16" /> ${
      member.username
    } (${member.languages.join(', ')})`;
  })
  .join('\n');

const readmeUpdated = readme.replace(
  new RegExp(`${i18nVolunteersStart}.*${i18nVolunteersEnd}`, 's'),
  `${i18nVolunteersStart}\n${i18nVolunteersList}\n${i18nVolunteersEnd}`,
);

fs.writeFileSync('README.md', readmeUpdated);

console.log('Updated README.md');
