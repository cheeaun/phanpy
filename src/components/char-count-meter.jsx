import { useSnapshot } from 'valtio';

import states from '../utils/states';

function CharCountMeter({ maxCharacters = 500, hidden }) {
  const snapStates = useSnapshot(states);
  const charCount = snapStates.composerCharacterCount;
  const leftChars = maxCharacters - charCount;
  if (hidden) {
    return <span class="char-counter" hidden />;
  }
  return (
    <span
      class="char-counter"
      title={`${leftChars}/${maxCharacters}`}
      style={{
        '--percentage': (charCount / maxCharacters) * 100,
      }}
    >
      <meter
        class={`${
          leftChars <= -10
            ? 'explode'
            : leftChars <= 0
              ? 'danger'
              : leftChars <= 20
                ? 'warning'
                : ''
        }`}
        value={charCount}
        max={maxCharacters}
      />
      <span class="counter">{leftChars}</span>
    </span>
  );
}

export default CharCountMeter;
