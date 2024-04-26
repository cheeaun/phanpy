import './filters.css';

import { useEffect, useReducer, useRef, useState } from 'preact/hooks';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import MenuConfirm from '../components/menu-confirm';
import Modal from '../components/modal';
import NavMenu from '../components/nav-menu';
import RelativeTime from '../components/relative-time';
import { api } from '../utils/api';
import useInterval from '../utils/useInterval';
import useTitle from '../utils/useTitle';

const FILTER_CONTEXT = ['home', 'public', 'notifications', 'thread', 'account'];
const FILTER_CONTEXT_UNIMPLEMENTED = ['notifications', 'thread', 'account'];
const FILTER_CONTEXT_LABELS = {
  home: 'Home and lists',
  notifications: 'Notifications',
  public: 'Public timelines',
  thread: 'Conversations',
  account: 'Profiles',
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
  0: 'Never',
  1800: '30 minutes',
  3600: '1 hour',
  21600: '6 hours',
  43200: '12 hours',
  86_400: '24 hours',
  604_800: '7 days',
  2_592_000: '30 days',
};

function Filters() {
  const { masto } = api();
  useTitle(`Filters`, `/ft`);
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
                <Icon icon="home" size="l" />
              </Link>
            </div>
            <h1>Filters</h1>
            <div class="header-side">
              <button
                type="button"
                class="plain"
                onClick={() => {
                  setShowFiltersAddEditModal(true);
                }}
              >
                <Icon icon="plus" size="l" alt="New filter" />
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
                    {filters.length} filter
                    {filters.length === 1 ? '' : 's'}
                  </small>
                </footer>
              )}
            </>
          ) : uiState === 'loading' ? (
            <p class="ui-state">
              <Loader />
            </p>
          ) : uiState === 'error' ? (
            <p class="ui-state">Unable to load filters.</p>
          ) : (
            <p class="ui-state">No filters yet.</p>
          )}
        </main>
      </div>
      {!!showFiltersAddEditModal && (
        <Modal
          title="Add filter"
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
          <Icon icon="x" />
        </button>
      )}
      <header>
        <h2>{editMode ? 'Edit filter' : 'New filter'}</h2>
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
                    ? 'Unable to edit filter'
                    : 'Unable to create filter',
                );
              }
            })();
          }}
        >
          <div class="filter-form-row">
            <label>
              <b>Title</b>
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
                          Whole word
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
                          <Icon icon="x" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div class="filter-keywords">
                <div class="insignificant">No keywords. Add one.</div>
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
                Add keyword
              </button>{' '}
              {filteredEditKeywords?.length > 1 && (
                <small class="insignificant">
                  {filteredEditKeywords.length} keyword
                  {filteredEditKeywords.length === 1 ? '' : 's'}
                </small>
              )}
            </footer>
          </div>
          <div class="filter-form-cols">
            <div class="filter-form-col">
              <div>
                <b>Filter from…</b>
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
                    {FILTER_CONTEXT_LABELS[ctx]}
                    {FILTER_CONTEXT_UNIMPLEMENTED.includes(ctx) ? '*' : ''}
                  </label>{' '}
                </div>
              ))}
              <p>
                <small class="insignificant">* Not implemented yet</small>
              </p>
            </div>
            <div class="filter-form-col">
              {editMode && (
                <>
                  Status:{' '}
                  <b>
                    <ExpiryStatus expiresAt={expiresAt} showNeverExpires />
                  </b>
                </>
              )}
              <div>
                <label for="filters-expires_in">
                  {editMode ? 'Change expiry' : 'Expiry'}
                </label>
                <select
                  id="filters-expires_in"
                  name="expires_in"
                  disabled={uiState === 'loading'}
                  defaultValue={editMode ? undefined : 0}
                >
                  {editMode && <option></option>}
                  {EXPIRY_DURATIONS.map((v) => (
                    <option value={v}>{EXPIRY_DURATIONS_LABELS[v]}</option>
                  ))}
                </select>
              </div>
              <p>
                Filtered post will be…
                <br />
                <label class="ib">
                  <input
                    type="radio"
                    name="filter_action"
                    value="warn"
                    defaultChecked={filterAction === 'warn' || !editMode}
                    disabled={uiState === 'loading'}
                  />{' '}
                  minimized
                </label>{' '}
                <label class="ib">
                  <input
                    type="radio"
                    name="filter_action"
                    value="hide"
                    defaultChecked={filterAction === 'hide'}
                    disabled={uiState === 'loading'}
                  />{' '}
                  hidden
                </label>
              </p>
            </div>
          </div>
          <footer class="filter-form-footer">
            <span>
              <button type="submit" disabled={uiState === 'loading'}>
                {editMode ? 'Save' : 'Create'}
              </button>{' '}
              <Loader abrupt hidden={uiState !== 'loading'} />
            </span>
            {editMode && (
              <MenuConfirm
                disabled={uiState === 'loading'}
                align="end"
                menuItemClassName="danger"
                confirmLabel="Delete this filter?"
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
                      alert('Unable to delete filter.');
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
                  Delete…
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
  const hasExpiry = !!expiresAt;
  const expiresAtDate = hasExpiry && new Date(expiresAt);
  const expired = hasExpiry && expiresAtDate <= new Date();

  // If less than a minute left, re-render interval every second, else every minute
  const [_, rerender] = useReducer((c) => c + 1, 0);
  useInterval(rerender, expired || 30_000);

  return expired ? (
    'Expired'
  ) : hasExpiry ? (
    <>
      Expiring <RelativeTime datetime={expiresAtDate} />
    </>
  ) : (
    showNeverExpires && 'Never expires'
  );
}

export default Filters;
