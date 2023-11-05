export default function isMastodonLinkMaybe(url) {
  const { pathname, hash } = new URL(url);
  return (
    /^\/.*\/\d+$/i.test(pathname) ||
    /^\/@[^/]+\/(statuses|posts)\/\w+\/?$/i.test(pathname) || // GoToSocial, Takahe
    /^\/notes\/[a-z0-9]+$/i.test(pathname) || // Misskey, Calckey
    /^\/notes\/[a-z0-9]+$/i.test(pathname) || // Misskey, Calckey
    /^\/(notice|objects)\/[a-z0-9-]+$/i.test(pathname) || // Pleroma
    /#\/[^\/]+\.[^\/]+\/s\/.+/i.test(hash) // Phanpy 🫣
  );
}
