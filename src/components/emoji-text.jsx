import { memo } from 'preact/compat';

import mem from '../utils/mem';

import CustomEmoji from './custom-emoji';

const shortcodesRegexp = mem((shortcodes) => {
  return new RegExp(`:(${shortcodes.join('|')}):`, 'g');
});

function EmojiText({ text, emojis, staticEmoji }) {
  if (!text) return '';
  if (!emojis?.length) return text;
  if (text.indexOf(':') === -1) return text;
  // const regex = new RegExp(
  //   `:(${emojis.map((e) => e.shortcode).join('|')}):`,
  //   'g',
  // );
  const regex = shortcodesRegexp(emojis.map((e) => e.shortcode));
  const elements = text.split(regex).map((word, i) => {
    const emoji = emojis.find((e) => e.shortcode === word);
    if (emoji) {
      const { url, staticUrl } = emoji;
      return (
        <CustomEmoji
          staticUrl={staticEmoji ? undefined : staticUrl}
          alt={word}
          url={staticEmoji ? staticUrl || url : url}
          key={word + '-' + i} // Handle >= 2 same shortcodes
        />
      );
    }
    return word;
  });
  return elements;
}

export default mem(EmojiText);

// export default memo(
//   EmojiText,
//   (oldProps, newProps) =>
//     oldProps.text === newProps.text &&
//     oldProps.emojis?.length === newProps.emojis?.length,
// );
