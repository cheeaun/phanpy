const COLLECTIONS_PAGE_REGEXES = [
  /^\/(@[^/]+)\/collections/i, // Mastodon: /@username/collections or /@username@domain/collections
];

function extractCollectionsPageInfo(href) {
  try {
    const urlObj = URL.parse(href);
    if (!urlObj?.hostname || !urlObj?.pathname) return null;

    const domain = urlObj.hostname.replace(/^www\./i, '');
    const path = urlObj.pathname.replace(/\/$/, '');

    for (const regex of COLLECTIONS_PAGE_REGEXES) {
      const match = path.match(regex);
      if (match) {
        const acctWithAt = match[1];
        return { domain, acct: acctWithAt.slice(1) }; // Remove leading @
      }
    }

    return null;
  } catch {
    return null;
  }
}

export default extractCollectionsPageInfo;
