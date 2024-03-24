import '../components/links-bar.css';
import './catchup.css';

import autoAnimate from '@formkit/auto-animate';
import { getBlurHashAverageColor } from 'fast-blurhash';
import { Fragment } from 'preact';
import { memo } from 'preact/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { useSearchParams } from 'react-router-dom';
import { uid } from 'uid/single';

import catchupUrl from '../assets/features/catch-up.png';

import Avatar from '../components/avatar';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import Modal from '../components/modal';
import NameText from '../components/name-text';
import NavMenu from '../components/nav-menu';
import RelativeTime from '../components/relative-time';
import { api } from '../utils/api';
import { oklab2rgb, rgb2oklab } from '../utils/color-utils';
import db from '../utils/db';
import emojifyText from '../utils/emojify-text';
import { isFiltered } from '../utils/filters';
import htmlContentLength from '../utils/html-content-length';
import niceDateTime from '../utils/nice-date-time';
import shortenNumber from '../utils/shorten-number';
import showToast from '../utils/show-toast';
import states, { statusKey } from '../utils/states';
import statusPeek from '../utils/status-peek';
import store from '../utils/store';
import { getCurrentAccountNS } from '../utils/store-utils';
import { assignFollowedTags } from '../utils/timeline-utils';
import useTitle from '../utils/useTitle';

const FILTER_CONTEXT = 'home';

const RANGES = [
  { label: 'last 1 hour', value: 1 },
  { label: 'last 2 hours', value: 2 },
  { label: 'last 3 hours', value: 3 },
  { label: 'last 4 hours', value: 4 },
  { label: 'last 5 hours', value: 5 },
  { label: 'last 6 hours', value: 6 },
  { label: 'last 7 hours', value: 7 },
  { label: 'last 8 hours', value: 8 },
  { label: 'last 9 hours', value: 9 },
  { label: 'last 10 hours', value: 10 },
  { label: 'last 11 hours', value: 11 },
  { label: 'last 12 hours', value: 12 },
  { label: 'beyond 12 hours', value: 13 },
];

const FILTER_LABELS = [
  'Original',
  'Replies',
  'Boosts',
  'Followed tags',
  'Groups',
  'Filtered',
];
const FILTER_SORTS = [
  'createdAt',
  'repliesCount',
  'favouritesCount',
  'reblogsCount',
  'density',
];
const FILTER_GROUPS = [null, 'account'];
const FILTER_VALUES = {
  Filtered: 'filtered',
  Groups: 'group',
  Boosts: 'boost',
  Replies: 'reply',
  'Followed tags': 'followedTags',
  Original: 'original',
};
const FILTER_CATEGORY_TEXT = {
  Filtered: 'filtered posts',
  Groups: 'group posts',
  Boosts: 'boosts',
  Replies: 'replies',
  'Followed tags': 'followed-tag posts',
  Original: 'original posts',
};
const SORT_BY_TEXT = {
  // asc, desc
  createdAt: ['oldest', 'latest'],
  repliesCount: ['fewest replies', 'most replies'],
  favouritesCount: ['fewest likes', 'most likes'],
  reblogsCount: ['fewest boosts', 'most boosts'],
  density: ['least dense', 'most dense'],
};

