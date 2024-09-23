export default function isMastodonLinkMaybe(url) {
  try {
    const { pathname, hash, hostname } = URL.parse(url);
    return (
      /^\/.*\/\d+$/i.test(pathname) ||
      /^\/(@[^/]+|users\/[^/]+)\/(statuses|posts)\/\w+\/?$/i.test(pathname) || // GoToSocial, Takahe
      /^\/notes\/[a-z0-9]+$/i.test(pathname) || // Misskey, Firefish
      /^\/(notice|objects)\/[a-z0-9-]+$/i.test(pathname) || // Pleroma
      /^\/@[^/]+\/post\/[a-z0-9\-_]+$/i.test(pathname) || // Threads
      /^\/@[^/]+\/[a-z0-9]+[a-z0-9\-]+[a-z0-9]+$/i.test(pathname) || // Hollo
      (hostname === 'fed.brid.gy' && pathname.startsWith('/r/http')) || // Bridgy Fed
      /#\/[^\/]+\.[^\/]+\/s\/.+/i.test(hash) // Phanpy 🫣
    );
  } catch (e) {
    return false;
  }
}
