export default function isMastodonLinkMaybe(url) {
  try {
    const { pathname, hash } = new URL(url);
    return (
      /^\/.*\/\d+$/i.test(pathname) ||
      /^\/(@[^/]+|users\/[^/]+)\/(statuses|posts)\/\w+\/?$/i.test(pathname) || // GoToSocial, Takahe
      /^\/notes\/[a-z0-9]+$/i.test(pathname) || // Misskey, Firefish
      /^\/(notice|objects)\/[a-z0-9-]+$/i.test(pathname) || // Pleroma
      /#\/[^\/]+\.[^\/]+\/s\/.+/i.test(hash) // Phanpy 🫣
    );
  } catch (e) {
    return false;
  }
}
