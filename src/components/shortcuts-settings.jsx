import './shortcuts-settings.css';

import { useAutoAnimate } from '@formkit/auto-animate/preact';
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import floatingButtonUrl from '../assets/floating-button.svg';
import multiColumnUrl from '../assets/multi-column.svg';
import tabMenuBarUrl from '../assets/tab-menu-bar.svg';

import { api } from '../utils/api';
import { fetchFollowedTags } from '../utils/followed-tags';
import { getLists, getListTitle } from '../utils/lists';
import pmem from '../utils/pmem';
import showToast from '../utils/show-toast';
import states from '../utils/states';
import store from '../utils/store';

import AsyncText from './AsyncText';
import Icon from './icon';
import MenuConfirm from './menu-confirm';
import Modal from './modal';

export const SHORTCUTS_LIMIT = 9;

const TYPES = [
  'following',
  'mentions',
  'notifications',
  'list',
  'public',
  'trending',
  'search',
  'hashtag',
  'bookmarks',
  'favourites',
  // NOTE: Hide for now
  // 'account-statuses', // Need @acct search first
];
const TYPE_TEXT = {
  following: 'Home / Following',
  notifications: 'Notifications',
  list: 'Lists',
  public: 'Public (Local / Federated)',
  search: 'Search',
  'account-statuses': 'Account',
  bookmarks: 'Bookmarks',
  favourites: 'Likes',
  hashtag: 'Hashtag',
  trending: 'Trending',
  mentions: 'Mentions',
};
const TYPE_PARAMS = {
  list: [
    {
      text: 'List ID',
      name: 'id',
      notRequired: true,
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
      placeholder: 'Optional, e.g. mastodon.social',
      notRequired: true,
    },
  ],
  trending: [
    {
      text: 'Instance',
      name: 'instance',
      type: 'text',
      placeholder: 'Optional, e.g. mastodon.social',
      notRequired: true,
    },
  ],
  search: [
    {
      text: 'Search term',
      name: 'query',
      type: 'text',
      placeholder: 'Optional, unless for multi-column mode',
      notRequired: true,
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
      text: 'Media only',
      name: 'media',
      type: 'checkbox',
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
const fetchAccountTitle = pmem(async ({ id }) => {
  const account = await api().masto.v1.accounts.$select(id).fetch();
  return account.username || account.acct || account.displayName;
});
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
    id: ({ id }) => (id ? 'list' : 'lists'),
    title: ({ id }) => (id ? getListTitle(id) : 'Lists'),
    path: ({ id }) => (id ? `/l/${id}` : '/l'),
    icon: 'list',
    excludeViewMode: ({ id }) => (!id ? ['multi-column'] : []),
  },
  public: {
    id: 'public',
    title: ({ local }) => (local ? 'Local' : 'Federated'),
    subtitle: ({ instance }) => instance || api().instance,
    path: ({ local, instance }) => `/${instance}/p${local ? '/l' : ''}`,
    icon: ({ local }) => (local ? 'building' : 'earth'),
  },
  trending: {
    id: 'trending',
    title: 'Trending',
    subtitle: ({ instance }) => instance || api().instance,
    path: ({ instance }) => `/${instance}/trending`,
    icon: 'chart',
  },
  search: {
    id: 'search',
    title: ({ query }) => (query ? `“${query}”` : 'Search'),
    path: ({ query }) =>
      query
        ? `/search?q=${encodeURIComponent(query)}&type=statuses`
        : '/search',
    icon: 'search',
    excludeViewMode: ({ query }) => (!query ? ['multi-column'] : []),
  },
  'account-statuses': {
    id: 'account-statuses',
    title: fetchAccountTitle,
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
    title: 'Likes',
    path: '/f',
    icon: 'heart',
  },
  hashtag: {
    id: 'hashtag',
    title: ({ hashtag }) => hashtag,
    subtitle: ({ instance }) => instance || api().instance,
    path: ({ hashtag, instance, media }) =>
      `${instance ? `/${instance}` : ''}/t/${hashtag.split(/\s+/).join('+')}${
        media ? '?media=1' : ''
      }`,
    icon: 'hashtag',
  },
};

function ShortcutsSettings({ onClose }) {
  const snapStates = useSnapshot(states);
  const { shortcuts } = snapStates;
  const [showForm, setShowForm] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

  const [shortcutsListParent] = useAutoAnimate();

  return (
    <div id="shortcuts-settings-container" class="sheet" tabindex="-1">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
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
        <p>Specify a list of shortcuts that'll appear&nbsp;as:</p>
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
          ].map(({ value, label, imgURL }) => {
            const checked =
              snapStates.settings.shortcutsViewMode === value ||
              (value === 'float-button' &&
                !snapStates.settings.shortcutsViewMode);
            return (
              <label key={value} class={checked ? 'checked' : ''}>
                <input
                  type="radio"
                  name="shortcuts-view-mode"
                  value={value}
                  checked={checked}
                  onChange={(e) => {
                    states.settings.shortcutsViewMode = e.target.value;
                  }}
                />{' '}
                <img src={imgURL} alt="" width="80" height="58" />{' '}
                <span>{label}</span>
              </label>
            );
          })}
        </div>
        {shortcuts.length > 0 ? (
          <>
            <ol class="shortcuts-list" ref={shortcutsListParent}>
              {shortcuts.filter(Boolean).map((shortcut, i) => {
                // const key = i + Object.values(shortcut);
                const key = Object.values(shortcut).join('-');
                const { type } = shortcut;
                if (!SHORTCUTS_META[type]) return null;
                let { icon, title, subtitle, excludeViewMode } =
                  SHORTCUTS_META[type];
                if (typeof title === 'function') {
                  title = title(shortcut, i);
                }
                if (typeof subtitle === 'function') {
                  subtitle = subtitle(shortcut, i);
                }
                if (typeof icon === 'function') {
                  icon = icon(shortcut, i);
                }
                if (typeof excludeViewMode === 'function') {
                  excludeViewMode = excludeViewMode(shortcut, i);
                }
                const excludedViewMode = excludeViewMode?.includes(
                  snapStates.settings.shortcutsViewMode,
                );
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
                      {excludedViewMode && (
                        <span class="tag">
                          Not available in current view mode
                        </span>
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
            {shortcuts.length === 1 &&
              snapStates.settings.shortcutsViewMode !== 'float-button' && (
                <div class="ui-state insignificant">
                  <Icon icon="info" />{' '}
                  <small>
                    Add more than one shortcut/column to make this work.
                  </small>
                </div>
              )}
          </>
        ) : (
          <div class="ui-state insignificant">
            <p>
              {snapStates.settings.shortcutsViewMode === 'multi-column'
                ? 'No columns yet. Tap on the Add column button.'
                : 'No shortcuts yet. Tap on the Add shortcut button.'}
            </p>
            <p>
              Not sure what to add?
              <br />
              Try adding{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  states.shortcuts = [
                    {
                      type: 'following',
                    },
                    {
                      type: 'notifications',
                    },
                  ];
                }}
              >
                Home / Following and Notifications
              </a>{' '}
              first.
            </p>
          </div>
        )}
        <p class="insignificant">
          {shortcuts.length >= SHORTCUTS_LIMIT &&
            (snapStates.settings.shortcutsViewMode === 'multi-column'
              ? `Max ${SHORTCUTS_LIMIT} columns`
              : `Max ${SHORTCUTS_LIMIT} shortcuts`)}
        </p>
        <p
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            class="light"
            onClick={() => setShowImportExport(true)}
          >
            Import/export
          </button>
          <button
            type="button"
            disabled={shortcuts.length >= SHORTCUTS_LIMIT}
            onClick={() => setShowForm(true)}
          >
            <Icon icon="plus" />{' '}
            <span>
              {snapStates.settings.shortcutsViewMode === 'multi-column'
                ? 'Add column…'
                : 'Add shortcut…'}
            </span>
          </button>
        </p>
      </main>
      {showForm && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <ShortcutForm
            shortcut={showForm.shortcut}
            shortcutIndex={showForm.shortcutIndex}
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
      {showImportExport && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowImportExport(false);
            }
          }}
        >
          <ImportExport
            shortcuts={shortcuts}
            onClose={() => setShowImportExport(false)}
          />
        </Modal>
      )}
    </div>
  );
}

