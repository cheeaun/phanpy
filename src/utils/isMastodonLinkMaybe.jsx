export default function isMastodonLinkMaybe(url) {
  return /^https:\/\/.*\/\d+$/i.test(url);
}
