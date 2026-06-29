function normalizeURL(url) {
  const parsed = URL.parse(url);
  if (!parsed) return url;
  const origin = parsed.origin;
  const pathname = parsed.pathname.replace(/\/$/, '') || '/';
  parsed.searchParams.sort();
  return origin + pathname + parsed.search;
}

export default function isSameURL(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeURL(a) === normalizeURL(b);
}
