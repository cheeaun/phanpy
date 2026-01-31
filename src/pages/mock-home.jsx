import { useEffect, useMemo } from 'preact/hooks';

import ComposeButton from '../components/compose-button';
import Icon from '../components/icon';
import Link from '../components/link';
import NavMenu from '../components/nav-menu';
import Shortcuts from '../components/shortcuts';
import Status from '../components/status';
import mockPostsData from '../data/mock-posts.json';
import states from '../utils/states';
import useTitle from '../utils/useTitle';

// Helper function to convert snake_case keys to camelCase recursively
// This mimics the behavior of masto.js which uses change-case library
// to transform API responses from snake_case to camelCase
function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);

  return Object.keys(obj).reduce((acc, key) => {
    // Convert snake_case to camelCase: user_name -> userName
    const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
      letter.toUpperCase(),
    );
    acc[camelKey] = toCamelCase(obj[key]);
    return acc;
  }, {});
}

const MOCK_SHORTCUTS = [
  { type: 'following', id: 'home' },
  { type: 'notifications', id: 'notifications' },
  { type: 'search', id: 'search' },
  { type: 'bookmarks', id: 'bookmarks' },
  { type: 'trending', id: 'trending' },
];

function MockHome() {
  useTitle('Home', '/');

  useEffect(() => {
    const prevShortcuts = states.shortcuts;
    const prevViewMode = states.settings.shortcutsViewMode;

    states.shortcuts = MOCK_SHORTCUTS;
    states.settings.shortcutsViewMode = 'tab-menu-bar';

    return () => {
      states.shortcuts = prevShortcuts;
      states.settings.shortcutsViewMode = prevViewMode;
    };
  }, []);

  const statuses = useMemo(() => {
    const now = new Date();

    return mockPostsData.map((status, index) => {
      const accountURL = new URL(status.account.url);
      const instance = accountURL.hostname;

      // Convert all snake_case keys to camelCase
      const transformedStatus = toCamelCase(status);
      transformedStatus._instance = instance;

      // Mock createdAt dates: now, then 15 minutes ago, 30 minutes ago, etc.
      const minutesAgo = index * 15;
      const createdAt = new Date(now.getTime() - minutesAgo * 60 * 1000);
      transformedStatus.createdAt = createdAt.toISOString();

      return transformedStatus;
    });
  }, []);

  return (
    <>
      <div id="home-page" class="deck-container" tabIndex="-1">
        <div class="timeline-deck deck">
          <header>
            <div class="header-grid">
              <div class="header-side">
                <NavMenu />
              </div>
              <h1>Home</h1>
              <div class="header-side">
                <Link to="/notifications" class="button plain">
                  <Icon icon="notification" size="l" alt="Notifications" />
                </Link>
              </div>
            </div>
          </header>
          <main>
            <ul class="timeline">
              {statuses.map((status) => {
                const instance = status._instance;
                return (
                  <li key={status.id} class="timeline-item">
                    <Status
                      status={status}
                      instance={instance}
                      allowFilters={false}
                    />
                  </li>
                );
              })}
            </ul>
          </main>
        </div>
      </div>
      <ComposeButton />
      <Shortcuts />
    </>
  );
}

export default MockHome;
