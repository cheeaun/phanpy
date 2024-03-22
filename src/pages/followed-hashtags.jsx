import { useEffect, useState } from 'preact/hooks';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import NavMenu from '../components/nav-menu';
import { api } from '../utils/api';
import { fetchFollowedTags } from '../utils/followed-tags';
import useTitle from '../utils/useTitle';

function FollowedHashtags() {
  const { masto, instance } = api();
  useTitle(`Followed Hashtags`, `/fh`);
  const [uiState, setUIState] = useState('default');

  const [followedHashtags, setFollowedHashtags] = useState([]);
  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const tags = await fetchFollowedTags();
        setFollowedHashtags(tags);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, []);

  return (
    <div id="followed-hashtags-page" class="deck-container" tabIndex="-1">
      <div class="timeline-deck deck">
        <header>
          <div class="header-grid">
            <div class="header-side">
              <NavMenu />
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
            <>
              <ul class="link-list">
                {followedHashtags.map((tag) => (
                  <li>
                    <Link
                      to={
                        instance
                          ? `/${instance}/t/${tag.name}`
                          : `/t/${tag.name}`
                      }
                    >
                      <Icon icon="hashtag" /> <span>{tag.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {followedHashtags.length > 1 && (
                <footer class="ui-state">
                  <small class="insignificant">
                    {followedHashtags.length} hashtag
                    {followedHashtags.length === 1 ? '' : 's'}
                  </small>
                </footer>
              )}
            </>
          ) : uiState === 'loading' ? (
            <p class="ui-state">
              <Loader abrupt />
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
