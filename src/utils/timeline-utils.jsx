import store from './store';

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

export function groupContext(items) {
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
    newItems.push(item);
  });

  return newItems;
}
