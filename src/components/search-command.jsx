import './search-command.css';

import { memo } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { useSnapshot } from 'valtio';

import states from '../utils/states';

import SearchForm from './search-form';

export default memo(function SearchCommand({ onClose = () => {} }) {
  const snapStates = useSnapshot(states);
  const [showSearch, setShowSearch] = useState(false);
  const searchFormRef = useRef(null);

  useEffect(() => {
    if (snapStates.showSearchCommand) {
      const { query } = snapStates.showSearchCommand;
      setShowSearch(true);
      setTimeout(() => {
        if (query) {
          searchFormRef.current?.setValue?.(query);
        }
        searchFormRef.current?.focus?.();
      }, 150);
      states.showSearchCommand = false;
    }
  }, [snapStates.showSearchCommand]);

  useHotkeys(
    ['Slash', '/'],
    (e) => {
      setShowSearch(true);
      setTimeout(() => {
        searchFormRef.current?.focus?.();
        searchFormRef.current?.select?.();
      }, 0);
    },
    {
      useKey: true,
      preventDefault: true,
      ignoreEventWhen: (e) => {
        const isSearchPage = /\/search/.test(location.hash);
        const hasModal = !!document.querySelector('#modal-container > *');
        return (
          isSearchPage ||
          hasModal ||
          e.metaKey ||
          e.ctrlKey ||
          e.altKey ||
          e.shiftKey
        );
      },
    },
  );

  const closeSearch = () => {
    setShowSearch(false);
    onClose();
  };

  useHotkeys(
    'esc',
    (e) => {
      searchFormRef.current?.blur?.();
      closeSearch();
    },
    {
      enabled: showSearch,
      enableOnFormTags: true,
      preventDefault: true,
      useKey: true,
      ignoreEventWhen: (e) => e.metaKey || e.ctrlKey || e.altKey || e.shiftKey,
    },
  );

  const hidden = !showSearch;

  return (
    <div
      id="search-command-container"
      hidden={hidden}
      onClick={(e) => {
        console.log(e);
        if (e.target === e.currentTarget) {
          closeSearch();
        }
      }}
    >
      <SearchForm
        ref={searchFormRef}
        hidden={hidden}
        onSubmit={() => {
          closeSearch();
        }}
      />
    </div>
  );
});
