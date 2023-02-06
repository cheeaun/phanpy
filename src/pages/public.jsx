// EXPERIMENTAL: This is a work in progress and may not work as expected.
import { useRef } from 'preact/hooks';
import { useMatch, useParams } from 'react-router-dom';

import Timeline from '../components/timeline';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Public() {
  const isLocal = !!useMatch('/:instance/p/l');
  const params = useParams();
  const { masto, instance } = api({ instance: params.instance });
  const title = `${instance} (${isLocal ? 'local' : 'federated'})`;
  useTitle(title, `/p/l?/:instance`);

  const publicIterator = useRef();
  async function fetchPublic(firstLoad) {
    if (firstLoad || !publicIterator.current) {
      publicIterator.current = masto.v1.timelines.listPublic({
        limit: LIMIT,
        local: isLocal,
      });
    }
    return await publicIterator.current.next();
  }

  return (
    <Timeline
      key={instance + isLocal}
      title={title}
      titleComponent={
        <h1 class="header-account">
          <b>{instance}</b>
          <div>{isLocal ? 'local' : 'federated'}</div>
        </h1>
      }
      id="public"
      instance={instance}
      emptyText="No one has posted anything yet."
      errorText="Unable to load posts"
      fetchItems={fetchPublic}
    />
  );
}

export default Public;
