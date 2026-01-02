import { api } from './api';
import db from './db';
import isSearchEnabled from './is-search-enabled';
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
    await db.yearInPosts.del(dataId);

    const list = store.account.get(YEAR_IN_POSTS_LIST_KEY) || {};
    delete list[yearToRemove];
    store.account.set(YEAR_IN_POSTS_LIST_KEY, list);

    return true;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

function isPostInYear(createdAt, year) {
  const postDate = new Date(createdAt);
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
  return postDate >= startOfYear && postDate <= endOfYear;
}

export async function fetchYearPosts(year) {
  const { masto, instance } = api();
  const allResults = [];
  let gapsFilled = false;

  const account = getCurrentAccount();
  if (!account) {
    throw new Error('No current account');
  }
  const accountId = account.info.id;
  const accountAcct = account.info.acct;

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

  const searchEnabled = await isSearchEnabled(instance);

  // Use search strategies if available
  let maxId = null;
  if (searchEnabled) {
    try {
      const latestPostIterator = masto.v1.accounts
        .$select(accountId)
        .statuses.list({
          limit: 1,
          exclude_replies: false,
          exclude_reblogs: false,
        })
        .values();
      const latestResult = await latestPostIterator.next();

      if (latestResult?.value?.length) {
        const latestPost = latestResult.value[0];
        if (!isPostInYear(latestPost.createdAt, year)) {
          // Use "before" search to find last post before year ends
          const beforeStr = `${year + 1}-01-02`;
          try {
            const beforeResults = await masto.v2.search.list({
              q: `from:${accountAcct} before:${beforeStr}`,
              type: 'statuses',
              limit: 1,
            });

            if (beforeResults?.statuses?.length) {
              maxId = beforeResults.statuses[0].id;
            }
          } catch (e) {
            console.error('Before search failed', e);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch latest post', e);
    }
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

      let foundInYear = false;
      for (const status of value) {
        const createdAt = new Date(status.createdAt);
        if (createdAt > endOfYear) {
          continue;
        }
        if (createdAt >= startOfYear) {
          allResults.push(status);
          foundInYear = true;
        }
      }

      // Only break if we didn't find any posts in the year in this batch
      if (!foundInYear) break fetchLoop;

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (e) {
      console.error(e);
      break fetchLoop;
    }
  }

  allResults.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Forward verification to check for gaps
  if (allResults.length > 0) {
    try {
      const earliestFetched = allResults[0];
      const earliestId = earliestFetched.id;

      // Loop to fetch all posts forward from earliest within the year
      const gapCheckIterator = masto.v1.accounts
        .$select(accountId)
        .statuses.list({
          limit: 40,
          min_id: earliestId,
          exclude_replies: false,
          exclude_reblogs: false,
        })
        .values();

      gapFillLoop: while (true) {
        try {
          const result = await gapCheckIterator.next();
          const { value, done } = result;

          if (done || !value?.length) break gapFillLoop;

          let foundInYear = false;
          for (const status of value) {
            const createdAt = new Date(status.createdAt);
            if (createdAt < startOfYear) {
              continue;
            }
            if (createdAt <= endOfYear) {
              if (!allResults.find((s) => s.id === status.id)) {
                allResults.push(status);
                gapsFilled = true;
              }
              foundInYear = true;
            }
          }

          // Only break if we didn't find any posts in the year in this batch
          if (!foundInYear) break gapFillLoop;

          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (e) {
          console.error(e);
          break gapFillLoop;
        }
      }

      if (gapsFilled) {
        allResults.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        );
      }
    } catch (e) {
      console.error('Gap check failed', e);
    }
  }

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

  return {
    posts: allResults,
    searchEnabled,
    gapsFilled,
  };
}
