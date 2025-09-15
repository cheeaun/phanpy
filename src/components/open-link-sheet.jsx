import './open-link-sheet.css';

import { Trans, useLingui } from '@lingui/react/macro';

import showToast from '../utils/show-toast';

import Icon from './icon';

export default function OpenLinkSheet({ url, linkText, onClose }) {
  const { t } = useLingui();
  if (!url) return null;

  let displayUrl = url;
  try {
    const urlObj = URL.parse(url);
    const protocol = urlObj.protocol;
    const hostname = urlObj.hostname;
    const rest = url.slice(urlObj.origin.length);
    displayUrl = (
      <>
        {protocol}//<strong>{hostname}</strong>
        {rest}
      </>
    );
  } catch (e) {}

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(url);
      showToast(t`Link copied`);
    } catch (e) {
      console.error(e);
      showToast(t`Unable to copy link`);
    }
  };

  const handleShare = () => {
    if (navigator.share && navigator.canShare({ url })) {
      try {
        navigator.share({ url });
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div class="sheet sheet-modal" id="open-link-sheet" tabindex="-1">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header class="header-grid">
        <h2>
          <Trans>Open link?</Trans>
        </h2>
      </header>
      <main>
        {!!linkText && (
          <>
            <p class="link-text">
              <Icon icon="cursor-hand" size="xl" /> {linkText}
            </p>
            <div class="arrow">
              <Icon icon="arrow-down" />
            </div>
          </>
        )}
        <p class="full-url">{displayUrl}</p>
      </main>
      <footer>
        <button type="button" class="light" onClick={onClose}>
          <Trans>Cancel</Trans>
        </button>
        <span class="spacer" />
        <button type="button" class="plain6" onClick={handleCopy}>
          <Icon icon="copy" alt={t`Copy`} />
        </button>
        {navigator.canShare && navigator.canShare({ url }) && (
          <button type="button" class="plain6" onClick={handleShare}>
            <Icon icon="share" alt={t`Share…`} />
          </button>
        )}
        <a
          class="button"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
        >
          <Trans>Open</Trans>
        </a>
      </footer>
    </div>
  );
}