const FORM_NOTES = {
  list: `Specific list is optional. For multi-column mode, list is required, else the column will not be shown.`,
  search: `For multi-column mode, search term is required, else the column will not be shown.`,
  hashtag: 'Multiple hashtags are supported. Space-separated.',
};

function ShortcutForm({
  onSubmit,
  disabled,
  shortcut,
  shortcutIndex,
  onClose,
}) {
  console.log('shortcut', shortcut);
  const editMode = !!shortcut;
  const [currentType, setCurrentType] = useState(shortcut?.type || null);
  const { masto } = api();

  const [uiState, setUIState] = useState('default');
  const [lists, setLists] = useState([]);
  const [followedHashtags, setFollowedHashtags] = useState([]);
  useEffect(() => {
    (async () => {
      if (currentType !== 'list') return;
      try {
        setUIState('loading');
        const lists = await getLists();
        setLists(lists);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();

    (async () => {
      if (currentType !== 'hashtag') return;
      try {
        const tags = await fetchFollowedTags();
        setFollowedHashtags(tags);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [currentType]);

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
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
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
              if (key === 'instance') {
                // Remove protocol and trailing slash
                result[key] = result[key]
                  .replace(/^https?:\/\//, '')
                  .replace(/\/+$/, '');
                // Remove @acct@ or acct@ from instance URL
                result[key] = result[key].replace(/^@?[^@]+@/, '');
              }
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
            onClose?.();
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
                        disabled={disabled || uiState === 'loading'}
                        defaultValue={editMode ? shortcut.id : undefined}
                      >
                        <option value=""></option>
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
                      switch={type === 'checkbox' || undefined}
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
                      spellCheck={false}
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
          {!!FORM_NOTES[currentType] && (
            <p class="form-note insignificant">
              <Icon icon="info" />
              {FORM_NOTES[currentType]}
            </p>
          )}
          <footer>
            <button
              type="submit"
              class="block"
              disabled={disabled || uiState === 'loading'}
            >
              {editMode ? 'Save' : 'Add'}
            </button>
            {editMode && (
              <button
                type="button"
                class="light danger"
                onClick={() => {
                  states.shortcuts.splice(shortcutIndex, 1);
                  onClose?.();
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

function ImportExport({ shortcuts, onClose }) {
  const { masto } = api();
  const shortcutsStr = useMemo(() => {
    if (!shortcuts) return '';
    if (!shortcuts.filter(Boolean).length) return '';
    return compressToEncodedURIComponent(
      JSON.stringify(shortcuts.filter(Boolean)),
    );
  }, [shortcuts]);
  const [importShortcutStr, setImportShortcutStr] = useState('');
  const [importUIState, setImportUIState] = useState('default');
  const parsedImportShortcutStr = useMemo(() => {
    if (!importShortcutStr) {
      setImportUIState('default');
      return null;
    }
    try {
      const parsed = JSON.parse(
        decompressFromEncodedURIComponent(importShortcutStr),
      );
      // Very basic validation, I know
      if (!Array.isArray(parsed)) throw new Error('Not an array');
      setImportUIState('default');
      return parsed;
    } catch (err) {
      // Fallback to JSON string parsing
      // There's a chance that someone might want to import a JSON string instead of the compressed version
      try {
        const parsed = JSON.parse(importShortcutStr);
        if (!Array.isArray(parsed)) throw new Error('Not an array');
        setImportUIState('default');
        return parsed;
      } catch (err) {
        setImportUIState('error');
        return null;
      }
    }
  }, [importShortcutStr]);
  const hasCurrentSettings = states.shortcuts.length > 0;

  const shortcutsImportFieldRef = useRef();

  return (
    <div id="import-export-container" class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <header>
        <h2>
          Import/Export <small class="ib insignificant">Shortcuts</small>
        </h2>
      </header>
      <main tabindex="-1">
        <section>
          <h3>
            <Icon icon="arrow-down-circle" size="l" class="insignificant" />{' '}
            <span>Import</span>
          </h3>
          <p class="field-button">
            <input
              ref={shortcutsImportFieldRef}
              type="text"
              name="import"
              placeholder="Paste shortcuts here"
              class="block"
              onInput={(e) => {
                setImportShortcutStr(e.target.value);
              }}
            />
            {states.settings.shortcutSettingsCloudImportExport && (
              <button
                type="button"
                class="plain2 small"
                disabled={importUIState === 'cloud-downloading'}
                onClick={async () => {
                  setImportUIState('cloud-downloading');
                  const currentAccount = store.session.get('currentAccount');
                  showToast(
                    'Downloading saved shortcuts from instance server…',
                  );
                  try {
                    const relationships =
                      await masto.v1.accounts.relationships.fetch({
                        id: [currentAccount],
                      });
                    const relationship = relationships[0];
                    if (relationship) {
                      const { note = '' } = relationship;
                      if (
                        /<phanpy-shortcuts-settings>(.*)<\/phanpy-shortcuts-settings>/.test(
                          note,
                        )
                      ) {
                        const settings = note.match(
                          /<phanpy-shortcuts-settings>(.*)<\/phanpy-shortcuts-settings>/,
                        )[1];
                        const { v, dt, data } = JSON.parse(settings);
                        shortcutsImportFieldRef.current.value = data;
                        shortcutsImportFieldRef.current.dispatchEvent(
                          new Event('input'),
                        );
                      }
                    }
                    setImportUIState('default');
                  } catch (e) {
                    console.error(e);
                    setImportUIState('error');
                    showToast('Unable to download shortcuts');
                  }
                }}
                title="Download shortcuts from instance server"
              >
                <Icon icon="cloud" />
                <Icon icon="arrow-down" />
              </button>
            )}
          </p>
          {!!parsedImportShortcutStr &&
            Array.isArray(parsedImportShortcutStr) && (
              <>
                <p>
                  <b>{parsedImportShortcutStr.length}</b> shortcut
                  {parsedImportShortcutStr.length > 1 ? 's' : ''}{' '}
                  <small class="insignificant">
                    ({importShortcutStr.length} characters)
                  </small>
                </p>
                <ol class="import-settings-list">
                  {parsedImportShortcutStr.map((shortcut) => (
                    <li>
                      <span
                        style={{
                          opacity: shortcuts.some((s) =>
                            // Compare all properties
                            Object.keys(s).every(
                              (key) => s[key] === shortcut[key],
                            ),
                          )
                            ? 1
                            : 0,
                        }}
                      >
                        *
                      </span>
                      <span>
                        {TYPE_TEXT[shortcut.type]}
                        {shortcut.type === 'list' && ' ⚠️'}{' '}
                        {TYPE_PARAMS[shortcut.type]?.map?.(
                          ({ text, name, type }) =>
                            shortcut[name] ? (
                              <>
                                <span class="tag collapsed insignificant">
                                  {text}:{' '}
                                  {type === 'checkbox'
                                    ? shortcut[name] === 'on'
                                      ? '✅'
                                      : '❌'
                                    : shortcut[name]}
                                </span>{' '}
                              </>
                            ) : null,
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
                <p>
                  <small>* Exists in current shortcuts</small>
                  <br />
                  <small>
                    ⚠️ List may not work if it's from a different account.
                  </small>
                </p>
              </>
            )}
          {importUIState === 'error' && (
            <p class="error">
              <small>⚠️ Invalid settings format</small>
            </p>
          )}
          <p>
            {hasCurrentSettings && (
              <>
                <MenuConfirm
                  confirmLabel="Append to current shortcuts?"
                  menuFooter={
                    <div class="footer">
                      Only shortcuts that don’t exist in current shortcuts will
                      be appended.
                    </div>
                  }
                  onClick={() => {
                    // states.shortcuts = [
                    //   ...states.shortcuts,
                    //   ...parsedImportShortcutStr,
                    // ];
                    // Append non-unique shortcuts only
                    const nonUniqueShortcuts = parsedImportShortcutStr.filter(
                      (shortcut) =>
                        !states.shortcuts.some((s) =>
                          // Compare all properties
                          Object.keys(s).every(
                            (key) => s[key] === shortcut[key],
                          ),
                        ),
                    );
                    if (!nonUniqueShortcuts.length) {
                      showToast('No new shortcuts to import');
                      return;
                    }
                    let newShortcuts = [
                      ...states.shortcuts,
                      ...nonUniqueShortcuts,
                    ];
                    const exceededLimit = newShortcuts.length > SHORTCUTS_LIMIT;
                    if (exceededLimit) {
                      // If exceeded, trim it
                      newShortcuts = newShortcuts.slice(0, SHORTCUTS_LIMIT);
                    }
                    states.shortcuts = newShortcuts;
                    showToast(
                      exceededLimit
                        ? `Shortcuts imported. Exceeded max ${SHORTCUTS_LIMIT}, so the rest are not imported.`
                        : 'Shortcuts imported',
                    );
                    onClose?.();
                  }}
                >
                  <button
                    type="button"
                    class="plain2"
                    disabled={!parsedImportShortcutStr}
                  >
                    Import & append…
                  </button>
                </MenuConfirm>{' '}
              </>
            )}
            <MenuConfirm
              confirmLabel={
                hasCurrentSettings
                  ? 'Override current shortcuts?'
                  : 'Import shortcuts?'
              }
              menuItemClassName={hasCurrentSettings ? 'danger' : undefined}
              onClick={() => {
                states.shortcuts = parsedImportShortcutStr;
                showToast('Shortcuts imported');
                onClose?.();
              }}
            >
              <button
                type="button"
                class="plain2"
                disabled={!parsedImportShortcutStr}
              >
                {hasCurrentSettings ? 'or override…' : 'Import…'}
              </button>
            </MenuConfirm>
          </p>
        </section>
        <section>
          <h3>
            <Icon icon="arrow-up-circle" size="l" class="insignificant" />{' '}
            <span>Export</span>
          </h3>
          <p>
            <input
              style={{ width: '100%' }}
              type="text"
              value={shortcutsStr}
              readOnly
              onClick={(e) => {
                if (!e.target.value) return;
                e.target.select();
                // Copy url to clipboard
                try {
                  navigator.clipboard.writeText(e.target.value);
                  showToast('Shortcuts copied');
                } catch (e) {
                  console.error(e);
                  showToast('Unable to copy shortcuts');
                }
              }}
            />
          </p>
          <p>
            <button
              type="button"
              class="plain2"
              disabled={!shortcutsStr}
              onClick={() => {
                try {
                  navigator.clipboard.writeText(shortcutsStr);
                  showToast('Shortcut settings copied');
                } catch (e) {
                  console.error(e);
                  showToast('Unable to copy shortcut settings');
                }
              }}
            >
              <Icon icon="clipboard" /> <span>Copy</span>
            </button>{' '}
            {navigator?.share &&
              navigator?.canShare?.({
                text: shortcutsStr,
              }) && (
                <button
                  type="button"
                  class="plain2"
                  disabled={!shortcutsStr}
                  onClick={() => {
                    try {
                      navigator.share({
                        text: shortcutsStr,
                      });
                    } catch (e) {
                      console.error(e);
                      alert("Sharing doesn't seem to work.");
                    }
                  }}
                >
                  <Icon icon="share" /> <span>Share</span>
                </button>
              )}{' '}
            {states.settings.shortcutSettingsCloudImportExport && (
              <button
                type="button"
                class="plain2"
                disabled={importUIState === 'cloud-uploading'}
                onClick={async () => {
                  setImportUIState('cloud-uploading');
                  const currentAccount = store.session.get('currentAccount');
                  try {
                    const relationships =
                      await masto.v1.accounts.relationships.fetch({
                        id: [currentAccount],
                      });
                    const relationship = relationships[0];
                    if (relationship) {
                      const { note = '' } = relationship;
                      // const newNote = `${note}\n\n\n$<phanpy-shortcuts-settings>{shortcutsStr}</phanpy-shortcuts-settings>`;
                      let newNote = '';
                      if (
                        /<phanpy-shortcuts-settings>(.*)<\/phanpy-shortcuts-settings>/.test(
                          note,
                        )
                      ) {
                        const settingsJSON = JSON.stringify({
                          v: '1', // version
                          dt: Date.now(), // datetime stamp
                          data: shortcutsStr, // shortcuts settings string
                        });
                        newNote = note.replace(
                          /<phanpy-shortcuts-settings>(.*)<\/phanpy-shortcuts-settings>/,
                          `<phanpy-shortcuts-settings>${settingsJSON}</phanpy-shortcuts-settings>`,
                        );
                      } else {
                        newNote = `${note}\n\n\n<phanpy-shortcuts-settings>${settingsJSON}</phanpy-shortcuts-settings>`;
                      }
                      showToast('Saving shortcuts to instance server…');
                      await masto.v1.accounts
                        .$select(currentAccount)
                        .note.create({
                          comment: newNote,
                        });
                      setImportUIState('default');
                      showToast('Shortcuts saved');
                    }
                  } catch (e) {
                    console.error(e);
                    setImportUIState('error');
                    showToast('Unable to save shortcuts');
                  }
                }}
                title="Sync to instance server"
              >
                <Icon icon="cloud" />
                <Icon icon="arrow-up" />
              </button>
            )}{' '}
            {shortcutsStr.length > 0 && (
              <small class="insignificant ib">
                {shortcutsStr.length} characters
              </small>
            )}
          </p>
          {!!shortcutsStr && (
            <details>
              <summary class="insignificant">
                <small>Raw Shortcuts JSON</small>
              </summary>
              <textarea style={{ width: '100%' }} rows={10} readOnly>
                {JSON.stringify(shortcuts.filter(Boolean), null, 2)}
              </textarea>
            </details>
          )}
        </section>
        {states.settings.shortcutSettingsCloudImportExport && (
          <footer>
            <p>
              <Icon icon="cloud" /> Import/export settings from/to instance
              server (Very experimental)
            </p>
          </footer>
        )}
      </main>
    </div>
  );
}

export default ShortcutsSettings;
