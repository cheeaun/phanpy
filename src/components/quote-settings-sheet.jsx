import './quote-settings-sheet.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'preact/hooks';

import { api } from '../utils/api';
import showToast from '../utils/show-toast';

import Icon from './icon';
import Status from './status';

function QuoteSettingsSheet({ onClose, post, currentPolicy }) {
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('default');

  const [selectedPolicy, setSelectedPolicy] = useState(
    currentPolicy || 'public',
  );

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const quoteApprovalPolicy = formData.get('quoteApprovalPolicy');

    setSelectedPolicy(quoteApprovalPolicy);
    setUIState('loading');

    try {
      await masto.v1.statuses.$select(post.id).interactionPolicy.update({
        quote_approval_policy: quoteApprovalPolicy,
      });
      onClose(true);
      showToast(t`Quote settings updated`);
      setUIState('default');
    } catch (e) {
      console.error(e);
      showToast(t`Failed to update quote settings`);
      setUIState('error');
    }
  };

  return (
    <div class="sheet" id="quote-settings-container">
      {!!onClose && (
        <button
          type="button"
          class="sheet-close"
          onClick={onClose}
          disabled={uiState === 'loading'}
        >
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Quote settings for this post</Trans>
        </h2>
      </header>
      <main>
        {!!post && (
          <div class="post-preview">
            <Status status={post} size="s" readOnly />
          </div>
        )}
        <form onSubmit={handleFormSubmit}>
          <select
            value={selectedPolicy}
            name="quoteApprovalPolicy"
            disabled={uiState === 'loading'}
          >
            <option value="public">
              <Trans>Anyone can quote</Trans>
            </option>
            <option value="followers">
              <Trans>Your followers can quote</Trans>
            </option>
            <option value="nobody">
              <Trans>Only you can quote</Trans>
            </option>
          </select>{' '}
          <button disabled={uiState === 'loading'}>
            <Trans>Save</Trans>
          </button>
        </form>
      </main>
    </div>
  );
}

export default QuoteSettingsSheet;
