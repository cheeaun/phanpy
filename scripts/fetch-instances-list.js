import fs from 'fs';

const { INSTANCES_SOCIAL_SECRET_TOKEN } = process.env;

const params = new URLSearchParams({
  count: 0,
  min_users: 500,
  sort_by: 'active_users',
  sort_order: 'desc',
});

const url = `https://instances.social/api/1.0/instances/list?${params.toString()}`;
const results = await fetch(url, {
  headers: {
    Authorization: `Bearer ${INSTANCES_SOCIAL_SECRET_TOKEN}`,
  },
});

const json = await results.json();

// Filters
json.instances = json.instances.filter(
  (instance) => Number(instance.connections) > 20,
);

const names = json.instances.map((instance) => instance.name);

// Write to file
const path = './src/data/instances.json';
fs.writeFileSync(path, JSON.stringify(names, null, '\t'), 'utf8');

// Write everything to file, for debugging
const path2 = './src/data/instances-full.json';
fs.writeFileSync(path2, JSON.stringify(json, null, '\t'), 'utf8');
