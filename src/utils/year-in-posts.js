import { api } from './api';
import db from './db';
import store from './store';
import { getCurrentAccount, getCurrentAccountNS } from './store-utils';

const YEAR_IN_POSTS_LIST_KEY = 'year-in-posts-list';

export function loadAvailableYears() {
  try {
    const list = store.account.get(YEAR_IN_POSTS_LIST_KEY) || {};
    const sortedYears = Object.entries(list)
      .map(([year, data]) => ({ year: parseInt(year), ...data }))
      .sort((a, b) => b.year - a.year);
    return sortedYears;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function removeYear(yearToRemove) {
  try {
    const NS = getCurrentAccountNS();
    const dataId = `${NS}-${yearToRemove}`;
    await db.yearInPosts.delete(dataId);

    const list = store.account.get(YEAR_IN_POSTS_LIST_KEY) || {};
    delete list[yearToRemove];
    store.account.set(YEAR_IN_POSTS_LIST_KEY, list);

    return true;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function fetchYearPosts(year) {
  const { masto } = api();
  const allResults = [];

  const account = getCurrentAccount();
  if (!account) {
    throw new Error('No current account');
  }
  const accountId = account.info.id;
  const accountAcct = account.info.acct;

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

  // Calculate beforeStr: use 2nd Jan for safety margin (server timezone may differ)
  const nextYear = year + 1;
  const beforeStr = `${nextYear}-01-02`;

  // Search for the latest status before the year ends
  let maxId = null;
  try {
    const searchResults = await masto.v2.search.list({
      q: `from:${accountAcct} before:${beforeStr}`,
      type: 'statuses',
      limit: 1,
    });
    if (searchResults?.statuses?.length) {
      maxId = searchResults.statuses[0].id;
    }
  } catch (e) {
    console.error('Search failed', e);
  }

  const statusIterator = masto.v1.accounts
    .$select(accountId)
    .statuses.list({
      limit: 40,
      exclude_replies: false,
      exclude_reblogs: false,
      max_id: maxId || undefined,
    })
    .values();

  fetchLoop: while (true) {
    try {
      const result = await statusIterator.next();
      const { value, done } = result;

      if (done || !value?.length) break fetchLoop;

      for (const status of value) {
        const createdAt = new Date(status.createdAt);
        if (createdAt > endOfYear) {
          continue;
        }
        if (createdAt >= startOfYear) {
          allResults.push(status);
        } else {
          break fetchLoop;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (e) {
      console.error(e);
      break fetchLoop;
    }
  }

  allResults.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Calculate total size of all posts in bytes
  let totalSize = 0;
  try {
    totalSize = new TextEncoder().encode(JSON.stringify(allResults)).length;
  } catch (e) {
    console.error('Error calculating total size:', e);
  }

  const NS = getCurrentAccountNS();
  const dataId = `${NS}-${year}`;
  const timezoneOffset = new Date().getTimezoneOffset();

  await db.yearInPosts.set(dataId, {
    id: dataId,
    posts: allResults,
    count: allResults.length,
    year,
    size: totalSize,
    fetchedAt: Date.now(),
    timezoneOffset,
  });

  const list = store.account.get(YEAR_IN_POSTS_LIST_KEY) || {};
  list[year] = {
    count: allResults.length,
    size: totalSize,
    fetchedAt: Date.now(),
    timezoneOffset,
  };
  store.account.set(YEAR_IN_POSTS_LIST_KEY, list);

  return allResults;
}
