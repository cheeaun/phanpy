// export const statusRegex = /\/@([^@\/]+)@?([^\/]+)?\/([^\/]+)\/?$/i;
// export const statusNoteRegex = /\/notes\/([^\/]+)\/?$/i;

const statusPostRegexes = [
  /^\/@[^@\/]+\/(?:statuses|posts)\/([^\/]+)/i, // GoToSocial, Takahe
  /\/notes\/([^\/]+)/i, // Misskey, Firefish
  /^\/(?:notice|objects)\/([a-z0-9-]+)/i, // Pleroma
  /\/@[^@\/]+@?[^\/]+?\/([^\/]+)/i, // Mastodon
];

export function getInstanceStatusObject(url) {
  // Regex /:username/:id, where username = @username or @username@domain, id = anything
  const { hostname, pathname } = new URL(url);
  // const [, username, domain, id] = pathname.match(statusRegex) || [];
  for (const regex of statusPostRegexes) {
    const [, id] = pathname.match(regex) || [];
    console.log(pathname, regex, id);
    if (id) {
      return {
        instance: hostname,
        id,
      };
    }
  }
  return {};
}

function getInstanceStatusURL(url) {
  const { instance, id } = getInstanceStatusObject(url);
  if (instance && id) {
    return `/${instance}/s/${id}`;
  }
  return null;
}

export default getInstanceStatusURL;
