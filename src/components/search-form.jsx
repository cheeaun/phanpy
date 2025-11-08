import { Trans, useLingui } from '@lingui/react/macro';
import { forwardRef } from 'preact/compat';
import { useImperativeHandle, useMemo, useRef, useState } from 'preact/hooks';
import { useSearchParams } from 'react-router-dom';

import { api } from '../utils/api';
import { addToSearchHistory, getSearchHistory } from '../utils/search-history';

import Icon from './icon';
import Link from './link';

// Helper function to generate search item data (label and URL)
export const generateSearchItemData = (query, queryType, instance) => {
  let label, to, icon;

  if (queryType === 'statuses') {
    label = (
      <Trans>
        Posts with <q>{query}</q>
      </Trans>
    );
    to = `/search?q=${encodeURIComponent(query)}&type=statuses`;
    icon = 'document';
  } else if (queryType === 'accounts') {
    label = (
      <Trans>
        Accounts with <q>{query}</q>
      </Trans>
    );
    to = `/search?q=${encodeURIComponent(query)}&type=accounts`;
    icon = 'group';
  } else if (queryType === 'hashtags') {
    const hashSymbol = query[0]; // Preserve original # or ＃
    const hashtagText = query.replace(/^[#＃]/, '');
    const hashtag = `${hashSymbol}${hashtagText}`;
    label = (
      <Trans>
        Posts tagged with <mark>{hashtag}</mark>
      </Trans>
    );
    to = `/${instance}/t/${hashtagText}`;
    icon = 'hashtag';
  } else {
    // Default/general search
    label = (
      <Trans>
        {query}{' '}
        <small class="insignificant">‒ accounts, hashtags &amp; posts</small>
      </Trans>
    );
    to = `/search?q=${encodeURIComponent(query)}`;
    icon = 'search';
  }

  return { label, to, icon };
};

const SearchForm = forwardRef((props, ref) => {
  const { t } = useLingui();
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
    select: () => {
      searchFieldRef.current.select();
    },
    blur: () => {
      searchFieldRef.current.blur();
    },
  }));

  const searchHistory = useMemo(
    () => getSearchHistory({ limit: 5 }),
    [props?.hidden],
  );

  const searchSuggestionsData = useMemo(() => {
    if (!query) return [];

    const matchingHistory = searchHistory
      .filter((historyItem) => {
        // Filter out exact matches with current query
        if (historyItem.query === query) return false;
        // Check if history item contains the current query (case insensitive)
        return historyItem.query.toLowerCase().includes(query.toLowerCase());
      })
      .slice(0, 2); // Max 2 recent searches

    const recentSearchItems = matchingHistory.map((historyItem) => ({
      ...generateSearchItemData(
        historyItem.query,
        historyItem.queryType,
        instance,
      ),
      queryType: historyItem.queryType,
      isRecentSearch: true,
      historyItem,
    }));

    const allItems = [
      // General search
      {
        ...generateSearchItemData(query, null, instance),
        top: !type && !/\s/.test(query),
        hidden: !!type,
      },
      // Recent searches
      ...recentSearchItems,
      // Posts search
      {
        ...generateSearchItemData(query, 'statuses', instance),
        hidden: /^https?:/.test(query),
        top: /\s/.test(query),
        queryType: 'statuses',
      },
      // Hashtag search
      {
        ...generateSearchItemData(query, 'hashtags', instance),
        hidden:
          /^[@＠]/.test(query) || /^https?:/.test(query) || /\s/.test(query),
        top: /^[#＃]/.test(query),
        type: 'link',
        queryType: 'hashtags',
      },
      // URL lookup (unique case)
      {
        label: (
          <Trans>
            Look up <mark>{query}</mark>
          </Trans>
        ),
        to: `/${query}`,
        hidden: !/^https?:/.test(query),
        top: /^https?:/.test(query),
        type: 'link',
        icon: 'arrow-right',
      },
      // Accounts search
      {
        ...generateSearchItemData(query, 'accounts', instance),
        queryType: 'accounts',
      },
    ];

    return allItems
      .sort((a, b) => {
        if (type) {
          if (a.queryType === type) return -1;
          if (b.queryType === type) return 1;
        }
        if (a.top && !b.top) return -1;
        if (!a.top && b.top) return 1;
        return 0;
      })
      .filter(({ hidden }) => !hidden);
  }, [query, type, instance]);

  return (
    <form
      ref={formRef}
      class="search-popover-container"
      onSubmit={(e) => {
        e.preventDefault();

        const isSearchPage = /\/search/.test(location.hash);
        if (isSearchPage) {
          if (query) {
            const params = {
              q: query,
            };
            if (type) params.type = type; // Preserve type
            setSearchParams(params);
          } else {
            setSearchParams({});
          }
        } else {
          if (query) {
            location.hash = `/search?q=${encodeURIComponent(query)}${
              type ? `&type=${type}` : ''
            }`;
          } else {
            location.hash = `/search`;
          }
        }

        addToSearchHistory(query, type);

        props?.onSubmit?.(e);
      }}
    >
      <input
        ref={searchFieldRef}
        value={query}
        name="q"
        type="search"
        // autofocus
        placeholder={t`Search`}
        dir="auto"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellCheck="false"
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
          // Focus first item
          const firstItem = formRef.current?.querySelector(
            '.search-popover-item',
          );
          if (firstItem) {
            firstItem.classList.add('focus');
          }
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
                  const items = document.querySelectorAll(
                    '.search-popover-item',
                  );
                  const lastItem = items[items.length - 1];
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
                props?.onSubmit?.(e);
              }
              break;
          }
        }}
      />
      <div class="search-popover" hidden={!searchMenuOpen}>
        {/* Search History - show when no query */}
        {!query && searchHistory.length > 0 && (
          <div class="search-popover-recent-searches">
            <div class="search-popover-header">
              <Icon icon="history" size="s" />
              <Trans>Recent searches</Trans>
            </div>
            {searchHistory.map((historyItem, i) => {
              const { label, to, icon } = generateSearchItemData(
                historyItem.query,
                historyItem.queryType,
                instance,
              );

              return (
                <Link
                  key={`${historyItem.query}-${historyItem.queryType}-${historyItem.timestamp}`}
                  to={to}
                  class={`search-popover-item ${i === 0 ? 'focus' : ''}`}
                  onClick={(e) => {
                    addToSearchHistory(
                      historyItem.query,
                      historyItem.queryType,
                    );
                    props?.onSubmit?.(e);
                  }}
                >
                  <Icon icon={icon} class="more-insignificant" />
                  <span>{label}</span>
                </Link>
              );
            })}
            <Link
              to="/search"
              class="search-popover-item search-history-see-all"
            >
              <Icon icon="more2" class="more-insignificant" />
              <span>
                <Trans>See all</Trans>
              </span>
            </Link>
          </div>
        )}

        {/* Search Suggestions - show when there's a query */}
        {searchSuggestionsData.map(
          ({ label, to, icon, queryType, isRecentSearch, historyItem }, i) => (
            <Link
              key={
                isRecentSearch
                  ? `recent-${historyItem.query}-${historyItem.queryType}-${historyItem.timestamp}`
                  : `suggestion-${queryType || 'general'}-${i}`
              }
              to={to}
              class={`search-popover-item ${isRecentSearch ? 'search-popover-item-recent' : ''} ${i === 0 ? 'focus' : ''}`}
              onClick={(e) => {
                if (!isRecentSearch) {
                  addToSearchHistory(query, queryType);
                }
                props?.onSubmit?.(e);
              }}
            >
              <Icon icon={icon} class="more-insignificant" />
              <span>{label}</span>
            </Link>
          ),
        )}
      </div>
    </form>
  );
});

export default SearchForm;
