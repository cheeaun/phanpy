import './search-command.css';

import { memo } from 'preact/compat';
import { useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';

import SearchForm from './search-form';

export default memo(function SearchCommand({ onClose = () => {} }) {
  const [showSearch, setShowSearch] = useState(false);
  const searchFormRef = useRef(null);

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
      preventDefault: true,
      ignoreEventWhen: (e) => {
        const isSearchPage = /\/search/.test(location.hash);
        const hasModal = !!document.querySelector('#modal-container > *');
        return isSearchPage || hasModal;
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
    },
  );

  return (
    <div
      id="search-command-container"
      hidden={!showSearch}
      onClick={(e) => {
        console.log(e);
        if (e.target === e.currentTarget) {
          closeSearch();
        }
      }}
    >
      <SearchForm
        ref={searchFormRef}
        onSubmit={() => {
          closeSearch();
        }}
      />
    </div>
  );
});
