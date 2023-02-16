import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { useSnapshot } from 'valtio';

import { api } from '../utils/api';
import states from '../utils/states';

import Icon from './icon';
import MenuLink from './MenuLink';

function NavMenu(props) {
  const snapStates = useSnapshot(states);
  const { instance, authenticated } = api();
  return (
    <Menu
      portal={{
        target: document.body,
      }}
      {...props}
      overflow="auto"
      viewScroll="close"
      boundingBoxPadding="8 8 8 8"
      menuButton={
        <button type="button" class="button plain">
          <Icon icon="menu" size="l" />
        </button>
      }
    >
      <MenuLink to="/">
        <Icon icon="home" size="l" /> <span>Home</span>
      </MenuLink>
      {authenticated && (
        <>
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
      {authenticated && (
        <>
          <MenuDivider />
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
