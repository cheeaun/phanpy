import './conversations.css';

import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import pRetry from 'p-retry';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import Modal from '../components/modal';
import NavMenu from '../components/nav-menu';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';
import AccountBlock from '../components/account-block';
import states from '../utils/states';

const LIMIT = 20;

function Conversations({instance}) {
  const { masto } = api();
  useTitle(`Conversations`, `/c`);
  const [uiState, setUIState] = useState('default');

  const [reloadCount, reload] = useReducer((c) => c + 1, 0);
  const [conversations, setConversations] = useState([]);
  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const conversationsFetch = () =>
          pRetry(() => masto.v1.conversations.list({limit: LIMIT}), {
            retries: 4
          })
        const cc = [];

        const conversationsRaw = await conversationsFetch();
        conversationsRaw.forEach(u => {
          u.accounts.forEach((account) => states.accounts[account.id] = account)
            const conversation = {
                actors: u.accounts.map(account => account.id),
                id: u.lastStatus?.id,
                date: u.lastStatus?.editedAt || u.lastStatus?.createdAt,
            }
            const withSameActorsIndex = cc.findIndex(c => c.actors.join(',') == conversation.actors.join(','));
            if (withSameActorsIndex == -1) {
              cc.push(conversation)
            } else if (cc[withSameActorsIndex].date < conversation.date) {
                cc.set(withSameActorsIndex, conversation)
            }
        })

        // TODO: unread first
        const conversations = cc.sort((a, b) => { a.date.localeCompare(b.date)})

        console.log(cc);
        console.log("accounts", states.accounts)
        setConversations(cc);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, [reloadCount]);

  return (
    <div id="conversations-page" class="deck-container" tabIndex="-1">
      <div class="timeline-deck deck">
        <header>
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
              <Link to="/" class="button plain">
                <Icon icon="home" size="l" />
              </Link>
            </div>
            <h1>Conversations</h1>
            <div class="header-side" />
          </div>
        </header>
        <main>
          {conversations.length > 0 ? (
            <ul class="link-list">
              {conversations.map((conversation) => (
                <li>
                  <Link to={`/c/${conversation.id}`}>
                    <div class="row">
                      <Icon icon="chat" size="xl" />
                      {conversation.actors.map((actor) => <AccountBlock account={states.accounts[actor]} />) }
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : uiState === 'loading' ? (
            <p class="ui-state">
              <Loader />
            </p>
          ) : uiState === 'error' ? (
            <p class="ui-state">Unable to load conversations.</p>
          ) : (
            <p class="ui-state">No conversations yet.</p>
          )}
        </main>
      </div>
    </div>
  );
}

export default Conversations;
