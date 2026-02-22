import './shortcuts.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { ControlledMenu, MenuDivider } from '@szhsin/react-menu';
import { memo } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from 'react-router-dom';
import { useLongPress } from 'use-long-press';
import { useSnapshot } from 'valtio';

import { SHORTCUTS_META } from '../components/shortcuts-settings';
import { api } from '../utils/api';
import { getLists } from '../utils/lists';
import safeBoundingBoxPadding from '../utils/safe-bounding-box-padding';
import states from '../utils/states';

import AsyncText from './AsyncText';
import Avatar from './avatar';
import Icon from './icon';
import Link from './link';
import ListExclusiveBadge from './list-exclusive-badge';
import MenuLink from './menu-link';
import Menu2 from './menu2';
import SubMenu2 from './submenu2';

function ListsMenuContent({ lists }) {
  return (
    <>
      <MenuLink to="/l">
        <span>
          <Trans>All Lists</Trans>
        </span>
      </MenuLink>
      <MenuDivider />
      {lists?.map((list) => (
        <MenuLink key={list.id} to={`/l/${list.id}`}>
          <span>
            {list.title}
            {list.exclusive && (
              <>
                {' '}
                <ListExclusiveBadge />
              </>
            )}
          </span>
        </MenuLink>
      ))}
    </>
  );
}

