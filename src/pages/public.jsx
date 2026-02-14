import { Trans, useLingui } from '@lingui/react/macro';
import { MenuDivider, MenuItem } from '@szhsin/react-menu';
import { useRef, useState } from 'preact/hooks';
import { useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Menu2 from '../components/menu2';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { filteredItems } from '../utils/filters';
import states, { saveStatus } from '../utils/states';
import store from '../utils/store';
import supports from '../utils/supports';
import { checkTimelineAccess } from '../utils/timeline-access';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Public({ local, columnMode, ...props }) {
  const { t } = useLingui();
  const snapStates = useSnapshot(states);
  const isLocal = !!local;
  const params = columnMode ? {} : useParams();
  const { masto, authenticated, instance } = api({
    instance: props?.instance || params.instance,
  });
  const { instance: currentInstance } = api();
  const title = isLocal
    ? t`Local timeline (${instance})`
    : t`Federated timeline (${instance})`;
  useTitle(title, isLocal ? `/:instance?/p/l` : `/:instance?/p`);
  // const navigate = useNavigate();
  const latestItem = useRef();

  // Timeline access: public, authenticated, disabled
  const [timelineAccess, setTimelineAccess] = useState(null);
  const isDisabled = timelineAccess === 'disabled';
  const requiresAuth = timelineAccess === 'authenticated';
  const isPrivate = requiresAuth && !authenticated;

  const publicIterator = useRef();
  async function fetchPublic(firstLoad) {
    if (firstLoad || !publicIterator.current) {
      const access = await checkTimelineAccess({
        feed: 'liveFeeds',
        feedType: isLocal ? 'local' : 'remote',
        instance,
      });
      setTimelineAccess(access);
      if (
        access === 'disabled' ||
        (access === 'authenticated' && !authenticated)
      ) {
        return {
          done: true,
          value: [],
        };
      }

      const opts = {
        limit: LIMIT,
        local: isLocal || undefined,
      };
      if (!isLocal && supports('@pixelfed/global-feed')) {
        opts.remote = true;
      }
      publicIterator.current = masto.v1.timelines.public.list(opts).values();
    }
    const results = await publicIterator.current.next();
    let { value } = results;
    if (value?.length) {
      if (firstLoad) {
        latestItem.current = value[0].id;
      }

      // value = filteredItems(value, 'public');
      value.forEach((item) => {
        saveStatus(item, instance);
      });
    }
    return {
      ...results,
      value,
    };
  }

  async function checkForUpdates() {
    if (isDisabled || isPrivate) return false;
    try {
      const results = await masto.v1.timelines.public
        .list({
          limit: 1,
          local: isLocal,
          since_id: latestItem.current,
        })
        .values()
        .next();
      let { value } = results;
      const valueContainsLatestItem = value[0]?.id === latestItem.current; // since_id might not be supported
      if (value?.length && !valueContainsLatestItem) {
        value = filteredItems(value, 'public');
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
        <h1 class="header-double-lines">
          <b>{isLocal ? t`Local timeline` : t`Federated timeline`}</b>
          <div>{instance}</div>
        </h1>
      }
      id="public"
      instance={instance}
      emptyText={
        isDisabled
          ? t`This timeline is disabled on this server.`
          : isPrivate
            ? t`Login required to see posts from this server.`
            : t`No one has posted anything yet.`
      }
      errorText={t`Unable to load posts`}
      fetchItems={fetchPublic}
      checkForUpdates={checkForUpdates}
      useItemID
      headerStart={<></>}
      boostsCarousel={snapStates.settings.boostsCarousel}
      // allowFilters
      filterContext="public"
      headerEnd={
        <Menu2
          portal
          // setDownOverflow
          overflow="auto"
          viewScroll="close"
          position="anchor"
          menuButton={
            <button type="button" class="plain">
              <Icon icon="more" size="l" alt={t`More`} />
            </button>
          }
        >
          <MenuItem href={isLocal ? `/#/${instance}/p` : `/#/${instance}/p/l`}>
            {isLocal ? (
              <>
                <Icon icon="transfer" />{' '}
                <span>
                  <Trans>Switch to Federated</Trans>
                </span>
              </>
            ) : (
              <>
                <Icon icon="transfer" />{' '}
                <span>
                  <Trans>Switch to Local</Trans>
                </span>
              </>
            )}
          </MenuItem>
          <MenuDivider />
          <MenuItem
            onClick={() => {
              let newInstance = prompt(
                t`Enter a new server e.g. "mastodon.social"`,
              );
              if (!/\./.test(newInstance)) {
                if (newInstance) alert(t`Invalid server`);
                return;
              }
              if (newInstance) {
                newInstance = newInstance.toLowerCase().trim();
                // navigate(isLocal ? `/${newInstance}/p/l` : `/${newInstance}/p`);
                location.hash = isLocal
                  ? `/${newInstance}/p/l`
                  : `/${newInstance}/p`;
              }
            }}
          >
            <Icon icon="bus" />{' '}
            <span>
              <Trans>Go to another server…</Trans>
            </span>
          </MenuItem>
          {currentInstance !== instance && (
            <MenuItem
              onClick={() => {
                location.hash = isLocal
                  ? `/${currentInstance}/p/l`
                  : `/${currentInstance}/p`;
              }}
            >
              <Icon icon="bus" />{' '}
              <small class="menu-double-lines">
                <Trans>
                  Go to my server (<b>{currentInstance}</b>)
                </Trans>
              </small>
            </MenuItem>
          )}
        </Menu2>
      }
    />
  );
}

export default Public;
