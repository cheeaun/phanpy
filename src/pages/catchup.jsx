import '../components/links-bar.css';
import './catchup.css';

import autoAnimate from '@formkit/auto-animate';
import { getBlurHashAverageColor } from 'fast-blurhash';
import { Fragment } from 'preact';
import { memo } from 'preact/compat';
import { useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import { useSearchParams } from 'react-router-dom';
import { uid } from 'uid/single';

import Avatar from '../components/avatar';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import NameText from '../components/name-text';
import NavMenu from '../components/nav-menu';
import RelativeTime from '../components/relative-time';
import { api } from '../utils/api';
import { oklab2rgb, rgb2oklab } from '../utils/color-utils';
import db from '../utils/db';
import emojifyText from '../utils/emojify-text';
import { isFiltered } from '../utils/filters';
import getHTMLText from '../utils/getHTMLText';
import niceDateTime from '../utils/nice-date-time';
import shortenNumber from '../utils/shorten-number';
import showToast from '../utils/show-toast';
import states, { statusKey } from '../utils/states';
import store from '../utils/store';
import { getCurrentAccountNS } from '../utils/store-utils';
import { assignFollowedTags } from '../utils/timeline-utils';
import useTitle from '../utils/useTitle';

const FILTER_CONTEXT = 'home';

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
  async function handleCatchupClick({ duration } = {}) {
    const now = Date.now();
    const maxCreatedAt = duration ? now - duration : null;
    setUIState('loading');
    const results = await fetchHome({ maxCreatedAt });
    // Namespaced by account ID
    // Possible conflict if ID matches between different accounts from different instances
    const ns = getCurrentAccountNS();
    const catchupID = `${ns}-${uid()}`;
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
      // setUIState('error');
    }
    // setPosts(results);
    // setUIState('results');
  }

  useEffect(() => {
    if (id) {
      (async () => {
        const catchup = await db.catchup.get(id);
        if (catchup) {
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
  const ranges = [
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

  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('asc');
  const [groupBy, setGroupBy] = useState(null);

  const [filteredPosts, authors, authorCounts] = useMemo(() => {
    let authors = [];
    const authorCounts = {};
    let filteredPosts = posts.filter((post) => {
      return (
        selectedFilterCategory === 'All' ||
        post.__FILTER ===
          {
            Filtered: 'filtered',
            Groups: 'group',
            Boosts: 'boost',
            Replies: 'reply',
            'Followed tags': 'followedTags',
            Original: 'original',
          }[selectedFilterCategory]
      );
    });

    filteredPosts.forEach((post) => {
      if (!authors.find((a) => a.id === post.account.id)) {
        authors.push(post.account);
      }
      authorCounts[post.account.id] = (authorCounts[post.account.id] || 0) + 1;
    });

    if (selectedAuthor && authorCounts[selectedAuthor]) {
      filteredPosts = filteredPosts.filter(
        (post) => post.account.id === selectedAuthor,
      );
    }

    const authorsHash = {};
    for (const author of authors) {
      authorsHash[author.id] = author;
    }

    return [filteredPosts, authorsHash, authorCounts];
  }, [selectedFilterCategory, selectedAuthor, posts]);

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
    return filteredPosts.sort((a, b) => {
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
        if (a[sortBy] === b[sortBy]) {
          return a.createdAt > b.createdAt ? 1 : -1;
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
  useEffect(() => {
    if (authorsListParent.current && authorCountsList.length < 30) {
      autoAnimate(authorsListParent.current, {
        duration: 200,
      });
    }
  }, [selectedFilterCategory, authorCountsList, authorsListParent]);

  const postsBar = useMemo(() => {
    return posts.map((post) => {
      // If part of filteredPosts
      const isFiltered = filteredPosts.find((p) => p.id === post.id);
      return (
        <span
          key={post.id}
          class={`post-dot ${isFiltered ? 'post-dot-highlight' : ''}`}
        />
      );
    });
  }, [posts, filteredPosts]);

  const scrollableRef = useRef(null);

  // if range value exceeded lastCatchupEndAt, show error
  const lastCatchupRange = useMemo(() => {
    // return hour, not ms
    if (!lastCatchupEndAt) return null;
    return (Date.now() - lastCatchupEndAt) / 1000 / 60 / 60;
  }, [lastCatchupEndAt, range]);

  useEffect(() => {
    if (uiState !== 'results') return;
    const filterCategoryText = {
      Filtered: 'filtered posts',
      Groups: 'group posts',
      Boosts: 'boosts',
      Replies: 'replies',
      'Followed tags': 'followed-tag posts',
      Original: 'original posts',
    };
    const authorUsername =
      selectedAuthor && authors[selectedAuthor]
        ? authors[selectedAuthor].username
        : '';
    const sortOrderIndex = sortOrder === 'asc' ? 0 : 1;
    const sortByText = {
      // asc, desc
      createdAt: ['oldest', 'latest'],
      repliesCount: ['fewest replies', 'most replies'],
      favouritesCount: ['fewest likes', 'most likes'],
      reblogsCount: ['fewest boosts', 'most boosts'],
    };
    const groupByText = {
      account: 'authors',
    };
    let toast = showToast(
      `Showing ${filterCategoryText[selectedFilterCategory] || 'all posts'}${
        authorUsername ? ` by @${authorUsername}` : ''
      }, ${sortByText[sortBy][sortOrderIndex]} first${
        !!groupBy
          ? `, grouped by ${groupBy === 'account' ? groupByText[groupBy] : ''}`
          : ''
      }`,
    );
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

  return (
    <div
      ref={scrollableRef}
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
              <Link to="/" class="button plain home-button">
                <Icon icon="home" size="l" />
              </Link>
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
                    setSearchParams({});
                  }}
                >
                  Start over
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
              <p>Let's catch up on the posts from your followings.</p>
              <p>
                <b>Show me all posts from…</b>
              </p>
              <div class="catchup-form">
                <input
                  ref={catchupRangeRef}
                  type="range"
                  value={range}
                  min={ranges[0].value}
                  max={ranges[ranges.length - 1].value}
                  step="1"
                  list="catchup-ranges"
                  onChange={(e) => setRange(+e.target.value)}
                />{' '}
                <span
                  style={{
                    width: '8em',
                  }}
                >
                  {ranges[range - 1].label}
                  <br />
                  <small class="insignificant">
                    {range == ranges[ranges.length - 1].value
                      ? 'until the max'
                      : niceDateTime(
                          new Date(Date.now() - range * 60 * 60 * 1000),
                        )}
                  </small>
                </span>
                <datalist id="catchup-ranges">
                  {ranges.map(({ label, value }) => (
                    <option value={value} label={label} />
                  ))}
                </datalist>{' '}
                <button
                  type="button"
                  onClick={() => {
                    if (range < ranges[ranges.length - 1].value) {
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
                          <Icon icon="history" />{' '}
                          <span>
                            {formatRange(
                              new Date(pc.startAt),
                              new Date(pc.endAt),
                            )}{' '}
                            <small class="ib insignificant">
                              {pc.count} posts
                            </small>
                          </span>
                        </Link>{' '}
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
                      {formatRange(
                        new Date(posts[posts.length - 1].createdAt),
                        new Date(posts[0].createdAt),
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
                                  <h1 class="title" lang={language} dir="auto">
                                    {title}
                                  </h1>
                                )}
                              </header>
                              {!!description && (
                                <p
                                  class="description"
                                  lang={language}
                                  dir="auto"
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
              {posts.length >= 5 && (
                <div class="catchup-posts-viz-bar">{postsBar}</div>
              )}
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
                  {[
                    'Original',
                    'Replies',
                    'Boosts',
                    'Followed tags',
                    'Groups',
                    'Filtered',
                  ].map(
                    (label) =>
                      !!filterCounts[label] && (
                        <label class="filter-cat" key={label}>
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
                    {[
                      'createdAt',
                      'repliesCount',
                      'favouritesCount',
                      'reblogsCount',
                      // 'account',
                    ].map((key) => (
                      <label class="filter-sort" key={key}>
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
                          // disabled={key === 'account' && selectedAuthor}
                        />
                        {
                          {
                            createdAt: 'Date',
                            repliesCount: 'Replies',
                            favouritesCount: 'Likes',
                            reblogsCount: 'Boosts',
                          }[key]
                        }
                      </label>
                    ))}
                  </fieldset>
                  <fieldset class="radio-field-group">
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
                  </fieldset>
                  <span class="filter-label">Group</span>{' '}
                  <fieldset class="radio-field-group">
                    {[null, 'account'].map((key) => (
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
                        class="plain small"
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
              <ul class="catchup-list">
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
                      <li>
                        <Link to={`/${instance}/s/${id}`}>
                          <IntersectionPostLine
                            post={post}
                            root={scrollableRef.current}
                          />
                        </Link>
                      </li>
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
              />{' '}
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

const IntersectionPostLine = ({ root, ...props }) => {
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
    <PostLine {...props} />
  ) : (
    <div ref={ref} style={{ height: '4em' }} />
  );
};

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
  const postText = content ? getHTMLText(content) : '';

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
            {content ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: emojifyText(content, emojis),
                }}
              />
            ) : mediaAttachments?.length === 1 &&
              mediaAttachments[0].description ? (
              <>
                <span class="post-peek-tag post-peek-alt">ALT</span>{' '}
                <div>{mediaAttachments[0].description}</div>
              </>
            ) : null}
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
        <>
          <Icon icon="comment2" size="s" /> {shortenNumber(repliesCount)}
        </>
      )}
      {favouritesCount > 0 && (
        <>
          <Icon icon="heart" size="s" /> {shortenNumber(favouritesCount)}
        </>
      )}
      {reblogsCount > 0 && (
        <>
          <Icon icon="rocket" size="s" /> {shortenNumber(reblogsCount)}
        </>
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
function formatRange(startDate, endDate) {
  return dtf.formatRange(startDate, endDate);
}

export default Catchup;
