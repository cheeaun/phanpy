import { forwardRef } from 'preact/compat';
import { useImperativeHandle, useRef, useState } from 'preact/hooks';
import { useSearchParams } from 'react-router-dom';

import { api } from '../utils/api';

import Icon from './icon';
import Link from './link';

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
    select: () => {
      searchFieldRef.current.select();
    },
    blur: () => {
      searchFieldRef.current.blur();
    },
  }));

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

        props?.onSubmit?.(e);
      }}
    >
      <input
        ref={searchFieldRef}
        value={query}
        name="q"
        type="search"
        // autofocus
        placeholder="Search"
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
          formRef.current
            ?.querySelector('.search-popover-item')
            ?.classList.add('focus');
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
                props?.onSubmit?.(e);
              }
              break;
          }
        }}
      />
      <div class="search-popover" hidden={!searchMenuOpen || !query}>
        {/* {!!query && (
          <Link
            to={`/search?q=${encodeURIComponent(query)}`}
            class="search-popover-item focus"
            onClick={(e) => {
              props?.onSubmit?.(e);
            }}
          >
            <Icon icon="search" />
            <span>{query}</span>
          </Link>
        )} */}
        {!!query &&
          [
            {
              label: (
                <>
                  {query}{' '}
                  <small class="insignificant">
                    ‒ accounts, hashtags &amp; posts
                  </small>
                </>
              ),
              to: `/search?q=${encodeURIComponent(query)}`,
              top: !type && !/\s/.test(query),
              hidden: !!type,
            },
            {
              label: (
                <>
                  Posts with <q>{query}</q>
                </>
              ),
              to: `/search?q=${encodeURIComponent(query)}&type=statuses`,
              hidden: /^https?:/.test(query),
              top: /\s/.test(query),
              icon: 'document',
              queryType: 'statuses',
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
              icon: 'hashtag',
              queryType: 'hashtags',
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
              icon: 'group',
              queryType: 'accounts',
            },
          ]
            .sort((a, b) => {
              if (type) {
                if (a.queryType === type) return -1;
                if (b.queryType === type) return 1;
              }
              if (a.top && !b.top) return -1;
              if (!a.top && b.top) return 1;
              return 0;
            })
            .filter(({ hidden }) => !hidden)
            .map(({ label, to, icon, type }, i) => (
              <Link
                to={to}
                class={`search-popover-item ${i === 0 ? 'focus' : ''}`}
                // hidden={hidden}
                onClick={(e) => {
                  props?.onSubmit?.(e);
                }}
              >
                <Icon
                  icon={icon || (type === 'link' ? 'arrow-right' : 'search')}
                  class="more-insignificant"
                />
                <span>{label}</span>{' '}
              </Link>
            ))}
      </div>
    </form>
  );
});

export default SearchForm;
