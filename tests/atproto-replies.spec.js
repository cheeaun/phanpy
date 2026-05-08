import { expect, test } from '@playwright/test';

import {
  feedToStatuses,
  hydrateFeedReplyContext,
  postProcessFollowingFeed,
  postToStatus,
} from '../src/utils/atproto-adapter.js';
import { shouldShowReplyBadge } from '../src/utils/reply-badge.js';
import {
  shouldFetchReplyContextForInstance,
  shouldFetchThreadParent,
} from '../src/utils/reply-context.js';

const parentUri = 'at://did:plc:parent/app.bsky.feed.post/root';
const childUri = 'at://did:plc:child/app.bsky.feed.post/reply';
const rootUri = 'at://did:plc:root/app.bsky.feed.post/root';

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

  test('does not fetch Bluesky reply context from timeline cards', () => {
    expect(shouldFetchReplyContextForInstance('bsky.social')).toBe(false);
    expect(
      shouldFetchThreadParent({
        instance: 'bsky.social',
        status: {
          inReplyToId: encodeURIComponent(parentUri),
          inReplyToAccountId: 'did:plc:alice',
          account: { id: 'did:plc:alice' },
        },
      }),
    ).toBe(false);
  });

  test('extracts hydrated reply context from feed payload synchronously', () => {
    const item = feedReply({
      post: {
        record: {
          $type: 'app.bsky.feed.post',
          text: 'reply text',
          createdAt: '2026-05-08T00:02:00.000Z',
          reply: {
            root: { uri: rootUri, cid: 'root-cid' },
            parent: { uri: parentUri, cid: 'parent-cid' },
          },
        },
      },
      reply: {
        root: {
          uri: rootUri,
          cid: 'root-cid',
          author: {
            did: 'did:plc:root',
            handle: 'root.test',
            displayName: 'Root',
          },
          record: {
            $type: 'app.bsky.feed.post',
            text: 'root text',
            createdAt: '2026-05-08T00:00:00.000Z',
          },
        },
      },
    });

    const statuses = feedToStatuses([item]);

    expect(statuses.map((status) => status.uri)).toEqual([
      rootUri,
      parentUri,
      childUri,
    ]);
    expect(statuses[2]._atproto.replyParentAccount).toMatchObject({
      id: 'did:plc:parent',
      username: 'parent.test',
    });
  });

  test('uses grandparent author for payload-hydrated middle replies', () => {
    const grandparentUri = 'at://did:plc:grandparent/app.bsky.feed.post/root';
    const item = feedReply({
      post: {
        record: {
          $type: 'app.bsky.feed.post',
          text: 'reply text',
          createdAt: '2026-05-08T00:02:00.000Z',
          reply: {
            root: { uri: grandparentUri, cid: 'grandparent-cid' },
            parent: { uri: parentUri, cid: 'parent-cid' },
          },
        },
      },
      reply: {
        root: {
          uri: grandparentUri,
          cid: 'grandparent-cid',
          author: {
            did: 'did:plc:grandparent',
            handle: 'grandparent.test',
            displayName: 'Grandparent',
          },
          record: {
            $type: 'app.bsky.feed.post',
            text: 'grandparent text',
            createdAt: '2026-05-08T00:00:00.000Z',
          },
        },
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
            createdAt: '2026-05-08T00:01:00.000Z',
            reply: {
              root: { uri: grandparentUri, cid: 'grandparent-cid' },
              parent: { uri: grandparentUri, cid: 'grandparent-cid' },
            },
          },
        },
        grandparentAuthor: {
          did: 'did:plc:grandparent',
          handle: 'grandparent.test',
          displayName: 'Grandparent',
        },
      },
    });

    const statuses = feedToStatuses([item]);

    expect(statuses.map((status) => status.uri)).toEqual([
      grandparentUri,
      parentUri,
      childUri,
    ]);
    expect(statuses[1]._atproto.replyParentUnavailable).toBe(false);
    expect(statuses[1]._atproto.replyParentAccount).toMatchObject({
      id: 'did:plc:grandparent',
      username: 'grandparent.test',
    });
  });

  test('batch hydrates missing feed reply parents before timeline render', async () => {
    const item = feedReply({ reply: undefined });
    delete item.reply;
    let requestedURIs;

    const feed = await hydrateFeedReplyContext([item], {
      getPosts: async ({ uris }) => {
        requestedURIs = uris;
        return {
          data: {
            posts: [
              {
                uri: parentUri,
                cid: 'parent-cid',
                author: {
                  did: 'did:plc:parent',
                  handle: 'parent.test',
                  displayName: 'Parent',
                  avatar: 'https://cdn.example/avatar.jpg',
                },
                record: {
                  $type: 'app.bsky.feed.post',
                  text: 'parent text',
                  createdAt: '2026-05-08T00:00:00.000Z',
                },
                indexedAt: '2026-05-08T00:00:00.000Z',
              },
            ],
          },
        };
      },
    });
    const statuses = feedToStatuses(feed);

    expect(requestedURIs).toEqual([parentUri]);
    expect(statuses.map((status) => status.uri)).toEqual([parentUri, childUri]);
    expect(statuses[1]._atproto.replyParentAccount).toMatchObject({
      id: 'did:plc:parent',
      username: 'parent.test',
      avatar: 'https://cdn.example/avatar.jpg',
    });
  });

  test('hides Following replies to people the current user does not follow', () => {
    const item = feedReply({
      post: {
        author: {
          did: 'did:plc:child',
          handle: 'child.test',
          displayName: 'Child',
          viewer: { following: 'at://did:plc:user/app.bsky.graph.follow/1' },
        },
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
      },
    });

    expect(postProcessFollowingFeed([item], 'did:plc:user')).toEqual([]);
  });

  test('keeps Following replies when the parent author is followed', () => {
    const item = feedReply({
      post: {
        author: {
          did: 'did:plc:child',
          handle: 'child.test',
          displayName: 'Child',
          viewer: { following: 'at://did:plc:user/app.bsky.graph.follow/1' },
        },
      },
      reply: {
        parent: {
          uri: parentUri,
          cid: 'parent-cid',
          author: {
            did: 'did:plc:parent',
            handle: 'parent.test',
            displayName: 'Parent',
            viewer: {
              following: 'at://did:plc:user/app.bsky.graph.follow/2',
            },
          },
          record: {
            $type: 'app.bsky.feed.post',
            text: 'parent text',
            createdAt: '2026-05-08T00:00:00.000Z',
          },
        },
      },
    });

    expect(postProcessFollowingFeed([item], 'did:plc:user')).toEqual([item]);
  });

  test('dedupes Following threads without hiding reposted replies', () => {
    const root = {
      post: {
        ...feedReply().reply.parent,
        uri: parentUri,
      },
    };
    const reply = feedReply();
    const repostedReply = feedReply({
      post: { uri: `${childUri}-repost` },
      reply: {
        parent: {
          ...feedReply().reply.parent,
          author: {
            ...feedReply().reply.parent.author,
            viewer: {
              following: 'at://did:plc:user/app.bsky.graph.follow/2',
            },
          },
        },
      },
    });
    repostedReply.reason = {
      $type: 'app.bsky.feed.defs#reasonRepost',
      by: {
        did: 'did:plc:reposter',
        handle: 'reposter.test',
        displayName: 'Reposter',
      },
      indexedAt: '2026-05-08T00:03:00.000Z',
    };

    expect(
      postProcessFollowingFeed([root, reply, repostedReply], 'did:plc:user'),
    ).toEqual([root, repostedReply]);
  });
});
