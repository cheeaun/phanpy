import mem from './mem';
import { getCurrentAccountID } from './store-utils';

function _isFiltered(filtered, filterContext) {
  if (!filtered?.length) return false;
  const appliedFilters = filtered.filter((f) => {
    const { filter } = f;
    const hasContext = filter.context.includes(filterContext);
    if (!hasContext) return false;
    if (!filter.expiresAt) return hasContext;
    return new Date(filter.expiresAt) > new Date();
  });
  if (!appliedFilters.length) return false;
  const isHidden = appliedFilters.some((f) => f.filter.filterAction === 'hide');
  if (isHidden)
    return {
      action: 'hide',
    };
  const isWarn = appliedFilters.some((f) => f.filter.filterAction === 'warn');
  if (isWarn) {
    const filterTitles = appliedFilters.map((f) => f.filter.title);
    return {
      action: 'warn',
      titles: filterTitles,
      titlesStr: filterTitles.join(' • '),
    };
  }
  return false;
}
export const isFiltered = mem(_isFiltered);

export function filteredItem(item, filterContext, currentAccountID) {
  const { filtered } = item;
  if (!filtered?.length) return true;
  const isSelf = currentAccountID && item.account?.id === currentAccountID;
  if (isSelf) return true;
  const filterState = isFiltered(filtered, filterContext);
  if (!filterState) return true;
  if (filterState.action === 'hide') return false;
  // item._filtered = filterState;
  return true;
}
export function filteredItems(items, filterContext) {
  if (!items?.length) return [];
  if (!filterContext) return items;
  const currentAccountID = getCurrentAccountID();
  return items.filter((item) =>
    filteredItem(item, filterContext, currentAccountID),
  );
}
