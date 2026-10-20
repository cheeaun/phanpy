import { Trans } from '@lingui/react/macro';
import { useSnapshot } from 'valtio';

import states from '../utils/states';

import Icon from './icon';
import NameText from './name-text';

function Byline({ authors, children }) {
  const snapStates = useSnapshot(states);
  if (!authors?.[0]?.account?.id) return children;
  const author = authors[0].account;

  return (
    <div class="card-byline">
      {children}
      <div class="card-byline-author">
        <Icon icon="link" size="s" />{' '}
        <small>
          <Trans comment="More from [Author]">
            More from{' '}
            <NameText
              account={author}
              showAvatar
              subtle={snapStates.settings.postUsernameOnly}
            />
          </Trans>
        </small>
      </div>
    </div>
  );
}

export default Byline;
