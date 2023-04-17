export const statusRegex = /\/@([^@\/]+)@?([^\/]+)?\/([^\/]+)\/?$/i;
export const statusNoteRegex = /\/notes\/([^\/]+)\/?$/i;
function getInstanceStatusURL(url) {
  // Regex /:username/:id, where username = @username or @username@domain, id = anything
  const { hostname, pathname } = new URL(url);
  const [, username, domain, id] = pathname.match(statusRegex) || [];

  if (id) {
    return `/${hostname}/s/${id}`;
  }

  const [, noteId] = pathname.match(statusNoteRegex) || [];

  if (noteId) {
    return `/${hostname}/s/${noteId}`;
  }
}

export default getInstanceStatusURL;
