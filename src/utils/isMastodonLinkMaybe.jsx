export default function isMastodonLinkMaybe(url) {
  return (
    /^https:\/\/.*\/\d+$/i.test(url) ||
    /^https:\/\/.*\/notes\/[a-z0-9]+$/i.test(url) // Misskey, Calckey
  );
}
