import './search.css';

import { forwardRef } from 'preact/compat';
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'preact/hooks';
import { InView } from 'react-intersection-observer';
import { useParams, useSearchParams } from 'react-router-dom';

import AccountBlock from '../components/account-block';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import NavMenu from '../components/nav-menu';
import Status from '../components/status';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const SHORT_LIMIT = 5;
const LIMIT = 40;

function Search(props) {
  const params = useParams();
  const { masto, instance, authenticated } = api({
    instance: params.instance,
  });
  const [uiState, setUIState] = useState('default');
  const [searchParams] = useSearchParams();
  const searchFormRef = useRef();
  const q = props?.query || searchParams.get('q');
  const type = props?.type || searchParams.get('type');
  useTitle(
    q
      ? `Search: ${q}${
          type
            ? ` (${
                {
                  statuses: 'Posts',
                  accounts: 'Accounts',
                  hashtags: 'Hashtags',
                }[type]
              })`
            : ''
        }`
      : 'Search',
    `/search`,
  );

  const [showMore, setShowMore] = useState(false);
  const offsetRef = useRef(0);
  useEffect(() => {
    offsetRef.current = 0;
  }, [q, type]);

  const scrollableRef = useRef();
  useLayoutEffect(() => {
    scrollableRef.current?.scrollTo?.(0, 0);
  }, [q, type]);

  const [statusResults, setStatusResults] = useState([]);
  const [accountResults, setAccountResults] = useState([]);
  const [hashtagResults, setHashtagResults] = useState([]);
  useEffect(() => {
    setStatusResults([]);
    setAccountResults([]);
    setHashtagResults([]);
  }, [q]);
  const setTypeResultsFunc = {
    statuses: setStatusResults,
    accounts: setAccountResults,
    hashtags: setHashtagResults,
  };

  function loadResults(firstLoad) {
    setUIState('loading');
    if (firstLoad && !type) {
      setStatusResults(statusResults.slice(0, SHORT_LIMIT));
      setAccountResults(accountResults.slice(0, SHORT_LIMIT));
      setHashtagResults(hashtagResults.slice(0, SHORT_LIMIT));
    }

    (async () => {
      const params = {
        q,
        resolve: authenticated,
        limit: SHORT_LIMIT,
      };
      if (type) {
        params.limit = LIMIT;
        params.type = type;
        params.offset = offsetRef.current;
      }
      try {
        const results = await masto.v2.search(params);
        console.log(results);
        if (type) {
          if (firstLoad) {
            setTypeResultsFunc[type](results[type]);
            const length = results[type]?.length;
            offsetRef.current = LIMIT;
            setShowMore(!!length);
          } else {
            setTypeResultsFunc[type]((prev) => [...prev, ...results[type]]);
            const length = results[type]?.length;
            offsetRef.current = offsetRef.current + LIMIT;
            setShowMore(!!length);
          }
        } else {
          setStatusResults(results.statuses);
          setAccountResults(results.accounts);
          setHashtagResults(results.hashtags);
          offsetRef.current = 0;
          setShowMore(false);
        }
        setUIState('default');
      } catch (err) {
        console.error(err);
        setUIState('error');
      }
    })();
  }

  useEffect(() => {
    // searchFieldRef.current?.focus?.();
    // searchFormRef.current?.focus?.();
    if (q) {
      // searchFieldRef.current.value = q;
      searchFormRef.current?.setValue?.(q);
      loadResults(true);
    }
  }, [q, type, instance]);

  return (
    <div id="search-page" class="deck-container" ref={scrollableRef}>
      <div class="timeline-deck deck">
        <header>
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
            </div>
            <SearchForm ref={searchFormRef} />
            <div class="header-side">&nbsp;</div>
          </div>
        </header>
        <main>
          {!!q && (
            <div class="filter-bar">
              {!!type && <Link to={`/search${q ? `?q=${q}` : ''}`}>‹ All</Link>}
              {[
                {
                  label: 'Accounts',
                  type: 'accounts',
                  to: `/search?q=${q}&type=accounts`,
                },
                {
                  label: 'Hashtags',
                  type: 'hashtags',
                  to: `/search?q=${q}&type=hashtags`,
                },
                {
                  label: 'Posts',
                  type: 'statuses',
                  to: `/search?q=${q}&type=statuses`,
                },
              ]
                .sort((a, b) => {
                  if (a.type === type) return -1;
                  if (b.type === type) return 1;
                  return 0;
                })
                .map((link) => (
                  <Link to={link.to}>{link.label}</Link>
                ))}
            </div>
          )}
          {!!q ? (
            <>
              {(!type || type === 'accounts') && (
                <>
                  {type !== 'accounts' && (
                    <h2 class="timeline-header">Accounts</h2>
                  )}
                  {accountResults.length > 0 ? (
                    <>
                      <ul class="timeline flat accounts-list">
                        {accountResults.map((account) => (
                          <li key={account.id}>
                            <AccountBlock
                              account={account}
                              instance={instance}
                              showStats
                            />
                          </li>
                        ))}
                      </ul>
                      {type !== 'accounts' && (
                        <div class="ui-state">
                          <Link
                            class="plain button"
                            to={`/search?q=${q}&type=accounts`}
                          >
                            See more accounts <Icon icon="arrow-right" />
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    !type &&
                    (uiState === 'loading' ? (
                      <p class="ui-state">
                        <Loader abrupt />
                      </p>
                    ) : (
                      <p class="ui-state">No accounts found.</p>
                    ))
                  )}
                </>
              )}
              {(!type || type === 'hashtags') && (
                <>
                  {type !== 'hashtags' && (
                    <h2 class="timeline-header">Hashtags</h2>
                  )}
                  {hashtagResults.length > 0 ? (
                    <>
                      <ul class="link-list hashtag-list">
                        {hashtagResults.map((hashtag) => (
                          <li key={hashtag.name}>
                            <Link
                              to={
                                instance
                                  ? `/${instance}/t/${hashtag.name}`
                                  : `/t/${hashtag.name}`
                              }
                            >
                              <Icon icon="hashtag" />
                              <span>{hashtag.name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {type !== 'hashtags' && (
                        <div class="ui-state">
                          <Link
                            class="plain button"
                            to={`/search?q=${q}&type=hashtags`}
                          >
                            See more hashtags <Icon icon="arrow-right" />
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    !type &&
                    (uiState === 'loading' ? (
                      <p class="ui-state">
                        <Loader abrupt />
                      </p>
                    ) : (
                      <p class="ui-state">No hashtags found.</p>
                    ))
                  )}
                </>
              )}
              {(!type || type === 'statuses') && (
                <>
                  {type !== 'statuses' && (
                    <h2 class="timeline-header">Posts</h2>
                  )}
                  {statusResults.length > 0 ? (
                    <>
                      <ul class="timeline">
                        {statusResults.map((status) => (
                          <li key={status.id}>
                            <Link
                              class="status-link"
                              to={
                                instance
                                  ? `/${instance}/s/${status.id}`
                                  : `/s/${status.id}`
                              }
                            >
                              <Status status={status} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {type !== 'statuses' && (
                        <div class="ui-state">
                          <Link
                            class="plain button"
                            to={`/search?q=${q}&type=statuses`}
                          >
                            See more posts <Icon icon="arrow-right" />
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    !type &&
                    (uiState === 'loading' ? (
                      <p class="ui-state">
                        <Loader abrupt />
                      </p>
                    ) : (
                      <p class="ui-state">No posts found.</p>
                    ))
                  )}
                </>
              )}
              {!!type &&
                (uiState === 'default' ? (
                  showMore ? (
                    <InView
                      onChange={(inView) => {
                        if (inView) {
                          loadResults();
                        }
                      }}
                    >
                      <button
                        type="button"
                        class="plain block"
                        onClick={() => loadResults()}
                        style={{ marginBlockEnd: '6em' }}
                      >
                        Show more&hellip;
                      </button>
                    </InView>
                  ) : (
                    <p class="ui-state insignificant">The end.</p>
                  )
                ) : (
                  uiState === 'loading' && (
                    <p class="ui-state">
                      <Loader abrupt />
                    </p>
                  )
                ))}
            </>
          ) : uiState === 'loading' ? (
            <p class="ui-state">
              <Loader abrupt />
            </p>
          ) : (
            <p class="ui-state">
              Enter your search term or paste a URL above to get started.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

export default Search;

const SearchForm = forwardRef((props, ref) => {
  const { instance } = api();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const type = searchParams.get('type');
  const formRef = useRef(null);

  const searchFieldRef = useRef(null);
  useImperativeHandle(ref, () => ({
    setValue: (value) => {
      setQuery(value);
    },
    focus: () => {
      searchFieldRef.current.focus();
    },
  }));

  return (
    <form
      ref={formRef}
      class="search-popover-container"
      onSubmit={(e) => {
        e.preventDefault();

        if (query) {
          const params = {
            q: query,
          };
          if (type) params.type = type; // Preserve type
          setSearchParams(params);
        } else {
          setSearchParams({});
        }
      }}
    >
      <input
        ref={searchFieldRef}
        value={query}
        name="q"
        type="search"
        // autofocus
        placeholder="Search"
        onSearch={(e) => {
          if (!e.target.value) {
            setSearchParams({});
          }
        }}
        onInput={(e) => {
          setQuery(e.target.value);
          setSearchMenuOpen(true);
        }}
        onFocus={() => {
          setSearchMenuOpen(true);
        }}
        onBlur={() => {
          setTimeout(() => {
            setSearchMenuOpen(false);
          }, 100);
          formRef.current
            ?.querySelector('.search-popover-item.focus')
            ?.classList.remove('focus');
        }}
        onKeyDown={(e) => {
          const { key } = e;
          switch (key) {
            case 'Escape':
              setSearchMenuOpen(false);
              break;
            case 'Down':
            case 'ArrowDown':
              e.preventDefault();
              if (searchMenuOpen) {
                const focusItem = formRef.current.querySelector(
                  '.search-popover-item.focus',
                );
                if (focusItem) {
                  let nextItem = focusItem.nextElementSibling;
                  while (nextItem && nextItem.hidden) {
                    nextItem = nextItem.nextElementSibling;
                  }
                  if (nextItem) {
                    nextItem.classList.add('focus');
                    const siblings = Array.from(
                      nextItem.parentElement.children,
                    ).filter((el) => el !== nextItem);
                    siblings.forEach((el) => {
                      el.classList.remove('focus');
                    });
                  }
                } else {
                  const firstItem = formRef.current.querySelector(
                    '.search-popover-item',
                  );
                  if (firstItem) {
                    firstItem.classList.add('focus');
                  }
                }
              }
              break;
            case 'Up':
            case 'ArrowUp':
              e.preventDefault();
              if (searchMenuOpen) {
                const focusItem = document.querySelector(
                  '.search-popover-item.focus',
                );
                if (focusItem) {
                  let prevItem = focusItem.previousElementSibling;
                  while (prevItem && prevItem.hidden) {
                    prevItem = prevItem.previousElementSibling;
                  }
                  if (prevItem) {
                    prevItem.classList.add('focus');
                    const siblings = Array.from(
                      prevItem.parentElement.children,
                    ).filter((el) => el !== prevItem);
                    siblings.forEach((el) => {
                      el.classList.remove('focus');
                    });
                  }
                } else {
                  const lastItem = document.querySelector(
                    '.search-popover-item:last-child',
                  );
                  if (lastItem) {
                    lastItem.classList.add('focus');
                  }
                }
              }
              break;
            case 'Enter':
              if (searchMenuOpen) {
                const focusItem = document.querySelector(
                  '.search-popover-item.focus',
                );
                if (focusItem) {
                  e.preventDefault();
                  focusItem.click();
                }
                setSearchMenuOpen(false);
              }
              break;
          }
        }}
      />
      <div class="search-popover" hidden={!searchMenuOpen || !query}>
        {!!query &&
          [
            {
              label: (
                <>
                  Posts with <q>{query}</q>
                </>
              ),
              to: `/search?q=${encodeURIComponent(query)}&type=statuses`,
              hidden: /^https?:/.test(query),
            },
            {
              label: (
                <>
                  Posts tagged with <mark>#{query.replace(/^#/, '')}</mark>
                </>
              ),
              to: `/${instance}/t/${query.replace(/^#/, '')}`,
              hidden:
                /^@/.test(query) || /^https?:/.test(query) || /\s/.test(query),
              top: /^#/.test(query),
              type: 'link',
            },
            {
              label: (
                <>
                  Look up <mark>{query}</mark>
                </>
              ),
              to: `/${query}`,
              hidden: !/^https?:/.test(query),
              top: /^https?:/.test(query),
              type: 'link',
            },
            {
              label: (
                <>
                  Accounts with <q>{query}</q>
                </>
              ),
              to: `/search?q=${encodeURIComponent(query)}&type=accounts`,
            },
          ]
            .sort((a, b) => {
              if (a.top && !b.top) return -1;
              if (!a.top && b.top) return 1;
              return 0;
            })
            .map(({ label, to, hidden, type }) => (
              <Link to={to} class="search-popover-item" hidden={hidden}>
                <Icon
                  icon={type === 'link' ? 'arrow-right' : 'search'}
                  class="more-insignificant"
                />
                <span>{label}</span>{' '}
              </Link>
            ))}
      </div>
    </form>
  );
});
