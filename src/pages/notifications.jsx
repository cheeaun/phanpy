import './notifications.css';

import { msg } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Fragment } from 'preact';
import { memo } from 'preact/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { InView } from 'react-intersection-observer';
import { useSearchParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';
import { subscribeKey } from 'valtio/utils';

import AccountBlock from '../components/account-block';
import FollowRequestButtons from '../components/follow-request-buttons';
import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import Modal from '../components/modal';
import NavMenu from '../components/nav-menu';
import Notification from '../components/notification';
import Status from '../components/status';
import { api } from '../utils/api';
import enhanceContent from '../utils/enhance-content';
import FilterContext from '../utils/filter-context';
import groupNotifications, {
  groupNotifications2,
  massageNotifications2,
} from '../utils/group-notifications';
import handleContentLinks from '../utils/handle-content-links';
import mem from '../utils/mem';
import niceDateTime from '../utils/nice-date-time';
import { getRegistration } from '../utils/push-notifications';
import shortenNumber from '../utils/shorten-number';
import showToast from '../utils/show-toast';
import states, { saveStatus } from '../utils/states';
import store from '../utils/store';
import { getCurrentInstance } from '../utils/store-utils';
import supports from '../utils/supports';
import usePageVisibility from '../utils/usePageVisibility';
import useScroll from '../utils/useScroll';
import useTitle from '../utils/useTitle';

const NOTIFICATIONS_LIMIT = 80;
const NOTIFICATIONS_GROUPED_LIMIT = 20;
const emptySearchParams = new URLSearchParams();

const scrollIntoViewOptions = {
  block: 'center',
  inline: 'center',
  behavior: 'smooth',
};

const memSupportsGroupedNotifications = mem(
  () => supports('@mastodon/grouped-notifications'),
  {
    maxAge: 1000 * 60 * 5, // 5 minutes
  },
);

export function mastoFetchNotifications(opts = {}) {
  const { masto } = api();
  if (
    states.settings.groupedNotificationsAlpha &&
    memSupportsGroupedNotifications()
  ) {
    // https://github.com/mastodon/mastodon/pull/29889
    return masto.v2.notifications.list({
      limit: NOTIFICATIONS_GROUPED_LIMIT,
      ...opts,
    });
  } else {
    return masto.v1.notifications.list({
      limit: NOTIFICATIONS_LIMIT,
      ...opts,
    });
  }
}

export function getGroupedNotifications(notifications) {
  if (
    states.settings.groupedNotificationsAlpha &&
    memSupportsGroupedNotifications()
  ) {
    return groupNotifications2(notifications);
  } else {
    return groupNotifications(notifications);
  }
}

const NOTIFICATIONS_POLICIES = [
  'forNotFollowing',
  'forNotFollowers',
  'forNewAccounts',
  'forPrivateMentions',
  'forLimitedAccounts',
];
const NOTIFICATIONS_POLICIES_TEXT = {
  forNotFollowing: msg`You don't follow`,
  forNotFollowers: msg`Who don't follow you`,
  forNewAccounts: msg`With a new account`,
  forPrivateMentions: msg`Who unsolicitedly private mention you`,
  forLimitedAccounts: msg`Who are limited by server moderators`,
};

function Notifications({ columnMode }) {
  const { _, t } = useLingui();
  useTitle(t`Notifications`, '/notifications');
  const { masto, instance } = api();
  const snapStates = useSnapshot(states);
  const [uiState, setUIState] = useState('default');
  const [searchParams] = columnMode ? [emptySearchParams] : useSearchParams();
  const notificationID = searchParams.get('id');
  const notificationAccessToken = searchParams.get('access_token');
  const [showMore, setShowMore] = useState(false);
  const [onlyMentions, setOnlyMentions] = useState(false);
  const scrollableRef = useRef();
  const { nearReachEnd, scrollDirection, reachStart, nearReachStart } =
    useScroll({
      scrollableRef,
    });
  const hiddenUI = scrollDirection === 'end' && !nearReachStart;
  const [followRequests, setFollowRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  console.debug('RENDER Notifications');

  const notificationsIterator = useRef();
  async function fetchNotifications(firstLoad) {
    if (firstLoad || !notificationsIterator.current) {
      // Reset iterator
      notificationsIterator.current = mastoFetchNotifications({
        excludeTypes: ['follow_request'],
      });
    }
    if (/max_id=($|&)/i.test(notificationsIterator.current?.nextParams)) {
      // Pixelfed returns next paginationed link with empty max_id
      // I assume, it's done (end of list)
      return {
        done: true,
      };
    }
    const allNotifications = await notificationsIterator.current.next();
    const notifications = massageNotifications2(allNotifications.value);

    if (notifications?.length) {
      notifications.forEach((notification) => {
        saveStatus(notification.status, instance, {
          skipThreading: true,
        });
      });

      // TEST: Slot in a fake notification to test 'severed_relationships'
      // notifications.unshift({
      //   id: '123123',
      //   type: 'severed_relationships',
      //   createdAt: '2024-03-22T19:20:08.316Z',
      //   event: {
      //     type: 'account_suspension',
      //     targetName: 'mastodon.dev',
      //     followersCount: 0,
      //     followingCount: 0,
      //   },
      // });

      // TEST: Slot in a fake notification to test 'moderation_warning'
      // notifications.unshift({
      //   id: '123123',
      //   type: 'moderation_warning',
      //   createdAt: new Date().toISOString(),
      //   moderation_warning: {
      //     id: '1231234',
      //     action: 'mark_statuses_as_sensitive',
      //   },
      // });

      // console.log({ notifications });

      const groupedNotifications = getGroupedNotifications(notifications);

      if (firstLoad) {
        states.notificationsLast = groupedNotifications[0];
        states.notifications = groupedNotifications;

        // Update last read marker
        masto.v1.markers
          .create({
            notifications: {
              lastReadId: groupedNotifications[0].id,
            },
          })
          .catch(() => {});
      } else {
        states.notifications.push(...groupedNotifications);
      }
    }

    states.notificationsShowNew = false;
    states.notificationsLastFetchTime = Date.now();
    return allNotifications;
  }

  async function fetchFollowRequests() {
    // Note: no pagination here yet because this better be on a separate page. Should be rare use-case???
    try {
      return await masto.v1.followRequests.list({
        limit: 80,
      });
    } catch (e) {
      // Silently fail
      return [];
    }
  }

  const loadFollowRequests = () => {
    setUIState('loading');
    (async () => {
      try {
        const requests = await fetchFollowRequests();
        setFollowRequests(requests);
        setUIState('default');
      } catch (e) {
        setUIState('error');
      }
    })();
  };

  async function fetchAnnouncements() {
    try {
      return await masto.v1.announcements.list();
    } catch (e) {
      // Silently fail
      return [];
    }
  }

  const supportsFilteredNotifications = supports(
    '@mastodon/filtered-notifications',
  );
  const [showNotificationsSettings, setShowNotificationsSettings] =
    useState(false);
  const [notificationsPolicy, setNotificationsPolicy] = useState({});
  function fetchNotificationsPolicy() {
    return masto.v2.notifications.policy.fetch().catch(() => {});
  }
  function loadNotificationsPolicy() {
    fetchNotificationsPolicy()
      .then((policy) => {
        console.log('✨ Notifications policy', policy);
        setNotificationsPolicy(policy);
      })
      .catch(() => {});
  }
  const [notificationsRequests, setNotificationsRequests] = useState(null);
  function fetchNotificationsRequest() {
    return masto.v1.notifications.requests.list();
  }

  const loadNotifications = (firstLoad) => {
    setShowNew(false);
    setUIState('loading');
    (async () => {
      try {
        const fetchNotificationsPromise = fetchNotifications(firstLoad);

        if (firstLoad) {
          fetchAnnouncements()
            .then((announcements) => {
              announcements.sort((a, b) => {
                // Sort by updatedAt first, then createdAt
                const aDate = new Date(a.updatedAt || a.createdAt);
                const bDate = new Date(b.updatedAt || b.createdAt);
                return bDate - aDate;
              });
              setAnnouncements(announcements);
            })
            .catch(() => {});

          fetchFollowRequests()
            .then((requests) => {
              setFollowRequests(requests);
            })
            .catch(() => {});

          if (supportsFilteredNotifications) {
            loadNotificationsPolicy();
          }
        }

        const { done } = await fetchNotificationsPromise;
        setShowMore(!done);

        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  };

  useEffect(() => {
    loadNotifications(true);
  }, []);
  useEffect(() => {
    if (reachStart) {
      loadNotifications(true);
    }
  }, [reachStart]);

  // useEffect(() => {
  //   if (nearReachEnd && showMore) {
  //     loadNotifications();
  //   }
  // }, [nearReachEnd, showMore]);

  const [showNew, setShowNew] = useState(false);

  const loadUpdates = useCallback(
    ({ disableIdleCheck = false } = {}) => {
      if (uiState === 'loading') {
        return;
      }
      console.log('✨ Load updates', {
        autoRefresh: snapStates.settings.autoRefresh,
        scrollTop: scrollableRef.current?.scrollTop,
        inBackground: inBackground(),
        disableIdleCheck,
      });
      if (
        snapStates.settings.autoRefresh &&
        scrollableRef.current?.scrollTop < 16 &&
        (disableIdleCheck || window.__IDLE__) &&
        !inBackground()
      ) {
        loadNotifications(true);
      }
    },
    [snapStates.notificationsShowNew, snapStates.settings.autoRefresh, uiState],
  );
  // useEffect(loadUpdates, [snapStates.notificationsShowNew]);

  const lastHiddenTime = useRef();
  usePageVisibility((visible) => {
    if (visible) {
      const timeDiff = Date.now() - lastHiddenTime.current;
      if (!lastHiddenTime.current || timeDiff > 1000 * 3) {
        // 3 seconds
        loadUpdates({
          disableIdleCheck: true,
        });
      } else {
        lastHiddenTime.current = Date.now();
      }
    }
  });
  const firstLoad = useRef(true);
  useEffect(() => {
    let unsub = subscribeKey(states, 'notificationsShowNew', (v) => {
      if (firstLoad.current) {
        firstLoad.current = false;
        return;
      }
      if (uiState === 'loading') return;
      if (v) loadUpdates();
      setShowNew(v);
    });
    return () => unsub?.();
  }, []);

  const todayDate = new Date();
  const yesterdayDate = new Date(todayDate - 24 * 60 * 60 * 1000);
  let currentDay = new Date();
  const showTodayEmpty = !snapStates.notifications.some(
    (notification) =>
      new Date(notification.createdAt).toDateString() ===
      todayDate.toDateString(),
  );

  const announcementsListRef = useRef();

  useEffect(() => {
    if (notificationID) {
      states.routeNotification = {
        id: notificationID,
        accessToken: atob(notificationAccessToken),
      };
    }
  }, [notificationID, notificationAccessToken]);

  // useEffect(() => {
  //   if (uiState === 'default') {
  //     (async () => {
  //       try {
  //         const registration = await getRegistration();
  //         if (registration?.getNotifications) {
  //           const notifications = await registration.getNotifications();
  //           console.log('🔔 Push notifications', notifications);
  //           // Close all notifications?
  //           // notifications.forEach((notification) => {
  //           //   notification.close();
  //           // });
  //         }
  //       } catch (e) {}
  //     })();
  //   }
  // }, [uiState]);

  const [annualReportNotification, setAnnualReportNotification] =
    useState(null);
  useEffect(async () => {
    // Skip this if not in December
    const date = new Date();
    if (date.getMonth() !== 11) return;

    // Skip if doesn't support annual report
    if (!supports('@mastodon/annual-report')) return;

    let annualReportNotification = store.account.get(
      'annualReportNotification',
    );
    if (annualReportNotification) {
      setAnnualReportNotification(annualReportNotification);
      return;
    }
    const notificationIterator = mastoFetchNotifications({
      types: ['annual_report'],
    });
    try {
      const notification = await notificationIterator.next();
      annualReportNotification = notification?.value?.notificationGroups?.[0];
      const annualReportYear = annualReportNotification?.annualReport?.year;
      // If same year, show the annual report
      if (annualReportYear == date.getFullYear()) {
        console.log(
          'ANNUAL REPORT',
          annualReportYear,
          annualReportNotification,
        );
        setAnnualReportNotification(annualReportNotification);
        store.account.set('annualReportNotification', annualReportNotification);
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  const itemsSelector = '.notification';
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
        let nextItem = allItems[activeItemIndex + 1];
        if (nextItem) {
          nextItem.focus();
          nextItem.scrollIntoView(scrollIntoViewOptions);
        }
      } else {
        const topmostItem = allItems.find((item) => {
          const itemRect = item.getBoundingClientRect();
          return itemRect.top >= 44 && itemRect.left >= 0;
        });
        if (topmostItem) {
          topmostItem.focus();
          topmostItem.scrollIntoView(scrollIntoViewOptions);
        }
      }
    },
    {
      useKey: true,
    },
  );

  const kRef = useHotkeys(
    'k',
    () => {
      // focus on previous status after active item
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
          prevItem.scrollIntoView(scrollIntoViewOptions);
        }
      } else {
        const topmostItem = allItems.find((item) => {
          const itemRect = item.getBoundingClientRect();
          return itemRect.top >= 44 && itemRect.left >= 0;
        });
        if (topmostItem) {
          topmostItem.focus();
          topmostItem.scrollIntoView(scrollIntoViewOptions);
        }
      }
    },
    {
      useKey: true,
    },
  );

  const oRef = useHotkeys(
    ['enter', 'o'],
    () => {
      const activeItem = document.activeElement.closest(itemsSelector);
      const statusLink = activeItem?.querySelector('.status-link');
      if (statusLink) {
        statusLink.click();
      }
    },
    {
      useKey: true,
    },
  );

  const today = new Date();
  const todaySubHeading = useMemo(() => {
    return niceDateTime(today, {
      forceOpts: {
        weekday: 'long',
      },
    });
  }, [today]);

  return (
    <div
      id="notifications-page"
      class="deck-container"
      ref={(node) => {
        scrollableRef.current = node;
        jRef.current = node;
        kRef.current = node;
        oRef.current = node;
      }}
      tabIndex="-1"
    >
      <div class={`timeline-deck deck ${onlyMentions ? 'only-mentions' : ''}`}>
        <header
          hidden={hiddenUI}
          onClick={(e) => {
            if (!e.target.closest('a, button')) {
              scrollableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          onDblClick={(e) => {
            if (!e.target.closest('a, button')) {
              loadNotifications(true);
            }
          }}
          class={uiState === 'loading' ? 'loading' : ''}
        >
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
              <Link to="/" class="button plain">
                <Icon icon="home" size="l" alt={t`Home`} />
              </Link>
            </div>
            <h1>
              <Trans>Notifications</Trans>
            </h1>
            <div class="header-side">
              {supportsFilteredNotifications && (
                <button
                  type="button"
                  class="button plain4"
                  onClick={() => {
                    setShowNotificationsSettings(true);
                  }}
                >
                  <Icon
                    icon="settings"
                    size="l"
                    alt={t`Notifications settings`}
                  />
                </button>
              )}
            </div>
          </div>
          {showNew && uiState !== 'loading' && (
            <button
              class="updates-button shiny-pill"
              type="button"
              onClick={() => {
                loadNotifications(true);
                scrollableRef.current?.scrollTo({
                  top: 0,
                  behavior: 'smooth',
                });
              }}
            >
              <Icon icon="arrow-up" /> <Trans>New notifications</Trans>
            </button>
          )}
        </header>
        {announcements.length > 0 && (
          <div class="shazam-container">
            <div class="shazam-container-inner">
              <details class="announcements">
                <summary>
                  <span>
                    <Icon icon="announce" class="announcement-icon" size="l" />{' '}
                    <Plural
                      value={announcements.length}
                      one="Announcement"
                      other="Announcements"
                    />{' '}
                    <small class="insignificant">{instance}</small>
                  </span>
                  {announcements.length > 1 && (
                    <span class="announcements-nav-buttons">
                      {announcements.map((announcement, index) => (
                        <button
                          type="button"
                          class="plain2 small"
                          onClick={() => {
                            announcementsListRef.current?.children[
                              index
                            ].scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                            });
                          }}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </span>
                  )}
                </summary>
                <ul
                  class={`announcements-list-${
                    announcements.length > 1 ? 'multiple' : 'single'
                  }`}
                  ref={announcementsListRef}
                >
                  {announcements.map((announcement) => (
                    <li>
                      <AnnouncementBlock announcement={announcement} />
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        )}
        {followRequests.length > 0 && (
          <div class="follow-requests">
            <h2 class="timeline-header">
              <Trans>Follow requests</Trans>
            </h2>
            {followRequests.length > 5 ? (
              <details>
                <summary>
                  <Plural
                    value={followRequests.length}
                    one="# follow request"
                    other="# follow requests"
                  />
                </summary>
                <ul>
                  {followRequests.map((account) => (
                    <li key={account.id}>
                      <AccountBlock account={account} />
                      <FollowRequestButtons
                        accountID={account.id}
                        onChange={() => {
                          // loadFollowRequests();
                          // loadNotifications(true);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <ul>
                {followRequests.map((account) => (
                  <li key={account.id}>
                    <AccountBlock account={account} />
                    <FollowRequestButtons
                      accountID={account.id}
                      onChange={() => {
                        // loadFollowRequests();
                        // loadNotifications(true);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {supportsFilteredNotifications &&
          notificationsPolicy?.summary?.pendingRequestsCount > 0 && (
            <div class="shazam-container">
              <div class="shazam-container-inner">
                <div class="filtered-notifications">
                  <details
                    onToggle={async (e) => {
                      const { open } = e.target;
                      if (open) {
                        const requests = await fetchNotificationsRequest();
                        setNotificationsRequests(requests);
                        console.log({ open, requests });
                      }
                    }}
                  >
                    <summary>
                      <Plural
                        value={notificationsPolicy.summary.pendingRequestsCount}
                        one="Filtered notifications from # person"
                        other="Filtered notifications from # people"
                      />
                    </summary>
                    {!notificationsRequests ? (
                      <p class="ui-state">
                        <Loader abrupt />
                      </p>
                    ) : (
                      notificationsRequests?.length > 0 && (
                        <ul>
                          {notificationsRequests.map((request) => (
                            <li key={request.id}>
                              <div class="request-notifcations">
                                {!request.lastStatus?.id && (
                                  <AccountBlock
                                    useAvatarStatic
                                    showStats
                                    account={request.account}
                                  />
                                )}
                                {request.lastStatus?.id && (
                                  <div class="last-post">
                                    <Link
                                      class="status-link"
                                      to={`/${instance}/s/${request.lastStatus.id}`}
                                    >
                                      <Status
                                        status={request.lastStatus}
                                        size="s"
                                        readOnly
                                      />
                                    </Link>
                                  </div>
                                )}
                                <NotificationRequestModalButton
                                  request={request}
                                />
                              </div>
                              <NotificationRequestButtons
                                request={request}
                                onChange={() => {
                                  loadNotifications(true);
                                }}
                              />
                            </li>
                          ))}
                        </ul>
                      )
                    )}
                  </details>
                </div>
              </div>
            </div>
          )}
        {annualReportNotification && (
          <div class="shazam-container">
            <div class="shazam-container-inner">
              <Notification notification={annualReportNotification} />
            </div>
          </div>
        )}
        <div id="mentions-option">
          <label>
            <input
              type="checkbox"
              checked={onlyMentions}
              onChange={(e) => {
                setOnlyMentions(e.target.checked);
              }}
            />{' '}
            <Trans>Only mentions</Trans>
          </label>
        </div>
        <h2 class="timeline-header">
          <Trans>Today</Trans>{' '}
          <small class="insignificant bidi-isolate">{todaySubHeading}</small>
        </h2>
        {showTodayEmpty && (
          <p class="ui-state insignificant">
            {uiState === 'default' ? t`You're all caught up.` : <>&hellip;</>}
          </p>
        )}
        {snapStates.notifications.length ? (
          <FilterContext.Provider value="notifications">
            {snapStates.notifications
              // This is leaked from Notifications popover
              .filter((n) => n.type !== 'follow_request')
              .map((notification) => {
                if (onlyMentions && notification.type !== 'mention') {
                  return null;
                }
                const notificationDay = new Date(notification.createdAt);
                const differentDay =
                  notificationDay.toDateString() !== currentDay.toDateString();
                if (differentDay) {
                  currentDay = notificationDay;
                }
                // if notificationDay is yesterday, show "Yesterday"
                // if notificationDay is before yesterday, show date
                const heading =
                  notificationDay.toDateString() ===
                  yesterdayDate.toDateString()
                    ? t`Yesterday`
                    : niceDateTime(currentDay, {
                        hideTime: true,
                      });
                const subHeading = niceDateTime(currentDay, {
                  forceOpts: {
                    weekday: 'long',
                  },
                });
                return (
                  <Fragment key={notification._ids || notification.id}>
                    {differentDay && (
                      <h2 class="timeline-header">
                        <span>{heading}</span>{' '}
                        <small class="insignificant bidi-isolate">
                          {subHeading}
                        </small>
                      </h2>
                    )}
                    <Notification
                      instance={instance}
                      notification={notification}
                      key={notification._ids || notification.id}
                    />
                  </Fragment>
                );
              })}
          </FilterContext.Provider>
        ) : (
          <>
            {uiState === 'loading' && (
              <>
                <ul class="timeline flat">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <li class="notification skeleton">
                      <div class="notification-type">
                        <Icon icon="notification" size="xl" />
                      </div>
                      <div class="notification-content">
                        <p>███████████ ████</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {uiState === 'error' && (
              <p class="ui-state">
                <Trans>Unable to load notifications</Trans>
                <br />
                <br />
                <button type="button" onClick={() => loadNotifications(true)}>
                  <Trans>Try again</Trans>
                </button>
              </p>
            )}
          </>
        )}
        {showMore && (
          <InView
            onChange={(inView) => {
              if (inView) {
                loadNotifications();
              }
            }}
          >
            <button
              type="button"
              class="plain block"
              disabled={uiState === 'loading'}
              onClick={() => loadNotifications()}
              style={{ marginBlockEnd: '6em' }}
            >
              {uiState === 'loading' ? (
                <Loader abrupt />
              ) : (
                <Trans>Show more…</Trans>
              )}
            </button>
          </InView>
        )}
      </div>
      {supportsFilteredNotifications && showNotificationsSettings && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNotificationsSettings(false);
            }
          }}
        >
          <div class="sheet" id="notifications-settings" tabIndex="-1">
            <button
              type="button"
              class="sheet-close"
              onClick={() => setShowNotificationsSettings(false)}
            >
              <Icon icon="x" alt={t`Close`} />
            </button>
            <header>
              <h2>
                <Trans>Notifications settings</Trans>
              </h2>
            </header>
            <main>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const {
                    forNotFollowing,
                    forNotFollowers,
                    forNewAccounts,
                    forPrivateMentions,
                    forLimitedAccounts,
                  } = e.target;
                  const newPolicy = {
                    ...notificationsPolicy,
                    forNotFollowing: forNotFollowing.value,
                    forNotFollowers: forNotFollowers.value,
                    forNewAccounts: forNewAccounts.value,
                    forPrivateMentions: forPrivateMentions.value,
                    forLimitedAccounts: forLimitedAccounts.value,
                  };
                  setNotificationsPolicy(newPolicy);
                  setShowNotificationsSettings(false);
                  (async () => {
                    try {
                      await masto.v2.notifications.policy.update(newPolicy);
                      showToast(t`Notifications settings updated`);
                    } catch (e) {
                      console.error(e);
                    }
                  })();
                }}
              >
                <p>
                  <Trans>Filter out notifications from people:</Trans>
                </p>
                <div class="notification-policy-fields">
                  {NOTIFICATIONS_POLICIES.map((key) => {
                    const value = notificationsPolicy[key];
                    return (
                      <div key={key}>
                        <label>
                          {_(NOTIFICATIONS_POLICIES_TEXT[key])}
                          <select name={key} defaultValue={value} class="small">
                            <option value="accept">
                              <Trans>Accept</Trans>
                            </option>
                            <option value="filter">
                              <Trans>Filter</Trans>
                            </option>
                            <option value="drop">
                              <Trans>Ignore</Trans>
                            </option>
                          </select>
                        </label>
                      </div>
                    );
                  })}
                </div>
                <p>
                  <button type="submit">
                    <Trans>Save</Trans>
                  </button>
                </p>
              </form>
            </main>
          </div>
        </Modal>
      )}
    </div>
  );
}

function inBackground() {
  return !!document.querySelector('.deck-backdrop, #modal-container > *');
}

function AnnouncementBlock({ announcement }) {
  const { instance } = api();
  const { contact } = getCurrentInstance();
  const contactAccount = contact?.account;
  const {
    id,
    content,
    startsAt,
    endsAt,
    published,
    allDay,
    publishedAt,
    updatedAt,
    read,
    mentions,
    statuses,
    tags,
    emojis,
    reactions,
  } = announcement;

  const publishedAtDate = new Date(publishedAt);
  const publishedDateText = niceDateTime(publishedAtDate);
  const updatedAtDate = new Date(updatedAt);
  const updatedAtText = niceDateTime(updatedAtDate);

  return (
    <div class="announcement-block">
      <AccountBlock account={contactAccount} />
      <div
        class="announcement-content"
        onClick={handleContentLinks({ mentions, instance })}
        dangerouslySetInnerHTML={{
          __html: enhanceContent(content, {
            emojis,
          }),
        }}
      />
      <p class="insignificant">
        <time datetime={publishedAtDate.toISOString()}>
          {niceDateTime(publishedAtDate)}
        </time>
        {updatedAt && updatedAtText !== publishedDateText && (
          <>
            {' '}
            &bull;{' '}
            <span class="ib">
              <Trans>
                Updated{' '}
                <time datetime={updatedAtDate.toISOString()}>
                  {niceDateTime(updatedAtDate)}
                </time>
              </Trans>
            </span>
          </>
        )}
      </p>
      <div class="announcement-reactions" hidden>
        {reactions.map((reaction) => {
          const { name, count, me, staticUrl, url } = reaction;
          return (
            <button type="button" class={`plain4 small ${me ? 'reacted' : ''}`}>
              {url || staticUrl ? (
                <img src={url || staticUrl} alt={name} width="16" height="16" />
              ) : (
                <span>{name}</span>
              )}{' '}
              <span class="count">{shortenNumber(count)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fetchNotficationsByAccount(accountID) {
  const { masto } = api();
  return masto.v1.notifications.list({
    accountID,
  });
}
function NotificationRequestModalButton({ request }) {
  const { instance } = api();
  const [uiState, setUIState] = useState('loading');
  const { account, lastStatus } = request;
  const [showModal, setShowModal] = useState(false);
  const [notifications, setNotifications] = useState([]);

  function onClose() {
    setShowModal(false);
  }

  useEffect(() => {
    if (!request?.account?.id) return;
    if (!showModal) return;
    setUIState('loading');
    (async () => {
      const notifs = await fetchNotficationsByAccount(request.account.id);
      setNotifications(notifs || []);
      setUIState('default');
    })();
  }, [showModal, request?.account?.id]);

  return (
    <>
      <button
        type="button"
        class="plain4 request-notifications-account"
        onClick={() => {
          setShowModal(true);
        }}
      >
        <Icon icon="notification" class="more-insignificant" />{' '}
        <small>
          <Trans>
            View notifications from{' '}
            <span class="bidi-isolate">@{account.username}</span>
          </Trans>
        </small>{' '}
        <Icon icon="chevron-down" />
      </button>
      {showModal && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <div class="sheet" tabIndex="-1">
            <button type="button" class="sheet-close" onClick={onClose}>
              <Icon icon="x" alt={t`Close`} />
            </button>
            <header>
              <b>
                <Trans>
                  Notifications from{' '}
                  <span class="bidi-isolate">@{account.username}</span>
                </Trans>
              </b>
            </header>
            <main>
              {uiState === 'loading' ? (
                <p class="ui-state">
                  <Loader abrupt />
                </p>
              ) : (
                notifications.map((notification) => (
                  <div
                    class="notification-peek"
                    onClick={(e) => {
                      const { target } = e;
                      // If button or links
                      if (
                        e.target.tagName === 'BUTTON' ||
                        e.target.tagName === 'A'
                      ) {
                        onClose();
                      }
                    }}
                  >
                    <Notification
                      instance={instance}
                      notification={notification}
                      isStatic
                    />
                  </div>
                ))
              )}
            </main>
          </div>
        </Modal>
      )}
    </>
  );
}

function NotificationRequestButtons({ request, onChange }) {
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const [requestState, setRequestState] = useState(null); // accept, dismiss
  const hasRequestState = requestState !== null;

  return (
    <p class="notification-request-buttons">
      <button
        type="button"
        disabled={uiState === 'loading' || hasRequestState}
        onClick={() => {
          setUIState('loading');
          (async () => {
            try {
              await masto.v1.notifications.requests
                .$select(request.id)
                .accept();
              setRequestState('accept');
              setUIState('default');
              onChange({
                request,
                state: 'accept',
              });
              showToast(
                t`Notifications from @${request.account.username} will not be filtered from now on.`,
              );
            } catch (error) {
              setUIState('error');
              console.error(error);
              showToast(t`Unable to accept notification request`);
            }
          })();
        }}
      >
        <Trans>Allow</Trans>
      </button>{' '}
      <button
        type="button"
        disabled={uiState === 'loading' || hasRequestState}
        class="light danger"
        onClick={() => {
          setUIState('loading');
          (async () => {
            try {
              await masto.v1.notifications.requests
                .$select(request.id)
                .dismiss();
              setRequestState('dismiss');
              setUIState('default');
              onChange({
                request,
                state: 'dismiss',
              });
              showToast(
                t`Notifications from @${request.account.username} will not show up in Filtered notifications from now on.`,
              );
            } catch (error) {
              setUIState('error');
              console.error(error);
              showToast(t`Unable to dismiss notification request`);
            }
          })();
        }}
      >
        <Trans>Dismiss</Trans>
      </button>
      <span class="notification-request-states">
        {uiState === 'loading' ? (
          <Loader abrupt />
        ) : requestState === 'accept' ? (
          <Icon
            icon="check-circle"
            alt={t`Accepted`}
            class="notification-accepted"
          />
        ) : (
          requestState === 'dismiss' && (
            <Icon
              icon="x-circle"
              alt={t`Dismissed`}
              class="notification-dismissed"
            />
          )
        )}
      </span>
    </p>
  );
}

export default memo(Notifications);
