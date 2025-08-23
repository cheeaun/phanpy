import './filters.css';

import { msg } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useReducer, useRef, useState } from 'preact/hooks';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import MenuConfirm from '../components/menu-confirm';
import Modal from '../components/modal';
import NavMenu from '../components/nav-menu';
import RelativeTime from '../components/relative-time';
import { api } from '../utils/api';
import i18nDuration from '../utils/i18n-duration';
import { getAPIVersions } from '../utils/store-utils';
import useInterval from '../utils/useInterval';
import useTitle from '../utils/useTitle';

const FILTER_CONTEXT = ['home', 'public', 'notifications', 'thread', 'account'];
const FILTER_CONTEXT_UNIMPLEMENTED = ['thread', 'account'];
const FILTER_CONTEXT_LABELS = {
  home: msg`Home and lists`,
  notifications: msg`Notifications`,
  public: msg`Public timelines`,
  thread: msg`Conversations`,
  account: msg`Profiles`,
};

const EXPIRY_DURATIONS = [
  0, // forever
  30 * 60, // 30 minutes
  60 * 60, // 1 hour
  6 * 60 * 60, // 6 hours
  12 * 60 * 60, // 12 hours
  60 * 60 * 24, // 24 hours
  60 * 60 * 24 * 7, // 7 days
  60 * 60 * 24 * 30, // 30 days
];

const EXPIRY_DURATIONS_LABELS = {
  0: msg`Never`,
  1800: i18nDuration(30, 'minute'),
  3600: i18nDuration(1, 'hour'),
  21600: i18nDuration(6, 'hour'),
  43200: i18nDuration(12, 'hour'),
  86_400: i18nDuration(24, 'hour'),
  604_800: i18nDuration(7, 'day'),
  2_592_000: i18nDuration(30, 'day'),
};

