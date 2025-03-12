import { Trans, useLingui } from '@lingui/react/macro';
import { ControlledMenu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { useLongPress } from 'use-long-press';
import { useSnapshot } from 'valtio';

import { api } from '../utils/api';
import niceDateTime from '../utils/nice-date-time';
import openCompose from '../utils/open-compose';
import openOSK from '../utils/open-osk';
import pmem from '../utils/pmem';
import safeBoundingBoxPadding from '../utils/safe-bounding-box-padding';
import showCompose from '../utils/show-compose';
import states from '../utils/states';
import statusPeek from '../utils/status-peek';
import { getCurrentAccountID } from '../utils/store-utils';

import Icon from './icon';
import Loader from './loader';
import MenuLink from './menu-link';
import RelativeTime from './relative-time';
import SubMenu2 from './submenu2';

// Function to fetch the latest posts from the current user
// Use pmem to memoize fetch results for 1 minute
const fetchLatestPostsMemoized = pmem(
  async (masto, currentAccountID) => {
    const statusesIterator = masto.v1.accounts
      .$select(currentAccountID)
      .statuses.list({
        limit: 3,
        exclude_replies: true,
        exclude_reblogs: true,
      });
    const { value } = await statusesIterator.next();
    return value || [];
  },
  { maxAge: 60000 },
); // 1 minute cache

export default function ComposeButton() {
  const { t } = useLingui();
  const snapStates = useSnapshot(states);
  const { masto } = api();

  // Context menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [latestPosts, setLatestPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  function handleButton(e) {
    if (snapStates.composerState.minimized) {
      states.composerState.minimized = false;
      openOSK();
      return;
    }

    if (e.shiftKey) {
      const newWin = openCompose();

      if (!newWin) {
        states.showCompose = true;
      }
    } else {
      openOSK();
      states.showCompose = true;
    }
  }

  useHotkeys('c, shift+c', handleButton, {
    ignoreEventWhen: (e) => {
      const hasModal = !!document.querySelector('#modal-container > *');
      return hasModal;
    },
  });

  // Setup longpress handler to open context menu
  const bindLongPress = useLongPress(
    () => {
      setMenuOpen(true);
    },
    {
      threshold: 600,
    },
  );

  const fetchLatestPosts = useCallback(async () => {
    try {
      setLoadingPosts(true);
      const currentAccountID = getCurrentAccountID();
      if (!currentAccountID) {
        return;
      }
      const posts = await fetchLatestPostsMemoized(masto, currentAccountID);
      setLatestPosts(posts);
    } catch (error) {
    } finally {
      setLoadingPosts(false);
    }
  }, [masto]);

  // Function to handle opening the compose window to reply to a post
  const handleReplyToPost = useCallback((post) => {
    showCompose({
      replyToStatus: post,
    });
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      fetchLatestPosts();
    }
  }, [fetchLatestPosts, menuOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        id="compose-button"
        onClick={handleButton}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        {...bindLongPress()}
        class={`${snapStates.composerState.minimized ? 'min' : ''} ${
          snapStates.composerState.publishing ? 'loading' : ''
        } ${snapStates.composerState.publishingError ? 'error' : ''}`}
      >
        <Icon icon="quill" size="xl" alt={t`Compose`} />
      </button>
      <ControlledMenu
        ref={menuRef}
        state={menuOpen ? 'open' : undefined}
        anchorRef={buttonRef}
        onClose={() => setMenuOpen(false)}
        direction="top"
        gap={8} // Add gap between menu and button
        unmountOnClose
        portal={{
          target: document.body,
        }}
        boundingBoxPadding={safeBoundingBoxPadding()}
        containerProps={{
          style: {
            zIndex: 9,
          },
          onClick: () => {
            menuRef.current?.closeMenu?.();
          },
        }}
        submenuOpenDelay={600}
      >
        <MenuLink to="/sp">
          <Icon icon="schedule" />{' '}
          <span>
            <Trans>Scheduled Posts</Trans>
          </span>
        </MenuLink>
        <MenuDivider />
        <SubMenu2
          align="end"
          direction="top"
          shift={-8}
          disabled={loadingPosts || latestPosts.length === 0}
          label={
            <>
              <Icon icon="comment" />{' '}
              <span className="menu-grow">
                <Trans>Add to thread</Trans>
              </span>
              {loadingPosts ? '…' : <Icon icon="chevron-right" />}
            </>
          }
        >
          {latestPosts.length > 0 &&
            latestPosts.map((post) => {
              const createdDate = new Date(post.createdAt);
              const isWithinDay =
                new Date().getTime() - createdDate.getTime() < 86400000;

              return (
                <MenuItem key={post.id} onClick={() => handleReplyToPost(post)}>
                  <small>
                    <div class="menu-post-text">{statusPeek(post)}</div>
                    <span className="more-insignificant">
                      {/* Show relative time if within a day */}
                      {isWithinDay && (
                        <>
                          <RelativeTime datetime={createdDate} format="micro" />{' '}
                          ‒{' '}
                        </>
                      )}
                      <time
                        className="created"
                        dateTime={createdDate.toISOString()}
                        title={createdDate.toLocaleString()}
                      >
                        {niceDateTime(post.createdAt)}
                      </time>
                    </span>
                  </small>
                </MenuItem>
              );
            })}
        </SubMenu2>
      </ControlledMenu>
    </>
  );
}
