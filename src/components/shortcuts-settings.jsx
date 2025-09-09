import './shortcuts-settings.css';

import { useAutoAnimate } from '@formkit/auto-animate/preact';
import { msg, t } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
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
import { getCurrentAccountID } from '../utils/store-utils';

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
  following: msg`Home / Following`,
  notifications: msg`Notifications`,
  list: msg`Lists`,
  public: msg`Local / Bubble / Federated`,
  search: msg`Search`,
  'account-statuses': msg`Account`,
  bookmarks: msg`Bookmarks`,
  favourites: msg`Likes`,
  hashtag: msg`Hashtag`,
  trending: msg`Trending`,
  mentions: msg`Mentions`,
};
const TYPE_PARAMS = {
  list: [
    {
      text: msg`List ID`,
      name: 'id',
      notRequired: true,
    },
  ],
  public: [
    {
      text: msg`Variant`,
      name: 'variant',
      type: 'variant',
    },
    {
      text: msg`Instance`,
      name: 'instance',
      type: 'text',
      placeholder: msg`Optional, e.g. mastodon.social`,
      notRequired: true,
    },
  ],
  trending: [
    {
      text: msg`Instance`,
      name: 'instance',
      type: 'text',
      placeholder: msg`Optional, e.g. mastodon.social`,
      notRequired: true,
    },
  ],
  search: [
    {
      text: msg`Search term`,
      name: 'query',
      type: 'text',
      placeholder: msg`Optional, unless for multi-column mode`,
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
      placeholder: msg`e.g. PixelArt (Max 5, space-separated)`,
      pattern: '[^#]+',
    },
    {
      text: msg`Media only`,
      name: 'media',
      type: 'checkbox',
    },
    {
      text: msg`Instance`,
      name: 'instance',
      type: 'text',
      placeholder: msg`Optional, e.g. mastodon.social`,
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
    title: (_, index) =>
      index === 0
        ? t`Home`
        : t({ id: 'following.title', message: 'Following' }),
    path: '/',
    icon: 'home',
  },
  mentions: {
    id: 'mentions',
    title: msg`Mentions`,
    path: '/mentions',
    icon: 'at',
  },
  notifications: {
    id: 'notifications',
    title: msg`Notifications`,
    path: '/notifications',
    icon: 'notification',
  },
  list: {
    id: ({ id }) => (id ? 'list' : 'lists'),
    title: ({ id }) => (id ? getListTitle(id) : t`Lists`),
    path: ({ id }) => (id ? `/l/${id}` : '/l'),
    icon: 'list',
    excludeViewMode: ({ id }) => (!id ? ['multi-column'] : []),
  },
  public: {
    id: 'public',
    title: ({ variant }) =>
      ({
        local: t`Local`,
        bubble: t`Bubble`,
        federated: t`Federated`,
      })[variant],
    subtitle: ({ instance }) => instance || api().instance,
    path: ({ variant, instance }) => {
      const suffix = {
        local: '/l',
        bubble: '/b',
        federated: '',
      }[variant];
      return `/${instance}/p${suffix}`;
    },
    icon: ({ variant }) =>
      ({
        local: 'building',
        bubble: 'star2',
        federated: 'earth',
      })[variant],
  },
  trending: {
    id: 'trending',
    title: msg`Trending`,
    subtitle: ({ instance }) => instance || api().instance,
    path: ({ instance }) => `/${instance}/trending`,
    icon: 'chart',
  },
  search: {
    id: 'search',
    title: ({ query }) => (query ? `“${query}”` : t`Search`),
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
    title: msg`Bookmarks`,
    path: '/b',
    icon: 'bookmark',
  },
  favourites: {
    id: 'favourites',
    title: msg`Likes`,
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
  const { _ } = useLingui();
  const snapStates = useSnapshot(states);
  const { shortcuts } = snapStates;
  const [showForm, setShowForm] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

  const [shortcutsListParent] = useAutoAnimate();

  return (
    <div id="shortcuts-settings-container" class="sheet" tabindex="-1">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Icon icon="shortcut" /> <Trans>Shortcuts</Trans>{' '}
          <sup
            style={{
              fontSize: 12,
              opacity: 0.5,
              textTransform: 'uppercase',
            }}
          >
            <Trans>beta</Trans>
          </sup>
        </h2>
      </header>
      <main>
        <p>
          <Trans>Specify a list of shortcuts that'll appear&nbsp;as:</Trans>
        </p>
        <div class="shortcuts-view-mode">
          {[
            {
              value: 'float-button',
              label: t`Floating button`,
              imgURL: floatingButtonUrl,
            },
            {
              value: 'tab-menu-bar',
              label: t`Tab/Menu bar`,
              imgURL: tabMenuBarUrl,
            },
            {
              value: 'multi-column',
              label: t`Multi-column`,
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
                } else {
                  title = _(title);
                }
                if (typeof subtitle === 'function') {
                  subtitle = subtitle(shortcut, i);
                } else {
                  subtitle = _(subtitle);
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
                          <Trans>Not available in current view mode</Trans>
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
                        <Icon icon="arrow-up" alt={t`Move up`} />
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
                        <Icon icon="arrow-down" alt={t`Move down`} />
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
                        <Icon icon="pencil" alt={t`Edit`} />
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
                    <Trans>
                      Add more than one shortcut/column to make this work.
                    </Trans>
                  </small>
                </div>
              )}
          </>
        ) : (
          <div class="ui-state insignificant">
            <p>
              {snapStates.settings.shortcutsViewMode === 'multi-column'
                ? t`No columns yet. Tap on the Add column button.`
                : t`No shortcuts yet. Tap on the Add shortcut button.`}
            </p>
            <p>
              <Trans>
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
              </Trans>
            </p>
          </div>
        )}
        <p class="insignificant">
          {shortcuts.length >= SHORTCUTS_LIMIT &&
            (snapStates.settings.shortcutsViewMode === 'multi-column'
              ? t`Max ${SHORTCUTS_LIMIT} columns`
              : t`Max ${SHORTCUTS_LIMIT} shortcuts`)}
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
            <Trans>Import/export</Trans>
          </button>
          <button
            type="button"
            disabled={shortcuts.length >= SHORTCUTS_LIMIT}
            onClick={() => setShowForm(true)}
          >
            <Icon icon="plus" />{' '}
            <span>
              {snapStates.settings.shortcutsViewMode === 'multi-column'
                ? t`Add column…`
                : t`Add shortcut…`}
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
  list: msg`Specific list is optional. For multi-column mode, list is required, else the column will not be shown.`,
  search: msg`For multi-column mode, search term is required, else the column will not be shown.`,
  hashtag: msg`Multiple hashtags are supported. Space-separated.`,
};

function ShortcutForm({
  onSubmit,
  disabled,
  shortcut,
  shortcutIndex,
  onClose,
}) {
  const { _ } = useLingui();
  console.log('shortcut', shortcut);
  const editMode = !!shortcut;
  const [currentType, setCurrentType] = useState(shortcut?.type || null);

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
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>{editMode ? t`Edit shortcut` : t`Add shortcut`}</h2>
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
              <span>
                <Trans>Timeline</Trans>
              </span>
              <select
                required
                disabled={disabled}
                onChange={(e) => {
                  setCurrentType(e.target.value);
                }}
                defaultValue={editMode ? shortcut.type : undefined}
                name="type"
                dir="auto"
              >
                <option></option>
                {TYPES.map((type) => (
                  <option value={type}>{_(TYPE_TEXT[type])}</option>
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
                      <span>
                        <Trans>List</Trans>
                      </span>
                      <select
                        name="id"
                        required={!notRequired}
                        disabled={disabled || uiState === 'loading'}
                        defaultValue={editMode ? shortcut.id : undefined}
                        dir="auto"
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

              if (type === 'variant') {
                return (
                  <p>
                    <label>
                      <span>
                        <Trans>Variant</Trans>
                      </span>
                      <select
                        name="variant"
                        required={!notRequired}
                        disabled={disabled || uiState === 'loading'}
                        defaultValue={editMode ? shortcut.variant : 'local'}
                        dir="auto"
                      >
                        <option value="local">
                          <Trans>Local</Trans>
                        </option>
                        <option value="bubble">
                          <Trans>Bubble</Trans>
                        </option>
                        <option value="federated">
                          <Trans>Federated</Trans>
                        </option>
                      </select>
                    </label>
                  </p>
                );
              }

              return (
                <p>
                  <label>
                    <span>{_(text)}</span>{' '}
                    <input
                      type={type}
                      switch={type === 'checkbox' || undefined}
                      name={name}
                      placeholder={_(placeholder)}
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
                      dir="auto"
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
              {_(FORM_NOTES[currentType])}
            </p>
          )}
          <footer>
            <button
              type="submit"
              class="block"
              disabled={disabled || uiState === 'loading'}
            >
              {editMode ? t`Save` : t`Add`}
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
                <Trans>Remove</Trans>
              </button>
            )}
          </footer>
        </form>
      </main>
    </div>
  );
}

function ImportExport({ shortcuts, onClose }) {
  const { _ } = useLingui();
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
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>
            Import/Export <small class="ib insignificant">Shortcuts</small>
          </Trans>
        </h2>
      </header>
      <main tabindex="-1">
        <section>
          <h3>
            <Icon icon="arrow-down-circle" size="l" class="insignificant" />{' '}
            <span>
              <Trans>Import</Trans>
            </span>
          </h3>
          <p class="field-button">
            <input
              ref={shortcutsImportFieldRef}
              type="text"
              name="import"
              placeholder={t`Paste shortcuts here`}
              class="block"
              onInput={(e) => {
                setImportShortcutStr(e.target.value);
              }}
              dir="auto"
            />
            {states.settings.shortcutSettingsCloudImportExport && (
              <button
                type="button"
                class="plain2 small"
                disabled={importUIState === 'cloud-downloading'}
                onClick={async () => {
                  setImportUIState('cloud-downloading');
                  const currentAccount = getCurrentAccountID();
                  showToast(
                    t`Downloading saved shortcuts from instance server…`,
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
                    showToast(t`Unable to download shortcuts`);
                  }
                }}
                title={t`Download shortcuts from instance server`}
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
                        {_(TYPE_TEXT[shortcut.type])}
                        {shortcut.type === 'list' && ' ⚠️'}{' '}
                        {TYPE_PARAMS[shortcut.type]?.map?.(
                          ({ text, name, type }) =>
                            shortcut[name] ? (
                              <>
                                <span class="tag collapsed insignificant">
                                  {_(text)}:{' '}
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
                  <small>
                    <Trans>* Exists in current shortcuts</Trans>
                  </small>
                  <br />
                  <small>
                    ⚠️{' '}
                    <Trans>
                      List may not work if it's from a different account.
                    </Trans>
                  </small>
                </p>
              </>
            )}
          {importUIState === 'error' && (
            <p class="error">
              <small>
                ⚠️ <Trans>Invalid settings format</Trans>
              </small>
            </p>
          )}
          <p>
            {hasCurrentSettings && (
              <>
                <MenuConfirm
                  confirmLabel={t`Append to current shortcuts?`}
                  menuFooter={
                    <div class="footer">
                      <Trans>
                        Only shortcuts that don’t exist in current shortcuts
                        will be appended.
                      </Trans>
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
                      showToast(t`No new shortcuts to import`);
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
                        ? t`Shortcuts imported. Exceeded max ${SHORTCUTS_LIMIT}, so the rest are not imported.`
                        : t`Shortcuts imported`,
                    );
                    onClose?.();
                  }}
                >
                  <button
                    type="button"
                    class="plain2"
                    disabled={!parsedImportShortcutStr}
                  >
                    <Trans>Import & append…</Trans>
                  </button>
                </MenuConfirm>{' '}
              </>
            )}
            <MenuConfirm
              confirmLabel={
                hasCurrentSettings
                  ? t`Override current shortcuts?`
                  : t`Import shortcuts?`
              }
              menuItemClassName={hasCurrentSettings ? 'danger' : undefined}
              onClick={() => {
                states.shortcuts = parsedImportShortcutStr;
                showToast(t`Shortcuts imported`);
                onClose?.();
              }}
            >
              <button
                type="button"
                class="plain2"
                disabled={!parsedImportShortcutStr}
              >
                {hasCurrentSettings ? t`or override…` : t`Import…`}
              </button>
            </MenuConfirm>
          </p>
        </section>
        <section>
          <h3>
            <Icon icon="arrow-up-circle" size="l" class="insignificant" />{' '}
            <span>
              <Trans>Export</Trans>
            </span>
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
                  showToast(t`Shortcuts copied`);
                } catch (e) {
                  console.error(e);
                  showToast(t`Unable to copy shortcuts`);
                }
              }}
              dir="auto"
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
                  showToast(t`Shortcut settings copied`);
                } catch (e) {
                  console.error(e);
                  showToast(t`Unable to copy shortcut settings`);
                }
              }}
            >
              <Icon icon="clipboard" />{' '}
              <span>
                <Trans>Copy</Trans>
              </span>
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
                      alert(t`Sharing doesn't seem to work.`);
                    }
                  }}
                >
                  <Icon icon="share" />{' '}
                  <span>
                    <Trans>Share</Trans>
                  </span>
                </button>
              )}{' '}
            {states.settings.shortcutSettingsCloudImportExport && (
              <button
                type="button"
                class="plain2"
                disabled={importUIState === 'cloud-uploading'}
                onClick={async () => {
                  setImportUIState('cloud-uploading');
                  const currentAccount = getCurrentAccountID();
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
                      const settingsJSON = JSON.stringify({
                        v: '1', // version
                        dt: Date.now(), // datetime stamp
                        data: shortcutsStr, // shortcuts settings string
                      });
                      if (
                        /<phanpy-shortcuts-settings>(.*)<\/phanpy-shortcuts-settings>/.test(
                          note,
                        )
                      ) {
                        newNote = note.replace(
                          /<phanpy-shortcuts-settings>(.*)<\/phanpy-shortcuts-settings>/,
                          `<phanpy-shortcuts-settings>${settingsJSON}</phanpy-shortcuts-settings>`,
                        );
                      } else {
                        newNote = `${note}\n\n\n<phanpy-shortcuts-settings>${settingsJSON}</phanpy-shortcuts-settings>`;
                      }
                      showToast(t`Saving shortcuts to instance server…`);
                      await masto.v1.accounts
                        .$select(currentAccount)
                        .note.create({
                          comment: newNote,
                        });
                      setImportUIState('default');
                      showToast(t`Shortcuts saved`);
                    }
                  } catch (e) {
                    console.error(e);
                    setImportUIState('error');
                    showToast(t`Unable to save shortcuts`);
                  }
                }}
                title={t`Sync to instance server`}
              >
                <Icon icon="cloud" />
                <Icon icon="arrow-up" />
              </button>
            )}{' '}
            {shortcutsStr.length > 0 && (
              <small class="insignificant ib">
                <Plural
                  value={shortcutsStr.length}
                  one="# character"
                  other="# characters"
                />
              </small>
            )}
          </p>
          {!!shortcutsStr && (
            <details>
              <summary class="insignificant">
                <small>
                  <Trans>Raw Shortcuts JSON</Trans>
                </small>
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
              <Icon icon="cloud" />{' '}
              <Trans>
                Import/export settings from/to instance server (Very
                experimental)
              </Trans>
            </p>
          </footer>
        )}
      </main>
    </div>
  );
}

export default ShortcutsSettings;
