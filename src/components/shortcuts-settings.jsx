import './shortcuts-settings.css';

import mem from 'mem';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import floatingButtonUrl from '../assets/floating-button.svg';
import multiColumnUrl from '../assets/multi-column.svg';
import tabMenuBarUrl from '../assets/tab-menu-bar.svg';
import { api } from '../utils/api';
import states from '../utils/states';

import AsyncText from './AsyncText';
import Icon from './icon';
import Modal from './modal';

const SHORTCUTS_LIMIT = 9;

const TYPES = [
  'following',
  'mentions',
  'notifications',
  'list',
  'public',
  'trending',
  // NOTE: Hide for now
  // 'search', // Search on Mastodon ain't great
  // 'account-statuses', // Need @acct search first
  'hashtag',
  'bookmarks',
  'favourites',
];
const TYPE_TEXT = {
  following: 'Home / Following',
  notifications: 'Notifications',
  list: 'List',
  public: 'Public (Local / Federated)',
  search: 'Search',
  'account-statuses': 'Account',
  bookmarks: 'Bookmarks',
  favourites: 'Favourites',
  hashtag: 'Hashtag',
  trending: 'Trending',
  mentions: 'Mentions',
};
const TYPE_PARAMS = {
  list: [
    {
      text: 'List ID',
      name: 'id',
    },
  ],
  public: [
    {
      text: 'Local only',
      name: 'local',
      type: 'checkbox',
    },
    {
      text: 'Instance',
      name: 'instance',
      type: 'text',
      placeholder: 'e.g. mastodon.social',
    },
  ],
  trending: [
    {
      text: 'Instance',
      name: 'instance',
      type: 'text',
      placeholder: 'e.g. mastodon.social',
    },
  ],
  search: [
    {
      text: 'Search term',
      name: 'query',
      type: 'text',
    },
  ],
  'account-statuses': [
    {
      text: '@',
      name: 'id',
      type: 'text',
      placeholder: 'cheeaun@mastodon.social',
    },
  ],
  hashtag: [
    {
      text: '#',
      name: 'hashtag',
      type: 'text',
      placeholder: 'e.g. PixelArt (Max 5, space-separated)',
      pattern: '[^#]+',
    },
    {
      text: 'Instance',
      name: 'instance',
      type: 'text',
      placeholder: 'Optional, e.g. mastodon.social',
      notRequired: true,
    },
  ],
};
export const SHORTCUTS_META = {
  following: {
    id: 'home',
    title: (_, index) => (index === 0 ? 'Home' : 'Following'),
    path: '/',
    icon: 'home',
  },
  mentions: {
    id: 'mentions',
    title: 'Mentions',
    path: '/mentions',
    icon: 'at',
  },
  notifications: {
    id: 'notifications',
    title: 'Notifications',
    path: '/notifications',
    icon: 'notification',
  },
  list: {
    id: 'list',
    title: mem(
      async ({ id }) => {
        const list = await api().masto.v1.lists.fetch(id);
        return list.title;
      },
      {
        cacheKey: ([{ id }]) => id,
      },
    ),
    path: ({ id }) => `/l/${id}`,
    icon: 'list',
  },
  public: {
    id: 'public',
    title: ({ local }) => (local ? 'Local' : 'Federated'),
    subtitle: ({ instance }) => instance,
    path: ({ local, instance }) => `/${instance}/p${local ? '/l' : ''}`,
    icon: ({ local }) => (local ? 'group' : 'earth'),
  },
  trending: {
    id: 'trending',
    title: 'Trending',
    subtitle: ({ instance }) => instance,
    path: ({ instance }) => `/${instance}/trending`,
    icon: 'chart',
  },
  search: {
    id: 'search',
    title: ({ query }) => query,
    path: ({ query }) => `/search?q=${query}`,
    icon: 'search',
  },
  'account-statuses': {
    id: 'account-statuses',
    title: mem(
      async ({ id }) => {
        const account = await api().masto.v1.accounts.fetch(id);
        return account.username || account.acct || account.displayName;
      },
      {
        cacheKey: ([{ id }]) => id,
      },
    ),
    path: ({ id }) => `/a/${id}`,
    icon: 'user',
  },
  bookmarks: {
    id: 'bookmarks',
    title: 'Bookmarks',
    path: '/b',
    icon: 'bookmark',
  },
  favourites: {
    id: 'favourites',
    title: 'Favourites',
    path: '/f',
    icon: 'heart',
  },
  hashtag: {
    id: 'hashtag',
    title: ({ hashtag }) => hashtag,
    subtitle: ({ instance }) => instance,
    path: ({ hashtag }) => `/t/${hashtag.split(/\s+/).join('+')}`,
    icon: 'hashtag',
  },
};

