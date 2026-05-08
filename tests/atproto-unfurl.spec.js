import { expect, test } from '@playwright/test';

import {
  createAtprotoExternalEmbed,
  fetchAtprotoLinkMetadata,
  getFirstPostURL,
} from '../src/utils/atproto-unfurl.js';

test.describe('ATProto compose helpers', () => {
  test('builds external embeds from cardyb metadata', async () => {
    const uploads = [];
    const agent = {
      uploadBlob: async (blob, options) => {
        uploads.push({ size: blob.size, encoding: options.encoding });
        return {
          data: {
            blob: {
              $type: 'blob',
              ref: { $link: 'bafkreicardthumb' },
              mimeType: options.encoding,
              size: blob.size,
            },
          },
        };
      },
    };
    const fetcher = async (url) => {
      const urlString = String(url);
      if (urlString.startsWith('https://cardyb.bsky.app/v1/extract?url=')) {
        return Response.json({
          error: '',
          url: 'https://docs.bsky.app/',
          title: 'Bluesky Documentation',
          description: 'Explore guides and tutorials.',
          image: 'https://image.test/card.png',
          associated_record: {
            uri: 'at://did:plc:test/app.bsky.feed.post/abc',
            cid: 'bafyreitest',
          },
        });
      }
      if (urlString === 'https://image.test/card.png') {
        return new Response(new Blob(['png'], { type: 'image/png' }));
      }
      return new Response('', { status: 404 });
    };

    const embed = await createAtprotoExternalEmbed(
      agent,
      'https://docs.bsky.app',
      { fetcher },
    );

    expect(getFirstPostURL('read https://docs.bsky.app please')).toBe(
      'https://docs.bsky.app',
    );
    expect(getFirstPostURL('read https://docs.bsky.app.')).toBe(
      'https://docs.bsky.app',
    );
    expect(uploads).toEqual([{ size: 3, encoding: 'image/png' }]);
    expect(embed).toEqual({
      $type: 'app.bsky.embed.external',
      external: {
        uri: 'https://docs.bsky.app/',
        title: 'Bluesky Documentation',
        description: 'Explore guides and tutorials.',
        associatedRecord: {
          uri: 'at://did:plc:test/app.bsky.feed.post/abc',
          cid: 'bafyreitest',
        },
        thumb: {
          $type: 'blob',
          ref: { $link: 'bafkreicardthumb' },
          mimeType: 'image/png',
          size: 3,
        },
      },
    });
  });

  test('fetches cardyb metadata for composer previews', async () => {
    const metadata = await fetchAtprotoLinkMetadata('https://example.com/post', {
      fetcher: async (url) => {
        expect(String(url)).toBe(
          'https://cardyb.bsky.app/v1/extract?url=https%3A%2F%2Fexample.com%2Fpost',
        );
        return Response.json({
          url: 'https://example.com/post',
          title: 'Example link',
          description: 'Preview description',
          image: 'https://example.com/card.jpg',
        });
      },
    });

    expect(metadata).toMatchObject({
      url: 'https://example.com/post',
      title: 'Example link',
      description: 'Preview description',
      image: 'https://example.com/card.jpg',
    });
  });
});
