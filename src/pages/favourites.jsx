import { useRef } from 'preact/hooks';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Favourites() {
  useTitle('Likes', '/f');
  const { masto, instance } = api();
  const favouritesIterator = useRef();
  async function fetchFavourites(firstLoad) {
    if (firstLoad || !favouritesIterator.current) {
      favouritesIterator.current = masto.v1.favourites.list({ limit: LIMIT });
    }
    return await favouritesIterator.current.next();
  }

  return (
    <Timeline
      title="Likes"
      id="favourites"
      emptyText="No likes yet. Go like something!"
      errorText="Unable to load likes"
      instance={instance}
      fetchItems={fetchFavourites}
    />
  );
}

export default Favourites;
