const SHORTCODES_REGEX = /(\:(\w|\+|\-)+\:)(?=|[\!\.\?]|$)/g;

export function stripShortCodes(text, emojis = []) {
  if (!text) return '';
  let strippedText = text;
  for (const emoji of emojis) {
    const shortcode = emoji?.shortcode;
    if (shortcode) strippedText = strippedText.replaceAll(`:${shortcode}:`, '');
  }
  return strippedText.trim();
}

export { SHORTCODES_REGEX };
