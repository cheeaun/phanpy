import { api } from './api';
import pmem from './pmem';

const FAMILIAR_FOLLOWERS_MAX_AGE = 1000 * 60 * 10; // 10 mins

function fetchFamiliarFollowers(currentID) {
  const { masto } = api();
  return masto.v1.accounts.familiarFollowers.fetch({
    id: [currentID],
  });
}

export const memFetchFamiliarFollowers = pmem(fetchFamiliarFollowers, {
  expires: FAMILIAR_FOLLOWERS_MAX_AGE,
});
