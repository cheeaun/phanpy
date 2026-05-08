import { expect, test } from '@playwright/test';

import {
  notificationStatusURI,
  notificationType,
} from '../src/utils/atproto-adapter.js';

test.describe('ATProto notifications', () => {
  test('maps repost-via-repost to the original post', () => {
    const notification = {
      reason: 'repost-via-repost',
      reasonSubject:
        'at://did:plc:test/app.bsky.feed.repost/repost-record-key',
      record: {
        subject: {
          uri: 'at://did:plc:test/app.bsky.feed.post/post-record-key',
        },
      },
    };

    expect(notificationType(notification.reason)).toBe('reblog');
    expect(notificationStatusURI(notification)).toBe(
      'at://did:plc:test/app.bsky.feed.post/post-record-key',
    );
  });
});
