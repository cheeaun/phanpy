import './shortcuts.css';

import { Menu, MenuItem } from '@szhsin/react-menu';
import { useRef } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import { SHORTCUTS_META } from '../components/shortcuts-settings';
import states from '../utils/states';

import AsyncText from './AsyncText';
import Icon from './icon';
import MenuLink from './MenuLink';

function Shortcuts() {
  const snapStates = useSnapshot(states);
  const { shortcuts } = snapStates;

  if (!shortcuts.length) {
    return null;
  }

  const menuRef = useRef();

  const formattedShortcuts = shortcuts
    .map((pin, i) => {
      const { type, ...data } = pin;
      if (!SHORTCUTS_META[type]) return null;
      let { path, title, icon } = SHORTCUTS_META[type];

      if (typeof path === 'function') {
        path = path(data, i);
      }
      if (typeof title === 'function') {
        title = title(data);
      }
      if (typeof icon === 'function') {
        icon = icon(data);
      }

      return {
        path,
        title,
        icon,
      };
    })
    .filter(Boolean);

  const navigate = useNavigate();
  useHotkeys(['1', '2', '3', '4', '5', '6', '7', '8', '9'], (e, handler) => {
    const index = parseInt(handler.keys[0], 10) - 1;
    if (index < formattedShortcuts.length) {
      const { path } = formattedShortcuts[index];
      if (path) {
        navigate(path);
      }
    }
  });

  return (
    <div id="shortcuts">
      <Menu
        instanceRef={menuRef}
        overflow="auto"
        viewScroll="close"
        boundingBoxPadding="8 8 8 8"
        menuClassName="glass-menu shortcuts-menu"
        offsetY={8}
        position="anchor"
        menuButton={
          <button
            type="button"
            id="shortcuts-button"
            class="plain"
            onTransitionStart={(e) => {
              // Close menu if the button disappears
              try {
                const { target } = e;
                if (getComputedStyle(target).pointerEvents === 'none') {
                  menuRef.current?.closeMenu?.();
                }
              } catch (e) {}
            }}
          >
            <Icon icon="shortcut" size="xl" alt="Shortcuts" />
          </button>
        }
      >
        {formattedShortcuts.map(({ path, title, icon }, i) => {
          return (
            <MenuLink to={path} key={i + title} class="glass-menu-item">
              <Icon icon={icon} size="l" />{' '}
              <span class="menu-grow">
                <AsyncText>{title}</AsyncText>
              </span>
              <span class="menu-shortcut">{i + 1}</span>
            </MenuLink>
          );
        })}
      </Menu>
    </div>
  );
}

export default Shortcuts;
