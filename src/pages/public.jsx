import { t, Trans } from '@lingui/macro';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { useRef } from 'preact/hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Menu2 from '../components/menu2';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { filteredItems } from '../utils/filters';
import states, { saveStatus } from '../utils/states';
import supports from '../utils/supports';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function Public({ variant = 'federated', columnMode, ...props }) {
  const snapStates = useSnapshot(states);
  const params = columnMode ? {} : useParams();
  const { masto, instance } = api({
    instance: props?.instance || params.instance,
  });
  const { masto: currentMasto, instance: currentInstance } = api();
  const title = {
    local: t`Local timeline (${instance})`,
    bubble: t`Bubble timeline (${instance})`,
    federated: t`Federated timeline (${instance})`,
  }[variant];
  const headerText = {
    local: t`Local timeline`,
    bubble: t`Bubble timeline`,
    federated: t`Federated timeline`,
  }[variant];
  const path = {
    local: '/:instance?/p/l',
    bubble: '/:instance?/p/b',
    federated: '/:instance?/p',
  }[variant];
  const source = {
    local: masto.v1.timelines.public.list,
    bubble: masto.v1.timelines.bubble.list, // Bubble timeline isn't officially supported in Masto, but this seems to work nevertheless
    federated: masto.v1.timelines.public.list,
  }[variant];

  useTitle(title, path);
  // const navigate = useNavigate();
  const latestItem = useRef();

  const publicIterator = useRef();
  async function fetchPublic(firstLoad) {
    if (firstLoad || !publicIterator.current) {
      const opts = {
        limit: LIMIT,
        local: variant === 'local',
      };
      if (variant === 'federated' && supports('@pixelfed/global-feed')) {
        opts.remote = true;
      }
      publicIterator.current = source(opts);
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
    try {
      const results = await source
        .list({
          limit: 1,
          local: variant === 'local',
          since_id: latestItem.current,
        })
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
      key={instance + variant}
      title={title}
      titleComponent={
        <h1 class="header-double-lines">
          <b>{headerText}</b>
          <div>{instance}</div>
        </h1>
      }
      id="public"
      instance={instance}
      emptyText={t`No one has posted anything yet.`}
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
          {variant !== 'local' && (
            <MenuItem href={`/#/${instance}/p/l`}>
              <Icon icon="transfer" />{' '}
              <span>
                <Trans>Switch to Local</Trans>
              </span>
            </MenuItem>
          )}
          {variant !== 'bubble' && (
            <MenuItem href={`/#/${instance}/p/b`}>
              <Icon icon="transfer" />{' '}
              <span>
                <Trans>Switch to Bubble</Trans>
              </span>
            </MenuItem>
          )}
          {variant !== 'federated' && (
            <MenuItem href={`/#/${instance}/p`}>
              <Icon icon="transfer" />{' '}
              <span>
                <Trans>Switch to Federated</Trans>
              </span>
            </MenuItem>
          )}
          <MenuDivider />
          <MenuItem
            onClick={() => {
              let newInstance = prompt(
                t`Enter a new instance e.g. "mastodon.social"`,
              );
              if (!/\./.test(newInstance)) {
                if (newInstance) alert(t`Invalid instance`);
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
              <Trans>Go to another instance…</Trans>
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
                  Go to my instance (<b>{currentInstance}</b>)
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
