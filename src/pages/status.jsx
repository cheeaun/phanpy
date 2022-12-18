import { Link } from 'preact-router/match';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Loader from '../components/loader';
import Status from '../components/status';
import states from '../utils/states';
import useTitle from '../utils/useTitle';

function StatusPage({ id }) {
  const snapStates = useSnapshot(states);
  const [statuses, setStatuses] = useState([{ id }]);
  const [uiState, setUIState] = useState('default');
  const heroStatusRef = useRef();

  useEffect(async () => {
    // If id is completely new, reset the whole list
    if (!statuses.find((s) => s.id === id)) {
      setStatuses([{ id }]);
    }

    setUIState('loading');

    const hasStatus = snapStates.statuses.has(id);
    let heroStatus = snapStates.statuses.get(id);
    try {
      heroStatus = await masto.statuses.fetch(id);
      states.statuses.set(id, heroStatus);
    } catch (e) {
      // Silent fail if status is cached
      if (!hasStatus) {
        setUIState('error');
        alert('Error fetching status');
      }
      return;
    }

    try {
      const context = await masto.statuses.fetchContext(id);
      const { ancestors, descendants } = context;

      ancestors.forEach((status) => {
        states.statuses.set(status.id, status);
      });
      const nestedDescendants = [];
      descendants.forEach((status) => {
        states.statuses.set(status.id, status);
        if (status.inReplyToAccountId === status.account.id) {
          // If replying to self, it's part of the thread, level 1
          nestedDescendants.push(status);
        } else if (status.inReplyToId === heroStatus.id) {
          // If replying to the hero status, it's a reply, level 1
          nestedDescendants.push(status);
        } else {
          // If replying to someone else, it's a reply to a reply, level 2
          const parent = descendants.find((s) => s.id === status.inReplyToId);
          if (parent) {
            if (!parent.__replies) {
              parent.__replies = [];
            }
            parent.__replies.push(status);
          } else {
            // If no parent, it's probably a reply to a reply to a reply, level 3
            console.warn('[LEVEL 3] No parent found for', status);
          }
        }
      });

      console.log({ ancestors, descendants, nestedDescendants });

      const allStatuses = [
        ...ancestors.map((s) => ({ id: s.id, ancestor: true })),
        { id },
        ...nestedDescendants.map((s) => ({
          id: s.id,
          descendant: true,
          thread: s.account.id === heroStatus.account.id,
          replies: s.__replies?.map((r) => r.id),
        })),
      ];
      console.log({ allStatuses });
      setStatuses(allStatuses);
    } catch (e) {
      console.error(e);
      setUIState('error');
    }

    setUIState('default');
  }, [id, snapStates.reloadStatusPage]);

  useLayoutEffect(() => {
    if (heroStatusRef.current && statuses.length > 1) {
      heroStatusRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [id]);

  useLayoutEffect(() => {
    const hasAncestor = statuses.some((s) => s.ancestor);
    if (hasAncestor) {
      heroStatusRef.current?.scrollIntoView({
        // behavior: 'smooth',
        block: 'start',
      });
    }
  }, [statuses]);

  const heroStatus = snapStates.statuses.get(id);
  const heroDisplayName = useMemo(() => {
    // Remove shortcodes from display name
    if (!heroStatus) return '';
    const { account } = heroStatus;
    const div = document.createElement('div');
    div.innerHTML = account.displayName;
    return div.innerText.trim();
  }, [heroStatus]);
  const heroContentText = useMemo(() => {
    if (!heroStatus) return '';
    const { spoilerText, content } = heroStatus;
    let text;
    if (spoilerText) {
      text = spoilerText;
    } else {
      const div = document.createElement('div');
      div.innerHTML = content;
      text = div.innerText.trim();
    }
    if (text.length > 64) {
      // "The title should ideally be less than 64 characters in length"
      // https://www.w3.org/Provider/Style/TITLE.html
      text = text.slice(0, 64) + '…';
    }
    return text;
  }, [heroStatus]);
  useTitle(
    heroDisplayName && heroContentText
      ? `${heroDisplayName}: "${heroContentText}"`
      : 'Status',
  );

  const prevRoute = states.history.findLast((h) => {
    return h === '/' || /notifications/i.test(h);
  });
  const closeLink = `#${prevRoute || '/'}`;

  const [limit, setLimit] = useState(40);
  const showMore = useMemo(() => {
    // return number of statuses to show
    return statuses.length - limit;
  }, [statuses.length, limit]);

  return (
    <div class="deck-backdrop">
      <Link href={closeLink}></Link>
      <div
        class={`status-deck deck contained ${
          statuses.length > 1 ? 'padded-bottom' : ''
        }`}
      >
        <header>
          <h1>Status</h1>
          <div class="header-side">
            <Loader hidden={uiState !== 'loading'} />
            <Link class="button plain deck-close" href={closeLink}>
              <Icon icon="x" size="xl" />
            </Link>
          </div>
        </header>
        <ul class="timeline flat contextual">
          {statuses.slice(0, limit).map((status) => {
            const {
              id: statusID,
              ancestor,
              descendant,
              thread,
              replies,
            } = status;
            const isHero = statusID === id;
            return (
              <li
                key={statusID}
                ref={isHero ? heroStatusRef : null}
                class={`${ancestor ? 'ancestor' : ''} ${
                  descendant ? 'descendant' : ''
                } ${thread ? 'thread' : ''}`}
              >
                {isHero ? (
                  <Status statusID={statusID} withinContext size="l" />
                ) : (
                  <Link
                    class="
                status-link
              "
                    href={`#/s/${statusID}`}
                  >
                    <Status
                      statusID={statusID}
                      withinContext
                      size={thread || ancestor ? 'm' : 's'}
                    />
                  </Link>
                )}
                {descendant && replies?.length > 0 && (
                  <details class="replies">
                    <summary>
                      {replies.length} repl{replies.length === 1 ? 'y' : 'ies'}
                    </summary>
                    <ul>
                      {replies.map((replyID) => (
                        <li key={replyID}>
                          <Link class="status-link" href={`#/s/${replyID}`}>
                            <Status statusID={replyID} withinContext size="s" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {uiState === 'loading' &&
                  isHero &&
                  !!heroStatus?.repliesCount &&
                  statuses.length === 1 && (
                    <div class="status-loading">
                      <Loader />
                    </div>
                  )}
              </li>
            );
          })}
        </ul>
        {showMore > 0 && (
          <button
            type="button"
            class="plain block"
            disabled={uiState === 'loading'}
            onClick={() => setLimit((l) => l + 40)}
            style={{ marginBlockEnd: '6em' }}
          >
            Show more&hellip;{' '}
            <span class="tag">{showMore > 40 ? '40+' : showMore}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default StatusPage;
