import store from './store';

export const getSearchHistory = ({ limit } = {}) => {
  const history = store.account.get('searchHistory') || [];
  return limit ? history.slice(0, limit) : history;
};

const MAX_HISTORY_LENGTH = 10;
export const addToSearchHistory = (query, queryType = null) => {
  if (!query?.trim?.()) return;

  const history = getSearchHistory();
  const existingIndex = history.findIndex(
    (item) => item.query === query && item.queryType === queryType,
  );

  // LRU
  // Remove existing entry if found
  if (existingIndex !== -1) {
    history.splice(existingIndex, 1);
  }
  // Add to beginning (most recent)
  history.unshift({
    query: query.trim(),
    queryType,
    timestamp: Date.now(),
  });
  const limitedHistory = history.slice(0, MAX_HISTORY_LENGTH);

  store.account.set('searchHistory', limitedHistory);
};

export const removeFromSearchHistory = (query, queryType = null) => {
  const history = getSearchHistory();
  const filteredHistory = history.filter(
    (item) => !(item.query === query && item.queryType === queryType),
  );
  store.account.set('searchHistory', filteredHistory);
};

export const clearAllSearchHistory = () => {
  store.account.set('searchHistory', []);
};
