import { expect, test } from '@playwright/test';

import {
  hydrateReplyParentAccounts,
  postToStatus,
} from '../src/utils/atproto-adapter.js';
import { shouldShowReplyBadge } from '../src/utils/reply-badge.js';

const parentUri = 'at://did:plc:parent/app.bsky.feed.post/root';
const childUri = 'at://did:plc:child/app.bsky.feed.post/reply';

function feedReply(overrides = {}) {
  return {
    post: {
      uri: childUri,
      cid: 'child-cid',
      author: {
        did: 'did:plc:child',
        handle: 'child.test',
        displayName: 'Child',
      },
      record: {
        $type: 'app.bsky.feed.post',
        text: 'reply text',
        createdAt: '2026-05-08T00:00:00.000Z',
        reply: {
          root: { uri: parentUri, cid: 'parent-cid' },
          parent: { uri: parentUri, cid: 'parent-cid' },
        },
      },
      indexedAt: '2026-05-08T00:00:00.000Z',
      replyCount: 0,
      repostCount: 0,
      likeCount: 0,
      quoteCount: 0,
      ...overrides.post,
    },
    reply: {
      parent: {
        uri: parentUri,
        cid: 'parent-cid',
        author: {
          did: 'did:plc:parent',
          handle: 'parent.test',
          displayName: 'Parent',
        },
        record: {
          $type: 'app.bsky.feed.post',
          text: 'parent text',
          createdAt: '2026-05-08T00:00:00.000Z',
        },
      },
      root: {
        uri: parentUri,
        cid: 'parent-cid',
      },
      ...overrides.reply,
    },
  };
}

test.describe('ATProto reply mapping', () => {
  test('keeps the hydrated parent actor from timeline feed replies', () => {
    const status = postToStatus(feedReply());

    expect(status.inReplyToId).toBe(encodeURIComponent(parentUri));
    expect(status.inReplyToAccountId).toBe('did:plc:parent');
    expect(status._atproto.parent).toEqual({
      uri: parentUri,
      cid: 'parent-cid',
    });
    expect(status._atproto.replyParentAccount).toMatchObject({
      id: 'did:plc:parent',
      username: 'parent.test',
    });
  });

  test('falls back to the parent AT URI repo when the parent post is not hydrated', () => {
    const item = feedReply({ reply: undefined });
    delete item.reply;

    const status = postToStatus(item);

    expect(status.inReplyToAccountId).toBe('did:plc:parent');
  });

  test('batch hydrates missing parent actors before timeline render', async () => {
    const item = feedReply({ reply: undefined });
    delete item.reply;
    const status = postToStatus(item);
    let requestedActors;

    await hydrateReplyParentAccounts([status], {
      getProfiles: async ({ actors }) => {
        requestedActors = actors;
        return {
          data: {
            profiles: [
              {
                did: 'did:plc:parent',
                handle: 'parent.test',
                displayName: 'Parent',
              },
            ],
          },
        };
      },
    });

    expect(requestedActors).toEqual(['did:plc:parent']);
    expect(status._atproto.replyParentAccount).toMatchObject({
      id: 'did:plc:parent',
      username: 'parent.test',
    });
  });

  test('batch hydrates reply parents inside quoted statuses', async () => {
    const status = {
      id: 'top',
      _atproto: {},
      quote: {
        quotedStatus: postToStatus({
          uri: 'at://did:plc:quote/app.bsky.feed.post/reply',
          cid: 'quote-cid',
          author: {
            did: 'did:plc:quote',
            handle: 'quote.test',
            displayName: 'Quote',
          },
          record: {
            $type: 'app.bsky.feed.post',
            text: 'quoted reply',
            createdAt: '2026-05-08T00:00:00.000Z',
            reply: {
              root: { uri: parentUri, cid: 'parent-cid' },
              parent: { uri: parentUri, cid: 'parent-cid' },
            },
          },
          indexedAt: '2026-05-08T00:00:00.000Z',
        }),
      },
    };
    let requestedActors;

    await hydrateReplyParentAccounts([status], {
      getProfiles: async ({ actors }) => {
        requestedActors = actors;
        return {
          data: {
            profiles: [
              {
                did: 'did:plc:parent',
                handle: 'parent.test',
                displayName: 'Parent',
              },
            ],
          },
        };
      },
    });

    expect(requestedActors).toEqual(['did:plc:parent']);
    expect(status.quote.quotedStatus._atproto.replyParentAccount).toMatchObject(
      {
        id: 'did:plc:parent',
        username: 'parent.test',
      },
    );
  });

  test('shows Bluesky reply badges even when the reply mentions the parent actor', () => {
    expect(
      shouldShowReplyBadge({
        inReplyToId: encodeURIComponent(parentUri),
        inReplyToAccount: { id: 'did:plc:parent' },
        instance: 'bsky.social',
        spoilerText: '',
        mentions: [{ id: 'did:plc:parent' }],
        inReplyToAccountId: 'did:plc:parent',
      }),
    ).toBe(true);

    expect(
      shouldShowReplyBadge({
        inReplyToId: encodeURIComponent(parentUri),
        inReplyToAccount: { id: 'did:plc:parent' },
        instance: 'mastodon.social',
        spoilerText: '',
        mentions: [{ id: 'did:plc:parent' }],
        inReplyToAccountId: 'did:plc:parent',
      }),
    ).toBe(false);
  });
});
