// EXPERIMENTAL: This is a work in progress and may not work as expected.
import { useRef } from 'preact/hooks';
import { useNavigate, useParams } from 'react-router-dom';

import Icon from '../components/icon';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Public({ local }) {
  const isLocal = !!local;
  const params = useParams();
  const { masto, instance } = api({ instance: params.instance });
  const title = `${isLocal ? 'Local' : 'Federated'} timeline (${instance})`;
  useTitle(title, isLocal ? `/:instance?/p/l` : `/:instance?/p`);
  const navigate = useNavigate();
  const latestItem = useRef();

  const publicIterator = useRef();
  async function fetchPublic(firstLoad) {
    if (firstLoad || !publicIterator.current) {
      publicIterator.current = masto.v1.timelines.listPublic({
        limit: LIMIT,
        local: isLocal,
      });
    }
    const results = await publicIterator.current.next();
    const { value } = results;
    if (value?.length) {
      if (firstLoad) {
        latestItem.current = value[0].id;
      }
    }
    return results;
  }

  async function checkForUpdates() {
    try {
      const results = await masto.v1.timelines
        .listPublic({
          limit: 1,
          local: isLocal,
          since_id: latestItem.current,
        })
        .next();
      const { value } = results;
      if (value?.length) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  return (
    <Timeline
      key={instance + isLocal}
      title={title}
      titleComponent={
        <h1 class="header-account">
          <b>{isLocal ? 'Local timeline' : 'Federated timeline'}</b>
          <div>{instance}</div>
        </h1>
      }
      id="public"
      instance={instance}
      emptyText="No one has posted anything yet."
      errorText="Unable to load posts"
      fetchItems={fetchPublic}
      checkForUpdates={checkForUpdates}
      headerStart={<></>}
      headerEnd={
        <button
          type="button"
          class="plain"
          onClick={() => {
            const newInstance = prompt(
              'Enter a new instance e.g. "mastodon.social"',
            );
            if (!/\./.test(newInstance)) {
              alert('Invalid instance');
              return;
            }
            if (newInstance) {
              navigate(isLocal ? `/${newInstance}/p/l` : `/${newInstance}/p`);
            }
          }}
        >
          <Icon icon="transfer" alt="Switch instance" />
        </button>
      }
    />
  );
}

export default Public;
