import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { useLongPress } from 'use-long-press';
import { useSnapshot } from 'valtio';

import { api } from '../utils/api';
import states from '../utils/states';
import store from '../utils/store';

import Avatar from './avatar';
import Icon from './icon';
import MenuLink from './menu-link';

function NavMenu(props) {
  const snapStates = useSnapshot(states);
  const { instance, authenticated } = api();
  const accounts = store.local.getJSON('accounts') || [];
  const currentAccount = accounts.find(
    (account) => account.info.id === store.session.get('currentAccount'),
  );
  const moreThanOneAccount = accounts.length > 1;

  // Home = Following
  // But when in multi-column mode, Home becomes columns of anything
  // User may choose pin or not to pin Following
  // If user doesn't pin Following, we show it in the menu
  const showFollowing =
    (snapStates.settings.shortcutsColumnsMode ||
      snapStates.settings.shortcutsViewMode === 'multi-column') &&
    !snapStates.shortcuts.find((pin) => pin.type === 'following');

  const bindLongPress = useLongPress(
    () => {
      states.showAccounts = true;
    },
    {
      threshold: 600,
      detect: 'touch',
      cancelOnMovement: true,
    },
  );

  return (
    <Menu
      portal={{
        target: document.body,
      }}
      {...props}
      overflow="auto"
      viewScroll="close"
      boundingBoxPadding="8 8 8 8"
      menuButton={({ open }) => (
        <button
          type="button"
          class={`button plain nav-menu-button ${
            moreThanOneAccount ? 'with-avatar' : ''
          } ${open ? 'active' : ''}`}
          style={{ position: 'relative' }}
          onContextMenu={(e) => {
            e.preventDefault();
            states.showAccounts = true;
          }}
          {...bindLongPress()}
        >
          {moreThanOneAccount && (
            <Avatar
              url={
                currentAccount?.info?.avatar ||
                currentAccount?.info?.avatarStatic
              }
              size="l"
              squircle={currentAccount?.info?.bot}
            />
          )}
          <Icon icon="menu" size={moreThanOneAccount ? 's' : 'l'} />
        </button>
      )}
    >
      {!!snapStates.appVersion?.commitHash &&
        __COMMIT_HASH__ !== snapStates.appVersion.commitHash && (
          <>
            <MenuItem
              onClick={() => {
                const yes = confirm('Reload page now to update?');
                if (yes) {
                  (async () => {
                    try {
                      location.reload();
                    } catch (e) {}
                  })();
                }
              }}
            >
              <Icon icon="sparkles" size="l" />{' '}
              <span>New update available…</span>
            </MenuItem>
            <MenuDivider />
          </>
        )}
      <MenuLink to="/">
        <Icon icon="home" size="l" /> <span>Home</span>
      </MenuLink>
      {authenticated && (
        <>
          {showFollowing && (
            <MenuLink to="/following">
              <Icon icon="following" size="l" /> <span>Following</span>
            </MenuLink>
          )}
          <MenuLink to="/mentions">
            <Icon icon="at" size="l" /> <span>Mentions</span>
          </MenuLink>
          <MenuLink to="/notifications">
            <Icon icon="notification" size="l" /> <span>Notifications</span>
            {snapStates.notificationsShowNew && (
              <sup title="New" style={{ opacity: 0.5 }}>
                {' '}
                &bull;
              </sup>
            )}
          </MenuLink>
          <MenuDivider />
          <MenuLink to="/l">
            <Icon icon="list" size="l" /> <span>Lists</span>
          </MenuLink>
          <MenuLink to="/ft">
            <Icon icon="hashtag" size="l" /> <span>Followed Hashtags</span>
          </MenuLink>
          <MenuLink to="/b">
            <Icon icon="bookmark" size="l" /> <span>Bookmarks</span>
          </MenuLink>
          <MenuLink to="/f">
            <Icon icon="heart" size="l" /> <span>Favourites</span>
          </MenuLink>
        </>
      )}
      <MenuDivider />
      <MenuLink to={`/search`}>
        <Icon icon="search" size="l" /> <span>Search</span>
      </MenuLink>
      <MenuLink to={`/${instance}/p/l`}>
        <Icon icon="group" size="l" /> <span>Local</span>
      </MenuLink>
      <MenuLink to={`/${instance}/p`}>
        <Icon icon="earth" size="l" /> <span>Federated</span>
      </MenuLink>
      <MenuLink to={`/${instance}/trending`}>
        <Icon icon="chart" size="l" /> <span>Trending</span>
      </MenuLink>
      {authenticated && (
        <>
          <MenuDivider />
          {currentAccount?.info?.id && (
            <MenuLink to={`/${instance}/a/${currentAccount.info.id}`}>
              <Icon icon="user" size="l" /> <span>Profile</span>
            </MenuLink>
          )}
          <MenuItem
            onClick={() => {
              states.showAccounts = true;
            }}
          >
            <Icon icon="group" size="l" /> <span>Accounts&hellip;</span>
          </MenuItem>
          <MenuItem
            onClick={() => {
              states.showShortcutsSettings = true;
            }}
          >
            <Icon icon="shortcut" size="l" />{' '}
            <span>Shortcuts Settings&hellip;</span>
          </MenuItem>
          <MenuItem
            onClick={() => {
              states.showSettings = true;
            }}
          >
            <Icon icon="gear" size="l" /> <span>Settings&hellip;</span>
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

export default NavMenu;
