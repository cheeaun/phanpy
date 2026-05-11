export const BSKY_LINK_META_PROXY = 'https://cardyb.bsky.app/v1/extract?url=';

const HTTP_URL_RE = /https?:\/\/[^\s<>"']+/i;

export function getFirstPostURL(text = '') {
  const match = HTTP_URL_RE.exec(text);
  return match?.[0]?.replace(/[),.;!?]+$/, '') || null;
}

function getAssociatedRecord(value) {
  if (!value || typeof value !== 'object') return undefined;
  return value;
}

export async function fetchAtprotoLinkMetadata(uri, { fetcher = fetch } = {}) {
  if (!uri) return null;
  const res = await fetcher(
    `${BSKY_LINK_META_PROXY}${encodeURIComponent(uri)}`,
  );
  if (!res.ok) return null;
  const metadata = await res.json();
  if (metadata?.error) return null;
  return metadata;
}

export async function createAtprotoExternalEmbed(
  agent,
  uri,
  { fetcher = fetch } = {},
) {
  if (!uri) return null;
  let metadata;
  try {
    metadata = await fetchAtprotoLinkMetadata(uri, { fetcher });
  } catch (e) {
    console.error('Failed to fetch Bluesky link metadata', e);
    return null;
  }
  if (!metadata) return null;

  const external = {
    uri: metadata.url || uri,
    title: metadata.title || '',
    description: metadata.description || '',
  };
  const associatedRecord = getAssociatedRecord(
    metadata.associatedRecord || metadata.associated_record,
  );
  if (associatedRecord) external.associatedRecord = associatedRecord;

  if (metadata.image) {
    try {
      const imageRes = await fetcher(metadata.image);
      if (imageRes.ok) {
        const imageBlob = await imageRes.blob();
        if (imageBlob.size > 0) {
          const uploadRes = await agent.uploadBlob(imageBlob, {
            encoding: imageBlob.type || 'image/jpeg',
          });
          if (uploadRes.data?.blob) external.thumb = uploadRes.data.blob;
        }
      }
    } catch (e) {
      console.error('Failed to upload Bluesky link thumbnail', e);
    }
  }

  return {
    $type: 'app.bsky.embed.external',
    external,
  };
}
