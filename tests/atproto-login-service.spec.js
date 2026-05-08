import { expect, test } from '@playwright/test';

import { resolveAtprotoLoginService } from '../src/utils/atproto-login-service.js';

test.describe('ATProto login service resolution', () => {
  test('uses the PDS from a resolved DID document', async () => {
    const fetch = async (input) => {
      const url = String(input);
      if (url.includes('resolveHandle')) {
        return Response.json({ did: 'did:plc:example' });
      }
      if (url === 'https://plc.directory/did%3Aplc%3Aexample') {
        return Response.json({
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: 'did:plc:example',
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://pds.example.com',
            },
          ],
        });
      }
      return new Response('', { status: 404 });
    };
    const service = await resolveAtprotoLoginService({
      identifier: 'example.com',
      fetch,
    });

    expect(service).toBe('https://pds.example.com');
  });

  test('keeps bsky.social as the entryway for Bluesky-hosted PDSes', async () => {
    const fetch = async (input) => {
      const url = String(input);
      if (url.includes('resolveHandle')) {
        return Response.json({ did: 'did:plc:bsky' });
      }
      if (url === 'https://plc.directory/did%3Aplc%3Absky') {
        return Response.json({
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: 'did:plc:bsky',
          service: [
            {
              id: '#atproto_pds',
              type: 'AtprotoPersonalDataServer',
              serviceEndpoint: 'https://morel.us-east.host.bsky.network',
            },
          ],
        });
      }
      return new Response('', { status: 404 });
    };
    const service = await resolveAtprotoLoginService({
      identifier: 'alice.bsky.social',
      fetch,
    });

    expect(service).toBe('https://bsky.social');
  });

  test('uses an explicit PDS URL for email logins', async () => {
    const service = await resolveAtprotoLoginService({
      identifier: 'alice@example.com',
      service: 'pds.example.com/',
    });

    expect(service).toBe('https://pds.example.com');
  });

  test('resolves a known independent PDS handle', async () => {
    const service = await resolveAtprotoLoginService({
      identifier: 'altq.net',
    });

    expect(service).toBe('https://altq.net');
  });
});
