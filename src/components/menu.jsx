import { FocusableItem, Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';

import { api } from '../utils/api';
import states from '../utils/states';

import Icon from './icon';
import Link from './link';

function NavMenu(props) {
  const { instance } = api();
  return (
    <Menu
      portal={{
        target: document.body,
      }}
      {...props}
      viewScroll="close"
      menuButton={
        <button type="button" class="button plain">
          <Icon icon="menu" size="l" />
        </button>
      }
    >
      <MenuLink to="/">
        <Icon icon="home" size="l" /> <span>Home</span>
      </MenuLink>
      <MenuLink to="/notifications">
        <Icon icon="notification" size="l" /> <span>Notifications</span>
      </MenuLink>
      <MenuDivider />
      <MenuLink to="/b">
        <Icon icon="bookmark" size="l" /> <span>Bookmarks</span>
      </MenuLink>
      <MenuLink to="/f">
        <Icon icon="heart" size="l" /> <span>Favourites</span>
      </MenuLink>
      <MenuLink to="/l">
        <Icon icon="list" size="l" /> <span>Lists</span>
      </MenuLink>
      <MenuDivider />
      {/* <MenuLink to={`/search`}>
        <Icon icon="search" size="l" /> <span>Search</span>
      </MenuLink> */}
      <MenuLink to={`/${instance}/p/l`}>
        <Icon icon="group" size="l" /> <span>Local</span>
      </MenuLink>
      <MenuLink to={`/${instance}/p`}>
        <Icon icon="earth" size="l" /> <span>Federated</span>
      </MenuLink>
      <MenuDivider />
      <MenuItem
        onClick={() => {
          states.showSettings = true;
        }}
      >
        <Icon icon="gear" size="l" alt="Settings" /> <span>Settings</span>
      </MenuItem>
    </Menu>
  );
}

function MenuLink(props) {
  return (
    <FocusableItem>
      {({ ref, closeMenu }) => (
        <Link
          {...props}
          ref={ref}
          onClick={({ detail }) =>
            closeMenu(detail === 0 ? 'Enter' : undefined)
          }
        />
      )}
    </FocusableItem>
  );
}

export default NavMenu;
