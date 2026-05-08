import { expect, test } from '@playwright/test';

import { postToStatus } from '../src/utils/atproto-adapter.js';

function postWithEmbed(embed) {
  return {
    uri: 'at://did:plc:alice/app.bsky.feed.post/video',
    cid: 'post-cid',
    author: {
      did: 'did:plc:alice',
      handle: 'alice.test',
      displayName: 'Alice',
    },
    record: {
      $type: 'app.bsky.feed.post',
      text: 'video post',
      createdAt: '2026-05-08T00:00:00.000Z',
    },
    embed,
    indexedAt: '2026-05-08T00:00:00.000Z',
    replyCount: 0,
    repostCount: 0,
    likeCount: 0,
    quoteCount: 0,
  };
}

test.describe('ATProto video mapping', () => {
  test('maps Bluesky video view embeds to video media attachments', () => {
    const status = postToStatus(
      postWithEmbed({
        $type: 'app.bsky.embed.video#view',
        cid: 'video-cid',
        playlist:
          'https://video.bsky.app/watch/did%3Aplc%3Aalice/video/playlist.m3u8',
        thumbnail:
          'https://video.bsky.app/watch/did%3Aplc%3Aalice/video/thumbnail.jpg',
        alt: 'Video alt text',
        aspectRatio: { width: 1920, height: 1080 },
      }),
    );

    expect(status.mediaAttachments).toEqual([
      {
        id: 'video-cid',
        type: 'video',
        url: 'https://video.bsky.app/watch/did%3Aplc%3Aalice/video/playlist.m3u8',
        previewUrl:
          'https://video.bsky.app/watch/did%3Aplc%3Aalice/video/thumbnail.jpg',
        remoteUrl:
          'https://video.bsky.app/watch/did%3Aplc%3Aalice/video/playlist.m3u8',
        description: 'Video alt text',
        meta: { original: { width: 1920, height: 1080 } },
      },
    ]);
  });

  test('maps record-with-media video embeds to video media attachments', () => {
    const status = postToStatus(
      postWithEmbed({
        $type: 'app.bsky.embed.recordWithMedia#view',
        media: {
          $type: 'app.bsky.embed.video#view',
          cid: 'nested-video-cid',
          playlist:
            'https://video.bsky.app/watch/did%3Aplc%3Aalice/nested/playlist.m3u8',
          thumbnail:
            'https://video.bsky.app/watch/did%3Aplc%3Aalice/nested/thumbnail.jpg',
          alt: 'Nested video alt text',
          aspectRatio: { width: 1080, height: 1920 },
        },
      }),
    );

    expect(status.mediaAttachments).toMatchObject([
      {
        id: 'nested-video-cid',
        type: 'video',
        url: 'https://video.bsky.app/watch/did%3Aplc%3Aalice/nested/playlist.m3u8',
        previewUrl:
          'https://video.bsky.app/watch/did%3Aplc%3Aalice/nested/thumbnail.jpg',
        remoteUrl:
          'https://video.bsky.app/watch/did%3Aplc%3Aalice/nested/playlist.m3u8',
        description: 'Nested video alt text',
        meta: { original: { width: 1080, height: 1920 } },
      },
    ]);
  });
});
