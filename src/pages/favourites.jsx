import { Trans, useLingui } from '@lingui/react/macro';
import { useRef } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import states from '../utils/states';
import { applyTimelineFilters } from '../utils/timeline-utils';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Favourites() {
  const { t } = useLingui();
  const snapStates = useSnapshot(states);
  useTitle(t`Likes`, '/favourites');
  const { masto, instance } = api();
  const favouritesIterator = useRef();
  async function fetchFavourites(firstLoad) {
    if (firstLoad || !favouritesIterator.current) {
      favouritesIterator.current = masto.v1.favourites
        .list({ limit: LIMIT })
        .values();
    }
    const results = await favouritesIterator.current.next();
    let { value } = results;
    if (value?.length) {
      value = applyTimelineFilters(value, snapStates.settings);
    }
    return {
      ...results,
      value,
    };
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
