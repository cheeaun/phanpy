import { api } from './api';
import { extractTagsFromStatus, getFollowedTags } from './followed-tags';
import pmem from './pmem';
import { fetchRelationships } from './relationships';
import states, { saveStatus, statusKey } from './states';
import store from './store';
import supports from './supports';

export function groupBoosts(values) {
  let newValues = [];
  let boostStash = [];
  let serialBoosts = 0;
  for (let i = 0; i < values.length; i++) {
    const item = values[i];
    if (item.reblog && !item.account?.group) {
      boostStash.push(item);
      serialBoosts++;
    } else {
      newValues.push(item);
      if (serialBoosts < 3) {
        serialBoosts = 0;
      }
    }
  }
  // if boostStash is more than quarter of values
  // or if there are 3 or more boosts in a row
  if (
    values.length > 10 &&
    (boostStash.length > values.length / 4 || serialBoosts >= 3)
  ) {
    // if boostStash is more than 3 quarter of values
    const boostStashID = boostStash.map((status) => status.id);
    if (boostStash.length > (values.length * 3) / 4) {
      // insert boost array at the end of specialHome list
      newValues = [
        ...newValues,
        { id: boostStashID, items: boostStash, type: 'boosts' },
      ];
    } else {
      // insert boosts array in the middle of specialHome list
      const half = Math.floor(newValues.length / 2);
      newValues = [
        ...newValues.slice(0, half),
        {
          id: boostStashID,
          items: boostStash,
          type: 'boosts',
        },
        ...newValues.slice(half),
      ];
    }
    return newValues;
  } else {
    return values;
  }
}

export function dedupeBoosts(items, instance) {
  const boostedStatusIDs = store.account.get('boostedStatusIDs') || {};
  const filteredItems = items.filter((item) => {
    if (!item.reblog) return true;
    const statusKey = `${instance}-${item.reblog.id}`;
    const boosterID = boostedStatusIDs[statusKey];
    if (boosterID && boosterID !== item.id) {
      console.warn(
        `🚫 Duplicate boost by ${item.account.displayName}`,
        item,
        item.reblog,
      );
      return false;
    } else {
      boostedStatusIDs[statusKey] = item.id;
    }
    return true;
  });
  // Limit to 50
  const keys = Object.keys(boostedStatusIDs);
  if (keys.length > 50) {
    keys.slice(0, keys.length - 50).forEach((key) => {
      delete boostedStatusIDs[key];
    });
  }
  store.account.set('boostedStatusIDs', boostedStatusIDs);
  return filteredItems;
}

