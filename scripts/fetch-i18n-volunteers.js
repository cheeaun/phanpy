import fs from 'fs';

const { CROWDIN_ACCESS_TOKEN } = process.env;

const PROJECT_ID = '703337';

if (!CROWDIN_ACCESS_TOKEN) {
  throw new Error('CROWDIN_ACCESS_TOKEN is not set');
}

// Generate Report

let REPORT_ID = null;
{
  const response = await fetch(
    `https://api.crowdin.com/api/v2/projects/${PROJECT_ID}/reports`,
    {
      headers: {
        Authorization: `Bearer ${CROWDIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({
        name: 'top-members',
        schema: {
          format: 'json',
        },
      }),
    },
  );
  const json = await response.json();
  console.log(`Report ID: ${json?.data?.identifier}`);
  REPORT_ID = json?.data?.identifier;
}

if (!REPORT_ID) {
  throw new Error('Report ID is not found');
}

// Check Report Generation Status
let finished = false;
{
  let maxPolls = 10;
  do {
    maxPolls--;
    if (maxPolls < 0) break;

    // Wait for 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const status = await fetch(
      `https://api.crowdin.com/api/v2/projects/${PROJECT_ID}/reports/${REPORT_ID}`,
      {
        headers: {
          Authorization: `Bearer ${CROWDIN_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const json = await status.json();
    const progress = json?.data?.progress;
    console.log(`Progress: ${progress}% (${maxPolls} retries left)`);
    finished = json?.data?.status === 'finished';
  } while (!finished);
}

if (!finished) {
  throw new Error('Failed to generate report');
}

// Download Report
let reportURL = null;
{
  const response = await fetch(
    `https://api.crowdin.com/api/v2/projects/${PROJECT_ID}/reports/${REPORT_ID}/download`,
    {
      headers: {
        Authorization: `Bearer ${CROWDIN_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    },
  );
  const json = await response.json();
  reportURL = json?.data?.url;
  console.log(`Report URL: ${reportURL}`);
}

if (!reportURL) {
  throw new Error('Report URL is not found');
}

// Actually download the report
let members = null;
{
  const response = await fetch(reportURL);
  const json = await response.json();

  const { data } = json;

  if (!data?.length) {
    throw new Error('No data found');
  }

  // Sort by 'user.fullName'
  data.sort((a, b) => a.user.username.localeCompare(b.user.username));
  members = data
    .filter((item) => {
      const isMyself = item.user.username === 'cheeaun';
      const translatedMoreThanZero = item.translated > 0;

      return !isMyself && translatedMoreThanZero;
    })
    .map((item) => ({
      avatarUrl: item.user.avatarUrl,
      username: item.user.username,
      languages: item.languages.map((lang) => lang.name),
    }));

  console.log(members);

  if (members?.length) {
    fs.writeFileSync(
      'i18n-volunteers.json',
      JSON.stringify(members, null, '\t'),
    );
  }
}

if (!members?.length) {
  throw new Error('No members found');
}
