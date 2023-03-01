import './shortcuts-settings.css';

import mem from 'mem';
import { useEffect, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import { api } from '../utils/api';
import states from '../utils/states';

import AsyncText from './AsyncText';
import Icon from './icon';
import Modal from './modal';

const SHORTCUTS_LIMIT = 9;

const TYPES = [
  'following',
  'notifications',
  'list',
  'public',
  // NOTE: Hide for now
  // 'search', // Search on Mastodon ain't great
  // 'account-statuses', // Need @acct search first
  'bookmarks',
  'favourites',
  'hashtag',
];
const TYPE_TEXT = {
  following: 'Home / Following',
  notifications: 'Notifications',
  list: 'List',
  public: 'Public',
  search: 'Search',
  'account-statuses': 'Account',
  bookmarks: 'Bookmarks',
  favourites: 'Favourites',
  hashtag: 'Hashtag',
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
  ],
};
export const SHORTCUTS_META = {
  following: {
    id: 'home',
    title: (_, index) => (index === 0 ? 'Home' : 'Following'),
    path: '/',
    icon: 'home',
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
    title: ({ local, instance }) =>
      `${local ? 'Local' : 'Federated'} (${instance})`,
    path: ({ local, instance }) => `/${instance}/p${local ? '/l' : ''}`,
    icon: ({ local }) => (local ? 'group' : 'earth'),
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
          <label class="shortcuts-view-mode">
            Specify a list of shortcuts that'll appear&nbsp;as:
            <select
              value={snapStates.settings.shortcutsViewMode || 'float-button'}
              onChange={(e) => {
                states.settings.shortcutsViewMode = e.target.value;
              }}
            >
              <option value="float-button">Floating button</option>
              <option value="multi-column">Multi-column</option>
              <option value="tab-menu-bar">Tab/Menu bar </option>
            </select>
          </label>
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
            {shortcuts.map((shortcut, i) => {
              const key = i + Object.values(shortcut);
              const { type } = shortcut;
              if (!SHORTCUTS_META[type]) return null;
              let { icon, title } = SHORTCUTS_META[type];
              if (typeof title === 'function') {
                title = title(shortcut, i);
              }
              if (typeof icon === 'function') {
                icon = icon(shortcut, i);
              }
              return (
                <li key={key}>
                  <Icon icon={icon} />
                  <span class="shortcut-text">
                    <AsyncText>{title}</AsyncText>
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
                        states.shortcuts.splice(i, 1);
                      }}
                    >
                      <Icon icon="x" alt="Remove" />
                    </button>
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
            disabled={shortcuts.length >= SHORTCUTS_LIMIT}
            lists={lists}
            followedHashtags={followedHashtags}
            onSubmit={(data) => {
              console.log('onSubmit', data);
              states.shortcuts.push(data);
            }}
            onClose={() => setShowForm(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function ShortcutForm({
  type,
  lists,
  followedHashtags,
  onSubmit,
  disabled,
  onClose = () => {},
}) {
  const [currentType, setCurrentType] = useState(type);
  return (
    <div id="shortcut-settings-form" class="sheet">
      <header>
        <h2>Add shortcut</h2>
      </header>
      <main tabindex="-1">
        <form
          onSubmit={(e) => {
            // Construct a nice object from form
            e.preventDefault();
            const data = new FormData(e.target);
            const result = {};
            data.forEach((value, key) => {
              result[key] = value?.trim();
            });
            if (!result.type) return;
            onSubmit(result);
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
            ({ text, name, type, placeholder, pattern }) => {
              if (currentType === 'list') {
                return (
                  <p>
                    <label>
                      <span>List</span>
                      <select name="id" required disabled={disabled}>
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
                      required={type === 'text'}
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
          <button type="submit" class="block" disabled={disabled}>
            Add
          </button>
        </form>
      </main>
    </div>
  );
}

export default ShortcutsSettings;
