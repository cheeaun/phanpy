import { api } from './api';
import pmem from './pmem';

async function _isSearchEnabled(instance) {
  const { masto } = api({ instance });
  let results;
  try {
    results = await masto.v2.search.list({
      q: 'from:me',
      type: 'statuses',
      limit: 1,
    });
  } catch (e) {
    if (e?.statusCode !== 400) throw e;
    // Temporary fallback when from:me returns 400
    results = await masto.v2.search.list({
      q: 'in:library',
      type: 'statuses',
      limit: 1,
    });
  }
  return !!results?.statuses?.length;
}

export default pmem(_isSearchEnabled);
