const STANDARD_SITE_DOCUMENT_COLLECTION = 'site.standard.document';

interface StandardSiteRecordFields {
  $type?: unknown;
  collection?: unknown;
  uri?: unknown;
}

interface StandardSiteDocumentCandidate extends StandardSiteRecordFields {
  record?: StandardSiteRecordFields;
}

interface CardCandidate {
  associated_record?: unknown;
  associatedRecord?: unknown;
  url?: string;
}

function hasStandardSiteDocumentCollection(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.includes(STANDARD_SITE_DOCUMENT_COLLECTION)
  );
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && Object(value) === value;
}

function isStandardSiteDocumentRecord(record: unknown): boolean {
  if (typeof record === 'string') {
    return record.includes(STANDARD_SITE_DOCUMENT_COLLECTION);
  }

  if (!isObject(record)) {
    return false;
  }

  const candidate = record as StandardSiteDocumentCandidate;
  const uri = candidate.uri || candidate.record?.uri;
  const collection = candidate.collection || candidate.record?.collection;
  const type = candidate.$type || candidate.record?.$type;

  return [uri, collection, type].some((value) =>
    hasStandardSiteDocumentCollection(value),
  );
}

function isLeafletUrl(url: string): boolean {
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

function canReadCardInline(card: unknown): boolean {
  if (!isObject(card)) {
    return false;
  }

  const candidate = card as CardCandidate;
  if (typeof candidate.url !== 'string' || candidate.url === '') {
    return false;
  }

  return (
    isLeafletUrl(candidate.url) ||
    isStandardSiteDocumentRecord(candidate.associatedRecord) ||
    isStandardSiteDocumentRecord(candidate.associated_record)
  );
}

export { canReadCardInline, isLeafletUrl, isStandardSiteDocumentRecord };
