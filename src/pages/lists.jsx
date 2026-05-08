import './lists.css';

import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useReducer, useState } from 'preact/hooks';

import Icon from '../components/icon';
import Link from '../components/link';
import ListAddEdit from '../components/list-add-edit';
import ListExclusiveBadge from '../components/list-exclusive-badge';
import Loader from '../components/loader';
import Modal from '../components/modal';
import NavMenu from '../components/nav-menu';
import { fetchLists, splitListsAndFeeds } from '../utils/lists';
import useTitle from '../utils/useTitle';

function Lists() {
  const { t } = useLingui();
  useTitle(t`Lists & Feeds`, `/l`);
  const [uiState, setUIState] = useState('default');

  const [reloadCount, reload] = useReducer((c) => c + 1, 0);
  const [lists, setLists] = useState([]);
  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const lists = await fetchLists();
        console.log(lists);
        setLists(lists);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, [reloadCount]);

  const [showListAddEditModal, setShowListAddEditModal] = useState(false);

  const { lists: userLists, feeds } = splitListsAndFeeds(lists);
  const hasExclusiveLists = userLists.some((list) => list.exclusive);

  return (
    <div id="lists-page" class="deck-container" tabIndex="-1">
      <div class="timeline-deck deck">
        <header>
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
              <Link to="/" class="button plain">
                <Icon icon="home" size="l" />
              </Link>
            </div>
            <h1>
              <Trans>Lists & Feeds</Trans>
            </h1>
            <div class="header-side">
              <button
                type="button"
                class="plain"
                onClick={() => setShowListAddEditModal(true)}
              >
                <Icon icon="plus" size="l" alt={t`New list`} />
              </button>
            </div>
          </div>
        </header>
        <main>
          {lists.length > 0 ? (
            <>
              {userLists.length > 0 && (
                <>
                  <h2 class="timeline-header">
                    <Trans>Lists</Trans>
                  </h2>
                  <ul class="link-list">
                    {userLists.map((list) => (
                      <li>
                        <Link to={`/l/${list.id}`}>
                          <Icon icon="list" />{' '}
                          <span>
                            {list.title}
                            {list.exclusive && (
                              <>
                                {' '}
                                <ListExclusiveBadge insignificant />
                              </>
                            )}
                          </span>
                          {/* <button
                      type="button"
                      class="plain"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowListAddEditModal({
                          list,
                        });
                      }}
                    >
                      <Icon icon="pencil" />
                    </button> */}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {feeds.length > 0 && (
                <>
                  <h2 class="timeline-header">
                    <Trans>Feeds</Trans>
                  </h2>
                  <ul class="link-list">
                    {feeds.map((feed) => (
                      <li>
                        <Link to={`/l/${feed.id}`}>
                          <Icon icon="sparkles" /> <span>{feed.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {lists.length > 1 && (
                <footer class="ui-state">
                  {hasExclusiveLists && (
                    <p>
                      <small class="insignificant">
                        <ListExclusiveBadge />{' '}
                        <Trans>
                          Posts on this list are hidden from Home/Following
                        </Trans>
                      </small>
                    </p>
                  )}
                  <p>
                    <small class="insignificant">
                      {userLists.length > 0 && (
                        <Plural
                          value={userLists.length}
                          one="# list"
                          other="# lists"
                        />
                      )}
                      {userLists.length > 0 && feeds.length > 0 && ' · '}
                      {feeds.length > 0 && (
                        <Plural
                          value={feeds.length}
                          one="# feed"
                          other="# feeds"
                        />
                      )}
                    </small>
                  </p>
                </footer>
              )}
            </>
          ) : uiState === 'loading' ? (
            <p class="ui-state">
              <Loader />
            </p>
          ) : uiState === 'error' ? (
            <p class="ui-state">
              <Trans>Unable to load lists.</Trans>
            </p>
          ) : (
            <p class="ui-state">
              <Trans>No lists or feeds yet.</Trans>
            </p>
          )}
        </main>
      </div>
      {showListAddEditModal && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowListAddEditModal(false);
            }
          }}
        >
          <ListAddEdit
            list={showListAddEditModal?.list}
            onClose={(result) => {
              if (result.state === 'success') {
                reload();
              }
              setShowListAddEditModal(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default Lists;
