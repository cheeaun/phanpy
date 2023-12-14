import { api } from '../utils/api';
import store from '../utils/store';

const LIMIT = 200;
const MAX_FETCH = 10;

export async function fetchFollowedTags() {
  const { masto } = api();
  const iterator = masto.v1.followedTags.list({
    limit: LIMIT,
  });
  const tags = [];
  let fetchCount = 0;
  do {
    const { value, done } = await iterator.next();
    if (done || value?.length === 0) break;
    tags.push(...value);
    fetchCount++;
  } while (fetchCount < MAX_FETCH);
  tags.sort((a, b) => a.name.localeCompare(b.name));
  console.log(tags);

  if (tags.length) {
    setTimeout(() => {
      // Save to local storage, with saved timestamp
      store.account.set('followedTags', {
        tags,
        updatedAt: Date.now(),
      });
    }, 1);
  }

  return tags;
}

const MAX_AGE = 24 * 60 * 60 * 1000; // 1 day
export async function getFollowedTags() {
  try {
    const { tags, updatedAt } = store.account.get('followedTags') || {};
    if (!tags?.length) return await fetchFollowedTags();
    if (Date.now() - updatedAt > MAX_AGE) {
      // Stale-while-revalidate
      fetchFollowedTags();
      return tags;
    }
    return tags;
  } catch (e) {
    return [];
  }
}

const fauxDiv = document.createElement('div');
export const extractTagsFromStatus = (content) => {
  if (!content) return [];
  if (content.indexOf('#') === -1) return [];
  fauxDiv.innerHTML = content;
  const hashtagLinks = fauxDiv.querySelectorAll('a.hashtag');
  if (!hashtagLinks.length) return [];
  return Array.from(hashtagLinks).map((a) =>
    a.innerText.trim().replace(/^[^#]*#+/, ''),
  );
};
