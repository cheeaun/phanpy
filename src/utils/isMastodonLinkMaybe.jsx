export default function isMastodonLinkMaybe(url) {
  const { pathname } = new URL(url);
  return (
    /^\/.*\/\d+$/i.test(pathname) ||
    /^\/@[^/]+\/statuses\/\w+$/i.test(pathname) || // GoToSocial
    /^\/notes\/[a-z0-9]+$/i.test(pathname) // Misskey, Calckey
  );
}
