export default function isMastodonLinkMaybe(url) {
  try {
    const { pathname, hash, hostname } = URL.parse(url);
    return (
      /^\/.*\/\d+$/i.test(pathname) ||
      /^\/(@[^/]+|users\/[^/]+)\/(statuses|posts)\/[\w-]+\/?$/i.test(
        pathname,
      ) || // GoToSocial, Takahe, Castopod
      /^\/notes\/[a-z0-9]+$/i.test(pathname) || // Misskey, Firefish
      /^\/(notice|objects)\/[a-z0-9-]+$/i.test(pathname) || // Pleroma
      /^\/@[^/]+\/post\/[a-z0-9\-_]+$/i.test(pathname) || // Threads
      /^\/@[^/]+\/[a-z0-9]+[a-z0-9\-]+[a-z0-9]+$/i.test(pathname) || // Hollo
      /^\/ap\/note\/[a-z0-9\-_]+$/i.test(pathname) || // BotKit, Fedify
      (/(fed|bsky)\.brid\.gy/i.test(hostname) &&
        pathname.startsWith('/r/http')) || // Bridgy Fed
      /^\/[^\/]+\/p\/\d+\.\d+$/i.test(pathname) || // snac2
      /^\/fediverse\/post\/[a-z0-9\-]+$/i.test(pathname) || // Wafrn
      /#\/[^\/]+\.[^\/]+\/s\/.+/i.test(hash) // Phanpy 🫣
    );
  } catch (e) {
    return false;
  }
}
