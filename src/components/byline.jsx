import { Trans } from '@lingui/react/macro';

import Icon from './icon';
import NameText from './name-text';

function Byline({ authors, hidden, children }) {
  if (hidden) return children;
  if (!authors?.[0]?.account?.id) return children;
  const author = authors[0].account;

  return (
    <div class="card-byline">
      {children}
      <div class="card-byline-author">
        <Icon icon="link" size="s" />{' '}
        <small>
          <Trans comment="More from [Author]">
            More from <NameText account={author} showAvatar />
          </Trans>
        </small>
      </div>
    </div>
  );
}

export default Byline;
