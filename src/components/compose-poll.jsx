import { Trans, useLingui } from '@lingui/react/macro';

import i18nDuration from '../utils/i18n-duration';

import Icon from './icon';
import TextExpander from './text-expander';

export const expiryOptions = {
  300: i18nDuration(5, 'minute'),
  1_800: i18nDuration(30, 'minute'),
  3_600: i18nDuration(1, 'hour'),
  21_600: i18nDuration(6, 'hour'),
  86_400: i18nDuration(1, 'day'),
  259_200: i18nDuration(3, 'day'),
  604_800: i18nDuration(1, 'week'),
};

function ComposePoll({
  lang,
  poll,
  disabled,
  onInput = () => {},
  maxOptions,
  maxExpiration,
  minExpiration,
  maxCharactersPerOption,
}) {
  const { t } = useLingui();
  const { options, expiresIn, multiple } = poll;

  return (
    <div class={`poll ${multiple ? 'multiple' : ''}`}>
      <div class="poll-choices">
        {options.map((option, i) => (
          <div class="poll-choice" key={i}>
            <TextExpander keys=":" class="poll-field-container">
              <input
                required
                type="text"
                value={option}
                disabled={disabled}
                maxlength={maxCharactersPerOption}
                placeholder={t`Choice ${i + 1}`}
                lang={lang}
                spellCheck="true"
                autocomplete="off"
                dir="auto"
                data-allow-custom-emoji="true"
                onInput={(e) => {
                  const { value } = e.target;
                  options[i] = value;
                  onInput(poll);
                }}
              />
            </TextExpander>
            <button
              type="button"
              class="plain4 poll-button"
              disabled={disabled || options.length <= 1}
              onClick={() => {
                options.splice(i, 1);
                onInput(poll);
              }}
              title={t`Remove`}
            >
              −
            </button>
          </div>
        ))}
      </div>
      <div class="poll-toolbar">
        <button
          type="button"
          class="plain2 poll-button"
          disabled={disabled || options.length >= maxOptions}
          onClick={() => {
            options.push('');
            onInput(poll);
          }}
          title={t`Add`}
        >
          +
        </button>{' '}
        <div class="poll-config">
          <label class="multiple-choices">
            <input
              type="checkbox"
              checked={multiple}
              disabled={disabled}
              onChange={(e) => {
                const { checked } = e.target;
                poll.multiple = checked;
                onInput(poll);
              }}
            />{' '}
            <Trans>Multiple choice</Trans>
          </label>
          <label class="expires-in">
            <Trans>Duration</Trans>{' '}
            <select
              value={expiresIn}
              disabled={disabled}
              onChange={(e) => {
                const { value } = e.target;
                poll.expiresIn = value;
                onInput(poll);
              }}
            >
              {Object.entries(expiryOptions)
                .filter(([value]) => {
                  return value >= minExpiration && value <= maxExpiration;
                })
                .map(([value, label]) => (
                  <option value={value} key={value}>
                    {label()}
                  </option>
                ))}
            </select>
          </label>
          <div class="spacer" />
          <button
            type="button"
            class="light danger small"
            disabled={disabled}
            onClick={() => {
              onInput(null);
            }}
          >
            <Trans>Remove poll</Trans>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ComposePoll;
