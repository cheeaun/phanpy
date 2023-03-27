import { getStatus } from './states';

export function groupBoosts(values) {
  let newValues = [];
  let boostStash = [];
  let serialBoosts = 0;
  for (let i = 0; i < values.length; i++) {
    const item = values[i];
    if (item.reblog) {
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
  if (boostStash.length > values.length / 4 || serialBoosts >= 3) {
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
  return items.filter((item) => {
    if (!item.reblog) return true;
    const s = getStatus(item.reblog.id, instance);
    if (s) {
      console.warn(
        `🚫 Duplicate boost by ${item.account.displayName}`,
        item,
        s,
      );
      return false;
    }
    const s2 = getStatus(item.id, instance);
    if (s2) {
      console.warn('🚫 Re-boosted boost', item);
      return false;
    }
    return true;
  });
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
