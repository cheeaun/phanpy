import './search.css';

import { useAutoAnimate } from '@formkit/auto-animate/preact';
import { t, Trans } from '@lingui/macro';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { InView } from 'react-intersection-observer';
import { useParams, useSearchParams } from 'react-router-dom';

import AccountBlock from '../components/account-block';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import NavMenu from '../components/nav-menu';
import SearchForm from '../components/search-form';
import Status from '../components/status';
import { api } from '../utils/api';
import { fetchRelationships } from '../utils/relationships';
import shortenNumber from '../utils/shorten-number';
import usePageVisibility from '../utils/usePageVisibility';
import useTitle from '../utils/useTitle';

const SHORT_LIMIT = 5;
const LIMIT = 40;
const emptySearchParams = new URLSearchParams();

function Search({ columnMode, ...props }) {
  const params = columnMode ? {} : useParams();
  const { masto, instance, authenticated } = api({
    instance: params.instance,
  });
  const [uiState, setUIState] = useState('default');
  const [searchParams] = columnMode ? [emptySearchParams] : useSearchParams();
  const searchFormRef = useRef();
  const q = props?.query || searchParams.get('q');
  const type = columnMode
    ? 'statuses'
    : props?.type || searchParams.get('type');
  let title = t`Search`;
  if (q) {
    switch (type) {
      case 'statuses':
        title = t`Search: ${q} (Posts)`;
        break;
      case 'accounts':
        title = t`Search: ${q} (Accounts)`;
        break;
      case 'hashtags':
        title = t`Search: ${q} (Hashtags)`;
        break;
      default:
        title = t`Search: ${q}`;
    }
  }
  useTitle(title, `/search`);

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

  const [relationshipsMap, setRelationshipsMap] = useState({});
  const loadRelationships = async (accounts) => {
    if (!accounts?.length) return;
    const relationships = await fetchRelationships(accounts, relationshipsMap);
    if (relationships) {
      setRelationshipsMap({
        ...relationshipsMap,
        ...relationships,
      });
    }
  };

  function loadResults(firstLoad) {
    if (firstLoad) {
      offsetRef.current = 0;
    }

    if (!firstLoad && !authenticated) {
      // Search results pagination is only available to authenticated users
      return;
    }

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
        if (authenticated) params.offset = offsetRef.current;
      }

      try {
        const results = await masto.v2.search.fetch(params);
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
          setStatusResults(results.statuses || []);
          setAccountResults(results.accounts || []);
          setHashtagResults(results.hashtags || []);
          offsetRef.current = 0;
          setShowMore(false);
        }
        loadRelationships(results.accounts);

        setUIState('default');
      } catch (err) {
        console.error(err);
        setUIState('error');
      }
    })();
  }

  const lastHiddenTime = useRef();
  usePageVisibility((visible) => {
    const reachStart = scrollableRef.current?.scrollTop === 0;
    if (visible && reachStart) {
      const timeDiff = Date.now() - lastHiddenTime.current;
      if (!lastHiddenTime.current || timeDiff > 1000 * 3) {
        // 3 seconds
        loadResults(true);
      } else {
        lastHiddenTime.current = Date.now();
      }
    }
  });

  useEffect(() => {
    searchFormRef.current?.setValue?.(q || '');
    if (q) {
      loadResults(true);
    } else {
      searchFormRef.current?.focus?.();
    }
  }, [q, type, instance]);

  useHotkeys(
    ['/', 'Slash'],
    (e) => {
      searchFormRef.current?.focus?.();
      searchFormRef.current?.select?.();
    },
    {
      preventDefault: true,
    },
  );

  const [filterBarParent] = useAutoAnimate();

  return (
    <div id="search-page" class="deck-container" ref={scrollableRef}>
      <div class="timeline-deck deck">
        <header class={uiState === 'loading' ? 'loading' : ''}>
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
            </div>
            <SearchForm ref={searchFormRef} />
            <div class="header-side">
              <button
                type="button"
                class="plain"
                onClick={() => {
                  loadResults(true);
                }}
                disabled={uiState === 'loading'}
              >
                <Icon icon="search" size="l" alt={t`Search`} />
              </button>
            </div>
          </div>
        </header>
        <main>
          {!!q && !columnMode && (
            <div
              ref={filterBarParent}
              class={`filter-bar ${uiState === 'loading' ? 'loading' : ''}`}
            >
              {!!type && (
                <Link to={`/search${q ? `?q=${encodeURIComponent(q)}` : ''}`}>
                  <Icon icon="chevron-left" /> <Trans>All</Trans>
                </Link>
              )}
              {[
                {
                  label: t`Accounts`,
                  type: 'accounts',
                  to: `/search?q=${encodeURIComponent(q)}&type=accounts`,
                },
                {
                  label: t`Hashtags`,
                  type: 'hashtags',
                  to: `/search?q=${encodeURIComponent(q)}&type=hashtags`,
                },
                {
                  label: t`Posts`,
                  type: 'statuses',
                  to: `/search?q=${encodeURIComponent(q)}&type=statuses`,
                },
              ]
                .sort((a, b) => {
                  if (a.type === type) return -1;
                  if (b.type === type) return 1;
                  return 0;
                })
                .map((link) => (
                  <Link to={link.to} key={link.type}>
                    {link.label}
                  </Link>
                ))}
            </div>
          )}
          {!!q ? (
            <>
              {(!type || type === 'accounts') && (
                <>
                  {type !== 'accounts' && (
                    <h2 class="timeline-header">
                      <Trans>Accounts</Trans>{' '}
                      <Link
                        to={`/search?q=${encodeURIComponent(q)}&type=accounts`}
                      >
                        <Icon icon="arrow-right" size="l" alt={t`See more`} />
                      </Link>
                    </h2>
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
                              relationship={relationshipsMap[account.id]}
                            />
                          </li>
                        ))}
                      </ul>
                      {type !== 'accounts' && (
                        <div class="ui-state">
                          <Link
                            class="plain button"
                            to={`/search?q=${encodeURIComponent(
                              q,
                            )}&type=accounts`}
                          >
                            <Trans>See more accounts</Trans>{' '}
                            <Icon icon="arrow-right" />
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
                      <p class="ui-state">
                        <Trans>No accounts found.</Trans>
                      </p>
                    ))
                  )}
                </>
              )}
              {(!type || type === 'hashtags') && (
                <>
                  {type !== 'hashtags' && (
                    <h2 class="timeline-header">
                      <Trans>Hashtags</Trans>{' '}
                      <Link
                        to={`/search?q=${encodeURIComponent(q)}&type=hashtags`}
                      >
                        <Icon icon="arrow-right" size="l" alt={t`See more`} />
                      </Link>
                    </h2>
                  )}
                  {hashtagResults.length > 0 ? (
                    <>
                      <ul class="link-list hashtag-list">
                        {hashtagResults.map((hashtag) => {
                          const { name, history } = hashtag;
                          const total = history?.reduce?.(
                            (acc, cur) => acc + +cur.uses,
                            0,
                          );
                          return (
                            <li key={`${name}-${total}`}>
                              <Link
                                to={
                                  instance
                                    ? `/${instance}/t/${name}`
                                    : `/t/${name}`
                                }
                              >
                                <Icon icon="hashtag" alt="#" />
                                <span>{name}</span>
                                {!!total && (
                                  <span class="count">
                                    {shortenNumber(total)}
                                  </span>
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                      {type !== 'hashtags' && (
                        <div class="ui-state">
                          <Link
                            class="plain button"
                            to={`/search?q=${encodeURIComponent(
                              q,
                            )}&type=hashtags`}
                          >
                            <Trans>See more hashtags</Trans>{' '}
                            <Icon icon="arrow-right" />
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
                      <p class="ui-state">
                        <Trans>No hashtags found.</Trans>
                      </p>
                    ))
                  )}
                </>
              )}
              {(!type || type === 'statuses') && (
                <>
                  {type !== 'statuses' && (
                    <h2 class="timeline-header">
                      <Trans>Posts</Trans>{' '}
                      <Link
                        to={`/search?q=${encodeURIComponent(q)}&type=statuses`}
                      >
                        <Icon icon="arrow-right" size="l" alt={t`See more`} />
                      </Link>
                    </h2>
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
                            to={`/search?q=${encodeURIComponent(
                              q,
                            )}&type=statuses`}
                          >
                            <Trans>See more posts</Trans>{' '}
                            <Icon icon="arrow-right" />
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
                      <p class="ui-state">
                        <Trans>No posts found.</Trans>
                      </p>
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
                        <Trans>Show more…</Trans>
                      </button>
                    </InView>
                  ) : (
                    <p class="ui-state insignificant">
                      <Trans>The end.</Trans>
                    </p>
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
              <Trans>
                Enter your search term or paste a URL above to get started.
              </Trans>
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

export default Search;
