export default function isMastodonLinkMaybe(url) {
  const { pathname } = new URL(url);
  return (
    /^\/.*\/\d+$/i.test(pathname) || /^\/notes\/[a-z0-9]+$/i.test(pathname) // Misskey, Calckey
  );
}
