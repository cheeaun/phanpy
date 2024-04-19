import { api } from './api';
import { getCurrentAccountID } from './store-utils';

export async function fetchRelationships(accounts, relationshipsMap = {}) {
  if (!accounts?.length) return;
  const { masto } = api();

  const currentAccount = getCurrentAccountID();
  const uniqueAccountIds = accounts.reduce((acc, a) => {
    // 1. Ignore duplicate accounts
    // 2. Ignore accounts that are already inside relationshipsMap
    // 3. Ignore currently logged in account
    if (
      !acc.includes(a.id) &&
      !relationshipsMap[a.id] &&
      a.id !== currentAccount
    ) {
      acc.push(a.id);
    }
    return acc;
  }, []);
  if (!uniqueAccountIds.length) return null;

  try {
    const relationships = await masto.v1.accounts.relationships.fetch({
      id: uniqueAccountIds,
    });
    const newRelationshipsMap = relationships.reduce((acc, r) => {
      acc[r.id] = r;
      return acc;
    }, {});
    return newRelationshipsMap;
  } catch (e) {
    console.error(e);
    // It's okay to fail
    return null;
  }
}