export function groupContext(items, instance) {
  const contexts = [];
  let contextIndex = 0;
  items.forEach((item) => {
    for (let i = 0; i < contexts.length; i++) {
      if (contexts[i].find((t) => t.id === item.id)) return;
      if (
        contexts[i].find((t) => t.id === item.inReplyToId) ||
        contexts[i].find((t) => t.inReplyToId === item.id)
      ) {
        contexts[i].push(item);
        return;
      }
    }
    const repliedItem = items.find((i) => i.id === item.inReplyToId);
    if (repliedItem) {
      contexts[contextIndex++] = [item, repliedItem];
    }
  });

  // Check for cross-item contexts
  // Merge contexts into one if they have a common item (same id)
  for (let i = 0; i < contexts.length; i++) {
    for (let j = i + 1; j < contexts.length; j++) {
      const commonItem = contexts[i].find((t) => contexts[j].includes(t));
      if (commonItem) {
        contexts[i] = [...contexts[i], ...contexts[j]];
        // Remove duplicate items
        contexts[i] = contexts[i].filter(
          (item, index, self) =>
            self.findIndex((t) => t.id === item.id) === index,
        );
        contexts.splice(j, 1);
        j--;
      }
    }
  }

  // Sort items by checking inReplyToId
  contexts.forEach((context) => {
    context.sort((a, b) => {
      if (!a.inReplyToId && !b.inReplyToId) {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (a.inReplyToId === b.id) return 1;
      if (b.inReplyToId === a.id) return -1;
      if (!a.inReplyToId) return -1;
      if (!b.inReplyToId) return 1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  });

  // Tag items that has different author than first post's author
  contexts.forEach((context) => {
    const firstItemAccountID = context[0].account.id;
    context.forEach((item) => {
      if (item.account.id !== firstItemAccountID) {
        item._differentAuthor = true;
      }
    });
  });

  if (contexts.length) console.log('🧵 Contexts', contexts);

  const newItems = [];
  const appliedContextIndices = [];
  const inReplyToIds = [];
  items.forEach((item) => {
    if (item.reblog) {
      newItems.push(item);
      return;
    }
    for (let i = 0; i < contexts.length; i++) {
      if (contexts[i].find((t) => t.id === item.id)) {
        if (appliedContextIndices.includes(i)) return;
        const contextItems = contexts[i];
        contextItems.sort((a, b) => {
          const aDate = new Date(a.createdAt);
          const bDate = new Date(b.createdAt);
          return aDate - bDate;
        });
        const firstItemAccountID = contextItems[0].account.id;
        newItems.push({
          id: contextItems.map((i) => i.id),
          items: contextItems,
          type: contextItems.every((it) => it.account.id === firstItemAccountID)
            ? 'thread'
            : 'conversation',
        });
        appliedContextIndices.push(i);
        return;
      }
    }

    // PREPARE FOR REPLY HINTS
    if (item.inReplyToId && item.inReplyToAccountId !== item.account.id) {
      const sKey = statusKey(item.id, instance);
      if (!states.statusReply[sKey]) {
        // If it's a reply and not a thread
        inReplyToIds.push({
          sKey,
          inReplyToId: item.inReplyToId,
        });
        // queueMicrotask(async () => {
        //   try {
        //     const { masto } = api({ instance });
        //     // const replyToStatus = await masto.v1.statuses
        //     //   .$select(item.inReplyToId)
        //     //   .fetch();
        //     const replyToStatus = await fetchStatus(item.inReplyToId, masto);
        //     saveStatus(replyToStatus, instance, {
        //       skipThreading: true,
        //       skipUnfurling: true,
        //     });
        //     states.statusReply[sKey] = {
        //       id: replyToStatus.id,
        //       instance,
        //     };
        //   } catch (e) {
        //     // Silently fail
        //     console.error(e);
        //   }
        // });
      }
    }

    newItems.push(item);
  });

  // FETCH AND SHOW REPLY HINTS
  if (inReplyToIds?.length) {
    queueMicrotask(() => {
      const { masto } = api({ instance });
      console.log('REPLYHINT', inReplyToIds);

      // Fallback if batch fetch fails or returns nothing or not supported
      async function fallbackFetch() {
        for (let i = 0; i < inReplyToIds.length; i++) {
          const { sKey, inReplyToId } = inReplyToIds[i];
          try {
            const replyToStatus = await fetchStatus(inReplyToId, masto);
            saveStatus(replyToStatus, instance, {
              skipThreading: true,
              skipUnfurling: true,
            });
            states.statusReply[sKey] = {
              id: replyToStatus.id,
              instance,
            };
            // Pause 1s
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (e) {
            // Silently fail
            console.error(e);
          }
        }
      }

      if (supports('@mastodon/fetch-multiple-statuses')) {
        // This is batch fetching yooo, woot
        // Limit 20, returns 422 if exceeded https://github.com/mastodon/mastodon/pull/27871
        const ids = inReplyToIds.map(({ inReplyToId }) => inReplyToId);
        (async () => {
          try {
            const replyToStatuses = await masto.v1.statuses.list({ id: ids });
            if (replyToStatuses?.length) {
              for (const replyToStatus of replyToStatuses) {
                saveStatus(replyToStatus, instance, {
                  skipThreading: true,
                  skipUnfurling: true,
                });
                const sKey = inReplyToIds.find(
                  ({ inReplyToId }) => inReplyToId === replyToStatus.id,
                )?.sKey;
                if (sKey) {
                  states.statusReply[sKey] = {
                    id: replyToStatus.id,
                    instance,
                  };
                }
              }
            } else {
              fallbackFetch();
            }
          } catch (e) {
            // Silently fail
            console.error(e);
            fallbackFetch();
          }
        })();
      } else {
        fallbackFetch();
      }
    });
  }

  return newItems;
}

const fetchStatus = pmem((statusID, masto) => {
  return masto.v1.statuses.$select(statusID).fetch();
});

export async function assignFollowedTags(items, instance) {
  const followedTags = await getFollowedTags(); // [{name: 'tag'}, {...}]
  if (!followedTags.length) return;
  const { statusFollowedTags } = states;
  console.log('statusFollowedTags', statusFollowedTags);
  const statusWithFollowedTags = [];
  items.forEach((item) => {
    if (item.reblog) return;
    const { id, content, tags = [] } = item;
    const sKey = statusKey(id, instance);
    if (statusFollowedTags[sKey]?.length) return;
    const extractedTags = extractTagsFromStatus(content);
    if (!extractedTags.length && !tags.length) return;
    const itemFollowedTags = followedTags.reduce((acc, tag) => {
      if (
        extractedTags.some((t) => t.toLowerCase() === tag.name.toLowerCase()) ||
        tags.some((t) => t.name.toLowerCase() === tag.name.toLowerCase())
      ) {
        acc.push(tag.name);
      }
      return acc;
    }, []);
    if (itemFollowedTags.length) {
      // statusFollowedTags[sKey] = itemFollowedTags;
      statusWithFollowedTags.push({
        item,
        sKey,
        followedTags: itemFollowedTags,
      });
    }
  });

  if (statusWithFollowedTags.length) {
    const accounts = statusWithFollowedTags.map((s) => s.item.account);
    const relationships = await fetchRelationships(accounts);
    if (!relationships) return;

    statusWithFollowedTags.forEach((s) => {
      const { item, sKey, followedTags } = s;
      const r = relationships[item.account.id];
      if (r && !r.following) {
        statusFollowedTags[sKey] = followedTags;
      }
    });
  }
}

export function clearFollowedTagsState() {
  states.statusFollowedTags = {};
}
