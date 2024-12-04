import './lists.css';

import { Plural, t, Trans } from '@lingui/macro';
import { useEffect, useReducer, useState } from 'preact/hooks';

import Icon from '../components/icon';
import Link from '../components/link';
import ListAddEdit from '../components/list-add-edit';
import Loader from '../components/loader';
import Modal from '../components/modal';
import NavMenu from '../components/nav-menu';
import { fetchLists } from '../utils/lists';
import useTitle from '../utils/useTitle';

function Lists() {
  useTitle(t`Lists`, `/l`);
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
              <Trans>Lists</Trans>
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
              <ul class="link-list">
                {lists.map((list) => (
                  <li>
                    <Link to={`/l/${list.id}`}>
                      <span>
                        <Icon icon="list" /> <span>{list.title}</span>
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
              {lists.length > 1 && (
                <footer class="ui-state">
                  <small class="insignificant">
                    <Plural value={lists.length} one="# list" other="# lists" />
                  </small>
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
              <Trans>No lists yet.</Trans>
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
