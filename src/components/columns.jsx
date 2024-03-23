import { useHotkeys } from 'react-hotkeys-hook';
import { useSnapshot } from 'valtio';

import Bookmarks from '../pages/bookmarks';
import Favourites from '../pages/favourites';
import Following from '../pages/following';
import Hashtag from '../pages/hashtag';
import List from '../pages/list';
import Mentions from '../pages/mentions';
import Notifications from '../pages/notifications';
import Public from '../pages/public';
import Search from '../pages/search';
import Trending from '../pages/trending';
import states from '../utils/states';
import useTitle from '../utils/useTitle';

function Columns() {
  useTitle('Home', '/');
  const snapStates = useSnapshot(states);
  const { shortcuts } = snapStates;

  console.debug('RENDER Columns', shortcuts);

  const components = shortcuts.map((shortcut) => {
    if (!shortcut) return null;
    const { type, ...params } = shortcut;
    const Component = {
      following: Following,
      notifications: Notifications,
      list: List,
      public: Public,
      bookmarks: Bookmarks,
      favourites: Favourites,
      hashtag: Hashtag,
      mentions: Mentions,
      trending: Trending,
      search: Search,
    }[type];
    if (!Component) return null;
    // Don't show Search column with no query, for now
    if (type === 'search' && !params.query) return null;
    // Don't show List column with no list, for now
    if (type === 'list' && !params.id) return null;
    return (
      <Component key={type + JSON.stringify(params)} {...params} columnMode />
    );
  });

  useHotkeys(['1', '2', '3', '4', '5', '6', '7', '8', '9'], (e, handler) => {
    try {
      const index = parseInt(handler.keys[0], 10) - 1;
      document.querySelectorAll('#columns > *')[index].focus();
    } catch (e) {
      console.error(e);
    }
  });

  return (
    <div
      id="columns"
      onContextMenu={(e) => {
        // If right-click on header, but not links or buttons
        if (
          e.target.closest('.deck > header') &&
          !e.target.closest('a') &&
          !e.target.closest('button')
        ) {
          e.preventDefault();
          states.showShortcutsSettings = true;
        }
      }}
    >
      {components}
    </div>
  );
}

export default Columns;