function Shortcuts() {
  const { t, _ } = useLingui();
  const { instance } = api();
  const snapStates = useSnapshot(states);
  const { shortcuts, settings } = snapStates;

  if (!shortcuts.length) {
    return null;
  }
  const isMultiColumnMode =
    settings.shortcutsViewMode === 'multi-column' ||
    (!settings.shortcutsViewMode && settings.shortcutsColumnsMode);

  const menuRef = useRef();
  const tabBarRef = useRef();

  const hasLists = useRef(false);
  const formattedShortcuts = shortcuts
    .map((pin, i) => {
      const { type, ...data } = pin;
      if (!SHORTCUTS_META[type]) return null;
      let { id, path, title, subtitle, icon, altIcon } = SHORTCUTS_META[type];

      if (typeof id === 'function') {
        id = id(data, i);
      }
      if (typeof path === 'function') {
        path = path(
          {
            ...data,
            instance: data.instance || instance,
          },
          i,
        );
      }
      if (typeof title === 'function') {
        title = title(data, i);
      } else if (title?.id) {
        // Check if it's MessageDescriptor
        title = _(title);
      }
      if (typeof subtitle === 'function') {
        subtitle = subtitle(data, i);
      } else if (subtitle?.id) {
        // Check if it's MessageDescriptor
        subtitle = _(subtitle);
      }
      if (typeof icon === 'function') {
        icon = icon(data, i);
      }
      if (typeof altIcon === 'function') {
        altIcon = altIcon(data, i);
      }

      if (id === 'lists') {
        hasLists.current = true;
      }

      return {
        id,
        path,
        title,
        subtitle,
        icon,
        altIcon,
      };
    })
    .filter(Boolean);

  // Auto-scroll to active tab on first render
  useEffect(() => {
    if (
      snapStates.settings.shortcutsViewMode === 'tab-menu-bar' &&
      tabBarRef.current
    ) {
      const timeoutId = setTimeout(() => {
        const activeTab = tabBarRef.current?.querySelector('.is-active');
        if (activeTab) {
          activeTab.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
          });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, []);

  const navigate = useNavigate();
  useHotkeys(
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    (e) => {
      const index = parseInt(e.key, 10) - 1;
      if (index < formattedShortcuts.length) {
        const { path } = formattedShortcuts[index];
        if (path) {
          navigate(path);
          menuRef.current?.closeMenu?.();
        }
      }
    },
    {
      enabled: !isMultiColumnMode,
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    },
  );

  const [lists, setLists] = useState([]);

  const listsMenuRef = useRef();
  const listsLinkRef = useRef();
  const [listsMenuState, setListsMenuState] = useState(undefined);

  useEffect(() => {
    if (listsMenuState === 'open') {
      getLists().then(setLists);
    }
  }, [listsMenuState]);

  const bindListsLongPress = useLongPress(
    () => {
      setListsMenuState('open');
    },
    {
      threshold: 600,
      detect: 'touch',
      cancelOnMovement: true,
    },
  );

  const bindProfileLongPress = useLongPress(
    () => {
      states.showAccounts = true;
    },
    {
      threshold: 600,
      detect: 'touch',
      cancelOnMovement: true,
    },
  );

  if (isMultiColumnMode) {
    return null;
  }

  return (
    <div id="shortcuts">
      {snapStates.settings.shortcutsViewMode === 'tab-menu-bar' ? (
        <>
          <nav
            ref={tabBarRef}
            class="tab-bar"
            onContextMenu={(e) => {
              e.preventDefault();
              states.showShortcutsSettings = true;
            }}
          >
            <ul>
              {formattedShortcuts.map(
                ({ id, path, title, subtitle, icon, altIcon }, i) => {
                  const extraProps =
                    id === 'lists'
                      ? {
                          ref: listsLinkRef,
                          onContextMenu(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            setListsMenuState('open');
                          },
                          ...bindListsLongPress(),
                        }
                      : id === 'profile'
                        ? {
                            onContextMenu(e) {
                              e.preventDefault();
                              e.stopPropagation();
                              states.showAccounts = true;
                            },
                            ...bindProfileLongPress(),
                          }
                        : {};

                  return (
                    <li key={`${i}-${id}-${title}-${subtitle}-${path}`}>
                      <Link
                        class={subtitle ? 'has-subtitle' : ''}
                        to={path}
                        onClick={(e) => {
                          if (e.target.classList.contains('is-active')) {
                            e.preventDefault();
                            const page = document.getElementById(`${id}-page`);
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
                        {...extraProps}
                      >
                        {altIcon?.url ? (
                          altIcon?.type === 'avatar' ? (
                            <Avatar staticUrl={altIcon.url} size="l" />
                          ) : (
                            <img
                              src={altIcon.url}
                              alt=""
                              class="shortcut-icon"
                              loading="lazy"
                              decoding="async"
                              fetchPriority="low"
                            />
                          )
                        ) : (
                          <Icon icon={icon} size="xl" />
                        )}
                        <span>
                          <AsyncText>{title}</AsyncText>
                          {subtitle && (
                            <>
                              <br />
                              <small>{subtitle}</small>
                            </>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                },
              )}
            </ul>
          </nav>
          <ControlledMenu
            ref={listsMenuRef}
            state={listsMenuState}
            anchorRef={listsLinkRef}
            onClose={() => {
              setListsMenuState(undefined);
            }}
            overflow="auto"
            viewScroll="close"
            gap={4}
            boundingBoxPadding={safeBoundingBoxPadding()}
            portal={{
              target: document.body,
            }}
          >
            <ListsMenuContent lists={lists} />
          </ControlledMenu>
        </>
      ) : (
        <Menu2
          instanceRef={menuRef}
          overflow="auto"
          viewScroll="close"
          menuClassName="glass-menu shortcuts-menu"
          gap={8}
          position="anchor"
          onMenuChange={(e) => {
            if (e.open && hasLists.current) {
              getLists().then(setLists);
            }
          }}
          menuButton={
            <button
              type="button"
              id="shortcuts-button"
              class="plain"
              onContextMenu={(e) => {
                e.preventDefault();
                states.showShortcutsSettings = true;
              }}
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
              <Icon icon="shortcut" size="xl" alt={t`Shortcuts`} />
            </button>
          }
        >
          {formattedShortcuts.map(({ id, path, title, subtitle, icon }, i) => {
            if (id === 'lists') {
              return (
                <SubMenu2
                  menuClassName="glass-menu"
                  overflow="auto"
                  gap={-8}
                  label={
                    <>
                      <Icon icon={icon} size="l" />
                      <span class="menu-grow">
                        <AsyncText>{title}</AsyncText>
                      </span>
                      <Icon icon="chevron-right" />
                    </>
                  }
                >
                  <ListsMenuContent lists={lists} />
                </SubMenu2>
              );
            }

            return (
              <MenuLink
                to={path}
                key={`${i}-${id}-${title}-${subtitle}-${path}`}
                class="glass-menu-item"
              >
                <Icon icon={icon} size="l" />{' '}
                <span class="menu-grow">
                  <span>
                    <AsyncText>{title}</AsyncText>
                  </span>
                  {subtitle && (
                    <>
                      {' '}
                      <small class="more-insignificant">{subtitle}</small>
                    </>
                  )}
                </span>
                <span class="menu-shortcut hide-until-focus-visible">
                  {i + 1}
                </span>
              </MenuLink>
            );
          })}
        </Menu2>
      )}
    </div>
  );
}

export default memo(Shortcuts);