function Catchup() {
  useTitle('Catch-up', '/catchup');
  const { masto, instance } = api();
  const [searchParams, setSearchParams] = useSearchParams();
  const id = searchParams.get('id');
  const [uiState, setUIState] = useState('start');
  const [showTopLinks, setShowTopLinks] = useState(false);

  const currentAccount = useMemo(() => {
    return store.session.get('currentAccount');
  }, []);
  const isSelf = (accountID) => accountID === currentAccount;

  async function fetchHome({ maxCreatedAt }) {
    const maxCreatedAtDate = maxCreatedAt ? new Date(maxCreatedAt) : null;
    console.debug('fetchHome', maxCreatedAtDate);
    const allResults = [];
    const homeIterator = masto.v1.timelines.home.list({ limit: 40 });
    mainloop: while (true) {
      try {
        const results = await homeIterator.next();
        const { value } = results;
        if (value?.length) {
          // This ignores maxCreatedAt filter, but it's ok for now
          await assignFollowedTags(value, instance);
          let addedResults = false;
          for (let i = 0; i < value.length; i++) {
            const item = value[i];
            const createdAtDate = new Date(item.createdAt);
            if (!maxCreatedAtDate || createdAtDate >= maxCreatedAtDate) {
              // Filtered
              const selfPost = isSelf(
                item.reblog?.account?.id || item.account.id,
              );
              const filterInfo =
                !selfPost &&
                isFiltered(
                  item.reblog?.filtered || item.filtered,
                  FILTER_CONTEXT,
                );
              if (filterInfo?.action === 'hide') continue;
              item._filtered = filterInfo;

              // Followed tags
              const sKey = statusKey(item.id, instance);
              item._followedTags = states.statusFollowedTags[sKey]
                ? [...states.statusFollowedTags[sKey]]
                : [];

              allResults.push(item);
              addedResults = true;
            } else {
              // Don't immediately stop, still add the other items that might still be within range
              // break mainloop;
            }
            // Only stop when ALL items are outside of range
            if (!addedResults) {
              break mainloop;
            }
          }
        } else {
          break mainloop;
        }
        // Pause 1s
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        console.error(e);
        break mainloop;
      }
    }

    // Post-process all results
    // 1. Threadify - tag 1st-post in a thread
    allResults.forEach((status) => {
      if (status?.inReplyToId) {
        const replyToStatus = allResults.find(
          (s) => s.id === status.inReplyToId,
        );
        if (replyToStatus && !replyToStatus.inReplyToId) {
          replyToStatus._thread = true;
        }
      }
    });

    return allResults;
  }

  const [posts, setPosts] = useState([]);
  const catchupRangeRef = useRef();
  const NS = useMemo(() => getCurrentAccountNS(), []);
  const handleCatchupClick = useCallback(async ({ duration } = {}) => {
    const now = Date.now();
    const maxCreatedAt = duration ? now - duration : null;
    setUIState('loading');
    const results = await fetchHome({ maxCreatedAt });
    // Namespaced by account ID
    // Possible conflict if ID matches between different accounts from different instances
    const catchupID = `${NS}-${uid()}`;
    try {
      await db.catchup.set(catchupID, {
        id: catchupID,
        posts: results,
        count: results.length,
        startAt: maxCreatedAt,
        endAt: now,
      });
      setSearchParams({ id: catchupID });
    } catch (e) {
      console.error(e, results);
    }
  }, []);

  useEffect(() => {
    if (id) {
      (async () => {
        const catchup = await db.catchup.get(id);
        if (catchup) {
          catchup.posts.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
          setPosts(catchup.posts);
          setUIState('results');
        }
      })();
    } else if (uiState === 'results') {
      setPosts([]);
      setUIState('start');
    }
  }, [id]);

  const [reloadCatchupsCount, reloadCatchups] = useReducer((c) => c + 1, 0);
  const [lastCatchupEndAt, setLastCatchupEndAt] = useState(null);
  const [prevCatchups, setPrevCatchups] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const catchups = await db.catchup.keys();
        if (catchups.length) {
          const ns = getCurrentAccountNS();
          const ownKeys = catchups.filter((key) => key.startsWith(`${ns}-`));
          if (ownKeys.length) {
            let ownCatchups = await db.catchup.getMany(ownKeys);
            ownCatchups.sort((a, b) => b.endAt - a.endAt);

            // Split to 1st 3 last catchups, and the rest
            let lastCatchups = ownCatchups.slice(0, 3);
            let restCatchups = ownCatchups.slice(3);

            const trimmedCatchups = lastCatchups.map((c) => {
              const { id, count, startAt, endAt } = c;
              return {
                id,
                count,
                startAt,
                endAt,
              };
            });
            setPrevCatchups(trimmedCatchups);
            setLastCatchupEndAt(lastCatchups[0].endAt);

            // GC time
            ownCatchups = null;
            lastCatchups = null;

            queueMicrotask(() => {
              if (restCatchups.length) {
                // delete them
                db.catchup
                  .delMany(restCatchups.map((c) => c.id))
                  .then(() => {
                    // GC time
                    restCatchups = null;
                  })
                  .catch((e) => {
                    console.error(e);
                  });
              }
            });

            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
      setPrevCatchups([]);
    })();
  }, [reloadCatchupsCount]);
  useEffect(() => {
    if (uiState === 'start') {
      reloadCatchups();
    }
  }, [uiState === 'start']);

  const [filterCounts, links] = useMemo(() => {
    let filtereds = 0,
      groups = 0,
      boosts = 0,
      replies = 0,
      followedTags = 0,
      originals = 0;
    const links = {};
    for (const post of posts) {
      if (post._filtered) {
        filtereds++;
        post.__FILTER = 'filtered';
      } else if (post.group) {
        groups++;
        post.__FILTER = 'group';
      } else if (post.reblog) {
        boosts++;
        post.__FILTER = 'boost';
      } else if (post._followedTags?.length) {
        followedTags++;
        post.__FILTER = 'followedTags';
      } else if (
        post.inReplyToId &&
        post.inReplyToAccountId !== post.account?.id
      ) {
        replies++;
        post.__FILTER = 'reply';
      } else {
        originals++;
        post.__FILTER = 'original';
      }

      const thePost = post.reblog || post;
      if (
        post.__FILTER !== 'filtered' &&
        thePost.card?.url &&
        thePost.card?.image &&
        thePost.card?.type === 'link'
      ) {
        const { card, favouritesCount, reblogsCount } = thePost;
        let { url } = card;
        url = url.replace(/\/$/, '');
        if (!links[url]) {
          links[url] = {
            postID: thePost.id,
            card,
            shared: 1,
            sharers: [post.account],
            likes: favouritesCount,
            boosts: reblogsCount,
          };
        } else {
          if (links[url].sharers.find((a) => a.id === post.account.id)) {
            continue;
          }
          links[url].shared++;
          links[url].sharers.push(post.account);
          if (links[url].postID !== thePost.id) {
            links[url].likes += favouritesCount;
            links[url].boosts += reblogsCount;
          }
        }
      }
    }

    let topLinks = [];
    for (const link in links) {
      topLinks.push({
        url: link,
        ...links[link],
      });
    }
    topLinks.sort((a, b) => {
      if (a.shared > b.shared) return -1;
      if (a.shared < b.shared) return 1;
      if (a.boosts > b.boosts) return -1;
      if (a.boosts < b.boosts) return 1;
      if (a.likes > b.likes) return -1;
      if (a.likes < b.likes) return 1;
      return 0;
    });

    // Slice links to shared > 1 but min 10 links
    if (topLinks.length > 10) {
      linksLoop: for (let i = 10; i < topLinks.length; i++) {
        const { shared } = topLinks[i];
        if (shared <= 1) {
          topLinks = topLinks.slice(0, i);
          break linksLoop;
        }
      }
    }

    return [
      {
        Filtered: filtereds,
        Groups: groups,
        Boosts: boosts,
        Replies: replies,
        'Followed tags': followedTags,
        Original: originals,
      },
      topLinks,
    ];
  }, [posts]);

  const [selectedFilterCategory, setSelectedFilterCategory] = useState('All');
  const [selectedAuthor, setSelectedAuthor] = useState(null);

  const [range, setRange] = useState(1);

  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('asc');
  const [groupBy, setGroupBy] = useState(null);

  const [filteredPosts, authors, authorCounts] = useMemo(() => {
    const authorsHash = {};
    const authorCountsMap = new Map();

    let filteredPosts = posts.filter((post) => {
      const postFilterMatches =
        selectedFilterCategory === 'All' ||
        post.__FILTER === FILTER_VALUES[selectedFilterCategory];

      if (postFilterMatches) {
        authorsHash[post.account.id] = post.account;
        authorCountsMap.set(
          post.account.id,
          (authorCountsMap.get(post.account.id) || 0) + 1,
        );
      }

      return postFilterMatches;
    });

    // Deduplicate boosts
    const boostedPosts = {};
    filteredPosts.forEach((post) => {
      if (post.reblog) {
        if (boostedPosts[post.reblog.id]) {
          if (boostedPosts[post.reblog.id].__BOOSTERS) {
            boostedPosts[post.reblog.id].__BOOSTERS.add(post.account);
          } else {
            boostedPosts[post.reblog.id].__BOOSTERS = new Set([post.account]);
          }
          post.__HIDDEN = true;
        } else {
          boostedPosts[post.reblog.id] = post;
        }
      }
    });

    if (selectedAuthor && authorCountsMap.has(selectedAuthor)) {
      filteredPosts = filteredPosts.filter(
        (post) =>
          post.account.id === selectedAuthor ||
          [...(post.__BOOSTERS || [])].find((a) => a.id === selectedAuthor),
      );
    }

    return [filteredPosts, authorsHash, Object.fromEntries(authorCountsMap)];
  }, [selectedFilterCategory, selectedAuthor, posts]);

  const filteredPostsMap = useMemo(() => {
    const map = {};
    filteredPosts.forEach((post) => {
      map[post.id] = post;
    });
    return map;
  }, [filteredPosts]);

  const authorCountsList = useMemo(
    () =>
      Object.keys(authorCounts).sort(
        (a, b) => authorCounts[b] - authorCounts[a],
      ),
    [authorCounts],
  );

  const sortedFilteredPosts = useMemo(() => {
    const authorIndices = {};
    authorCountsList.forEach((authorID, index) => {
      authorIndices[authorID] = index;
    });
    return filteredPosts
      .filter((post) => !post.__HIDDEN)
      .sort((a, b) => {
        if (groupBy === 'account') {
          const aAccountID = a.account.id;
          const bAccountID = b.account.id;
          const aIndex = authorIndices[aAccountID];
          const bIndex = authorIndices[bAccountID];
          const order = aIndex - bIndex;
          if (order !== 0) {
            return order;
          }
        }
        if (sortBy !== 'createdAt') {
          a = a.reblog || a;
          b = b.reblog || b;
          if (sortBy !== 'density' && a[sortBy] === b[sortBy]) {
            return a.createdAt > b.createdAt ? 1 : -1;
          }
        }
        if (sortBy === 'density') {
          const aDensity = postDensity(a);
          const bDensity = postDensity(b);
          if (sortOrder === 'asc') {
            return aDensity > bDensity ? 1 : -1;
          } else {
            return bDensity > aDensity ? 1 : -1;
          }
        }
        if (sortOrder === 'asc') {
          return a[sortBy] > b[sortBy] ? 1 : -1;
        } else {
          return b[sortBy] > a[sortBy] ? 1 : -1;
        }
      });
  }, [filteredPosts, sortBy, sortOrder, groupBy, authorCountsList]);

  const prevGroup = useRef(null);

  const authorsListParent = useRef(null);
  const autoAnimated = useRef(false);
  useEffect(() => {
    if (posts.length > 100 || autoAnimated.current) return;
    if (authorsListParent.current) {
      autoAnimate(authorsListParent.current, {
        duration: 200,
      });
      autoAnimated.current = true;
    }
  }, [posts, authorsListParent]);

  const postsBarType = posts.length > 160 ? '3d' : '2d';

  const postsBar = useMemo(() => {
    if (postsBarType !== '2d') return null;
    return posts.map((post) => {
      // If part of filteredPosts
      const isFiltered = filteredPostsMap[post.id];
      return (
        <span
          key={post.id}
          class={`post-dot ${isFiltered ? 'post-dot-highlight' : ''}`}
        />
      );
    });
  }, [filteredPostsMap]);

  const postsBins = useMemo(() => {
    if (postsBarType !== '3d') return null;
    if (!posts?.length) return null;
    const bins = binByTime(posts, 'createdAt', 320);
    return bins.map((posts, i) => {
      return (
        <div class="posts-bin" key={i}>
          {posts.map((post) => {
            const isFiltered = filteredPostsMap[post.id];
            return (
              <span
                key={post.id}
                class={`post-dot ${isFiltered ? 'post-dot-highlight' : ''}`}
              />
            );
          })}
        </div>
      );
    });
  }, [filteredPostsMap]);

  const scrollableRef = useRef(null);

  // if range value exceeded lastCatchupEndAt, show error
  const lastCatchupRange = useMemo(() => {
    // return hour, not ms
    if (!lastCatchupEndAt) return null;
    return (Date.now() - lastCatchupEndAt) / 1000 / 60 / 60;
  }, [lastCatchupEndAt, range]);

  useEffect(() => {
    if (uiState !== 'results') return;
    const authorUsername =
      selectedAuthor && authors[selectedAuthor]
        ? authors[selectedAuthor].username
        : '';
    const sortOrderIndex = sortOrder === 'asc' ? 0 : 1;
    const groupByText = {
      account: 'authors',
    };
    let toast = showToast({
      duration: 5_000, // 5 seconds
      text: `Showing ${
        FILTER_CATEGORY_TEXT[selectedFilterCategory] || 'all posts'
      }${authorUsername ? ` by @${authorUsername}` : ''}, ${
        SORT_BY_TEXT[sortBy][sortOrderIndex]
      } first${
        !!groupBy
          ? `, grouped by ${groupBy === 'account' ? groupByText[groupBy] : ''}`
          : ''
      }`,
    });
    return () => {
      toast?.hideToast?.();
    };
  }, [
    uiState,
    selectedFilterCategory,
    selectedAuthor,
    sortBy,
    sortOrder,
    groupBy,
    authors,
  ]);

  useEffect(() => {
    if (selectedAuthor) {
      if (authors[selectedAuthor]) {
        // Check if author is visible and within the scrollable area viewport
        const authorElement = authorsListParent.current.querySelector(
          `[data-author="${selectedAuthor}"]`,
        );
        const scrollableRect =
          authorsListParent.current?.getBoundingClientRect();
        const authorRect = authorElement?.getBoundingClientRect();
        console.log({
          sLeft: scrollableRect.left,
          sRight: scrollableRect.right,
          aLeft: authorRect.left,
          aRight: authorRect.right,
        });
        if (
          authorRect.left < scrollableRect.left ||
          authorRect.right > scrollableRect.right
        ) {
          authorElement.scrollIntoView({
            block: 'nearest',
            inline: 'center',
            behavior: 'smooth',
          });
        } else if (authorRect.top < 0) {
          authorElement.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
            behavior: 'smooth',
          });
        }
      }
    }
  }, [selectedAuthor, authors]);

  const [showHelp, setShowHelp] = useState(false);

  const itemsSelector = '.catchup-list > li > a';
  const jRef = useHotkeys(
    'j',
    () => {
      const activeItem = document.activeElement.closest(itemsSelector);
      const activeItemRect = activeItem?.getBoundingClientRect();
      const allItems = Array.from(
        scrollableRef.current.querySelectorAll(itemsSelector),
      );
      if (
        activeItem &&
        activeItemRect.top < scrollableRef.current.clientHeight &&
        activeItemRect.bottom > 0
      ) {
        const activeItemIndex = allItems.indexOf(activeItem);
        const nextItem = allItems[activeItemIndex + 1];
        if (nextItem) {
          nextItem.focus();
          nextItem.scrollIntoView({
            block: 'center',
            inline: 'center',
            behavior: 'smooth',
          });
        }
      } else {
        const topmostItem = allItems.find((item) => {
          const itemRect = item.getBoundingClientRect();
          return itemRect.top >= 0;
        });
        if (topmostItem) {
          topmostItem.focus();
          topmostItem.scrollIntoView({
            block: 'nearest',
            inline: 'center',
            behavior: 'smooth',
          });
        }
      }
    },
    {
      preventDefault: true,
      ignoreModifiers: true,
    },
  );

  const kRef = useHotkeys(
    'k',
    () => {
      const activeItem = document.activeElement.closest(itemsSelector);
      const activeItemRect = activeItem?.getBoundingClientRect();
      const allItems = Array.from(
        scrollableRef.current.querySelectorAll(itemsSelector),
      );
      if (
        activeItem &&
        activeItemRect.top < scrollableRef.current.clientHeight &&
        activeItemRect.bottom > 0
      ) {
        const activeItemIndex = allItems.indexOf(activeItem);
        let prevItem = allItems[activeItemIndex - 1];
        if (prevItem) {
          prevItem.focus();
          prevItem.scrollIntoView({
            block: 'center',
            inline: 'center',
            behavior: 'smooth',
          });
        }
      } else {
        const topmostItem = allItems.find((item) => {
          const itemRect = item.getBoundingClientRect();
          return itemRect.top >= 44 && itemRect.left >= 0;
        });
        if (topmostItem) {
          topmostItem.focus();
          topmostItem.scrollIntoView({
            block: 'nearest',
            inline: 'center',
            behavior: 'smooth',
          });
        }
      }
    },
    {
      preventDefault: true,
      ignoreModifiers: true,
    },
  );

  const hlRef = useHotkeys(
    'h, l',
    (_, handler) => {
      // Go next/prev selectedAuthor in authorCountsList list
      const key = handler.keys[0];
      if (selectedAuthor) {
        const index = authorCountsList.indexOf(selectedAuthor);
        if (key === 'h') {
          if (index > 0 && index < authorCountsList.length) {
            setSelectedAuthor(authorCountsList[index - 1]);
            scrollableRef.current?.focus();
          }
        } else if (key === 'l') {
          if (index < authorCountsList.length - 1 && index >= 0) {
            setSelectedAuthor(authorCountsList[index + 1]);
            scrollableRef.current?.focus();
          }
        }
      } else if (key === 'l') {
        setSelectedAuthor(authorCountsList[0]);
        scrollableRef.current?.focus();
      }
    },
    {
      preventDefault: true,
      ignoreModifiers: true,
      enableOnFormTags: ['input'],
    },
  );

  const escRef = useHotkeys(
    'esc',
    () => {
      setSelectedAuthor(null);
      scrollableRef.current?.focus();
    },
    {
      preventDefault: true,
      ignoreModifiers: true,
      enableOnFormTags: ['input'],
    },
  );

  const dotRef = useHotkeys(
    '.',
    () => {
      scrollableRef.current?.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    },
    {
      preventDefault: true,
      ignoreModifiers: true,
      enableOnFormTags: ['input'],
    },
  );

  return (
    <div
      ref={(node) => {
        scrollableRef.current = node;
        jRef.current = node;
        kRef.current = node;
        hlRef.current = node;
        escRef.current = node;
      }}
      id="catchup-page"
      class="deck-container"
      tabIndex="-1"
    >
      <div class="timeline-deck deck wide">
        <header
          class={`${uiState === 'loading' ? 'loading' : ''}`}
          onClick={(e) => {
            if (!e.target.closest('a, button')) {
              scrollableRef.current?.scrollTo({
                top: 0,
                behavior: 'smooth',
              });
            }
          }}
        >
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
              {uiState === 'results' && (
                <Link to="/catchup" class="button plain">
                  <Icon icon="history2" size="l" />
                </Link>
              )}
              {uiState === 'start' && (
                <Link to="/" class="button plain">
                  <Icon icon="home" size="l" />
                </Link>
              )}
            </div>
            <h1>
              {uiState !== 'start' && (
                <>
                  Catch-up <sup>beta</sup>
                </>
              )}
            </h1>
            <div class="header-side">
              {uiState !== 'start' && uiState !== 'loading' && (
                <button
                  type="button"
                  class="plain"
                  onClick={() => {
                    setShowHelp(true);
                  }}
                >
                  Help
                </button>
              )}
            </div>
          </div>
        </header>
        <main>
          {uiState === 'start' && (
            <div class="catchup-start">
              <h1>
                Catch-up <sup>beta</sup>
              </h1>
              <details>
                <summary>What is this?</summary>
                <p>
                  Catch-up is a separate timeline for your followings, offering
                  a high-level view at a glance, with a simple, email-inspired
                  interface to effortlessly sort and filter through posts.
                </p>
                <img
                  src={catchupUrl}
                  width="1200"
                  height="900"
                  alt="Preview of Catch-up UI"
                />
                <p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.target.closest('details').open = false;
                    }}
                  >
                    Let's catch up
                  </button>
                </p>
              </details>
              <p>Let's catch up on the posts from your followings.</p>
              <p>
                <b>Show me all posts from…</b>
              </p>
              <div class="catchup-form">
                <input
                  ref={catchupRangeRef}
                  type="range"
                  value={range}
                  min={RANGES[0].value}
                  max={RANGES[RANGES.length - 1].value}
                  step="1"
                  list="catchup-ranges"
                  onChange={(e) => setRange(+e.target.value)}
                />{' '}
                <span
                  style={{
                    width: '8em',
                  }}
                >
                  {RANGES[range - 1].label}
                  <br />
                  <small class="insignificant">
                    {range == RANGES[RANGES.length - 1].value
                      ? 'until the max'
                      : niceDateTime(
                          new Date(Date.now() - range * 60 * 60 * 1000),
                        )}
                  </small>
                </span>
                <datalist id="catchup-ranges">
                  {RANGES.map(({ label, value }) => (
                    <option value={value} label={label} />
                  ))}
                </datalist>{' '}
                <button
                  type="button"
                  onClick={() => {
                    if (range < RANGES[RANGES.length - 1].value) {
                      const duration = range * 60 * 60 * 1000;
                      handleCatchupClick({ duration });
                    } else {
                      handleCatchupClick();
                    }
                  }}
                >
                  Catch up
                </button>
              </div>
              {lastCatchupRange && range > lastCatchupRange && (
                <p class="catchup-info">
                  <Icon icon="info" /> Overlaps with your last catch-up
                </p>
              )}
              <p class="insignificant">
                <small>
                  Note: your instance might only show a maximum of 800 posts in
                  the Home timeline regardless of the time range. Could be less
                  or more.
                </small>
              </p>
              {!!prevCatchups?.length && (
                <div class="catchup-prev">
                  <p>Previously…</p>
                  <ul>
                    {prevCatchups.map((pc) => (
                      <li key={pc.id}>
                        <Link to={`/catchup?id=${pc.id}`}>
                          <Icon icon="history2" />{' '}
                          <span>
                            {pc.startAt
                              ? dtf.formatRange(
                                  new Date(pc.startAt),
                                  new Date(pc.endAt),
                                )
                              : `… – ${dtf.format(new Date(pc.endAt))}`}
                          </span>
                        </Link>{' '}
                        <span>
                          <small class="ib insignificant">
                            {pc.count} posts
                          </small>{' '}
                          <button
                            type="button"
                            class="light danger small"
                            onClick={async () => {
                              const yes = confirm('Remove this catch-up?');
                              if (yes) {
                                let t = showToast(`Removing Catch-up ${pc.id}`);
                                await db.catchup.del(pc.id);
                                t?.hideToast?.();
                                showToast(`Catch-up ${pc.id} removed`);
                                reloadCatchups();
                              }
                            }}
                          >
                            <Icon icon="x" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {prevCatchups.length >= 3 && (
                    <p>
                      <small>
                        Note: Only max 3 will be stored. The rest will be
                        automatically removed.
                      </small>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {uiState === 'loading' && (
            <div class="ui-state catchup-start">
              <Loader abrupt />
              <p class="insignificant">Fetching posts…</p>
              <p class="insignificant">This might take a while.</p>
            </div>
          )}
          {uiState === 'results' && (
            <>
              <div class="catchup-header">
                {posts.length > 0 && (
                  <p>
                    <b class="ib">
                      {dtf.formatRange(
                        new Date(posts[0].createdAt),
                        new Date(posts[posts.length - 1].createdAt),
                      )}
                    </b>
                  </p>
                )}
                <aside>
                  <button
                    hidden={
                      selectedFilterCategory === 'All' &&
                      !selectedAuthor &&
                      sortBy === 'createdAt' &&
                      sortOrder === 'asc'
                    }
                    type="button"
                    class="plain4 small"
                    onClick={() => {
                      setSelectedFilterCategory('All');
                      setSelectedAuthor(null);
                      setSortBy('createdAt');
                      setGroupBy(null);
                      setSortOrder('asc');
                    }}
                  >
                    Reset filters
                  </button>
                  {links?.length > 0 && (
                    <button
                      type="button"
                      class="plain small"
                      onClick={() => setShowTopLinks(!showTopLinks)}
                    >
                      Top links{' '}
                      <Icon
                        icon="chevron-down"
                        style={{
                          transform: showTopLinks
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)',
                        }}
                      />
                    </button>
                  )}
                </aside>
              </div>
              <div class="shazam-container no-animation" hidden={!showTopLinks}>
                <div class="shazam-container-inner">
                  <div class="catchup-top-links links-bar">
                    {links.map((link) => {
                      const { card, shared, sharers, likes, boosts } = link;
                      const {
                        blurhash,
                        title,
                        description,
                        url,
                        image,
                        imageDescription,
                        language,
                        width,
                        height,
                        publishedAt,
                      } = card;
                      const domain = new URL(url).hostname
                        .replace(/^www\./, '')
                        .replace(/\/$/, '');
                      let accentColor;
                      if (blurhash) {
                        const averageColor = getBlurHashAverageColor(blurhash);
                        const labAverageColor = rgb2oklab(averageColor);
                        accentColor = oklab2rgb([
                          0.6,
                          labAverageColor[1],
                          labAverageColor[2],
                        ]);
                      }

                      return (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={
                            accentColor
                              ? {
                                  '--accent-color': `rgb(${accentColor.join(
                                    ',',
                                  )})`,
                                  '--accent-alpha-color': `rgba(${accentColor.join(
                                    ',',
                                  )}, 0.4)`,
                                }
                              : {}
                          }
                        >
                          <article>
                            <figure>
                              <img
                                src={image}
                                alt={imageDescription}
                                width={width}
                                height={height}
                                loading="lazy"
                              />
                            </figure>
                            <div class="article-body">
                              <header>
                                <div class="article-meta">
                                  <span class="domain">{domain}</span>{' '}
                                  {!!publishedAt && <>&middot; </>}
                                  {!!publishedAt && (
                                    <>
                                      <RelativeTime
                                        datetime={publishedAt}
                                        format="micro"
                                      />
                                    </>
                                  )}
                                </div>
                                {!!title && (
                                  <h1
                                    class="title"
                                    lang={language}
                                    dir="auto"
                                    title={title}
                                  >
                                    {title}
                                  </h1>
                                )}
                              </header>
                              {!!description && (
                                <p
                                  class="description"
                                  lang={language}
                                  dir="auto"
                                  title={description}
                                >
                                  {description}
                                </p>
                              )}
                              <hr />
                              <p
                                style={{
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Shared by{' '}
                                {sharers.map((s) => {
                                  const { avatarStatic, displayName } = s;
                                  return (
                                    <Avatar
                                      url={avatarStatic}
                                      size="s"
                                      alt={displayName}
                                    />
                                  );
                                })}
                              </p>
                            </div>
                          </article>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
              {posts.length >= 5 &&
                (postsBarType === '3d' ? (
                  <div class="catchup-posts-viz-time-bar">{postsBins}</div>
                ) : (
                  <div class="catchup-posts-viz-bar">{postsBar}</div>
                ))}
              {posts.length >= 2 && (
                <div class="catchup-filters">
                  <label class="filter-cat">
                    <input
                      type="radio"
                      name="filter-cat"
                      checked={selectedFilterCategory.toLowerCase() === 'all'}
                      onChange={() => {
                        setSelectedFilterCategory('All');
                      }}
                    />
                    All <span class="count">{posts.length}</span>
                  </label>
                  {FILTER_LABELS.map(
                    (label) =>
                      !!filterCounts[label] && (
                        <label
                          class="filter-cat"
                          key={label}
                          title={
                            (
                              (filterCounts[label] / posts.length) *
                              100
                            ).toFixed(2) + '%'
                          }
                        >
                          <input
                            type="radio"
                            name="filter-cat"
                            checked={
                              selectedFilterCategory.toLowerCase() ===
                              label.toLowerCase()
                            }
                            onChange={() => {
                              setSelectedFilterCategory(label);
                              // setSelectedAuthor(null);
                            }}
                          />
                          {label}{' '}
                          <span class="count">{filterCounts[label]}</span>
                        </label>
                      ),
                  )}
                </div>
              )}
              {posts.length >= 2 && !!authorCounts && (
                <div
                  class="catchup-filters authors-filters"
                  ref={authorsListParent}
                >
                  {authorCountsList.map((author) => (
                    <label
                      class="filter-author"
                      data-author={author}
                      key={`${author}-${authorCounts[author]}`}
                      // Preact messed up the order sometimes, need additional key besides just `author`
                      // https://github.com/preactjs/preact/issues/2849
                    >
                      <input
                        type="radio"
                        name="filter-author"
                        checked={selectedAuthor === author}
                        onChange={() => {
                          setSelectedAuthor(author);
                          // setGroupBy(null);
                        }}
                        onClick={() => {
                          if (selectedAuthor === author) {
                            setSelectedAuthor(null);
                          }
                        }}
                      />
                      <Avatar
                        url={
                          authors[author].avatarStatic || authors[author].avatar
                        }
                        size="xxl"
                        alt={`${authors[author].displayName} (@${authors[author].username})`}
                      />{' '}
                      <span class="count">{authorCounts[author]}</span>
                      <span class="username">{authors[author].username}</span>
                    </label>
                  ))}
                  {authorCountsList.length > 5 && (
                    <small
                      key="authors-count"
                      style={{
                        whiteSpace: 'nowrap',
                        paddingInline: '1em',
                        opacity: 0.33,
                      }}
                    >
                      {authorCountsList.length} authors
                    </small>
                  )}
                </div>
              )}
              {posts.length >= 2 && (
                <div class="catchup-filters">
                  <span class="filter-label">Sort</span>{' '}
                  <fieldset class="radio-field-group">
                    {FILTER_SORTS.map((key) => (
                      <label
                        class="filter-sort"
                        key={key}
                        onClick={(e) => {
                          if (sortBy === key) {
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
                            createdAt: 'Date',
                            repliesCount: 'Replies',
                            favouritesCount: 'Likes',
                            reblogsCount: 'Boosts',
                            density: 'Density',
                          }[key]
                        }
                        {sortBy === key && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                      </label>
                    ))}
                  </fieldset>
                  {/* <fieldset class="radio-field-group">
                    {['asc', 'desc'].map((key) => (
                      <label class="filter-sort" key={key}>
                        <input
                          type="radio"
                          name="filter-sort-dir"
                          checked={sortOrder === key}
                          onChange={() => {
                            setSortOrder(key);
                          }}
                        />
                        {key === 'asc' ? '↑' : '↓'}
                      </label>
                    ))}
                  </fieldset> */}
                  <span class="filter-label">Group</span>{' '}
                  <fieldset class="radio-field-group">
                    {FILTER_GROUPS.map((key) => (
                      <label class="filter-group" key={key || 'none'}>
                        <input
                          type="radio"
                          name="filter-group"
                          checked={groupBy === key}
                          onChange={() => {
                            setGroupBy(key);
                          }}
                          disabled={key === 'account' && selectedAuthor}
                        />
                        {{
                          account: 'Authors',
                        }[key] || 'None'}
                      </label>
                    ))}
                  </fieldset>
                  {
                    selectedAuthor && authorCountsList.length > 1 ? (
                      <button
                        type="button"
                        class="plain6 small"
                        onClick={() => {
                          setSelectedAuthor(null);
                        }}
                        style={{
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Show all authors
                      </button>
                    ) : null
                    // <button
                    //   type="button"
                    //   class="plain4 small"
                    //   onClick={() => {}}
                    // >
                    //   Group by authors
                    // </button>
                  }
                </div>
              )}
              <ul
                class={`catchup-list catchup-filter-${
                  FILTER_VALUES[selectedFilterCategory] || ''
                } ${sortBy ? `catchup-sort-${sortBy}` : ''} ${
                  selectedAuthor && authors[selectedAuthor]
                    ? `catchup-selected-author`
                    : ''
                } ${groupBy ? `catchup-group-${groupBy}` : ''}`}
              >
                {sortedFilteredPosts.map((post, i) => {
                  const id = post.reblog?.id || post.id;
                  let showSeparator = false;
                  if (groupBy === 'account') {
                    if (
                      prevGroup.current &&
                      post.account.id !== prevGroup.current &&
                      i > 0
                    ) {
                      showSeparator = true;
                    }
                    prevGroup.current = post.account.id;
                  }
                  return (
                    <Fragment key={`${post.id}-${showSeparator}`}>
                      {showSeparator && <li class="separator" />}
                      <IntersectionPostLineItem
                        to={`/${instance}/s/${id}`}
                        post={post}
                        root={scrollableRef.current}
                      />
                    </Fragment>
                  );
                })}
              </ul>
              <footer>
                {filteredPosts.length > 5 && (
                  <p>
                    {selectedFilterCategory === 'Boosts'
                      ? "You don't have to read everything."
                      : "That's all."}{' '}
                    <button
                      type="button"
                      class="textual"
                      onClick={() => {
                        scrollableRef.current.scrollTop = 0;
                      }}
                    >
                      Back to top
                    </button>
                    .
                  </p>
                )}
              </footer>
            </>
          )}
        </main>
      </div>
      {showHelp && (
        <Modal onClose={() => setShowHelp(false)}>
          <div class="sheet" id="catchup-help-sheet">
            <button
              type="button"
              class="sheet-close"
              onClick={() => setShowHelp(false)}
            >
              <Icon icon="x" />
            </button>
            <header>
              <h2>Help</h2>
            </header>
            <main>
              <dl>
                <dt>Top links</dt>
                <dd>
                  Links shared by followings, sorted by shared counts, boosts
                  and likes.
                </dd>
                <dt>Sort: Density</dt>
                <dd>
                  Posts are sorted by information density or depth. Shorter
                  posts are "lighter" while longer posts are "heavier". Posts
                  with photos are "heavier" than posts without photos.
                </dd>
                <dt>Group: Authors</dt>
                <dd>
                  Posts are grouped by authors, sorted by posts count per
                  author.
                </dd>
                <dt>Keyboard shortcuts</dt>
                <dd>
                  <kbd>j</kbd>: Next post
                </dd>
                <dd>
                  <kbd>k</kbd>: Previous post
                </dd>
                <dd>
                  <kbd>l</kbd>: Next author
                </dd>
                <dd>
                  <kbd>h</kbd>: Previous author
                </dd>
                <dd>
                  <kbd>Enter</kbd>: Open post details
                </dd>
                <dd>
                  <kbd>.</kbd>: Scroll to top
                </dd>
              </dl>
            </main>
          </div>
        </Modal>
      )}
    </div>
  );
}

const PostLine = memo(
  function ({ post }) {
    const {
      id,
      account,
      group,
      reblog,
      inReplyToId,
      inReplyToAccountId,
      _followedTags: isFollowedTags,
      _filtered: filterInfo,
      visibility,
      __BOOSTERS,
    } = post;
    const isReplyTo = inReplyToId && inReplyToAccountId !== account.id;
    const isFiltered = !!filterInfo;

    const debugHover = (e) => {
      if (e.shiftKey) {
        console.log({
          ...post,
        });
      }
    };

    return (
      <article
        class={`post-line ${
          group
            ? 'group'
            : reblog
            ? 'reblog'
            : isFollowedTags?.length
            ? 'followed-tags'
            : ''
        } ${isReplyTo ? 'reply-to' : ''} ${
          isFiltered ? 'filtered' : ''
        } visibility-${visibility}`}
        onMouseEnter={debugHover}
      >
        <span class="post-author">
          {reblog ? (
            <span class="post-reblog-avatar">
              <Avatar
                url={account.avatarStatic || account.avatar}
                squircle={account.bot}
              />
              {__BOOSTERS?.size > 0
                ? [...__BOOSTERS].map((b) => (
                    <Avatar url={b.avatarStatic || b.avatar} squircle={b.bot} />
                  ))
                : ''}{' '}
              <Icon icon="rocket" />{' '}
              {/* <Avatar
              url={reblog.account.avatarStatic || reblog.account.avatar}
              squircle={reblog.account.bot}
            /> */}
              <NameText account={reblog.account} showAvatar />
            </span>
          ) : (
            <NameText account={account} showAvatar />
          )}
        </span>
        <PostPeek post={reblog || post} filterInfo={filterInfo} />
        <span class="post-meta">
          <PostStats post={reblog || post} />{' '}
          <RelativeTime
            datetime={new Date(reblog?.createdAt || post.createdAt)}
            format="micro"
          />
        </span>
      </article>
    );
  },
  (oldProps, newProps) => {
    return oldProps?.post?.id === newProps?.post?.id;
  },
);

const IntersectionPostLineItem = ({ root, to, ...props }) => {
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

  return show ? (
    <li>
      <Link to={to}>
        <PostLine {...props} />
      </Link>
    </li>
  ) : (
    <li ref={ref} style={{ height: '4em' }} />
  );
};

// A media speak a thousand words
const MEDIA_DENSITY = 8;
const CARD_DENSITY = 8;
function postDensity(post) {
  const { spoilerText, content, poll, mediaAttachments, card } = post;
  const pollContent = poll?.options?.length
    ? poll.options.reduce((acc, cur) => acc + cur.title, '')
    : '';
  const density =
    (spoilerText.length + htmlContentLength(content) + pollContent.length) /
      140 +
    (mediaAttachments?.length
      ? MEDIA_DENSITY * mediaAttachments.length
      : card?.image
      ? CARD_DENSITY
      : 0);
  return density;
}

const MEDIA_SIZE = 48;

function PostPeek({ post, filterInfo }) {
  const {
    spoilerText,
    sensitive,
    content,
    emojis,
    poll,
    mediaAttachments,
    card,
    inReplyToId,
    inReplyToAccountId,
    account,
    _thread,
  } = post;
  const isThread =
    (inReplyToId && inReplyToAccountId === account.id) || !!_thread;
  const showMedia = !spoilerText && !sensitive;
  const postText = content ? statusPeek(post) : '';

  return (
    <div class="post-peek" title={!spoilerText ? postText : ''}>
      <span class="post-peek-content">
        {!!filterInfo ? (
          <>
            {isThread && (
              <>
                <span class="post-peek-tag post-peek-thread">Thread</span>{' '}
              </>
            )}
            <span class="post-peek-filtered">
              Filtered{filterInfo?.titlesStr ? `: ${filterInfo.titlesStr}` : ''}
            </span>
          </>
        ) : !!spoilerText ? (
          <>
            {isThread && (
              <>
                <span class="post-peek-tag post-peek-thread">Thread</span>{' '}
              </>
            )}
            <span class="post-peek-spoiler">
              <Icon icon="eye-close" /> {spoilerText}
            </span>
          </>
        ) : (
          <div class="post-peek-html">
            {isThread && (
              <>
                <span class="post-peek-tag post-peek-thread">Thread</span>{' '}
              </>
            )}
            {!!content && (
              <div
                dangerouslySetInnerHTML={{
                  __html: emojifyText(content, emojis),
                }}
              />
            )}
            {!!poll?.options?.length &&
              poll.options.map((o) => (
                <div>
                  {poll.multiple ? '▪️' : '•'} {o.title}
                </div>
              ))}
            {!content &&
              mediaAttachments?.length === 1 &&
              mediaAttachments[0].description && (
                <>
                  <span class="post-peek-tag post-peek-alt">ALT</span>{' '}
                  <div>{mediaAttachments[0].description}</div>
                </>
              )}
          </div>
        )}
      </span>
      {!filterInfo && (
        <span class="post-peek-post-content">
          {!!poll && (
            <span class="post-peek-tag post-peek-poll">
              <Icon icon="poll" size="s" />
              Poll
            </span>
          )}
          {!!mediaAttachments?.length
            ? mediaAttachments.map((m) => {
                const mediaURL = m.previewUrl || m.url;
                const remoteMediaURL = m.previewRemoteUrl || m.remoteUrl;
                return (
                  <span key={m.id} class="post-peek-media">
                    {{
                      image:
                        (mediaURL || remoteMediaURL) && showMedia ? (
                          <img
                            src={mediaURL}
                            width={MEDIA_SIZE}
                            height={MEDIA_SIZE}
                            alt={m.description}
                            loading="lazy"
                            onError={(e) => {
                              const { src } = e.target;
                              if (src === mediaURL) {
                                e.target.src = remoteMediaURL;
                              }
                            }}
                          />
                        ) : (
                          <span class="post-peek-faux-media">🖼</span>
                        ),
                      gifv:
                        (mediaURL || remoteMediaURL) && showMedia ? (
                          <img
                            src={mediaURL}
                            width={MEDIA_SIZE}
                            height={MEDIA_SIZE}
                            alt={m.description}
                            loading="lazy"
                            onError={(e) => {
                              const { src } = e.target;
                              if (src === mediaURL) {
                                e.target.src = remoteMediaURL;
                              }
                            }}
                          />
                        ) : (
                          <span class="post-peek-faux-media">🎞️</span>
                        ),
                      video:
                        (mediaURL || remoteMediaURL) && showMedia ? (
                          <img
                            src={mediaURL}
                            width={MEDIA_SIZE}
                            height={MEDIA_SIZE}
                            alt={m.description}
                            loading="lazy"
                            onError={(e) => {
                              const { src } = e.target;
                              if (src === mediaURL) {
                                e.target.src = remoteMediaURL;
                              }
                            }}
                          />
                        ) : (
                          <span class="post-peek-faux-media">📹</span>
                        ),
                      audio: <span class="post-peek-faux-media">🎵</span>,
                    }[m.type] || null}
                  </span>
                );
              })
            : !!card &&
              card.image &&
              showMedia && (
                <span
                  class={`post-peek-media post-peek-card card-${
                    card.type || ''
                  }`}
                >
                  {card.image ? (
                    <img
                      src={card.image}
                      width={MEDIA_SIZE}
                      height={MEDIA_SIZE}
                      alt={
                        card.title || card.description || card.imageDescription
                      }
                      loading="lazy"
                    />
                  ) : (
                    <span class="post-peek-faux-media">🔗</span>
                  )}
                </span>
              )}
        </span>
      )}
    </div>
  );
}

function PostStats({ post }) {
  const { reblogsCount, repliesCount, favouritesCount } = post;
  return (
    <span class="post-stats">
      {repliesCount > 0 && (
        <span class="post-stat-replies">
          <Icon icon="comment2" size="s" /> {shortenNumber(repliesCount)}
        </span>
      )}
      {favouritesCount > 0 && (
        <span class="post-stat-likes">
          <Icon icon="heart" size="s" /> {shortenNumber(favouritesCount)}
        </span>
      )}
      {reblogsCount > 0 && (
        <span class="post-stat-boosts">
          <Icon icon="rocket" size="s" /> {shortenNumber(reblogsCount)}
        </span>
      )}
    </span>
  );
}

const { locale } = new Intl.DateTimeFormat().resolvedOptions();
const dtf = new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
});

function binByTime(data, key, numBins) {
  // Extract dates from data objects
  const dates = data.map((item) => new Date(item[key]));

  // Find minimum and maximum dates directly (avoiding Math.min/max)
  const minDate = dates.reduce(
    (acc, date) => (date < acc ? date : acc),
    dates[0],
  );
  const maxDate = dates.reduce(
    (acc, date) => (date > acc ? date : acc),
    dates[0],
  );

  // Calculate the time span in milliseconds
  const range = maxDate.getTime() - minDate.getTime();

  // Create empty bins and loop through data
  const bins = Array.from({ length: numBins }, () => []);
  data.forEach((item) => {
    const date = new Date(item[key]);
    const normalized = (date.getTime() - minDate.getTime()) / range;
    const binIndex = Math.floor(normalized * (numBins - 1));
    bins[binIndex].push(item);
  });

  return bins;
}

export default Catchup;