function Filters() {
  const { t } = useLingui();
  const { masto } = api();
  useTitle(t`Filters`, `/ft`);
  const [uiState, setUIState] = useState('default');
  const [showFiltersAddEditModal, setShowFiltersAddEditModal] = useState(false);

  const [reloadCount, reload] = useReducer((c) => c + 1, 0);
  const [filters, setFilters] = useState([]);
  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const filters = await masto.v2.filters.list();
        filters.sort((a, b) => a.title.localeCompare(b.title));
        filters.forEach((filter) => {
          if (filter.keywords?.length) {
            filter.keywords.sort((a, b) => a.id - b.id);
          }
        });
        console.log(filters);
        setFilters(filters);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, [reloadCount]);

  return (
    <div id="filters-page" class="deck-container" tabIndex="-1">
      <div class="timeline-deck deck">
        <header>
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
              <Link to="/" class="button plain">
                <Icon icon="home" size="l" alt={t`Home`} />
              </Link>
            </div>
            <h1>
              <Trans>Filters</Trans>
            </h1>
            <div class="header-side">
              <button
                type="button"
                class="plain"
                onClick={() => {
                  setShowFiltersAddEditModal(true);
                }}
              >
                <Icon icon="plus" size="l" alt={t`New filter`} />
              </button>
            </div>
          </div>
        </header>
        <main>
          {filters.length > 0 ? (
            <>
              <ul class="filters-list">
                {filters.map((filter) => {
                  const { id, title, expiresAt, keywords } = filter;
                  return (
                    <li key={id}>
                      <div>
                        <h2>{title}</h2>
                        {keywords?.length > 0 && (
                          <div>
                            {keywords.map((k) => (
                              <>
                                <span class="tag collapsed insignificant">
                                  {k.wholeWord ? `“${k.keyword}”` : k.keyword}
                                </span>{' '}
                              </>
                            ))}
                          </div>
                        )}
                        <small class="insignificant">
                          <ExpiryStatus expiresAt={expiresAt} />
                        </small>
                      </div>
                      <button
                        type="button"
                        class="plain"
                        onClick={() => {
                          setShowFiltersAddEditModal({
                            filter,
                          });
                        }}
                      >
                        <Icon icon="pencil" size="l" alt="Edit filter" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {filters.length > 1 && (
                <footer class="ui-state">
                  <small class="insignificant">
                    <Plural
                      value={filters.length}
                      one="# filter"
                      other="# filters"
                    />
                  </small>
                </footer>
              )}
            </>
          ) : uiState === 'loading' ? (
            <p class="ui-state">
              <Loader />
            </p>
          ) : uiState === 'error' ? (
            <p class="ui-state">
              <Trans>Unable to load filters.</Trans>
            </p>
          ) : (
            <p class="ui-state">
              <Trans>No filters yet.</Trans>
            </p>
          )}
        </main>
      </div>
      {!!showFiltersAddEditModal && (
        <Modal
          title={t`Add filter`}
          onClose={() => {
            setShowFiltersAddEditModal(false);
          }}
        >
          <FiltersAddEdit
            filter={showFiltersAddEditModal?.filter}
            onClose={(result) => {
              if (result.state === 'success') {
                reload();
              }
              setShowFiltersAddEditModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

let _id = 1;
const incID = () => _id++;
function FiltersAddEdit({ filter, onClose }) {
  const { _, t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const editMode = !!filter;
  const { context, expiresAt, id, keywords, title, filterAction } =
    filter || {};
  const hasExpiry = !!expiresAt;
  const expiresAtDate = hasExpiry && new Date(expiresAt);
  const [editKeywords, setEditKeywords] = useState(keywords || []);
  const keywordsRef = useRef();

  // Hacky way of handling removed keywords for both existing and new ones
  const [removedKeywordIDs, setRemovedKeywordIDs] = useState([]);
  const [removedKeyword_IDs, setRemovedKeyword_IDs] = useState([]);

  const filteredEditKeywords = editKeywords.filter(
    (k) =>
      !removedKeywordIDs.includes(k.id) && !removedKeyword_IDs.includes(k._id),
  );

  return (
    <div class="sheet" id="filters-add-edit-modal">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>{editMode ? t`Edit filter` : t`New filter`}</h2>
      </header>
      <main>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const title = formData.get('title');
            const keywordIDs = formData.getAll('keyword_attributes[][id]');
            const keywordKeywords = formData.getAll(
              'keyword_attributes[][keyword]',
            );
            // const keywordWholeWords = formData.getAll(
            //   'keyword_attributes[][whole_word]',
            // );
            // Not using getAll because it skips the empty checkboxes
            const keywordWholeWords = [
              ...keywordsRef.current.querySelectorAll(
                'input[name="keyword_attributes[][whole_word]"]',
              ),
            ].map((i) => i.checked);
            const keywordsAttributes = keywordKeywords.map((k, i) => ({
              id: keywordIDs[i] || undefined,
              keyword: k,
              wholeWord: keywordWholeWords[i],
            }));
            // if (editMode && keywords?.length) {
            //   // Find which one got deleted and add to keywordsAttributes
            //   keywords.forEach((k) => {
            //     if (!keywordsAttributes.find((ka) => ka.id === k.id)) {
            //       keywordsAttributes.push({
            //         ...k,
            //         _destroy: true,
            //       });
            //     }
            //   });
            // }
            if (editMode && removedKeywordIDs?.length) {
              removedKeywordIDs.forEach((id) => {
                keywordsAttributes.push({
                  id,
                  _destroy: true,
                });
              });
            }
            const context = formData.getAll('context');
            let expiresIn = formData.get('expires_in');
            const filterAction = formData.get('filter_action');
            console.log({
              title,
              keywordIDs,
              keywords: keywordKeywords,
              wholeWords: keywordWholeWords,
              keywordsAttributes,
              context,
              expiresIn,
              filterAction,
            });

            // Required fields
            if (!title || !context?.length) {
              return;
            }

            setUIState('loading');

            (async () => {
              try {
                let filterResult;

                if (editMode) {
                  if (expiresIn === '' || expiresIn === null) {
                    // No value
                    // Preserve existing expiry if not specified
                    // Seconds from now to expiresAtDate
                    // Other clients don't do this
                    if (hasExpiry) {
                      expiresIn = Math.floor(
                        (expiresAtDate - new Date()) / 1000,
                      );
                    } else {
                      expiresIn = null;
                    }
                  } else if (expiresIn === '0' || expiresIn === 0) {
                    // 0 = Never
                    expiresIn = null;
                  } else {
                    expiresIn = +expiresIn;
                  }
                  filterResult = await masto.v2.filters.$select(id).update({
                    title,
                    context,
                    expiresIn,
                    keywordsAttributes,
                    filterAction,
                  });
                } else {
                  expiresIn = +expiresIn || null;
                  filterResult = await masto.v2.filters.create({
                    title,
                    context,
                    expiresIn,
                    keywordsAttributes,
                    filterAction,
                  });
                }
                console.log({ filterResult });
                setUIState('default');
                onClose?.({
                  state: 'success',
                  filter: filterResult,
                });
              } catch (error) {
                console.error(error);
                setUIState('error');
                alert(
                  editMode
                    ? t`Unable to edit filter`
                    : t`Unable to create filter`,
                );
              }
            })();
          }}
        >
          <div class="filter-form-row">
            <label>
              <b>
                <Trans>Title</Trans>
              </b>
              <input
                type="text"
                name="title"
                defaultValue={title}
                disabled={uiState === 'loading'}
                dir="auto"
                required
              />
            </label>
          </div>
          <div class="filter-form-keywords" ref={keywordsRef}>
            {filteredEditKeywords.length ? (
              <ul class="filter-keywords">
                {filteredEditKeywords.map((k) => {
                  const { id, keyword, wholeWord, _id } = k;
                  return (
                    <li key={`${id}-${_id}`}>
                      <input
                        type="hidden"
                        name="keyword_attributes[][id]"
                        value={id}
                      />
                      <input
                        name="keyword_attributes[][keyword]"
                        type="text"
                        defaultValue={keyword}
                        disabled={uiState === 'loading'}
                        required
                        dir="auto"
                      />
                      <div class="filter-keyword-actions">
                        <label>
                          <input
                            name="keyword_attributes[][whole_word]"
                            type="checkbox"
                            value={id} // Hacky way to map checkbox boolean to the keyword id
                            defaultChecked={wholeWord}
                            disabled={uiState === 'loading'}
                          />{' '}
                          <Trans>Whole word</Trans>
                        </label>
                        <button
                          type="button"
                          class="light danger small"
                          disabled={uiState === 'loading'}
                          onClick={() => {
                            if (id) {
                              removedKeywordIDs.push(id);
                              setRemovedKeywordIDs([...removedKeywordIDs]);
                            } else if (_id) {
                              removedKeyword_IDs.push(_id);
                              setRemovedKeyword_IDs([...removedKeyword_IDs]);
                            }
                          }}
                        >
                          <Icon icon="x" alt={t`Remove`} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div class="filter-keywords">
                <div class="insignificant">
                  <Trans>No keywords. Add one.</Trans>
                </div>
              </div>
            )}
            <footer class="filter-keywords-footer">
              <button
                type="button"
                class="light"
                onClick={() => {
                  setEditKeywords([
                    ...editKeywords,
                    {
                      _id: incID(),
                      keyword: '',
                      wholeWord: true,
                    },
                  ]);
                  setTimeout(() => {
                    // Focus last input
                    const fields =
                      keywordsRef.current.querySelectorAll(
                        'input[type="text"]',
                      );
                    fields[fields.length - 1]?.focus?.();
                  }, 10);
                }}
              >
                <Trans>Add keyword</Trans>
              </button>{' '}
              {filteredEditKeywords?.length > 1 && (
                <small class="insignificant">
                  <Plural
                    value={filteredEditKeywords.length}
                    one="# keyword"
                    other="# keywords"
                  />
                </small>
              )}
            </footer>
          </div>
          <div class="filter-form-cols">
            <div class="filter-form-col">
              <div>
                <b>
                  <Trans>Filter from…</Trans>
                </b>
              </div>
              {FILTER_CONTEXT.map((ctx) => (
                <div>
                  <label
                    class={
                      FILTER_CONTEXT_UNIMPLEMENTED.includes(ctx)
                        ? 'insignificant'
                        : ''
                    }
                  >
                    <input
                      type="checkbox"
                      name="context"
                      value={ctx}
                      defaultChecked={!!context ? context.includes(ctx) : true}
                      disabled={uiState === 'loading'}
                    />{' '}
                    {_(FILTER_CONTEXT_LABELS[ctx])}
                    {FILTER_CONTEXT_UNIMPLEMENTED.includes(ctx) ? '*' : ''}
                  </label>{' '}
                </div>
              ))}
              <p>
                <small class="insignificant">
                  <Trans>* Not implemented yet</Trans>
                </small>
              </p>
            </div>
            <div class="filter-form-col">
              {editMode && (
                <Trans>
                  Status:{' '}
                  <b>
                    <ExpiryStatus expiresAt={expiresAt} showNeverExpires />
                  </b>
                </Trans>
              )}
              <div>
                <label for="filters-expires_in">
                  {editMode ? t`Change expiry` : t`Expiry`}
                </label>
                <select
                  id="filters-expires_in"
                  name="expires_in"
                  disabled={uiState === 'loading'}
                  defaultValue={editMode ? undefined : 0}
                >
                  {editMode && <option></option>}
                  {EXPIRY_DURATIONS.map((v) => (
                    <option value={v}>
                      {typeof EXPIRY_DURATIONS_LABELS[v] === 'function'
                        ? EXPIRY_DURATIONS_LABELS[v]()
                        : _(EXPIRY_DURATIONS_LABELS[v])}
                    </option>
                  ))}
                </select>
              </div>
              <p>
                <Trans>Filtered post will be…</Trans>
                <br />
                {getAPIVersions()?.mastodon >= 5 && (
                  <label class="ib">
                    <input
                      type="radio"
                      name="filter_action"
                      value="blur"
                      defaultChecked={filterAction === 'blur'}
                      disabled={uiState === 'loading'}
                    />{' '}
                    <Trans>obscured (media only)</Trans>
                  </label>
                )}{' '}
                <label class="ib">
                  <input
                    type="radio"
                    name="filter_action"
                    value="warn"
                    defaultChecked={
                      (filterAction !== 'hide' && filterAction !== 'blur') ||
                      !editMode
                    }
                    disabled={uiState === 'loading'}
                  />{' '}
                  <Trans>minimized</Trans>
                </label>{' '}
                <label class="ib">
                  <input
                    type="radio"
                    name="filter_action"
                    value="hide"
                    defaultChecked={filterAction === 'hide'}
                    disabled={uiState === 'loading'}
                  />{' '}
                  <Trans>hidden</Trans>
                </label>
              </p>
            </div>
          </div>
          <footer class="filter-form-footer">
            <span>
              <button type="submit" disabled={uiState === 'loading'}>
                {editMode ? t`Save` : t`Create`}
              </button>{' '}
              <Loader abrupt hidden={uiState !== 'loading'} />
            </span>
            {editMode && (
              <MenuConfirm
                disabled={uiState === 'loading'}
                align="end"
                menuItemClassName="danger"
                confirmLabel={t`Delete this filter?`}
                onClick={() => {
                  setUIState('loading');
                  (async () => {
                    try {
                      await masto.v2.filters.$select(id).remove();
                      setUIState('default');
                      onClose?.({
                        state: 'success',
                      });
                    } catch (e) {
                      console.error(e);
                      setUIState('error');
                      alert(t`Unable to delete filter.`);
                    }
                  })();
                }}
              >
                <button
                  type="button"
                  class="light danger"
                  onClick={() => {}}
                  disabled={uiState === 'loading'}
                >
                  <Trans>Delete…</Trans>
                </button>
              </MenuConfirm>
            )}
          </footer>
        </form>
      </main>
    </div>
  );
}

function ExpiryStatus({ expiresAt, showNeverExpires }) {
  const { t } = useLingui();
  const hasExpiry = !!expiresAt;
  const expiresAtDate = hasExpiry && new Date(expiresAt);
  const expired = hasExpiry && expiresAtDate <= new Date();

  // If less than a minute left, re-render interval every second, else every minute
  const [_, rerender] = useReducer((c) => c + 1, 0);
  useInterval(rerender, expired || 30_000);

  return expired ? (
    t`Expired`
  ) : hasExpiry ? (
    <Trans>
      Expiring <RelativeTime datetime={expiresAtDate} />
    </Trans>
  ) : (
    showNeverExpires && t`Never expires`
  );
}

export default Filters;
