import { Trans } from '@lingui/react/macro';
import { useContext } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import FilterContext from '../utils/filter-context';
import { isFiltered } from '../utils/filters';
import states, { getStatus, statusKey } from '../utils/states';
import statusPeek from '../utils/status-peek';
import { getCurrentAccID } from '../utils/store-utils';

import Avatar from './avatar';

function StatusCompact({ sKey }) {
  const snapStates = useSnapshot(states);
  const statusReply = snapStates.statusReply[sKey];
  if (!statusReply) return null;

  const { id, instance } = statusReply;
  const status = getStatus(id, instance);
  if (!status) return null;

  const {
    account: { id: accountId },
    sensitive,
    spoilerText,
    account: { avatar, avatarStatic, bot } = {},
    visibility,
    content,
    language,
    filtered,
  } = status;
  if (sensitive || spoilerText) return null;
  if (!content) return null;

  const srKey = statusKey(id, instance);
  const statusPeekText = statusPeek(status);

  const currentAccount = getCurrentAccID();
  const isSelf = currentAccount && currentAccount === accountId;

  const filterContext = useContext(FilterContext);
  let filterInfo = !isSelf && isFiltered(filtered, filterContext);

  // This is fine. Images are converted to emojis so they are
  // in a way, already "obscured"
  if (filterInfo?.action === 'blur') filterInfo = null;

  if (filterInfo?.action === 'hide') return null;

  const filterTitleStr = filterInfo?.titlesStr || '';

  return (
    <article
      class={`status compact-reply shazam ${
        visibility === 'direct' ? 'visibility-direct' : ''
      }`}
      tabindex="-1"
      data-state-post-id={srKey}
    >
      <Avatar url={avatarStatic || avatar} squircle={bot} />
      <div
        class="content-compact"
        title={statusPeekText}
        lang={language}
        dir="auto"
      >
        {filterInfo ? (
          <b class="status-filtered-badge badge-meta" title={filterTitleStr}>
            <span>
              <Trans>Filtered</Trans>
            </span>
            <span>{filterTitleStr}</span>
          </b>
        ) : (
          <span>{statusPeekText}</span>
        )}
      </div>
    </article>
  );
}

export default StatusCompact;
