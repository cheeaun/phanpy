import { useEffect, useState } from 'preact/hooks';

import Icon from '../components/icon';
import Link from '../components/link';
import Loader from '../components/loader';
import NavMenu from '../components/nav-menu';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

const LIMIT = 200;

function FollowedHashtags() {
  const { masto, instance } = api();
  useTitle(`Followed Hashtags`, `/ft`);
  const [uiState, setUIState] = useState('default');

  const [followedHashtags, setFollowedHashtags] = useState([]);
  useEffect(() => {
    setUIState('loading');
    (async () => {
      try {
        const iterator = masto.v1.followedTags.list({
          limit: LIMIT,
        });
        const tags = [];
        do {
          const { value, done } = await iterator.next();
          if (done || value?.length === 0) break;
          tags.push(...value);
        } while (true);
        tags.sort((a, b) => a.name.localeCompare(b.name));
        console.log(tags);
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
