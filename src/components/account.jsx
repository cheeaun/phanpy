import './account.css';

import { useEffect, useState } from 'preact/hooks';

import enhanceContent from '../utils/enhance-content';
import shortenNumber from '../utils/shorten-number';
import store from '../utils/store';

import Avatar from './avatar';
import NameText from './name-text';

export default ({ account }) => {
  const [uiState, setUIState] = useState('default');
  const isString = typeof account === 'string';
  const [info, setInfo] = useState(isString ? null : account);

  useEffect(() => {
    if (isString) {
      setUIState('loading');
      (async () => {
        try {
          const info = await masto.accounts.lookup({
            acct: account,
            skip_webfinger: false,
          });
          setInfo(info);
          setUIState('default');
        } catch (e) {
          alert(e);
          setUIState('error');
        }
      })();
    }
  }, []);

  const {
    acct,
    avatar,
    avatarStatic,
    bot,
    createdAt,
    displayName,
    emojis,
    fields,
    followersCount,
    followingCount,
    group,
    header,
    headerStatic,
    id,
    lastStatusAt,
    locked,
    note,
    statusesCount,
    url,
    username,
  } = info || {};

  const [relationshipUIState, setRelationshipUIState] = useState('default');
  const [relationship, setRelationship] = useState(null);
  useEffect(() => {
    if (info) {
      const currentAccount = store.session.get('currentAccount');
      if (currentAccount === id) {
        // It's myself!
        return;
      }
      setRelationshipUIState('loading');
      (async () => {
        try {
          const relationships = await masto.accounts.fetchRelationships([id]);
          console.log('fetched relationship', relationships);
          if (relationships.length) {
            setRelationship(relationships[0]);
          }
          setRelationshipUIState('default');
        } catch (e) {
          console.error(e);
          setRelationshipUIState('error');
        }
      })();
    }
  }, [info]);

  const {
    following,
    showingReblogs,
    notifying,
    followedBy,
    blocking,
    blockedBy,
    muting,
    mutingNotifications,
    requested,
    domainBlocking,
    endorsed,
  } = relationship || {};

  return (
    <div
      id="account-container"
      class={`sheet ${uiState === 'loading' ? 'skeleton' : ''}`}
    >
      {!info || uiState === 'loading' ? (
        <>
          <header>
            <Avatar size="xxl" />
            ███ ████████████
          </header>
          <div class="note">
            <p>████████ ███████</p>
            <p>███████████████ ███████████████</p>
          </div>
          <p class="stats">
            <span>██ Posts</span>
            <span>██ Following</span>
            <span>██ Followers</span>
          </p>
        </>
      ) : (
        <>
          <header>
            <Avatar url={avatar} size="xxl" />
            <NameText account={info} showAcct external />
          </header>
          <div
            class="note"
            dangerouslySetInnerHTML={{
              __html: enhanceContent(note, { emojis }),
            }}
          />
          <p class="stats">
            <span>
              <b title={statusesCount}>{shortenNumber(statusesCount)}</b> Posts
            </span>
            <span>
              <b title={followingCount}>{shortenNumber(followingCount)}</b>{' '}
              Following
            </span>
            <span>
              <b title={followersCount}>{shortenNumber(followersCount)}</b>{' '}
              Followers
            </span>
          </p>
          <p class="actions">
            {followedBy ? <span class="tag">Following you</span> : <span />}{' '}
            {relationshipUIState !== 'loading' && relationship && (
              <button
                type="button"
                class={following ? 'light' : ''}
                disabled={relationshipUIState === 'loading'}
                onClick={() => {
                  setRelationshipUIState('loading');
                  (async () => {
                    try {
                      let newRelationship;
                      if (following) {
                        newRelationship = await masto.accounts.unfollow(id);
                      } else {
                        newRelationship = await masto.accounts.follow(id);
                      }
                      setRelationship(newRelationship);
                      setRelationshipUIState('default');
                    } catch (e) {
                      alert(e);
                      setRelationshipUIState('error');
                    }
                  })();
                }}
              >
                {following ? 'Unfollow' : 'Follow'}
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
};
