import { useRef } from 'preact/hooks';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Favourites() {
  useTitle('Favourites', '/f');
  const { masto } = api();
  const favouritesIterator = useRef();
  async function fetchFavourites(firstLoad) {
    if (firstLoad || !favouritesIterator.current) {
      favouritesIterator.current = masto.v1.favourites.list({ limit: LIMIT });
    }
    return await favouritesIterator.current.next();
  }

  return (
    <Timeline
      title="Favourites"
      id="favourites"
      emptyText="No favourites yet. Go favourite something!"
      errorText="Unable to load favourites"
      fetchItems={fetchFavourites}
    />
  );
}

export default Favourites;
