import { expect, test } from '@playwright/test';

import { postToStatus } from '../src/utils/atproto-adapter.js';
import {
  canReadCardInline,
  isLeafletUrl,
  isStandardSiteDocumentRecord,
} from '../src/utils/standard-site.js';

function postWithEmbed(embed) {
  return {
    uri: 'at://did:plc:alice/app.bsky.feed.post/standard-site',
    cid: 'post-cid',
    author: {
      did: 'did:plc:alice',
      handle: 'alice.test',
      displayName: 'Alice',
    },
    record: {
      $type: 'app.bsky.feed.post',
      text: 'read this',
      createdAt: '2026-05-11T00:00:00.000Z',
    },
    embed,
    indexedAt: '2026-05-11T00:00:00.000Z',
    replyCount: 0,
    repostCount: 0,
    likeCount: 0,
    quoteCount: 0,
  };
}

test.describe('ATProto Standard.site cards', () => {
  test('detects Leaflet and Standard.site document cards as inline-readable', () => {
    expect(isLeafletUrl('https://leaflet.pub/abc')).toBe(true);
    expect(isLeafletUrl('https://lab.leaflet.pub/abc')).toBe(true);
    expect(isLeafletUrl('https://leaflet.mosphere.at/abc')).toBe(true);
    expect(isLeafletUrl('https://example.com/abc')).toBe(false);

    expect(
      isStandardSiteDocumentRecord(
        'at://did:plc:test/site.standard.document/abc',
      ),
    ).toBe(true);

    expect(
      isStandardSiteDocumentRecord({
        uri: 'at://did:plc:test/site.standard.document/abc',
      }),
    ).toBe(true);

    expect(
      canReadCardInline({
        url: 'https://example.com/post',
        associatedRecord: {
          uri: 'at://did:plc:test/site.standard.document/abc',
        },
      }),
    ).toBe(true);
  });

  test('preserves associated Standard.site records on link cards', () => {
    const status = postToStatus(
      postWithEmbed({
        $type: 'app.bsky.embed.external#view',
        external: {
          uri: 'https://lab.leaflet.pub/3md4qsktbms24',
          title: 'Leaflet post',
          description: 'Longform post',
          associatedRecord: {
            uri: 'at://did:plc:test/site.standard.document/3md4qsktbms24',
            cid: 'bafyreitest',
          },
        },
      }),
    );

    expect(status.card).toMatchObject({
      url: 'https://lab.leaflet.pub/3md4qsktbms24',
      title: 'Leaflet post',
      associatedRecord: {
        uri: 'at://did:plc:test/site.standard.document/3md4qsktbms24',
        cid: 'bafyreitest',
      },
    });
    expect(canReadCardInline(status.card)).toBe(true);
  });
});
