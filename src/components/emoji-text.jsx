import PQueue from 'p-queue';
import { useEffect, useState } from 'preact/hooks';

import { getGifFirstFrame } from '../utils/get-gif-first-frame';
import mem from '../utils/mem';

import CustomEmoji from './custom-emoji';

const fetchQueue = new PQueue({
  concurrency: 2,
  interval: 1000,
  intervalCap: 2,
});

const throttledFetch = (signal, ...args) =>
  fetchQueue.add(() => fetch(...args), { signal });

const SHORTCODES_REGEX = /(\:(\w|\+|\-)+\:)(?=|[\!\.\?]|$)/g;

const shortcodesRegexp = mem((shortcodes) => {
  return new RegExp(`:(${shortcodes.join('|')}):`, 'g');
});

const resolvedEmojisCache = new Map();
const MAX_CACHE_SIZE = 30;

const resolveEmojis = async (resolverURL) => {
  if (resolvedEmojisCache.has(resolverURL)) {
    return resolvedEmojisCache.get(resolverURL);
  }

  try {
    const response = await throttledFetch(null, resolverURL, {
      headers: { accept: 'application/activity+json' },
      referrerPolicy: 'no-referrer',
    });

    const data = await response.json();
    const emojiTags = data.tag?.filter((t) => t.type === 'Emoji') || [];

    const emojis = emojiTags.length
      ? await Promise.all(
          emojiTags.map(async (t) => {
            const emoji = {
              shortcode: t.name.replace(/^:|:$/g, ''),
              url: t.icon.url,
            };
            if (t.icon?.mediaType === 'image/gif') {
              const staticUrl = await getGifFirstFrame(emoji.url);
              if (staticUrl) emoji.staticUrl = staticUrl;
            }
            return emoji;
          }),
        )
      : [];

    if (resolvedEmojisCache.size >= MAX_CACHE_SIZE) {
      const firstKey = resolvedEmojisCache.keys().next().value;
      resolvedEmojisCache.delete(firstKey);
    }

    resolvedEmojisCache.set(resolverURL, emojis);
    return emojis;
  } catch (error) {
    console.error('Failed to resolve emojis:', error);
    return [];
  }
};

const renderEmojiText = mem((text, allEmojis, staticEmoji) => {
  if (!text) return '';
  if (!text.includes(':')) return text;
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
});

function EmojiText({ text, emojis = [], staticEmoji, resolverURL }) {
  const [resolvedEmojis, setResolvedEmojis] = useState(
    () => resolvedEmojisCache.get(resolverURL) || [],
  );
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

    if (resolvedEmojisCache.has(resolverURL)) return;

    setLoading(true);

    (async () => {
      const emojis = await resolveEmojis(resolverURL);
      setResolvedEmojis(emojis);
      setLoading(false);
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

  return renderEmojiText(text, allEmojis, staticEmoji);
}

export default EmojiText;
