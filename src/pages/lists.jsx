import { useEffect, useState } from 'preact/hooks';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import Menu from '../components/menu';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

function Lists() {
  const { masto } = api();
  useTitle(`Lists`, `/l`);
  const [uiState, setUiState] = useState('default');

  const [lists, setLists] = useState([]);
  useEffect(() => {
    setUiState('loading');
    (async () => {
      try {
        const lists = await masto.v1.lists.list();
        console.log(lists);
        setLists(lists);
        setUiState('default');
      } catch (e) {
        console.error(e);
        setUiState('error');
      }
    })();
  }, []);

  return (
    <div id="lists-page" class="deck-container">
      <div class="timeline-deck deck">
        <header>
          <div class="header-grid">
            <div class="header-side">
              <Menu />
              <Link to="/" class="button plain">
                <Icon icon="home" size="l" />
              </Link>
            </div>
            <h1>Lists</h1>
            <div class="header-side" />
          </div>
        </header>
        <main>
          {lists.length > 0 ? (
            <ul class="link-list">
              {lists.map((list) => (
                <li>
                  <Link to={`/l/${list.id}`}>
                    <Icon icon="list" /> <span>{list.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : uiState === 'loading' ? (
            <p class="ui-state">
              <Loader />
            </p>
          ) : uiState === 'error' ? (
            <p class="ui-state">Unable to load lists.</p>
          ) : (
            <p class="ui-state">No lists yet.</p>
          )}
        </main>
      </div>
    </div>
  );
}

export default Lists;
