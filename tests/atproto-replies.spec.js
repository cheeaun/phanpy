import { expect, test } from '@playwright/test';

import { postToStatus } from '../src/utils/atproto-adapter.js';
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
    expect(status._atproto.replyParentAccount).toBeUndefined();
    expect(status._atproto.replyParentUnavailable).toBe(true);
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

  test('shows stable generic Bluesky reply badges when parent actor is unavailable', () => {
    expect(
      shouldShowReplyBadge({
        inReplyToId: encodeURIComponent(parentUri),
        inReplyToAccount: undefined,
        isReplyParentUnavailable: true,
        instance: 'bsky.social',
        spoilerText: '',
        mentions: [],
        inReplyToAccountId: 'did:plc:parent',
      }),
    ).toBe(true);
  });
});
