# Goal: Port Phanpy to ATProto/Bluesky

Port `/home/agent/phanpy` from Mastodon to ATProto/Bluesky, using `/home/agent/social-app` as the implementation reference.

Goal: feature parity with upstream Phanpy where feasible, but as a fully client-side Bluesky client. V1 may use app-password auth; design the auth/session layer so OAuth can replace it later. Prioritize making the existing Phanpy UI work by translating Bluesky data into Phanpy's existing internal account/status/notification shapes at an adapter boundary.

## Local Setup

- Phanpy repo: `/home/agent/phanpy`
- Bluesky social-app reference: `/home/agent/social-app`
- Test credentials are stored in `/home/agent/.secrets/phanpy-atproto-test.env`
- Current working dev loop:
  - `cd /home/agent/phanpy`
  - `bun run dev -- --host 127.0.0.1`
  - app URL: `http://127.0.0.1:5173/`
  - `bun run test` passes after switching Playwright to Nix Chromium
- Use Chromium only. System Chromium is `/run/current-system/sw/bin/chromium`.
- Use `agent-browser` for browser/UI smoke checks.

## Current Changes

- `/home/agent/phanpy/playwright.config.js` points Playwright at Nix Chromium.
- `bun.lock` has package metadata churn from `bun install`; inspect before committing.

## Implementation Strategy

1. Add `@atproto/api` to Phanpy if needed.
2. Create ATProto client/session module, app-password login, persisted account/session storage.
3. Add a Bluesky-to-Phanpy adapter layer:
   - actor profile -> Phanpy account shape
   - post view / feed item -> Phanpy status shape
   - notifications -> Phanpy notification/groupable shape
   - embeds/images/video/external/record -> existing media/card/quote fields where possible
4. Replace Mastodon API calls incrementally behind the existing `api()` boundary or a nearby adapter, keeping UI components mostly intact.
5. First vertical slice: login -> authenticated home timeline -> post detail/thread -> like/repost/bookmark/quote/reply smoke tested.
6. Then add profiles, search, notifications, lists, bookmarks, moderation/report/block/mute.
7. Hashtags exist in Bluesky but are low priority.

## Feed Switching

Support switching between Bluesky feeds. This includes the main following timeline, Discover/official feeds, saved custom feeds, user-created or third-party feed generators, and list feeds where Phanpy's shortcut/multi-column model can map to them.

Use social-app's feed APIs as reference: `FollowingFeedAPI`, `CustomFeedAPI`, `ListFeedAPI`, `HomeFeedAPI`, saved feeds/preferences, and feed generator resolution. The UX should preserve Phanpy's shortcuts/columns concept while backing each shortcut with a Bluesky feed descriptor.

## Key Decisions

- Preserve Phanpy's internal data model at UI boundaries.
- Use AT URI as canonical post ID; introduce URL-safe route encoding/decoding for post routes.
- Keep pure client-side/static deployment.
- Do not fork social-app UI. Use it as API behavior/reference only.
- Keep changes tight and smoke test often.

## Verification Expectations

- Prioritize E2E and smoke tests over unit tests. Unit tests are useful support, but the main confidence loop is real user flows in the browser.
- Keep `bun run test` green.
- Use `agent-browser` against local Vite server for logged-out and logged-in smoke tests.
- Use the saved test account only from env file; do not print credentials.
- Build should pass before stopping if feasible.
