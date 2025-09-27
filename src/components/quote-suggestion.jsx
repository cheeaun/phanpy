import './quote-suggestion.css';

import { Trans } from '@lingui/react/macro';

import Status from './status';

export default function QuoteSuggestion({
  quoteSuggestion,
  hasCurrentQuoteStatus,
  onAccept,
  onCancel,
}) {
  if (!quoteSuggestion) return null;

  return (
    <div class="quote-suggestion">
      <div class="quote-suggestion-header">
        <b>
          <Trans>Turn link into a quote?</Trans>
        </b>
        <div class="quote-suggestion-url">{quoteSuggestion.url}</div>
      </div>
      <div class="quote-status">
        <Status
          status={quoteSuggestion.status}
          instance={quoteSuggestion.instance}
          size="s"
          readOnly
        />
      </div>
      <div class="quote-suggestion-actions">
        <span class="spacer" />
        <button type="button" class="plain" onClick={onCancel}>
          {hasCurrentQuoteStatus ? (
            <Trans>Cancel</Trans>
          ) : (
            <Trans>Keep as link</Trans>
          )}
        </button>
        <button type="button" class="plain6" onClick={onAccept}>
          {hasCurrentQuoteStatus ? (
            <Trans>Replace current quote</Trans>
          ) : (
            <Trans>Turn into quote</Trans>
          )}
        </button>
      </div>
    </div>
  );
}
