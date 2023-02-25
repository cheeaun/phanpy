import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { useRef } from 'preact/hooks';
import { useNavigate, useParams } from 'react-router-dom';

import Icon from '../components/icon';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Public({ local, ...props }) {
  const isLocal = !!local;
  const params = useParams();
  const { masto, instance } = api({
    instance: props?.instance || params.instance,
  });
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
        <Menu
          portal={{
            target: document.body,
          }}
          // setDownOverflow
          overflow="auto"
          viewScroll="close"
          position="anchor"
          boundingBoxPadding="8 8 8 8"
          menuButton={
            <button type="button" class="plain">
              <Icon icon="more" size="l" />
            </button>
          }
        >
          <MenuItem href={isLocal ? `/#/${instance}/p` : `/#/${instance}/p/l`}>
            {isLocal ? (
              <>
                <Icon icon="transfer" /> <span>Switch to Federated</span>
              </>
            ) : (
              <>
                <Icon icon="transfer" /> <span>Switch to Local</span>
              </>
            )}
          </MenuItem>
          <MenuDivider />
          <MenuItem
            onClick={() => {
              let newInstance = prompt(
                'Enter a new instance e.g. "mastodon.social"',
              );
              if (!/\./.test(newInstance)) {
                if (newInstance) alert('Invalid instance');
                return;
              }
              if (newInstance) {
                newInstance = newInstance.toLowerCase().trim();
                navigate(isLocal ? `/${newInstance}/p/l` : `/${newInstance}/p`);
              }
            }}
          >
            <Icon icon="bus" /> <span>Go to another instance…</span>
          </MenuItem>
        </Menu>
      }
    />
  );
}

export default Public;
