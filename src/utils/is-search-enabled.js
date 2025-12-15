import { api } from './api';
import pmem from './pmem';

async function _isSearchEnabled(instance) {
  const { masto } = api({ instance });
  const results = await masto.v2.search.list({
    q: 'from:me',
    type: 'statuses',
    limit: 1,
  });
  return !!results?.statuses?.length;
}

export default pmem(_isSearchEnabled);
