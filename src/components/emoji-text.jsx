import pThrottle from 'p-throttle';
import { useEffect, useState } from 'preact/hooks';

import { getGifFirstFrame } from '../utils/get-gif-first-frame';
import mem from '../utils/mem';

import CustomEmoji from './custom-emoji';

const throttledFetch = pThrottle({
  limit: 2,
  interval: 1000,
})(fetch);

const SHORTCODES_REGEX = /(\:(\w|\+|\-)+\:)(?=|[\!\.\?]|$)/g;

const shortcodesRegexp = mem((shortcodes) => {
  return new RegExp(`:(${shortcodes.join('|')}):`, 'g');
});

function EmojiText({ text, emojis = [], staticEmoji, resolverURL }) {
  const [resolvedEmojis, setResolvedEmojis] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!resolverURL || !text?.includes(':')) return;

    const matches = text.match(SHORTCODES_REGEX);
    if (!matches) return;

    const hasUnresolved = matches.some((match) => {
      const shortcode = match.slice(1, -1);
      return !emojis.some((e) => e.shortcode === shortcode);
    });
    if (!hasUnresolved) return;

    setLoading(true);

    (async () => {
      try {
        const response = await throttledFetch(resolverURL, {
          headers: { accept: 'application/activity+json' },
          referrerPolicy: 'no-referrer',
        });

        const data = await response.json();
        const emojiTags = data.tag?.filter((t) => t.type === 'Emoji') || [];

        if (!emojiTags.length) return;

        const emojis = emojiTags.map((t) => ({
          shortcode: t.name.replace(/^:|:$/g, ''),
          url: t.icon.url,
        }));

        await Promise.all(
          emojis.map(async (emoji, index) => {
            const tag = emojiTags[index];
            if (tag.icon?.mediaType === 'image/gif') {
              const staticUrl = await getGifFirstFrame(emoji.url);
              if (staticUrl) emoji.staticUrl = staticUrl;
            }
          }),
        );

        setResolvedEmojis(emojis);
      } catch (error) {
        console.error('Failed to resolve emojis:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [resolverURL, text, emojis?.length]);

  if (!text) return '';
  if (!text.includes(':')) return text;

  if (resolverURL && loading) {
    return text.replace(SHORTCODES_REGEX, '');
  }

  const allEmojis = [
    ...resolvedEmojis.filter(
      (resolved) =>
        !emojis.some((emoji) => emoji.shortcode === resolved.shortcode),
    ),
    ...emojis,
  ];
  if (!allEmojis.length) return text;

  const regex = shortcodesRegexp(allEmojis.map((e) => e.shortcode));
  const elements = text.split(regex).map((word, index) => {
    const emoji = allEmojis.find((e) => e.shortcode === word);

    if (emoji) {
      const { url, staticUrl } = emoji;
      return (
        <CustomEmoji
          key={`${word}-${index}`}
          staticUrl={staticEmoji ? undefined : staticUrl}
          url={staticEmoji ? staticUrl || url : url}
          alt={word}
        />
      );
    }

    return word;
  });

  return elements;
}

export default EmojiText;
