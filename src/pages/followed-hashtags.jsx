import { useEffect, useState } from 'preact/hooks';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import Menu from '../components/menu';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

function FollowedHashtags() {
  const { masto, instance } = api();
  useTitle(`Followed Hashtags`, `/ft`);
  const [uiState, setUiState] = useState('default');

  const [followedHashtags, setFollowedHashtags] = useState([]);
  useEffect(() => {
    setUiState('loading');
    (async () => {
      try {
        const tags = await masto.v1.followedTags.list();
        console.log(tags);
        setFollowedHashtags(tags);
        setUiState('default');
      } catch (e) {
        console.error(e);
        setUiState('error');
      }
    })();
  }, []);

  return (
    <div id="followed-hashtags-page" class="deck-container">
      <div class="timeline-deck deck">
        <header>
          <div class="header-grid">
            <div class="header-side">
              <Menu />
              <Link to="/" class="button plain">
                <Icon icon="home" size="l" />
              </Link>
            </div>
            <h1>Followed Hashtags</h1>
            <div class="header-side" />
          </div>
        </header>
        <main>
          {followedHashtags.length > 0 ? (
            <ul class="link-list">
              {followedHashtags.map((tag) => (
                <li>
                  <Link
                    to={
                      instance ? `/${instance}/t/${tag.name}` : `/t/${tag.name}`
                    }
                  >
                    <Icon icon="hashtag" /> <span>{tag.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : uiState === 'loading' ? (
            <p class="ui-state">
              <Loader />
            </p>
          ) : uiState === 'error' ? (
            <p class="ui-state">Unable to load followed hashtags.</p>
          ) : (
            <p class="ui-state">No hashtags followed yet.</p>
          )}
        </main>
      </div>
    </div>
  );
}

export default FollowedHashtags;
