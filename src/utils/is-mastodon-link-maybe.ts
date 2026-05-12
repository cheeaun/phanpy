export default function isMastodonLinkMaybe(url: string): boolean {
  try {
    const parsedUrl = URL.parse(url);

    if (!parsedUrl) {
      return false;
    }

    const { pathname, hash, hostname } = parsedUrl;
    return (
      /^\/.*\/\d+$/iu.test(pathname) ||
      // GoToSocial, Takahe, Castopod
      /^\/(@[^/]+|users\/[^/]+)\/(statuses|posts)\/[\w-]+\/?$/iu.test(
        pathname,
      ) ||
      // Misskey, Firefish
      /^\/notes\/[a-z0-9]+$/iu.test(pathname) ||
      // Pleroma
      /^\/(notice|objects)\/[a-z0-9-]+$/iu.test(pathname) ||
      // Threads
      /^\/@[^/]+\/post\/[a-z0-9_-]+$/iu.test(pathname) ||
      // Hollo
      /^\/@[^/]+\/[a-z0-9]+[a-z0-9-]+[a-z0-9]+$/iu.test(pathname) ||
      // BotKit, Fedify
      /^\/ap\/note\/[a-z0-9_-]+$/iu.test(pathname) ||
      // Bridgy Fed
      (/(fed|bsky)\.brid\.gy/iu.test(hostname) &&
        pathname.startsWith('/r/http')) ||
      // Snac2
      /^\/[^/]+\/p\/\d+\.\d+$/iu.test(pathname) ||
      // Wafrn
      /^\/fediverse\/post\/[a-z0-9-]+$/iu.test(pathname) ||
      // Loops
      /^\/v\/[a-z0-9]+$/iu.test(pathname) ||
      // Phanpy
      /#\/[^/]+\.[^/]+\/s\/.+/iu.test(hash)
    );
  } catch {
    return false;
  }
}
