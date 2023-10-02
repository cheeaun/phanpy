import { useState } from 'preact/hooks';

import shortenNumber from '../utils/shorten-number';

import EmojiText from './emoji-text';
import Icon from './icon';
import RelativeTime from './relative-time';

export default function Poll({
  poll,
  lang,
  readOnly,
  refresh = () => {},
  votePoll = () => {},
}) {
  const [uiState, setUIState] = useState('default');
  const {
    expired,
    expiresAt,
    id,
    multiple,
    options,
    ownVotes,
    voted,
    votersCount,
    votesCount,
    emojis,
  } = poll;
  const expiresAtDate = !!expiresAt && new Date(expiresAt); // Update poll at point of expiry
  // NOTE: Disable this because setTimeout runs immediately if delay is too large
  // https://stackoverflow.com/a/56718027/20838
  // useEffect(() => {
  //   let timeout;
  //   if (!expired && expiresAtDate) {
  //     const ms = expiresAtDate.getTime() - Date.now() + 1; // +1 to give it a little buffer
  //     if (ms > 0) {
  //       timeout = setTimeout(() => {
  //         setUIState('loading');
  //         (async () => {
  //           // await refresh();
  //           setUIState('default');
  //         })();
  //       }, ms);
  //     }
  //   }
  //   return () => {
  //     clearTimeout(timeout);
  //   };
  // }, [expired, expiresAtDate]);

  const pollVotesCount = votersCount || votesCount;
  let roundPrecision = 0;

  if (pollVotesCount <= 1000) {
    roundPrecision = 0;
  } else if (pollVotesCount <= 10000) {
    roundPrecision = 1;
  } else if (pollVotesCount <= 100000) {
    roundPrecision = 2;
  }

  const [showResults, setShowResults] = useState(false);
  const optionsHaveVoteCounts = options.every((o) => o.votesCount !== null);

  return (
    <div
      lang={lang}
      dir="auto"
      class={`poll ${readOnly ? 'read-only' : ''} ${
        uiState === 'loading' ? 'loading' : ''
      }`}
    >
      {(showResults && optionsHaveVoteCounts) || voted || expired ? (
        <>
          <div class="poll-options">
            {options.map((option, i) => {
              const { title, votesCount: optionVotesCount } = option;
              const percentage = pollVotesCount
                ? ((optionVotesCount / pollVotesCount) * 100).toFixed(
                    roundPrecision,
                  )
                : 0; // check if current poll choice is the leading one

              const isLeading =
                optionVotesCount > 0 &&
                optionVotesCount ===
                  Math.max(...options.map((o) => o.votesCount));
              return (
                <div
                  key={`${i}-${title}-${optionVotesCount}`}
                  class={`poll-option poll-result ${
                    isLeading ? 'poll-option-leading' : ''
                  }`}
                  style={{
                    '--percentage': `${percentage}%`,
                  }}
                >
                  <div class="poll-option-title">
                    <span>
                      <EmojiText text={title} emojis={emojis} />
                    </span>
                    {voted && ownVotes.includes(i) && (
                      <>
                        {' '}
                        <Icon icon="check-circle" />
                      </>
                    )}
                  </div>
                  <div
                    class="poll-option-votes"
                    title={`${optionVotesCount} vote${
                      optionVotesCount === 1 ? '' : 's'
                    }`}
                  >
                    {percentage}%
                  </div>
                </div>
              );
            })}
          </div>
          {!expired && !voted && (
            <button
              class="poll-vote-button plain2"
              disabled={uiState === 'loading'}
              onClick={(e) => {
                e.preventDefault();
                setShowResults(false);
              }}
            >
              <Icon icon="arrow-left" size="s" /> Hide results
            </button>
          )}
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            const choices = [];
            formData.forEach((value, key) => {
              if (key === 'poll') {
                choices.push(value);
              }
            });
            if (!choices.length) return;
            setUIState('loading');
            await votePoll(choices);
            setUIState('default');
          }}
        >
          <div class="poll-options">
            {options.map((option, i) => {
              const { title } = option;
              return (
                <div class="poll-option">
                  <label class="poll-label">
                    <input
                      type={multiple ? 'checkbox' : 'radio'}
                      name="poll"
                      value={i}
                      disabled={uiState === 'loading'}
                      readOnly={readOnly}
                    />
                    <span class="poll-option-title">
                      <EmojiText text={title} emojis={emojis} />
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
          {!readOnly && (
            <button
              class="poll-vote-button"
              type="submit"
              disabled={uiState === 'loading'}
            >
              Vote
            </button>
          )}
        </form>
      )}
      <p class="poll-meta">
        {!expired && !readOnly && (
          <button
            type="button"
            class="plain small"
            disabled={uiState === 'loading'}
            style={{
              marginLeft: -8,
            }}
            onClick={(e) => {
              e.preventDefault();
              setUIState('loading');

              (async () => {
                await refresh();
                setUIState('default');
              })();
            }}
            title="Refresh"
          >
            <Icon icon="refresh" alt="Refresh" />
          </button>
        )}
        {!voted && !expired && !readOnly && optionsHaveVoteCounts && (
          <button
            type="button"
            class="plain small"
            disabled={uiState === 'loading'}
            onClick={(e) => {
              e.preventDefault();
              setShowResults(!showResults);
            }}
            title={showResults ? 'Hide results' : 'Show results'}
          >
            <Icon
              icon={showResults ? 'eye-open' : 'eye-close'}
              alt={showResults ? 'Hide results' : 'Show results'}
            />{' '}
          </button>
        )}
        {!expired && !readOnly && ' '}
        <span title={votesCount}>{shortenNumber(votesCount)}</span> vote
        {votesCount === 1 ? '' : 's'}
        {!!votersCount && votersCount !== votesCount && (
          <>
            {' '}
            &bull; <span title={votersCount}>
              {shortenNumber(votersCount)}
            </span>{' '}
            voter
            {votersCount === 1 ? '' : 's'}
          </>
        )}{' '}
        &bull; {expired ? 'Ended' : 'Ending'}{' '}
        {!!expiresAtDate && <RelativeTime datetime={expiresAtDate} />}
      </p>{' '}
    </div>
  );
}
