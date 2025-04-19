import { useLingui } from '@lingui/react/macro';
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
import isRTL from '../utils/is-rtl';
import states from '../utils/states';
import useTitle from '../utils/useTitle';

const scrollIntoViewOptions = {
  block: 'nearest',
  inline: 'nearest',
  behavior: 'smooth',
};

function Columns() {
  const { t } = useLingui();
  useTitle(t`Home`, '/');
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
      const $column = document.querySelectorAll('#columns > *')[index];
      if ($column) {
        $column.focus();
        $column.scrollIntoView(scrollIntoViewOptions);
      }
    } catch (e) {
      console.error(e);
    }
  });

  useHotkeys(
    ['[', ']'],
    (e, handler) => {
      const key = handler.keys[0];
      const currentFocusedColumn =
        document.activeElement.closest('#columns > *');

      const rtl = isRTL();
      const prevColKey = rtl ? ']' : '[';
      const nextColKey = rtl ? '[' : ']';
      let $column;

      if (key === prevColKey) {
        // If [, focus on left of focused column, else first column
        $column = currentFocusedColumn
          ? currentFocusedColumn.previousElementSibling
          : document.querySelectorAll('#columns > *')[0];
      } else if (key === nextColKey) {
        // If ], focus on right of focused column, else 2nd column
        $column = currentFocusedColumn
          ? currentFocusedColumn.nextElementSibling
          : document.querySelectorAll('#columns > *')[1];
      }
      if ($column) {
        $column.focus();
        $column.scrollIntoView(scrollIntoViewOptions);
      }
    },
    {
      useKey: true,
    },
  );

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
      onFocus={() => {
        // Get current focused column
        const currentFocusedColumn =
          document.activeElement.closest('#columns > *');
        if (currentFocusedColumn) {
          // Remove focus classes from all columns
          // Add focus class to current focused column
          document.querySelectorAll('#columns > *').forEach((column) => {
            column.classList.toggle('focus', column === currentFocusedColumn);
          });
        }
      }}
    >
      {components}
    </div>
  );
}

export default Columns;
