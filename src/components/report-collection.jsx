import './report-collection.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'preact/hooks';

import { api } from '../utils/api';
import showToast from '../utils/show-toast';

import CollectionCard from './collection-card';
import Icon from './icon';
import Loader from './loader';

function ReportCollection({ collection, domain, onClose }) {
  const { t } = useLingui();
  const { masto } = api();

  const isRemote = !!domain;

  const [uiState, setUIState] = useState('default');

  return (
    <div class="report-collection-container">
      <div class="top-controls">
        <h1>
          <Trans>Report Collection</Trans>
        </h1>
        <button
          type="button"
          class="plain4 small"
          disabled={uiState === 'loading'}
          onClick={() => onClose()}
        >
          <Icon icon="x" size="xl" alt={t`Close`} />
        </button>
      </div>
      <main>
        <div class="report-preview">
          <CollectionCard collection={collection} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const comment = formData.get('comment') || undefined;
            const forwardToDomain = formData.get('forwardToDomain') === 'on';

            setUIState('loading');
            (async () => {
              try {
                await masto.v1.reports.create({
                  accountId: collection.accountId,
                  collectionIds: [collection.id],
                  // Default to spam for collection reports
                  // https://github.com/mastodon/mastodon/blob/963a54664804e60ea8e30795090a0f20de7a48dc/app/javascript/mastodon/features/ui/components/report_collection_modal.tsx#L88
                  category: 'spam',
                  comment,
                  forwardToDomains: forwardToDomain ? [domain] : [],
                  forward: forwardToDomain,
                });
                showToast(t`Collection reported`);
                onClose();
              } catch (error) {
                console.error(error);
                setUIState('error');
                showToast(error?.message || t`Unable to report collection`);
              }
            })();
          }}
        >
          <section class="report-comment">
            <p>
              <label for="report-collection-comment">
                <Trans>Additional comments</Trans>
              </label>
            </p>
            <textarea
              maxlength="1000"
              rows="2"
              id="report-collection-comment"
              name="comment"
              disabled={uiState === 'loading'}
            />
          </section>
          {isRemote && (
            <section class="report-forward-section">
              <label>
                <input
                  type="checkbox"
                  switch
                  name="forwardToDomain"
                  disabled={uiState === 'loading'}
                />{' '}
                <span>
                  <Trans>
                    Forward to <i>{domain}</i>
                  </Trans>
                </span>
              </label>
            </section>
          )}
          <footer>
            <button type="submit" disabled={uiState === 'loading'}>
              <Trans>Send Report</Trans>
            </button>
            <Loader hidden={uiState !== 'loading'} />
          </footer>
        </form>
      </main>
    </div>
  );
}

export default ReportCollection;
