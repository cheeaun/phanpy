import { i18n } from '@lingui/core';
import { plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';

import shortenNumber from '../utils/shorten-number';
import showToast from '../utils/show-toast';
import useTruncated from '../utils/useTruncated';

import EmojiText from './emoji-text';
import Icon from './icon';
import RelativeTime from './relative-time';

const POLL_OPTIONS_BATCH_SIZE = 40;

export default function Poll({
  poll,
  lang,
  readOnly,
  refresh = () => {},
  votePoll = () => {},
}) {
  const { t } = useLingui();
  const [uiState, setUIState] = useState('default');
  const [visibleOptionsCount, setVisibleOptionsCount] = useState(
    POLL_OPTIONS_BATCH_SIZE,
  );
  const loadMoreRef = useRef(null);
  const {
    expired,
    expiresAt,
    id,
    multiple,
    options,
    ownVotes,
    voted,
    votersCount,
    votesCount = 0,
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

  const pollVotesCount = multiple ? votersCount || votesCount : votesCount;
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

  const resultsView =
    (showResults && optionsHaveVoteCounts) || voted || expired;
  const [selectedOptions, setSelectedOptions] = useState(multiple ? [] : null);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    if (visibleOptionsCount >= options.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleOptionsCount((prev) =>
            Math.min(prev + POLL_OPTIONS_BATCH_SIZE, options.length),
          );
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [visibleOptionsCount, options.length]);

  useEffect(() => {
    setVisibleOptionsCount(POLL_OPTIONS_BATCH_SIZE);
  }, [resultsView, options.length]);

  const voteOptionsSelectionCount = multiple
    ? selectedOptions.length
    : selectedOptions !== null
      ? 1
      : 0;
  const [showPollInfo, setShowPollInfo] = useState(false);
  const ref = useTruncated({
    onTruncated: setShowPollInfo,
  });

  return (
    <div
      lang={lang}
      dir="auto"
      class={`poll ${readOnly ? 'read-only' : ''} ${
        uiState === 'loading' ? 'loading' : ''
      }`}
    >
      {resultsView ? (
        <>
          <div class="poll-options" ref={ref}>
            {options.slice(0, visibleOptionsCount).map((option, i) => {
              const { title, votesCount: optionVotesCount } = option;
              const ratio = pollVotesCount
                ? optionVotesCount / pollVotesCount
                : 0;
              const percentage = ratio
                ? ratio.toLocaleString(i18n.locale || undefined, {
                    style: 'percent',
                    maximumFractionDigits: roundPrecision,
                  })
                : '0%';

              const isLeading =
                optionVotesCount > 0 &&
                optionVotesCount ===
                  Math.max(...options.map((o) => o.votesCount));
              return (
                <div
                  key={`${i}-${title}`}
                  class={`poll-option poll-result ${
                    isLeading ? 'poll-option-leading' : ''
                  }`}
                  style={{
                    '--percentage': `${ratio * 100}%`,
                  }}
                >
                  <div class="poll-option-title">
                    <span>
                      <EmojiText text={title} emojis={emojis} />
                    </span>
                  </div>
                  <div
                    class="poll-option-votes"
                    title={plural(optionVotesCount, {
                      one: `# vote`,
                      other: `# votes`,
                    })}
                  >
                    {voted && ownVotes.includes(i) && (
                      <>
                        <Icon icon="check-circle" alt={t`Voted`} />{' '}
                      </>
                    )}
                    <span class="poll-option-votes-percentage">
                      {percentage}
                    </span>
                  </div>
                </div>
              );
            })}
            {visibleOptionsCount < options.length && (
              <div ref={loadMoreRef} style={{ minHeight: '1em' }} />
            )}
          </div>
          {!expired && !voted && (
            <div class="poll-actions">
              <button
                class="poll-hide-results-button plain2"
                disabled={uiState === 'loading'}
                onClick={(e) => {
                  e.preventDefault();
                  setShowResults(false);
                }}
              >
                <Icon icon="arrow-left" size="s" /> <Trans>Hide results</Trans>
              </button>{' '}
              <div class="poll-info">
                {showPollInfo && (
                  <small class="insignificant">
                    <Plural
                      value={options.length}
                      one={`# choice`}
                      other={`# choices`}
                    />
                  </small>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const choices = multiple
              ? selectedOptions
              : selectedOptions !== null
                ? [selectedOptions]
                : [];
            if (!choices.length) return;
            setUIState('loading');
            try {
              await votePoll(choices);
            } catch (e) {
              console.error(e);
              showToast(t`Unable to vote in poll`);
            } finally {
              setUIState('default');
            }
          }}
        >
          <div class="poll-options" ref={ref}>
            {options.slice(0, visibleOptionsCount).map((option, i) => {
              const { title } = option;
              const isSelected = multiple
                ? selectedOptions.includes(i)
                : selectedOptions === i;
              return (
                <div class="poll-option" key={`${i}-${title}`}>
                  <label class="poll-label">
                    <input
                      type={multiple ? 'checkbox' : 'radio'}
                      name="poll"
                      value={i}
                      disabled={uiState === 'loading'}
                      readOnly={readOnly}
                      checked={isSelected}
                      onChange={(e) => {
                        const value = i;
                        if (multiple) {
                          setSelectedOptions((prev) =>
                            e.target.checked
                              ? [...prev, value]
                              : prev.filter((v) => v !== value),
                          );
                        } else {
                          setSelectedOptions(value);
                        }
                      }}
                    />
                    <span class="poll-option-title">
                      <EmojiText text={title} emojis={emojis} />
                    </span>
                  </label>
                </div>
              );
            })}
            {visibleOptionsCount < options.length && (
              <div ref={loadMoreRef} style={{ minHeight: '1em' }} />
            )}
          </div>
          <div class="poll-actions">
            <button
              class="poll-vote-button"
              type="submit"
              disabled={
                readOnly ||
                uiState === 'loading' ||
                voteOptionsSelectionCount === 0
              }
            >
              <Trans>Vote</Trans>
            </button>{' '}
            <div class="poll-info">
              {showPollInfo &&
                (multiple && voteOptionsSelectionCount > 0 ? (
                  <small>
                    {voteOptionsSelectionCount}{' '}
                    <span class="insignificant">/ {options.length}</span>
                  </small>
                ) : (
                  <small class="insignificant">
                    <Plural
                      value={options.length}
                      one={`# choice`}
                      other={`# choices`}
                    />
                  </small>
                ))}
            </div>
          </div>
        </form>
      )}
      <p class="poll-meta">
        <span class="spacer">
          {(expired || voted) && showPollInfo && (
            <>
              <span class="ib">
                <Plural
                  value={options.length}
                  one={`# choice`}
                  other={`# choices`}
                />
              </span>{' '}
              &bull;{' '}
            </>
          )}
          <span class="ib">
            <Plural
              value={votesCount}
              one={
                <Trans>
                  <span title={votesCount}>{shortenNumber(votesCount)}</span>{' '}
                  vote
                </Trans>
              }
              other={
                <Trans>
                  <span title={votesCount}>{shortenNumber(votesCount)}</span>{' '}
                  votes
                </Trans>
              }
            />
          </span>
          {!!votersCount && votersCount !== votesCount && (
            <>
              {' '}
              &bull;{' '}
              <span class="ib">
                <Plural
                  value={votersCount}
                  one={
                    <Trans>
                      <span title={votersCount}>
                        {shortenNumber(votersCount)}
                      </span>{' '}
                      voter
                    </Trans>
                  }
                  other={
                    <Trans>
                      <span title={votersCount}>
                        {shortenNumber(votersCount)}
                      </span>{' '}
                      voters
                    </Trans>
                  }
                />
              </span>
            </>
          )}{' '}
          &bull;{' '}
          {expired ? (
            !!expiresAtDate ? (
              <span class="ib">
                <Trans>
                  Ended <RelativeTime datetime={expiresAtDate} />
                </Trans>
              </span>
            ) : (
              t`Ended`
            )
          ) : !!expiresAtDate ? (
            <span class="ib">
              <Trans>
                Ending <RelativeTime datetime={expiresAtDate} />
              </Trans>
            </span>
          ) : (
            t`Ending`
          )}
        </span>
        {!voted && !expired && !readOnly && optionsHaveVoteCounts && (
          <button
            type="button"
            class="plain small poll-results-button"
            disabled={uiState === 'loading'}
            onClick={(e) => {
              e.preventDefault();
              setShowResults(!showResults);
            }}
            title={showResults ? t`Hide results` : t`Show results`}
          >
            <Icon
              icon={showResults ? 'eye-open' : 'eye-close'}
              alt={showResults ? t`Hide results` : t`Show results`}
            />{' '}
          </button>
        )}
        {!expired && !readOnly && (
          <button
            type="button"
            class="plain small"
            disabled={uiState === 'loading'}
            onClick={(e) => {
              e.preventDefault();
              setUIState('loading');

              (async () => {
                await refresh();
                setUIState('default');
              })();
            }}
            title={t`Refresh`}
          >
            <Icon icon="refresh" alt={t`Refresh`} />
          </button>
        )}
      </p>
    </div>
  );
}
