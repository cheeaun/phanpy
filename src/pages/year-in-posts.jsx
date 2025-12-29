import './year-in-posts.css';

import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { MenuDivider, MenuItem } from '@szhsin/react-menu';
import FlexSearch from 'flexsearch';
import { forwardRef } from 'preact/compat';
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { useSearchParams } from 'react-router-dom';
import { useThrottledCallback } from 'use-debounce';

import yearInPostsUrl from '../assets/features/year-in-posts.png';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import Menu2 from '../components/menu2';
import NavMenu from '../components/nav-menu';
import Status from '../components/status';
import { api } from '../utils/api';
import DateTimeFormat from '../utils/date-time-format';
import db from '../utils/db';
import getHTMLText from '../utils/getHTMLText';
import prettyBytes from '../utils/pretty-bytes';
import { supportsNativeQuote } from '../utils/quote-utils';
import showToast from '../utils/show-toast';
import store from '../utils/store';
import { getCurrentAccountNS } from '../utils/store-utils';
import useTitle from '../utils/useTitle';
import {
  fetchYearPosts,
  loadAvailableYears,
  removeYear,
} from '../utils/year-in-posts';

const MIN_YEAR = 2005; // https://en.wikipedia.org/wiki/Microblogging#Origin

function formatTimezoneOffset(offset) {
  // offset is in minutes, negative for east of UTC
  const sign = offset <= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset / 60);
  const minutes = absOffset % 60;
  return `UTC${sign}${hours}${minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

function getCurrentTimezoneOffset() {
  return new Date().getTimezoneOffset();
}

const FILTER_KEYS = {
  all: 'All',
  original: 'Original',
  replies: 'Replies',
  quotes: 'Quotes',
  boosts: 'Boosts',
  media: 'Media',
};

const SORT_OPTIONS = [
  { key: 'relevance', condition: 'searchQuery' },
  { key: 'createdAt' },
  { key: 'repliesCount' },
  { key: 'favouritesCount' },
  { key: 'reblogsCount' },
];

function getMonthName(month, locale, format = 'short') {
  const date = new Date(2000, month, 1);
  return DateTimeFormat(locale, { month: format }).format(date);
}

function getYear(year) {
  year = parseInt(year, 10);
  return year >= MIN_YEAR && year <= new Date().getFullYear() ? year : null;
}

function getMonth(month) {
  month = parseInt(month, 10);
  return month >= 0 && month <= 11 ? month : null;
}

const SEARCH_RESULT_PAGE_SIZE = 30;

function YearInPosts() {
  const { i18n } = useLingui();
  const [searchParams, setSearchParams] = useSearchParams();
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');
  const [postType, setPostType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const year = getYear(yearParam);
  const month = getMonth(monthParam);

  useTitle(
    searchQuery
      ? `Year in Posts ${year} - Search: ${searchQuery}`
      : year
        ? month !== null
          ? `Year in Posts ${year} - ${getMonthName(month, i18n.locale)}`
          : `Year in Posts ${year}`
        : 'Year in Posts',
    '/yip',
  );

  const { instance } = api();
  const [uiState, setUIState] = useState('default');
  const [posts, setPosts] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [showSearchField, setShowSearchField] = useState(!!searchQuery);
  const [searchLimit, setSearchLimit] = useState(SEARCH_RESULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState(searchQuery ? 'relevance' : 'createdAt');
  const [sortOrder, setSortOrder] = useState('asc');
  const searchFieldRef = useRef(null);
  const scrollableRef = useRef(null);
  const NS = useMemo(() => getCurrentAccountNS(), []);

  const totalPosts = posts.length;

  useEffect(() => {
    if (!searchQuery) {
      // Only hide search field if it's not focused
      const isSearchFieldFocused = searchFieldRef.current?.isFocused();
      if (!isSearchFieldFocused) {
        setShowSearchField(false);
      }
    }
  }, [searchQuery, monthParam, postType, sortBy, sortOrder]);

  function loadYears() {
    const years = loadAvailableYears();
    setAvailableYears(years);
  }

  useEffect(() => {
    if (year) return;
    loadYears();
  }, [year]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    const generateYear = getYear(e.target.elements.year.value);
    if (generateYear) {
      try {
        const dataId = `${NS}-${generateYear}`;
        const existingData = await db.yearInPosts.get(dataId);

        if (existingData && existingData.year === generateYear) {
          // Year already generated, go straight to year view
          setSearchParams({ year: generateYear });
        } else {
          // Year not generated, show generating UI and fetch data
          setUIState('generating');
          await fetchYearPosts(generateYear);
          setSearchParams({ year: generateYear });
        }
      } catch (error) {
        setUIState('error');
        console.error('Failed to generate year posts:', error);
        showToast('Unable to generate year posts. Please try again.');
      } finally {
        if (uiState === 'generating') {
          setUIState('default');
        }
      }
    } else {
      showToast('Invalid year.');
    }
  };

  async function handleFetchYearPosts(yearParam = year) {
    setUIState('loading');
    try {
      const allResults = await fetchYearPosts(yearParam);
      setPosts(allResults);
      setUIState('results');
      loadYears();
      // Inform user about timezone context
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      showToast(`Archive generated in ${tz}`);
    } catch (e) {
      console.error(e);
      setUIState('error');
    }
  }

  async function handleRemoveYear(yearToRemove) {
    if (!confirm(`Remove year ${yearToRemove} posts?`)) return;
    try {
      await removeYear(yearToRemove);
      setAvailableYears((years) =>
        years.filter((y) => y.year !== yearToRemove),
      );
    } catch (e) {
      console.error(e);
      alert('Failed to remove year data');
    }
  }

  const monthHeatmaps = useMemo(() => {
    const heatmaps = {};
    posts.forEach((post) => {
      const date = new Date(post.createdAt);
      const month = date.getMonth();
      const day = date.getDate();
      if (!heatmaps[month]) {
        heatmaps[month] = {};
      }
      if (!heatmaps[month][day]) {
        heatmaps[month][day] = {
          total: 0,
          original: 0,
          reply: 0,
          quote: 0,
          boost: 0,
        };
      }

      // Categorize post type
      const dayData = heatmaps[month][day];
      dayData.total++;

      if (post.reblog) {
        dayData.boost++;
      } else if (
        supportsNativeQuote() &&
        (post.quote?.id || post.quote?.quotedStatus?.id)
      ) {
        dayData.quote++;
      } else if (post.inReplyToId) {
        dayData.reply++;
      } else {
        dayData.original++;
      }
    });

    const result = {};
    Object.keys(heatmaps).forEach((month) => {
      const days = heatmaps[month];
      const maxCount = Math.max(...Object.values(days).map((d) => d.total));

      const firstDayOfMonth = new Date(year, parseInt(month), 1);
      const firstDayOfWeek = firstDayOfMonth.getDay();

      const calendar = [];

      for (let i = 0; i < firstDayOfWeek; i++) {
        calendar.push({
          day: null,
          count: 0,
          ratio: 0,
          original: 0,
          reply: 0,
          quote: 0,
          boost: 0,
        });
      }

      for (let day = 1; day <= 31; day++) {
        const dayData = days[day];
        const count = dayData?.total || 0;
        const ratio = count && maxCount > 0 ? count / maxCount : 0;
        calendar.push({
          day,
          count,
          ratio,
          original: dayData?.original || 0,
          reply: dayData?.reply || 0,
          quote: dayData?.quote || 0,
          boost: dayData?.boost || 0,
        });
      }

      result[month] = calendar;
    });

    return result;
  }, [posts, year]);

  const monthMediaGrids = useMemo(() => {
    if (postType !== 'media') return {};
    const grids = {};
    posts.forEach((post) => {
      const date = new Date(post.createdAt);
      const m = date.getMonth();
      const d = date.getDate();
      if (!grids[m]) grids[m] = {};
      if (!grids[m][d]) grids[m][d] = [];
      grids[m][d].push(post);
    });

    Object.keys(grids).forEach((month) => {
      const days = grids[month];
      const firstDayOfMonth = new Date(year, parseInt(month), 1);
      const firstDayOfWeek = firstDayOfMonth.getDay();

      const calendar = [];

      for (let i = 0; i < firstDayOfWeek; i++) {
        calendar.push(null);
      }

      for (let day = 1; day <= 31; day++) {
        const dayPosts = days[day] || [];
        let bestPost = null;
        let hasMedia = false;
        if (dayPosts.length > 0) {
          const postsWithMedia = dayPosts.filter((post) => {
            const actualPost = post.reblog || post;
            return (
              !post.reblog &&
              actualPost.mediaAttachments?.some(
                (media) =>
                  media.previewUrl ||
                  media.url ||
                  media.previewRemoteUrl ||
                  media.remoteUrl,
              )
            );
          });

          if (postsWithMedia.length > 0) {
            bestPost = postsWithMedia.reduce((topPost, post) => {
              const actualPost = post;
              const totalCount =
                (actualPost.favouritesCount || 0) +
                (actualPost.reblogsCount || 0) +
                (actualPost.repliesCount || 0) +
                (actualPost.quotesCount || 0);

              const topTotalCount = topPost
                ? (topPost.favouritesCount || 0) +
                  (topPost.reblogsCount || 0) +
                  (topPost.repliesCount || 0) +
                  (topPost.quotesCount || 0)
                : -1;

              if (totalCount > topTotalCount) return post;
              if (totalCount === topTotalCount) return topPost || post;
              return topPost;
            }, null);
            hasMedia = true;
          }
        }
        calendar.push(bestPost ? { post: bestPost, hasMedia } : { hasMedia });
      }

      grids[month] = calendar;
    });

    return grids;
  }, [posts, year, postType]);

  const monthsWithPosts = useMemo(() => {
    const monthCounts = {};
    const monthTypes = {};
    posts.forEach((post) => {
      const month = new Date(post.createdAt).getMonth();
      monthCounts[month] = (monthCounts[month] || 0) + 1;

      if (!monthTypes[month]) {
        monthTypes[month] = {
          original: 0,
          reply: 0,
          quote: 0,
          boost: 0,
        };
      }

      if (post.reblog) {
        monthTypes[month].boost++;
      } else if (
        supportsNativeQuote() &&
        (post.quote?.id || post.quote?.quotedStatus?.id)
      ) {
        monthTypes[month].quote++;
      } else if (post.inReplyToId) {
        monthTypes[month].reply++;
      } else {
        monthTypes[month].original++;
      }
    });
    return Object.entries(monthCounts)
      .map(([month, count]) => {
        const types = monthTypes[month];
        return {
          month: parseInt(month),
          count,
          heatmap: monthHeatmaps[month] || [],
          mediaGrid: monthMediaGrids[month] || [],
          original: types.original,
          reply: types.reply,
          quote: types.quote,
          boost: types.boost,
        };
      })
      .sort((a, b) => a.month - b.month);
  }, [posts, monthHeatmaps, monthMediaGrids]);

  const searchIndexRef = useRef(null);
  useEffect(() => {
    if (totalPosts > 0) {
      const index = new FlexSearch.Document({
        preset: 'match',
        document: {
          id: 'id',
          index: ['content', 'spoilerText', 'poll', 'media', 'card'],
        },
      });
      posts.forEach((p) => {
        const status = p.reblog || p;
        const pollText = status.poll?.options?.map((o) => o.title).join(' ');
        const mediaText = status.mediaAttachments
          ?.map((m) => m.description)
          .join(' ');
        const cardText = status.card
          ? `${status.card.title} ${status.card.description} ${status.card.url}`
          : '';
        index.add({
          id: p.id,
          content: getHTMLText(status.content),
          spoilerText: status.spoilerText,
          poll: pollText,
          media: mediaText,
          card: cardText,
        });
      });
      searchIndexRef.current = index;
    }
  }, [posts]);

  const searchedPosts = useMemo(() => {
    if (!searchQuery) return posts;
    if (!searchIndexRef.current) return [];
    console.time(`search: '${searchQuery}'`);
    const allResults = searchIndexRef.current.search(searchQuery, {
      limit: totalPosts,
    });
    console.timeEnd(`search: '${searchQuery}'`);
    const orderedIds = allResults.flatMap((r) => r.result);
    const uniqueOrderedIds = [...new Set(orderedIds)];

    const postsMap = new Map(posts.map((p) => [p.id, p]));
    const postResults = uniqueOrderedIds
      .map((id) => postsMap.get(id))
      .filter(Boolean);
    return postResults;
  }, [posts, searchQuery]);

  useEffect(() => {
    setSearchLimit(SEARCH_RESULT_PAGE_SIZE);
    if (searchQuery) {
      if (!['relevance', 'createdAt'].includes(sortBy)) {
        setSortBy('relevance');
      }
    } else {
      if (sortBy === 'relevance') {
        setSortBy('createdAt');
      }
    }
  }, [searchQuery, sortBy]);

  const [filterCounts, monthPosts] = useMemo(() => {
    const monthPosts = searchedPosts.filter((post) => {
      if (searchQuery) return true;
      const postMonth = new Date(post.createdAt).getMonth();
      return month !== null && postMonth === month;
    });

    const counts = {
      all: monthPosts.length,
      original: 0,
      replies: 0,
      quotes: 0,
      boosts: 0,
      media: 0,
    };

    monthPosts.forEach((post) => {
      if (post.reblog) {
        counts.boosts++;
      } else if (
        supportsNativeQuote() &&
        (post.quote?.id || post.quote?.quotedStatus?.id)
      ) {
        counts.quotes++;
      } else if (post.inReplyToId) {
        counts.replies++;
      } else {
        counts.original++;
      }

      const status = post.reblog || post;
      if (!post.reblog && status.mediaAttachments?.length > 0) {
        counts.media++;
      }
    });

    return [counts, monthPosts];
  }, [searchedPosts, month, searchQuery]);

  const [filteredPosts, hasMore] = useMemo(() => {
    const filtered = monthPosts.filter((post) => {
      if (postType === 'boosts') {
        return !!post.reblog;
      } else if (postType === 'media') {
        const status = post.reblog || post;
        return !post.reblog && status.mediaAttachments?.length > 0;
      } else if (postType === 'quotes') {
        return (
          supportsNativeQuote() &&
          (post.quote?.id || post.quote?.quotedStatus?.id)
        );
      } else if (postType === 'replies') {
        return !!post.inReplyToId;
      } else if (postType === 'original') {
        return (
          !post.reblog &&
          !(
            supportsNativeQuote() &&
            (post.quote?.id || post.quote?.quotedStatus?.id)
          ) &&
          !post.inReplyToId
        );
      }

      return true;
    });

    // Sort the filtered posts
    let sorted = filtered;
    if (sortBy !== 'relevance') {
      sorted = [...filtered].sort((a, b) => {
        const postA = a.reblog || a;
        const postB = b.reblog || b;
        let valueA, valueB;

        if (sortBy === 'createdAt') {
          valueA = new Date(a.createdAt);
          valueB = new Date(b.createdAt);
        } else {
          valueA = postA[sortBy] || 0;
          valueB = postB[sortBy] || 0;
        }

        if (sortOrder === 'asc') {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueB > valueA ? 1 : -1;
        }
      });
    }

    if (searchQuery) {
      return [sorted.slice(0, searchLimit), sorted.length > searchLimit];
    }
    return [sorted, false];
  }, [monthPosts, postType, searchQuery, searchLimit, sortBy, sortOrder]);

  // Auto-switch to 'all' when filtered results are empty but there are results in other categories
  useEffect(() => {
    if (
      searchQuery &&
      postType !== 'all' &&
      filteredPosts.length === 0 &&
      filterCounts.all > 0
    ) {
      setPostType('all');
    }
  }, [searchQuery, postType, filteredPosts.length, filterCounts.all]);

  const currentMonthIndex = monthsWithPosts.findIndex((m) => m.month === month);
  const prevMonth =
    currentMonthIndex > 0 ? monthsWithPosts[currentMonthIndex - 1] : null;
  const nextMonth =
    currentMonthIndex < monthsWithPosts.length - 1
      ? monthsWithPosts[currentMonthIndex + 1]
      : null;

  useEffect(() => {
    if (!year) {
      setUIState('default');
      setPosts([]);
      return;
    }

    (async () => {
      setUIState('loading');
      try {
        const dataId = `${NS}-${year}`;
        console.time(`fetchYearPosts-${year}`);
        const data = await db.yearInPosts.get(dataId);
        console.timeEnd(`fetchYearPosts-${year}`);
        if (data && data.year === year) {
          data.posts.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
          );
          setPosts(data.posts);
          setUIState('results');
        } else {
          setUIState('no-data');
        }
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, [year]);

  useEffect(() => {
    if (month !== null && uiState === 'results') {
      const monthFilter = document.querySelector(
        `.calendar-bar .month-filter[data-month="${month}"]`,
      );
      monthFilter?.focus();
      monthFilter?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [month, uiState === 'results']);

  return (
    <div
      ref={scrollableRef}
      id="year-in-posts-page"
      class="deck-container"
      tabIndex="-1"
      style={{
        '--month': month || 0,
      }}
    >
      <div class="timeline-deck deck">
        <header
          class={uiState === 'loading' ? 'loading' : ''}
          onClick={(e) => {
            if (!e.target.closest('a, button')) {
              scrollableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
              {year && month !== null ? (
                <Link
                  to={`/yip?year=${year}`}
                  class="button plain"
                  onClick={() => {
                    setSearchQuery('');
                  }}
                >
                  <Icon icon="grid" size="l" alt="Year in Posts" />
                </Link>
              ) : year ? (
                <Link
                  to="/yip"
                  class="button plain"
                  onClick={() => {
                    setSearchQuery('');
                  }}
                >
                  <Icon icon="month" size="l" alt="Year in Posts" />
                </Link>
              ) : (
                <Link to="/" class="button plain">
                  <Icon icon="home" size="l" alt="Home" />
                </Link>
              )}
            </div>
            {year && (
              <>
                {showSearchField ? (
                  <SearchField
                    ref={searchFieldRef}
                    placeholder={`Search posts in ${year}…`}
                    searchQuery={searchQuery}
                    onSearch={(val) => {
                      setSearchQuery(val);
                      setSearchLimit(SEARCH_RESULT_PAGE_SIZE);
                    }}
                    onEscape={() => {
                      if (!searchQuery.trim()) {
                        setShowSearchField(false);
                        setSearchQuery('');
                      }
                    }}
                  />
                ) : (
                  <h1 class="header-double-lines">
                    <b>{year}</b>
                    {uiState === 'results' && (
                      <div>
                        {/* <Plural
                          value={posts.length}
                          one="# post"
                          other="# posts"
                        /> */}
                        {posts.length} posts{' '}
                        {/* TODO: Use Plural above when finalized */}
                      </div>
                    )}
                  </h1>
                )}
              </>
            )}
            <div class="header-side">
              {year && (
                <>
                  <button
                    type="button"
                    class={`plain ${showSearchField ? 'is-active' : ''}`}
                    onClick={() => {
                      if (showSearchField) {
                        setShowSearchField(false);
                        setSearchQuery('');
                      } else {
                        setShowSearchField(true);
                        setTimeout(() => {
                          searchFieldRef.current?.focus();
                        }, 100);
                      }
                    }}
                  >
                    <Icon icon="search" size="l" alt="Search" />
                  </button>
                  <Menu2
                    align="end"
                    menuButton={
                      <button type="button" class="plain">
                        <Icon icon="more" size="l" alt="More" />
                      </button>
                    }
                  >
                    <MenuItem
                      type="checkbox"
                      checked={postType === 'media'}
                      onClick={() => {
                        setPostType(postType === 'media' ? 'all' : 'media');
                      }}
                    >
                      <Icon icon="check-circle" alt="☑️" />{' '}
                      <span class="menu-grow">Media only</span>
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem
                      onClick={() => {
                        handleFetchYearPosts();
                      }}
                      disabled={uiState === 'loading' || !!searchQuery}
                    >
                      <Icon icon="refresh" />
                      <span>Regenerate</span>
                    </MenuItem>
                  </Menu2>
                </>
              )}
            </div>
          </div>
        </header>

        <main>
          {!year && (
            <div class="year-in-posts-start">
              {uiState !== 'generating' ? (
                <>
                  <h1>
                    Year in Posts <sup>beta</sup>
                  </h1>
                  <p>A year-at-a-glance view of your posts.</p>
                  <details>
                    <summary>What is this?</summary>
                    <p>
                      Year in Posts is a simple, searchable archive of your
                      posts, offering a year-at-a-glance view with calendar
                      visualizations and straight-forward interface to sort and
                      filter through posts.
                    </p>
                    <img
                      src={yearInPostsUrl}
                      width="1200"
                      height="900"
                      alt="Preview of Year in Posts UI"
                    />
                    <p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.target.closest('details').open = false;
                        }}
                      >
                        Let's explore my posts
                      </button>
                    </p>
                  </details>

                  <form class="year-generate" onSubmit={handleGenerate}>
                    <label>
                      <input
                        type="number"
                        min={MIN_YEAR}
                        max={new Date().getFullYear()}
                        name="year"
                        defaultValue={new Date().getFullYear()}
                        disabled={uiState === 'generating'}
                      />
                    </label>
                    <button type="submit" disabled={uiState === 'generating'}>
                      <Icon icon="arrow-right" alt="Generate" size="l" />
                    </button>
                  </form>
                  <p class="insignificant">
                    <small>
                      This downloads your posts from the server and saves them
                      locally. It may take a longer time and require more disk
                      space.
                    </small>
                  </p>
                </>
              ) : (
                <div class="ui-state year-in-posts-start">
                  <Loader abrupt />
                  <p class="insignificant">Generating Year in Posts…</p>
                  <p class="insignificant">This might take a while.</p>
                </div>
              )}

              {availableYears.length > 0 && uiState !== 'generating' && (
                <div class="year-selection">
                  <p>Generated years in posts:</p>
                  <ul>
                    {availableYears.map(
                      ({ year, count, fetchedAt, size, timezoneOffset }) => {
                        const currentOffset = getCurrentTimezoneOffset();
                        const tzMismatch =
                          timezoneOffset !== undefined &&
                          timezoneOffset !== currentOffset;

                        return (
                          <li key={year}>
                            <Link
                              to={`/yip?year=${year}`}
                              class="year-card available"
                            >
                              <Icon icon="month" /> {year}
                            </Link>{' '}
                            <small class="ib insignificant">
                              {/* <Plural value={count} one="# post" other="# posts" /> */}
                              {count} posts{' '}
                              {/* TODO: Use Plural above when finalized */}
                            </small>{' '}
                            {size && (
                              <small
                                class="tag insignificant collapsed"
                                title={`${size.toLocaleString(i18n.locale || undefined)} bytes`}
                              >
                                ~{prettyBytes(size)}
                              </small>
                            )}{' '}
                            {fetchedAt && (
                              <small class="tag insignificant collapsed">
                                <Icon icon="refresh" />{' '}
                                <time
                                  datetime={new Date(fetchedAt).toISOString()}
                                >
                                  {new Date(fetchedAt).toLocaleDateString(
                                    i18n.locale,
                                    {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    },
                                  )}
                                </time>
                              </small>
                            )}{' '}
                            {timezoneOffset !== undefined && (
                              <small
                                class={`tag insignificant collapsed ${tzMismatch ? 'warn' : ''}`}
                                title={
                                  tzMismatch
                                    ? `Generated in ${formatTimezoneOffset(timezoneOffset)}, current timezone is ${formatTimezoneOffset(currentOffset)}`
                                    : formatTimezoneOffset(timezoneOffset)
                                }
                              >
                                {tzMismatch && <Icon icon="time" />}
                                {formatTimezoneOffset(timezoneOffset)}
                              </small>
                            )}
                            <button
                              type="button"
                              class="light danger small"
                              onClick={(e) => {
                                e.preventDefault();
                                handleRemoveYear(year);
                              }}
                            >
                              <Icon icon="x" alt="Remove" />
                            </button>
                          </li>
                        );
                      },
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {year && uiState === 'loading' && (
            <div class="ui-state year-in-posts-start">
              <Loader abrupt />
            </div>
          )}

          {year && uiState === 'results' && (
            <>
              {!searchQuery && monthsWithPosts.length > 0 && (
                <CalendarBar
                  year={year}
                  month={month}
                  monthsWithPosts={monthsWithPosts}
                  postType={postType}
                />
              )}

              {(month !== null || searchQuery) && (
                <div class="post-type-filters">
                  {Object.entries(FILTER_KEYS).map(
                    ([key, label]) =>
                      filterCounts[key] > 0 && (
                        <button
                          key={key}
                          type="button"
                          class={`filter-cat plain ${postType === key ? 'is-active' : ''}`}
                          onClick={() => setPostType(key)}
                        >
                          {label} <span class="count">{filterCounts[key]}</span>
                        </button>
                      ),
                  )}
                </div>
              )}

              {(month !== null || searchQuery) && filteredPosts.length > 1 && (
                <div class="sort-controls">
                  <span class="filter-label">Sort</span>{' '}
                  <fieldset class="radio-field-group">
                    {SORT_OPTIONS.filter((o) => {
                      if (o.key === 'relevance') return !!searchQuery;
                      if (o.key === 'createdAt') return true;
                      return !searchQuery;
                    }).map(({ key }) => (
                      <label
                        class="filter-sort"
                        key={key}
                        onClick={(e) => {
                          if (sortBy === key && key !== 'relevance') {
                            e.preventDefault();
                            e.stopPropagation();
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          }
                        }}
                      >
                        <input
                          type="radio"
                          name="filter-sort-cat"
                          checked={sortBy === key}
                          onChange={() => {
                            setSortBy(key);
                            const order = /(replies|favourites|reblogs)/.test(
                              key,
                            )
                              ? 'desc'
                              : 'asc';
                            setSortOrder(order);
                          }}
                        />
                        {
                          {
                            relevance: `Relevance`,
                            createdAt: `Date`,
                            repliesCount: `Replies`,
                            favouritesCount: `Likes`,
                            reblogsCount: `Boosts`,
                          }[key]
                        }
                        {sortBy === key &&
                          key !== 'relevance' &&
                          (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </label>
                    ))}
                  </fieldset>
                </div>
              )}

              {(month !== null || searchQuery) && (
                <>
                  <ul class="timeline">
                    {filteredPosts.length === 0 ? (
                      <p class="ui-state insignificant">…</p>
                    ) : totalPosts > 20 ? (
                      filteredPosts.map((post) => (
                        <IntersectionPostItem
                          key={post.id}
                          root={scrollableRef.current}
                          post={post}
                          instance={instance}
                        />
                      ))
                    ) : (
                      filteredPosts.map((post) => (
                        <li key={post.id}>
                          <Link
                            class="status-link timeline-item"
                            to={
                              post.reblog
                                ? `/${instance}/s/${post.reblog.id}`
                                : `/${instance}/s/${post.id}`
                            }
                          >
                            <Status
                              status={post}
                              instance={instance}
                              size="m"
                              showCommentCount
                              showQuoteCount
                            />
                          </Link>
                        </li>
                      ))
                    )}
                  </ul>

                  {searchQuery && hasMore && (
                    <div class="ui-state">
                      <button
                        type="button"
                        class="plain6 block"
                        onClick={() =>
                          setSearchLimit((l) => l + SEARCH_RESULT_PAGE_SIZE)
                        }
                      >
                        More…
                      </button>
                    </div>
                  )}

                  {!searchQuery && (
                    <div class="year-in-posts-nav">
                      {prevMonth ? (
                        <Link
                          to={`/yip?year=${year}&month=${prevMonth.month}`}
                          class="button light"
                          onClick={() => {
                            scrollableRef.current?.scrollTo({
                              top: 0,
                              behavior: 'instant',
                            });
                          }}
                        >
                          <Icon icon="arrow-left" />{' '}
                          {getMonthName(prevMonth.month, i18n.locale, 'long')}
                        </Link>
                      ) : (
                        <span />
                      )}
                      {nextMonth && (
                        <Link
                          to={`/yip?year=${year}&month=${nextMonth.month}`}
                          class="button light"
                          onClick={() => {
                            scrollableRef.current?.scrollTo({
                              top: 0,
                              behavior: 'instant',
                            });
                          }}
                        >
                          {getMonthName(nextMonth.month, i18n.locale, 'long')}{' '}
                          <Icon icon="arrow-right" />
                        </Link>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      <div class={`tron-grid ${month === null ? 'animated' : ''}`} />
    </div>
  );
}

const IntersectionPostItem = ({ root, post, instance }) => {
  const ref = useRef();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          queueMicrotask(() => setShow(true));
          observer.unobserve(ref.current);
        }
      },
      {
        root,
        rootMargin: `${Math.max(320, screen.height * 0.75)}px`,
      },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  const statusId = post.reblog?.id || post.id;

  return (
    <li
      ref={ref}
      style={{
        height: show ? undefined : '10em',
      }}
    >
      {show ? (
        <Link
          class="status-link timeline-item"
          to={`/${instance}/s/${statusId}`}
        >
          <Status
            status={post}
            instance={instance}
            size="m"
            showCommentCount
            showQuoteCount
          />
        </Link>
      ) : (
        <>&nbsp;</>
      )}
    </li>
  );
};

function CalendarBar({ year, month, monthsWithPosts, postType }) {
  const { i18n } = useLingui();
  return (
    <div
      class={`calendar-bar ${month === null ? 'grid' : 'horizontal'} ${postType === 'media' ? 'media-grid' : ''}`}
    >
      {monthsWithPosts.map(
        ({
          month: m,
          count,
          heatmap,
          mediaGrid,
          original,
          reply,
          quote,
          boost,
        }) => {
          const originalRatio = count > 0 ? original / count : 0;
          const replyRatio = count > 0 ? reply / count : 0;
          const quoteRatio = count > 0 ? quote / count : 0;
          const boostRatio = count > 0 ? boost / count : 0;

          return (
            <Link
              to={`/yip?year=${year}&month=${m}${postType !== 'all' ? `&postType=${postType}` : ''}`}
              key={m}
              class={`button plain ${
                month === m ? 'is-active month-filter' : 'month-filter'
              }`}
              style={{
                '--month-original-ratio': originalRatio,
                '--month-reply-ratio': replyRatio,
                '--month-quote-ratio': quoteRatio,
                '--month-boost-ratio': boostRatio,
              }}
              data-month={m}
            >
              <div class="month-name">{getMonthName(m, i18n.locale)}</div>
              {postType === 'media'
                ? mediaGrid.length > 0 && (
                    <div class="month-media-grid">
                      {mediaGrid.map((item, i) => {
                        if (!item)
                          return <span key={i} class="media-day empty" />;
                        if (!item.hasMedia)
                          return <span key={i} class="media-day no-media" />;
                        const status = item.post;
                        const media = status.mediaAttachments?.[0];
                        return (
                          <span key={i} class="media-day">
                            <img
                              src={media.previewUrl || media.url}
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                const { src } = e.target;
                                if (
                                  src === media.previewUrl ||
                                  src === media.url
                                ) {
                                  e.target.src =
                                    media.previewRemoteUrl || media.remoteUrl;
                                } else {
                                  e.target.remove();
                                }
                              }}
                              alt=""
                            />
                          </span>
                        );
                      })}
                    </div>
                  )
                : heatmap.length > 0 && (
                    <div class="month-heatmap">
                      {heatmap.map((dayData, i) => {
                        const total = dayData.count || 0;
                        const originalRatio =
                          total > 0 ? dayData.original / total : 0;
                        const replyRatio =
                          total > 0 ? dayData.reply / total : 0;
                        const quoteRatio =
                          total > 0 ? dayData.quote / total : 0;
                        const boostRatio =
                          total > 0 ? dayData.boost / total : 0;

                        return (
                          <span
                            key={i}
                            class={`heatmap-day ${dayData.day === null ? 'empty' : ''} ${i % 7 === 0 || i % 7 === 6 ? 'weekend' : ''}`}
                            data-ratio={dayData.ratio}
                            style={{
                              '--ratio': dayData.ratio,
                              '--original-ratio': originalRatio,
                              '--reply-ratio': replyRatio,
                              '--quote-ratio': quoteRatio,
                              '--boost-ratio': boostRatio,
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
              <div class="month-metadata">
                {/* <Plural value={count} one="# post" other="# posts" /> */}
                {count} posts {/* TODO: Use Plural above when finalized */}
              </div>
            </Link>
          );
        },
      )}
    </div>
  );
}

const SearchField = forwardRef(
  ({ searchQuery, onSearch, placeholder, onEscape }, ref) => {
    const searchInputRef = useRef(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        searchInputRef.current?.focus();
      },
      setValue: (val) => {
        searchInputRef.current.value = val;
      },
      isFocused: () => {
        return document.activeElement === searchInputRef.current;
      },
    }));

    const throttledSearch = useThrottledCallback(onSearch, 150);

    return (
      <form
        class="search-field"
        onSubmit={(e) => {
          e.preventDefault();
          const q = searchInputRef.current.value.trim();
          throttledSearch?.cancel();
          throttledSearch(q);
        }}
      >
        <input
          ref={searchInputRef}
          type="search"
          name="q"
          class="block"
          placeholder={placeholder || 'Search posts…'}
          defaultValue={searchQuery}
          dir="auto"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellCheck="false"
          enterKeyHint="search"
          onInput={(e) => {
            const val = e.target.value;
            throttledSearch(val);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !e.target.value.trim()) {
              onEscape?.();
            }
          }}
        />
      </form>
    );
  },
);

export default YearInPosts;
