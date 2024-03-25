import { memo } from 'preact/compat';

import CustomEmoji from './custom-emoji';

function EmojiText({ text, emojis }) {
  if (!text) return '';
  if (!emojis?.length) return text;
  if (text.indexOf(':') === -1) return text;
  const regex = new RegExp(
    `:(${emojis.map((e) => e.shortcode).join('|')}):`,
    'g',
  );
  const elements = text.split(regex).map((word) => {
    const emoji = emojis.find((e) => e.shortcode === word);
    if (emoji) {
      const { url, staticUrl } = emoji;
      return <CustomEmoji staticUrl={staticUrl} alt={word} url={url} />;
    }
    return word;
  });
  return elements;
}

export default memo(
  EmojiText,
  (oldProps, newProps) =>
    oldProps.text === newProps.text &&
    oldProps.emojis?.length === newProps.emojis?.length,
);
