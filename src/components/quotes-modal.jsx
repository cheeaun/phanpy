import './quotes-modal.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';

import { api } from '../utils/api';

import Icon from './icon';
import Link from './link';
import Loader from './loader';
import Status from './status';

const LIMIT = 20;

export default function QuotesModal({
  statusId,
  instance,
  onClose = () => {},
}) {
  const { t } = useLingui();
  const { masto } = api();

  const [posts, setPosts] = useState([]);
  const [uiState, setUIState] = useState('default');
  const [showMore, setShowMore] = useState(false);

  const quotesIterator = useRef();
  const firstLoad = useRef(true);

  const loadQuotes = (isFirstLoad = false) => {
    if (isFirstLoad || !quotesIterator.current) {
      quotesIterator.current = masto.v1.statuses
        .$select(statusId)
        .quotes.list({
          limit: LIMIT,
        })
        .values();
    }

    setUIState('loading');

    (async () => {
      try {
        let { done, value } = await quotesIterator.current.next();

        if (Array.isArray(value)) {
          if (isFirstLoad) {
            setPosts(value);
          } else {
            setPosts((prev) => [...prev, ...value]);
          }
          if (value.length < LIMIT) {
            done = true;
          }
          setShowMore(!done);
        } else {
          setShowMore(false);
        }
        setUIState('default');
      } catch (e) {
        console.error('Error loading quotes:', e);
        setUIState('error');
      }
    })();
  };

  useEffect(() => {
    loadQuotes(true);
    firstLoad.current = false;
  }, [statusId]);

  return (
    <div id="quotes-modal" class="sheet" tabindex="-1">
      {onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Quotes</Trans>
        </h2>
      </header>
      <main>
        {posts.length > 0 ? (
          <>
            <ul class="quoted-posts-list">
              {posts.map((post) => (
                <li key={post.id} class="quoted-post-item">
                  <Link
                    to={
                      instance ? `/${instance}/s/${post.id}` : `/s/${post.id}`
                    }
                    class="status-link"
                  >
                    <Status
                      status={post}
                      instance={instance}
                      size="s"
                      readOnly
                      enableCommentHint
                    />
                  </Link>
                </li>
              ))}
            </ul>
            {uiState === 'default' ? (
              showMore ? (
                <button
                  type="button"
                  class="plain block"
                  onClick={() => loadQuotes()}
                >
                  <Trans>Show more…</Trans>
                </button>
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
            )}
          </>
        ) : uiState === 'loading' ? (
          <p class="ui-state">
            <Loader abrupt />
          </p>
        ) : uiState === 'error' ? (
          <p class="ui-state">
            <Trans>Error loading quotes</Trans>
          </p>
        ) : (
          <p class="ui-state insignificant">
            <Trans>No quotes yet</Trans>
          </p>
        )}
      </main>
    </div>
  );
}
