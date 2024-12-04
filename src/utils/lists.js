import { api } from './api';
import pmem from './pmem';
import store from './store';

const FETCH_MAX_AGE = 1000 * 60; // 1 minute
const MAX_AGE = 24 * 60 * 60 * 1000; // 1 day

export const fetchLists = pmem(
  async () => {
    const { masto } = api();
    const lists = await masto.v1.lists.list();
    lists.sort((a, b) => a.title.localeCompare(b.title));

    if (lists.length) {
      setTimeout(() => {
        // Save to local storage, with saved timestamp
        store.account.set('lists', {
          lists,
          updatedAt: Date.now(),
        });
      }, 1);
    }

    return lists;
  },
  {
    maxAge: FETCH_MAX_AGE,
  },
);

export async function getLists() {
  try {
    const { lists, updatedAt } = store.account.get('lists') || {};
    if (!lists?.length) return await fetchLists();
    if (Date.now() - updatedAt > MAX_AGE) {
      // Stale-while-revalidate
      fetchLists();
      return lists;
    }
    return lists;
  } catch (e) {
    return [];
  }
}

export const fetchList = pmem(
  (id) => {
    const { masto } = api();
    return masto.v1.lists.$select(id).fetch();
  },
  {
    maxAge: FETCH_MAX_AGE,
  },
);

export async function getList(id) {
  const { lists } = store.account.get('lists') || {};
  console.log({ lists });
  if (lists?.length) {
    const theList = lists.find((l) => l.id === id);
    if (theList) return theList;
  }
  try {
    return fetchList(id);
  } catch (e) {
    return null;
  }
}

export async function getListTitle(id) {
  const list = await getList(id);
  return list?.title || '';
}

export function addListStore(list) {
  const { lists } = store.account.get('lists') || {};
  if (lists?.length) {
    lists.push(list);
    lists.sort((a, b) => a.title.localeCompare(b.title));
    store.account.set('lists', {
      lists,
      updatedAt: Date.now(),
    });
  }
}

export function updateListStore(list) {
  const { lists } = store.account.get('lists') || {};
  if (lists?.length) {
    const index = lists.findIndex((l) => l.id === list.id);
    if (index !== -1) {
      lists[index] = list;
      lists.sort((a, b) => a.title.localeCompare(b.title));
      store.account.set('lists', {
        lists,
        updatedAt: Date.now(),
      });
    }
  }
}

export function deleteListStore(listID) {
  const { lists } = store.account.get('lists') || {};
  if (lists?.length) {
    const index = lists.findIndex((l) => l.id === listID);
    if (index !== -1) {
      lists.splice(index, 1);
      store.account.set('lists', {
        lists,
        updatedAt: Date.now(),
      });
    }
  }
}
