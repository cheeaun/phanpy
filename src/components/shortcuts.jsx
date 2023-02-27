import './shortcuts.css';

import { Menu, MenuItem } from '@szhsin/react-menu';
import { useMemo, useRef } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import { SHORTCUTS_META } from '../components/shortcuts-settings';
import states from '../utils/states';

import AsyncText from './AsyncText';
import Icon from './icon';
import Link from './Link';
import MenuLink from './MenuLink';

function Shortcuts() {
  const snapStates = useSnapshot(states);
  const { shortcuts } = snapStates;

  if (!shortcuts.length) {
    return null;
  }

  const menuRef = useRef();

  const formattedShortcuts = useMemo(
    () =>
      shortcuts
        .map((pin, i) => {
          const { type, ...data } = pin;
          if (!SHORTCUTS_META[type]) return null;
          let { id, path, title, icon } = SHORTCUTS_META[type];

          if (typeof id === 'function') {
            id = id(data);
          }
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
            id,
            path,
            title,
            icon,
          };
        })
        .filter(Boolean),
    [shortcuts],
  );

  const navigate = useNavigate();
  useHotkeys(['1', '2', '3', '4', '5', '6', '7', '8', '9'], (e, handler) => {
    const index = parseInt(handler.keys[0], 10) - 1;
    if (index < formattedShortcuts.length) {
      const { path } = formattedShortcuts[index];
      if (path) {
        navigate(path);
        menuRef.current?.closeMenu?.();
      }
    }
  });

  return (
    <div id="shortcuts">
      {snapStates.settings.shortcutsViewMode === 'tab-menu-bar' ? (
        <nav class="tab-bar">
          <ul>
            {formattedShortcuts.map(({ id, path, title, icon }, i) => {
              return (
                <li key={i + title}>
                  <Link
                    to={path}
                    onClick={(e) => {
                      if (e.target.classList.contains('is-active')) {
                        e.preventDefault();
                        const page = document.getElementById(`${id}-page`);
                        console.log(id, page);
                        if (page) {
                          page.scrollTop = 0;
                          const updatesButton =
                            page.querySelector('.updates-button');
                          if (updatesButton) {
                            updatesButton.click();
                          }
                        }
                      }
                    }}
                  >
                    <Icon icon={icon} size="xl" alt={title} />
                    <span>
                      <AsyncText>{title}</AsyncText>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : (
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
                <span class="menu-shortcut hide-until-focus-visible">
                  {i + 1}
                </span>
              </MenuLink>
            );
          })}
        </Menu>
      )}
    </div>
  );
}

export default Shortcuts;
