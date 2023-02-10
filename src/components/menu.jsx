import { FocusableItem, Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';

import states from '../utils/states';

import Icon from './icon';
import Link from './link';

function NavMenu(props) {
  return (
    <Menu
      {...props}
      menuButton={
        <button type="button" class="button plain">
          <Icon icon="menu" size="l" />
        </button>
      }
    >
      <MenuLink to="/">
        <Icon icon="home" size="l" /> <span>Home</span>
      </MenuLink>
      <MenuLink to="/b">
        <Icon icon="bookmark" size="l" /> <span>Bookmarks</span>
      </MenuLink>
      <MenuLink to="/f">
        <Icon icon="heart" size="l" /> <span>Favourites</span>
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
