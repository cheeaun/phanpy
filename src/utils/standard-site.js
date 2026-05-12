const STANDARD_SITE_DOCUMENT_COLLECTION = 'site.standard.document';

export function isStandardSiteDocumentRecord(record) {
  if (!record) return false;

  if (typeof record === 'string') {
    return record.includes(STANDARD_SITE_DOCUMENT_COLLECTION);
  }

  if (typeof record !== 'object') return false;

  const uri = record.uri || record.record?.uri;
  const collection = record.collection || record.record?.collection;
  const type = record.$type || record.record?.$type;

  return [uri, collection, type].some((value) =>
    String(value || '').includes(STANDARD_SITE_DOCUMENT_COLLECTION),
  );
}

export function isLeafletUrl(url) {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'leaflet.pub' ||
      hostname.endsWith('.leaflet.pub') ||
      hostname.startsWith('leaflet.')
    );
  } catch {
    return false;
  }
}

export function canReadCardInline(card) {
  if (!card?.url) return false;

  return (
    isLeafletUrl(card.url) ||
    isStandardSiteDocumentRecord(card.associatedRecord) ||
    isStandardSiteDocumentRecord(card.associated_record)
  );
}
