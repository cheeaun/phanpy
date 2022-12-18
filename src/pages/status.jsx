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

    if (!states.statuses.has(id)) {
      try {
        const status = await masto.statuses.fetch(id);
        states.statuses.set(id, status);
      } catch (e) {
        setUIState('error');
        alert('Error fetching status');
        return;
      }
    }

    try {
      const context = await masto.statuses.fetchContext(id);
      const { ancestors, descendants } = context;

      ancestors.forEach((status) => {
        states.statuses.set(status.id, status);
      });
      const directReplies = [];
      descendants.forEach((status) => {
        states.statuses.set(status.id, status);
        if (status.inReplyToId === id) {
          directReplies.push(status);
        }
      });
      console.log({ ancestors, descendants, directReplies });

      if (directReplies.length) {
        const heroStatus = states.statuses.get(id);
        const heroStatusRepliesCount = heroStatus.repliesCount;
        if (heroStatusRepliesCount != directReplies.length) {
          // If replies count doesn't match, refetch the status
          const status = await masto.statuses.fetch(id);
          states.statuses.set(id, status);
        }
      }

      const allStatuses = [
        ...ancestors.map((s) => ({ id: s.id, ancestor: true })),
        { id },
        ...descendants.map((s) => ({
          id: s.id,
          descendant: true,
          directReply:
            s.inReplyToId === id || s.inReplyToAccountId === s.account.id,
          // I can assume if the reply is to the same account, it's a direct reply. In other words, it's a thread?!?
        })),
      ];
      setStatuses(allStatuses);
    } catch (e) {
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

  const heroStatus = states.statuses.get(id);
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

  const comments = statuses.filter((s) => s.descendant);
  const replies = comments.filter((s) => s.directReply);

  const prevRoute = states.history.findLast((h) => {
    return h === '/' || /notifications/i.test(h);
  });
  const closeLink = `#${prevRoute || '/'}`;

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
          {statuses.map((status) => {
            const { id: statusID, ancestor, descendant, directReply } = status;
            const isHero = statusID === id;
            return (
              <li
                key={statusID}
                ref={isHero ? heroStatusRef : null}
                class={`${ancestor ? 'ancestor' : ''} ${
                  descendant ? 'descendant' : ''
                } ${descendant && !directReply ? 'indirect' : ''}`}
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
                    <Status statusID={statusID} withinContext />
                  </Link>
                )}
                {uiState === 'loading' &&
                  isHero &&
                  !!heroStatus?.repliesCount &&
                  statuses.length === 1 && (
                    <div class="status-loading">
                      <Loader />
                      {/* {' '}<span>
                        {!!replies.length &&
                          replies.length !== comments.length && (
                            <>
                              {replies.length} repl
                              {replies.length > 1 ? 'ies' : 'y'}
                            </>
                          )}
                        {!!comments.length && (
                          <>
                            {' '}
                            &bull; {comments.length} comment
                            {comments.length > 1 ? 's' : ''}
                          </>
                        )}
                      </span> */}
                    </div>
                  )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default StatusPage;
