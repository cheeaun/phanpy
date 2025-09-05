import { Trans, useLingui } from '@lingui/react/macro';
import { useContext } from 'preact/hooks';

import { ThreadCountContext } from '../utils/thread-count-context';

import Icon from './icon';

function ThreadIcon({ alt }) {
  return <Icon icon="thread" size="s" alt={alt} />;
}

function ThreadBadge({ index, showIcon, showText }) {
  const { t } = useLingui();
  const total = useContext(ThreadCountContext);
  const hasIndex = index > 0;
  const hasTotal = total > 0;

  return (
    <div class="status-thread-badge">
      {showIcon && (
        <>
          <ThreadIcon alt={showText ? '' : t`Thread`} />{' '}
        </>
      )}
      {showText ? (
        hasIndex ? (
          hasTotal ? (
            <Trans>
              Thread {index}/{total}
            </Trans>
          ) : (
            <Trans comment="X is the unspecified total number of posts in a thread">
              Thread {index}/X
            </Trans>
          )
        ) : (
          t`Thread`
        )
      ) : hasIndex ? (
        hasTotal ? (
          t({
            message: `${index}/${total}`,
            comment: 'index/total posts in a thread',
          })
        ) : (
          t({
            message: `${index}/X`,
            comment: 'X is the unspecified total number of posts in a thread',
          })
        )
      ) : (
        !showIcon && <ThreadIcon alt={t`Thread`} />
      )}
    </div>
  );
}

export default ThreadBadge;