function ShortcutsSettings() {
  const snapStates = useSnapshot(states);
  const { masto } = api();
  const { shortcuts } = snapStates;

  const [lists, setLists] = useState([]);
  const [followedHashtags, setFollowedHashtags] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const lists = await masto.v1.lists.list();
        setLists(lists);
      } catch (e) {
        console.error(e);
      }
    })();

    (async () => {
      try {
        const iterator = masto.v1.followedTags.list();
        const tags = [];
        do {
          const { value, done } = await iterator.next();
          if (done || value?.length === 0) break;
          tags.push(...value);
        } while (true);
        setFollowedHashtags(tags);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <div id="shortcuts-settings-container" class="sheet" tabindex="-1">
      <header>
        <h2>
          <Icon icon="shortcut" /> Shortcuts{' '}
          <sup
            style={{
              fontSize: 12,
              opacity: 0.5,
              textTransform: 'uppercase',
            }}
          >
            beta
          </sup>
        </h2>
      </header>
      <main>
        <p>
          Specify a list of shortcuts that'll appear&nbsp;as:
          <div class="shortcuts-view-mode">
            {[
              {
                value: 'float-button',
                label: 'Floating button',
                imgURL: floatingButtonUrl,
              },
              {
                value: 'tab-menu-bar',
                label: 'Tab/Menu bar',
                imgURL: tabMenuBarUrl,
              },
              {
                value: 'multi-column',
                label: 'Multi-column',
                imgURL: multiColumnUrl,
              },
            ].map(({ value, label, imgURL }) => (
              <label>
                <input
                  type="radio"
                  name="shortcuts-view-mode"
                  value={value}
                  checked={
                    snapStates.settings.shortcutsViewMode === value ||
                    (value === 'float-button' &&
                      !snapStates.settings.shortcutsViewMode)
                  }
                  onChange={(e) => {
                    states.settings.shortcutsViewMode = e.target.value;
                  }}
                />{' '}
                <img src={imgURL} alt="" width="80" height="58" />{' '}
                <span>{label}</span>
              </label>
            ))}
          </div>
          {/* <select
              value={snapStates.settings.shortcutsViewMode || 'float-button'}
              onChange={(e) => {
                states.settings.shortcutsViewMode = e.target.value;
              }}
            >
              <option value="float-button">Floating button</option>
              <option value="multi-column">Multi-column</option>
              <option value="tab-menu-bar">Tab/Menu bar </option>
            </select> */}
        </p>
        {/* <p>
          <details>
            <summary class="insignificant">
              Experimental Multi-column mode
            </summary>
            <label>
              <input
                type="checkbox"
                checked={snapStates.settings.shortcutsColumnsMode}
                onChange={(e) => {
                  states.settings.shortcutsColumnsMode = e.target.checked;
                }}
              />{' '}
              Show shortcuts in multiple columns instead of the floating button.
            </label>
          </details>
        </p> */}
        {shortcuts.length > 0 ? (
          <ol class="shortcuts-list">
            {shortcuts.filter(Boolean).map((shortcut, i) => {
              const key = i + Object.values(shortcut);
              const { type } = shortcut;
              if (!SHORTCUTS_META[type]) return null;
              let { icon, title, subtitle } = SHORTCUTS_META[type];
              if (typeof title === 'function') {
                title = title(shortcut, i);
              }
              if (typeof subtitle === 'function') {
                subtitle = subtitle(shortcut, i);
              }
              if (typeof icon === 'function') {
                icon = icon(shortcut, i);
              }
              return (
                <li key={key}>
                  <Icon icon={icon} />
                  <span class="shortcut-text">
                    <AsyncText>{title}</AsyncText>
                    {subtitle && (
                      <>
                        {' '}
                        <small class="ib insignificant">{subtitle}</small>
                      </>
                    )}
                  </span>
                  <span class="shortcut-actions">
                    <button
                      type="button"
                      class="plain small"
                      disabled={i === 0}
                      onClick={() => {
                        const shortcutsArr = Array.from(states.shortcuts);
                        if (i > 0) {
                          const temp = states.shortcuts[i - 1];
                          shortcutsArr[i - 1] = shortcut;
                          shortcutsArr[i] = temp;
                          states.shortcuts = shortcutsArr;
                        }
                      }}
                    >
                      <Icon icon="arrow-up" alt="Move up" />
                    </button>
                    <button
                      type="button"
                      class="plain small"
                      disabled={i === shortcuts.length - 1}
                      onClick={() => {
                        const shortcutsArr = Array.from(states.shortcuts);
                        if (i < states.shortcuts.length - 1) {
                          const temp = states.shortcuts[i + 1];
                          shortcutsArr[i + 1] = shortcut;
                          shortcutsArr[i] = temp;
                          states.shortcuts = shortcutsArr;
                        }
                      }}
                    >
                      <Icon icon="arrow-down" alt="Move down" />
                    </button>
                    <button
                      type="button"
                      class="plain small"
                      onClick={() => {
                        setShowForm({
                          shortcut,
                          shortcutIndex: i,
                        });
                      }}
                    >
                      <Icon icon="pencil" alt="Edit" />
                    </button>
                    {/* <button
                      type="button"
                      class="plain small"
                      onClick={() => {
                        states.shortcuts.splice(i, 1);
                      }}
                    >
                      <Icon icon="x" alt="Remove" />
                    </button> */}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p class="ui-state insignificant">
            No shortcuts yet. Add one from the form below.
          </p>
        )}
        <p
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span class="insignificant">
            {shortcuts.length >= SHORTCUTS_LIMIT &&
              `Max ${SHORTCUTS_LIMIT} shortcuts`}
          </span>
          <button
            type="button"
            disabled={shortcuts.length >= SHORTCUTS_LIMIT}
            onClick={() => setShowForm(true)}
          >
            <Icon icon="plus" /> <span>Add shortcut</span>
          </button>
        </p>
      </main>
      {showForm && (
        <Modal
          class="light"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <ShortcutForm
            shortcut={showForm.shortcut}
            shortcutIndex={showForm.shortcutIndex}
            disabled={shortcuts.length >= SHORTCUTS_LIMIT}
            lists={lists}
            followedHashtags={followedHashtags}
            onSubmit={({ result, mode }) => {
              console.log('onSubmit', result);
              if (mode === 'edit') {
                states.shortcuts[showForm.shortcutIndex] = result;
              } else {
                states.shortcuts.push(result);
              }
            }}
            onClose={() => setShowForm(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function ShortcutForm({
  lists,
  followedHashtags,
  onSubmit,
  disabled,
  shortcut,
  shortcutIndex,
  onClose = () => {},
}) {
  console.log('shortcut', shortcut);
  const editMode = !!shortcut;
  const [currentType, setCurrentType] = useState(shortcut?.type || null);

  const formRef = useRef();
  useEffect(() => {
    if (editMode && currentType && TYPE_PARAMS[currentType]) {
      // Populate form
      const form = formRef.current;
      TYPE_PARAMS[currentType].forEach(({ name, type }) => {
        const input = form.querySelector(`[name="${name}"]`);
        if (input && shortcut[name]) {
          if (type === 'checkbox') {
            input.checked = shortcut[name] === 'on' ? true : false;
          } else {
            input.value = shortcut[name];
          }
        }
      });
    }
  }, [editMode, currentType]);

  return (
    <div id="shortcut-settings-form" class="sheet">
      <header>
        <h2>{editMode ? 'Edit' : 'Add'} shortcut</h2>
      </header>
      <main tabindex="-1">
        <form
          ref={formRef}
          onSubmit={(e) => {
            // Construct a nice object from form
            e.preventDefault();
            const data = new FormData(e.target);
            const result = {};
            data.forEach((value, key) => {
              result[key] = value?.trim();
            });
            console.log('result', result);
            if (!result.type) return;
            onSubmit({
              result,
              mode: editMode ? 'edit' : 'add',
            });
            // Reset
            e.target.reset();
            setCurrentType(null);
            onClose();
          }}
        >
          <p>
            <label>
              <span>Timeline</span>
              <select
                required
                disabled={disabled}
                onChange={(e) => {
                  setCurrentType(e.target.value);
                }}
                defaultValue={editMode ? shortcut.type : undefined}
                name="type"
              >
                <option></option>
                {TYPES.map((type) => (
                  <option value={type}>{TYPE_TEXT[type]}</option>
                ))}
              </select>
            </label>
          </p>
          {TYPE_PARAMS[currentType]?.map?.(
            ({ text, name, type, placeholder, pattern, notRequired }) => {
              if (currentType === 'list') {
                return (
                  <p>
                    <label>
                      <span>List</span>
                      <select
                        name="id"
                        required={!notRequired}
                        disabled={disabled}
                      >
                        {lists.map((list) => (
                          <option value={list.id}>{list.title}</option>
                        ))}
                      </select>
                    </label>
                  </p>
                );
              }

              return (
                <p>
                  <label>
                    <span>{text}</span>{' '}
                    <input
                      type={type}
                      name={name}
                      placeholder={placeholder}
                      required={type === 'text' && !notRequired}
                      disabled={disabled}
                      list={
                        currentType === 'hashtag'
                          ? 'followed-hashtags-datalist'
                          : null
                      }
                      autocorrect="off"
                      autocapitalize="off"
                      spellcheck={false}
                      pattern={pattern}
                    />
                    {currentType === 'hashtag' &&
                      followedHashtags.length > 0 && (
                        <datalist id="followed-hashtags-datalist">
                          {followedHashtags.map((tag) => (
                            <option value={tag.name} />
                          ))}
                        </datalist>
                      )}
                  </label>
                </p>
              );
            },
          )}
          <footer>
            <button type="submit" class="block" disabled={disabled}>
              {editMode ? 'Save' : 'Add'}
            </button>
            {editMode && (
              <button
                type="button"
                class="light danger"
                onClick={() => {
                  states.shortcuts.splice(shortcutIndex, 1);
                  onClose();
                }}
              >
                Remove
              </button>
            )}
          </footer>
        </form>
      </main>
    </div>
  );
}

export default ShortcutsSettings;
