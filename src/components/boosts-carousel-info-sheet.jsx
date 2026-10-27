import './boosts-carousel-info-sheet.css';

import { Trans, useLingui } from '@lingui/react/macro';

import diagramURL from '../assets/boost-carousel-diagram.svg';

import Icon from './icon';

export default function BoostsCarouselInfoSheet({
  inSettings = false,
  onClose = () => {},
}) {
  const { t } = useLingui();

  return (
    <div class="sheet" id="boosts-carousel-info-container" tabindex="-1">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Boosts carousel</Trans>
        </h2>
      </header>
      <main>
        <p>
          <Trans>
            Groups boosts into a carousel when they crowd the timeline.
          </Trans>
        </p>
        <div class="diagram">
          <img
            width="518"
            height="329"
            src={diagramURL}
            alt={t`Diagram showing a timeline with boosts moved into a carousel in another timeline`}
          />
        </div>
      </main>
      {!inSettings && (
        <footer class="insignificant">
          <Icon icon="info" />
          <Trans comment="Refers to the boosts carousel that can be turned off">
            Can be turned off in Settings.
          </Trans>
        </footer>
      )}
    </div>
  );
}
