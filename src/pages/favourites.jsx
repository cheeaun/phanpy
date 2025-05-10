import { Trans, useLingui } from '@lingui/react/macro';
import { useRef } from 'preact/hooks';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Favourites() {
  const { t } = useLingui();
  useTitle(t`Likes`, '/favourites');
  const { masto, instance } = api();
  const favouritesIterator = useRef();
  async function fetchFavourites(firstLoad) {
    if (firstLoad || !favouritesIterator.current) {
      favouritesIterator.current = masto.v1.favourites
        .list({ limit: LIMIT })
        .values();
    }
    return await favouritesIterator.current.next();
  }

  return (
    <Timeline
      title={t`Likes`}
      id="favourites"
      emptyText={t`No likes yet. Go like something!`}
      errorText={t`Unable to load likes.`}
      instance={instance}
      fetchItems={fetchFavourites}
    />
  );
}

export default Favourites;
