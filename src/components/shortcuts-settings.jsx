import './shortcuts-settings.css';

import { useEffect, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import { api } from '../utils/api';
import states from '../utils/states';

import AsyncText from './AsyncText';
import Icon from './icon';

const TYPES = [
  'following',
  'notifications',
  'list',
  'public',
  'search',
  // NOTE: Hide for now, can't think of a good way to handle this
  // 'account-statuses',
  'bookmarks',
  'favourites',
  'hashtag',
];
const TYPE_TEXT = {
  following: 'Home',
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
      placeholder: 'e.g PixelArt',
    },
  ],
};
export const SHORTCUTS_META = {
  following: {
    title: 'Home',
    path: (_, index) => (index === 0 ? '/' : '/l/f'),
    icon: 'home',
  },
  notifications: {
    title: 'Notifications',
    path: '/notifications',
    icon: 'notification',
  },
  list: {
    title: async ({ id }) => {
      const list = await api().masto.v1.lists.fetch(id);
      return list.title;
    },
    path: ({ id }) => `/l/${id}`,
    icon: 'list',
  },
  public: {
    title: ({ local, instance }) =>
      `${local ? 'Local' : 'Federated'} (${instance})`,
    path: ({ local, instance }) => `/${instance}/p${local ? '/l' : ''}`,
    icon: ({ local }) => (local ? 'group' : 'earth'),
  },
  search: {
    title: ({ query }) => query,
    path: ({ query }) => `/search?q=${query}`,
    icon: 'search',
  },
  'account-statuses': {
    title: async ({ id }) => {
      const account = await api().masto.v1.accounts.fetch(id);
      return account.username || account.acct || account.displayName;
    },
    path: ({ id }) => `/a/${id}`,
    icon: 'user',
  },
  bookmarks: {
    title: 'Bookmarks',
    path: '/b',
    icon: 'bookmark',
  },
  favourites: {
    title: 'Favourites',
    path: '/f',
    icon: 'heart',
  },
  hashtag: {
    title: ({ hashtag }) => hashtag,
    path: ({ hashtag }) => `/t/${hashtag}`,
    icon: 'hashtag',
  },
};

function ShortcutsSettings() {
  const snapStates = useSnapshot(states);
  const { masto } = api();

  const [lists, setLists] = useState([]);
  const [followedHashtags, setFollowedHashtags] = useState([]);

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
          Specify a list of shortcuts that'll appear in the floating Shortcuts
          button.
        </p>
        {snapStates.shortcuts.length > 0 ? (
          <ol class="shortcuts-list">
            {snapStates.shortcuts.map((shortcut, i) => {
              const key = i + Object.values(shortcut);
              const { type } = shortcut;
              let { icon, title } = SHORTCUTS_META[type];
              if (typeof title === 'function') {
                title = title(shortcut);
              }
              if (typeof icon === 'function') {
                icon = icon(shortcut);
              }
              return (
                <li key={key}>
                  <Icon icon={icon} />
                  <span class="shortcut-text">
                    <AsyncText>{title}</AsyncText>
                  </span>
                  <span>
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
                      disabled={i === snapStates.shortcuts.length - 1}
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
        <hr />
        <ShortcutForm
          lists={lists}
          followedHashtags={followedHashtags}
          onSubmit={(data) => {
            console.log('onSubmit', data);
            states.shortcuts.push(data);
          }}
        />
      </main>
    </div>
  );
}

export default ShortcutsSettings;
function ShortcutForm({ type, lists, followedHashtags, onSubmit }) {
  const [currentType, setCurrentType] = useState(type);
  return (
    <>
      <form
        onSubmit={(e) => {
          // Construct a nice object from form
          e.preventDefault();
          const data = new FormData(e.target);
          const result = {};
          data.forEach((value, key) => {
            result[key] = value;
          });
          if (!result.type) return;
          onSubmit(result);
          // Reset
          e.target.reset();
          setCurrentType(null);
        }}
      >
        <header>
          <h3>Add a shortcut</h3>
          <button type="submit">Add</button>
        </header>
        <p>
          <label>
            <span>Timeline</span>
            <select
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
          ({ text, name, type, placeholder }) => {
            if (currentType === 'list') {
              return (
                <p>
                  <label>
                    <span>List</span>
                    <select name="id" required>
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
                    list={
                      currentType === 'hashtag'
                        ? 'followed-hashtags-datalist'
                        : null
                    }
                  />
                  {currentType === 'hashtag' && followedHashtags.length > 0 && (
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
        <footer></footer>
      </form>
    </>
  );
}
