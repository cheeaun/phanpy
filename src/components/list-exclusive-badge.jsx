import './list-exclusive-badge.css';

import { useLingui } from '@lingui/react/macro';

import Icon from './icon';

function ListExclusiveBadge({ insignificant }) {
  const { t } = useLingui();
  return (
    <Icon
      icon="filter"
      size="xs"
      class={`list-exclusive-badge ${insignificant ? 'insignificant' : ''}`}
      title={t`Posts on this list are hidden from Home/Following`}
    />
  );
}

export default ListExclusiveBadge;
