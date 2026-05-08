import { BskyAgent, RichText } from '@atproto/api';
import { getPdsEndpoint } from '@atproto/common-web';

import { BSKY_PDS, resolveAtprotoLoginService } from './atproto-login-service';
import { createAtprotoOAuthAgent } from './atproto-oauth';
import { encodeAtprotoID } from './atproto-route';
import { createAtprotoExternalEmbed, getFirstPostURL } from './atproto-unfurl';

const BSKY_APPVIEW = 'https://public.api.bsky.app';
export const BSKY_INSTANCE = 'bsky.social';
const BSKY_DISCOVER_FEED =
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';
const BSKY_GET_POSTS_LIMIT = 25;
const BSKY_VIDEO_SERVICE = 'https://video.bsky.app';
const BSKY_VIDEO_SERVICE_DID = 'did:web:video.bsky.app';
export { BSKY_PDS, resolveAtprotoLoginService };

function getServiceAuthAudFromUrl(url) {
  const { hostname } = new URL(url);
  return `did:web:${hostname}`;
}

function createVideoEndpointUrl(route, params = {}) {
  const url = new URL(BSKY_VIDEO_SERVICE);
  url.pathname = route;
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.href;
}

async function getServiceAuthToken({ agent, aud, lxm, exp }) {
  const res = await agent.com.atproto.server.getServiceAuth({
    aud,
    lxm,
    exp,
  });
  return res.data.token;
}

async function uploadVideoBlob(agent, file) {
  if (file.type !== 'video/mp4') {
    throw new Error('Only MP4 video uploads are supported for Bluesky posts');
  }
  if (!agent.did) throw new Error('Missing Bluesky session');

  if (agent.sessionManager && !agent.sessionManager.pdsUrl) {
    const session = await agent.com.atproto.server.getSession();
    const pdsEndpoint = session.data.didDoc
      ? getPdsEndpoint(session.data.didDoc)
      : null;
    if (pdsEndpoint) agent.sessionManager.pdsUrl = new URL(pdsEndpoint);
  }
  const dispatchUrl =
    agent.dispatchUrl || (await agent.sessionManager?.getTokenInfo?.())?.aud;

  const uploadToken = await getServiceAuthToken({
    agent,
    aud: getServiceAuthAudFromUrl(dispatchUrl),
    lxm: 'com.atproto.repo.uploadBlob',
    exp: Date.now() / 1000 + 60 * 30,
  });
  const uploadRes = await fetch(
    createVideoEndpointUrl('/xrpc/app.bsky.video.uploadVideo', {
      did: agent.did,
      name: `${crypto.randomUUID()}.mp4`,
    }),
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${uploadToken}`,
        'content-type': file.type,
      },
      body: file,
    },
  );
  if (!uploadRes.ok) {
    const message = await uploadRes.text().catch(() => '');
    throw new Error(
      `Failed to upload video (${uploadRes.status})${message ? `: ${message}` : ''}`,
    );
  }
  let jobStatus = await uploadRes.json();
  if (jobStatus.jobStatus) jobStatus = jobStatus.jobStatus;
  if (jobStatus.error) {
    throw new Error(jobStatus.message || jobStatus.error);
  }

  const videoAgent = new BskyAgent({ service: BSKY_VIDEO_SERVICE });
  const statusToken = await getServiceAuthToken({
    agent,
    aud: BSKY_VIDEO_SERVICE_DID,
    lxm: 'app.bsky.video.getJobStatus',
  });
  for (let i = 0; i < 60; i++) {
    if (jobStatus.state === 'JOB_STATE_COMPLETED' && jobStatus.blob) {
      return jobStatus.blob;
    }
    if (jobStatus.state === 'JOB_STATE_FAILED') {
      throw new Error(
        jobStatus.message || jobStatus.error || 'Video upload failed',
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const statusRes = await videoAgent.app.bsky.video.getJobStatus(
      { jobId: jobStatus.jobId },
      { headers: { authorization: `Bearer ${statusToken}` } },
    );
    jobStatus = statusRes.data.jobStatus || statusRes.data;
  }
  throw new Error('Timed out waiting for Bluesky video processing');
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textToHTML(text = '') {
  return escapeHTML(text).replace(/\n/g, '<br />');
}

function richTextToHTML(text = '', facets = []) {
  if (!facets?.length) return textToHTML(text);
  const richText = new RichText({ text, facets });
  return Array.from(richText.segments())
    .map((segment) => {
      const html = textToHTML(segment.text);
      if (segment.link?.uri) {
        return `<a href="${escapeHTML(segment.link.uri)}" target="_blank" rel="nofollow noopener noreferrer">${html}</a>`;
      }
      if (segment.mention?.did) {
        return `<a href="https://bsky.app/profile/${escapeHTML(segment.mention.did)}" class="mention" target="_blank" rel="nofollow noopener noreferrer">${html}</a>`;
      }
      if (segment.tag?.tag) {
        return `<a href="/t/${encodeURIComponent(segment.tag.tag)}" class="mention hashtag" rel="tag">#<span>${escapeHTML(segment.tag.tag)}</span></a>`;
      }
      return html;
    })
    .join('');
}

function actorToAccount(actor = {}) {
  const handle = actor.handle || actor.did || 'unknown.bsky.social';
  const displayName = actor.displayName || handle;
  const description = actor.description || '';
  const url = `https://bsky.app/profile/${handle}`;
  const hasProfileCounts =
    Number.isFinite(actor.followersCount) &&
    Number.isFinite(actor.followsCount) &&
    Number.isFinite(actor.postsCount);
  return {
    id: actor.did || handle,
    username: handle,
    acct: handle,
    displayName,
    note: textToHTML(description),
    source: {
      note: description,
      fields: [],
    },
    url,
    uri: actor.did,
    avatar: actor.avatar,
    avatarStatic: actor.avatar,
    header: actor.banner,
    headerStatic: actor.banner,
    followersCount: actor.followersCount ?? 0,
    followingCount: actor.followsCount ?? 0,
    statusesCount: actor.postsCount ?? 0,
    emojis: [],
    fields: [],
    bot: false,
    group: false,
    _atproto: {
      hasProfileCounts,
    },
  };
}

function embedToParts(embed, agent) {
  const mediaAttachments = [];
  let card;
  let quote;

  if (!embed) return { mediaAttachments, card, quote };
  if (Array.isArray(embed)) {
    embed.forEach((item) => {
      const parts = embedToParts(item, agent);
      mediaAttachments.push(...parts.mediaAttachments);
      card ||= parts.card;
      quote ||= parts.quote;
    });
    return { mediaAttachments, card, quote };
  }

  const images = embed.images || embed.media?.images || [];
  images.forEach((image, index) => {
    const fullsize = image.fullsize || image.thumb;
    mediaAttachments.push({
      id: `${fullsize || index}`,
      type: 'image',
      url: fullsize,
      previewUrl: image.thumb || fullsize,
      remoteUrl: fullsize,
      description: image.alt || '',
      meta: {
        original: {
          width: image.aspectRatio?.width,
          height: image.aspectRatio?.height,
        },
      },
    });
  });

  const external = embed.external || embed.media?.external;
  if (external) {
    card = {
      url: external.uri,
      title: external.title || external.uri,
      description: external.description || '',
      image: external.thumb,
      type: 'link',
    };
  }

  const video =
    (embed.playlist && embed) ||
    embed.video ||
    (embed.media?.playlist && embed.media) ||
    embed.media?.video;
  if (video?.playlist) {
    mediaAttachments.push({
      id: video.cid || video.playlist,
      type: 'video',
      url: video.playlist,
      previewUrl: video.thumbnail || video.thumb,
      remoteUrl: video.playlist,
      description: video.alt || '',
      meta: {
        original: {
          width: video.aspectRatio?.width,
          height: video.aspectRatio?.height,
        },
      },
    });
  }

  const record = embed.record?.record || embed.record;
  if (record?.uri && record?.author && record?.value) {
    quote = {
      id: encodeAtprotoID(record.uri),
      state: 'accepted',
      quotedStatus: postToStatus({ post: record }, agent),
    };
  }

  return { mediaAttachments, card, quote };
}

function postURL(post) {
  const rkey = post.uri?.split('/').pop();
  return `https://bsky.app/profile/${post.author?.handle || post.author?.did}/post/${rkey}`;
}

function parseBskyPostURL(text = '') {
  const match = String(text).match(
    /https?:\/\/bsky\.app\/profile\/([^/\s]+)\/post\/([^?\s#]+)/i,
  );
  if (!match) return null;
  return {
    actor: decodeURIComponent(match[1]),
    rkey: decodeURIComponent(match[2]),
  };
}

function normalizeActor(actor) {
  if (!actor) return actor;
  return String(actor)
    .replace(/^@/, '')
    .replace(/^https?:\/\/bsky\.app\/profile\//, '')
    .replace(/\/+$/, '');
}

function decodeResourceID(id) {
  return decodeURIComponent(id);
}

function atprotoRkey(uri) {
  return uri?.split('/').pop();
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function listToPhanpyList(list = {}) {
  const uri = list.uri;
  return {
    id: encodeURIComponent(uri),
    title: list.name || list.displayName || uri,
    repliesPolicy: 'list',
    exclusive: false,
    _atproto: {
      uri,
      cid: list.cid,
      purpose: list.purpose,
      type: 'list',
    },
  };
}

function feedGeneratorToPhanpyList(feed = {}) {
  const uri = feed.uri;
  return {
    id: encodeURIComponent(uri),
    title: feed.displayName || feed.name || uri,
    repliesPolicy: 'list',
    exclusive: false,
    _atproto: {
      uri,
      cid: feed.cid,
      type: 'feed',
    },
  };
}

function atUriRepo(uri) {
  return /^at:\/\/([^/]+)/.exec(uri || '')?.[1] || null;
}

function strongRef(value) {
  if (!value?.uri) return value;
  return {
    uri: value.uri,
    cid: value.cid,
  };
}

function isPostView(value) {
  return !!(value?.uri && value?.author && value?.record);
}

function replyContextSourceForPost(feedItem, post) {
  if (!feedItem?.reply || feedItem.post?.uri === post.uri) return feedItem;
  const parent = feedItem.reply.parent;
  if (
    parent?.uri === post.uri &&
    feedItem.reply.grandparentAuthor &&
    post.record?.reply?.parent?.uri
  ) {
    return {
      post,
      reply: {
        root: feedItem.reply.root,
        parent: {
          ...post.record.reply.parent,
          author: feedItem.reply.grandparentAuthor,
        },
      },
    };
  }
  return post;
}

export async function hydrateFeedReplyContext(feed, agent) {
  const feedPostURIs = new Set(
    feed.map((item) => item.post?.uri).filter(Boolean),
  );
  const missingURIs = [];
  const seen = new Set(feedPostURIs);
  feed.forEach((item) => {
    if (item?.reason?.$type === 'app.bsky.feed.defs#reasonRepost') return;
    const refs = [
      item.reply?.root || item.post?.record?.reply?.root,
      item.reply?.parent || item.post?.record?.reply?.parent,
    ];
    refs.forEach((ref) => {
      if (!ref?.uri || isPostView(ref) || seen.has(ref.uri)) return;
      seen.add(ref.uri);
      missingURIs.push(ref.uri);
    });
  });
  if (!missingURIs.length) return feed;

  const hydratedPosts = [];
  for (let i = 0; i < missingURIs.length; i += BSKY_GET_POSTS_LIMIT) {
    const uris = missingURIs.slice(i, i + BSKY_GET_POSTS_LIMIT);
    const res = await agent.getPosts({ uris });
    hydratedPosts.push(...(res.data.posts || []));
  }
  if (!hydratedPosts.length) return feed;

  const postsByURI = Object.fromEntries(
    hydratedPosts.map((post) => [post.uri, post]),
  );
  const hydrateRef = (ref) => postsByURI[ref?.uri] || ref;
  return feed.map((item) => {
    const reply = item.reply || item.post?.record?.reply;
    if (!reply) return item;
    return {
      ...item,
      reply: {
        ...item.reply,
        root: hydrateRef(reply.root),
        parent: hydrateRef(reply.parent),
      },
    };
  });
}

function feedItemToStatuses(feedItem, agent) {
  const post = feedItem?.post || feedItem;
  if (feedItem?.reason?.$type === 'app.bsky.feed.defs#reasonRepost') {
    return [postToStatus(feedItem, agent)];
  }

  const statuses = [];
  const seen = new Set();
  const addPost = (item, statusSource = item) => {
    if (!isPostView(item) || seen.has(item.uri)) return;
    seen.add(item.uri);
    statuses.push(postToStatus(statusSource, agent));
  };

  addPost(
    feedItem?.reply?.root,
    replyContextSourceForPost(feedItem, feedItem?.reply?.root),
  );
  addPost(
    feedItem?.reply?.parent,
    replyContextSourceForPost(feedItem, feedItem?.reply?.parent),
  );
  addPost(post, feedItem);
  return statuses;
}

export function feedToStatuses(feed, agent) {
  return feed.flatMap((item) => feedItemToStatuses(item, agent));
}

function feedItemRootURI(feedItem) {
  return isPostView(feedItem?.reply?.root)
    ? feedItem.reply.root.uri
    : feedItem?.post?.uri;
}

function isSelfOrFollowing(profile, currentUserDid) {
  return !!(
    profile?.did &&
    (profile.did === currentUserDid || profile.viewer?.following)
  );
}

function shouldDisplayReplyInFollowing(feedItem, currentUserDid) {
  const post = feedItem?.post;
  const author = post?.author;
  const parentAuthor = isPostView(feedItem?.reply?.parent)
    ? feedItem.reply.parent.author
    : undefined;
  const grandparentAuthor = feedItem?.reply?.grandparentAuthor;
  const rootAuthor = isPostView(feedItem?.reply?.root)
    ? feedItem.reply.root.author
    : undefined;

  if (!isSelfOrFollowing(author, currentUserDid)) return false;
  if (
    (!parentAuthor || parentAuthor.did === author.did) &&
    (!grandparentAuthor || grandparentAuthor.did === author.did) &&
    (!rootAuthor || rootAuthor.did === author.did)
  ) {
    return true;
  }
  return [parentAuthor, grandparentAuthor, rootAuthor].some(
    (profile) =>
      profile?.did !== author?.did &&
      isSelfOrFollowing(profile, currentUserDid),
  );
}

export function postProcessFollowingFeed(feed, currentUserDid) {
  const seenRootURIs = new Set();
  return feed.filter((item) => {
    const post = item?.post;
    if (!post) return false;
    if (post.viewer?.threadMuted) return false;

    const isRepost = item?.reason?.$type === 'app.bsky.feed.defs#reasonRepost';
    const isReply = !!post.record?.reply;

    if (isReply && !isRepost) {
      if (!item.reply || !isPostView(item.reply.parent)) return false;
      if (!shouldDisplayReplyInFollowing(item, currentUserDid)) return false;
    }

    const rootURI = feedItemRootURI(item);
    if (!isRepost && rootURI) {
      if (seenRootURIs.has(rootURI)) return false;
      seenRootURIs.add(rootURI);
    }

    return true;
  });
}

export function postToStatus(feedItemOrPost, agent) {
  const post = feedItemOrPost?.post || feedItemOrPost;
  const record = post?.record || post?.value || {};
  const feedReply = feedItemOrPost?.reply;
  const replyParent = feedReply?.parent || post.reply?.parent;
  const replyParentRef = strongRef(
    record.reply?.parent || post.reply?.parent || feedReply?.parent,
  );
  const replyRootRef = strongRef(
    record.reply?.root || post.reply?.root || feedReply?.root,
  );
  const replyParentURI = replyParentRef?.uri;
  const replyParentAuthorDid =
    replyParent?.author?.did ||
    post.reply?.parent?.author?.did ||
    atUriRepo(replyParentURI);
  const id = encodeAtprotoID(post.uri);
  const { mediaAttachments, card, quote } = embedToParts(
    post.embed || post.embeds || record.embed || record.embeds,
    agent,
  );
  const mentions = (record.facets || []).flatMap((facet) => {
    const segment = Array.from(
      new RichText({
        text: record.text || '',
        facets: [facet],
      }).segments(),
    ).find((segment) => segment.facet);
    const text = segment?.text;
    return (facet.features || [])
      .filter((feature) => feature.$type === 'app.bsky.richtext.facet#mention')
      .map((feature) => {
        const username = (text || feature.did).replace(/^@/, '');
        return {
          id: feature.did,
          username,
          acct: username,
          url: `https://bsky.app/profile/${feature.did}`,
        };
      });
  });
  const status = {
    id,
    uri: post.uri,
    url: postURL(post),
    createdAt: record.createdAt || post.indexedAt,
    account: actorToAccount(post.author),
    content: richTextToHTML(record.text || '', record.facets),
    visibility: 'public',
    sensitive: !!post.labels?.length,
    spoilerText: '',
    language: record.langs?.[0],
    repliesCount: post.replyCount || 0,
    reblogsCount: post.repostCount || 0,
    favouritesCount: post.likeCount || 0,
    quotesCount: post.quoteCount || 0,
    reblogged: !!post.viewer?.repost,
    favourited: !!post.viewer?.like,
    bookmarked: !!post.viewer?.bookmarked,
    muted: false,
    mediaAttachments,
    card,
    mentions,
    tags: (record.facets || [])
      .flatMap((facet) => facet.features || [])
      .filter((feature) => feature.$type === 'app.bsky.richtext.facet#tag')
      .map((feature) => ({
        name: feature.tag,
        url: `/t/${encodeURIComponent(feature.tag)}`,
      })),
    emojis: [],
    poll: null,
    editedAt: null,
    inReplyToId: replyParentURI ? encodeAtprotoID(replyParentURI) : null,
    inReplyToAccountId: replyParentAuthorDid || null,
    quote,
    _atproto: {
      uri: post.uri,
      cid: post.cid,
      root: replyRootRef,
      parent: replyParentRef,
      replyParentAccount: replyParent?.author
        ? actorToAccount(replyParent.author)
        : undefined,
      replyParentUnavailable: !!replyParentURI && !replyParent?.author,
      like: post.viewer?.like,
      repost: post.viewer?.repost,
      text: record.text || '',
    },
    quoteApproval: {
      currentUser: 'automatic',
      automatic: ['public'],
      manual: [],
    },
  };

  if (feedItemOrPost?.reason?.$type === 'app.bsky.feed.defs#reasonRepost') {
    return {
      ...status,
      id: `${id}-repost-${feedItemOrPost.reason.indexedAt}`,
      createdAt: feedItemOrPost.reason.indexedAt,
      account: actorToAccount(feedItemOrPost.reason.by),
      reblog: status,
    };
  }

  return status;
}

function createIterator(fetchPage) {
  let cursor;
  return {
    async next() {
      const res = await fetchPage(cursor);
      cursor = res.cursor;
      return {
        value: res.items,
        done: !res.cursor,
      };
    },
  };
}

function makeCollection(fetchPage) {
  return {
    values() {
      return createIterator(fetchPage);
    },
  };
}

function emptyCollection() {
  return makeCollection(async () => ({ cursor: undefined, items: [] }));
}

function relationshipFor(id) {
  return {
    id,
    following: false,
    showingReblogs: true,
    notifying: false,
    followedBy: false,
    blocking: false,
    blockedBy: false,
    muting: false,
    mutingNotifications: false,
    requested: false,
    domainBlocking: false,
    endorsed: false,
  };
}

function relationshipFromAtproto(rel = {}, profile = {}) {
  return {
    ...relationshipFor(rel.did || profile.did),
    id: rel.did || profile.did,
    following: !!rel.following,
    followedBy: !!rel.followedBy,
    blocking: !!rel.blocking,
    blockedBy: !!rel.blockedBy,
    muting: !!profile.viewer?.muted,
    _atproto: {
      following: rel.following,
      blocking: rel.blocking,
    },
  };
}

export function notificationType(reason) {
  switch (reason) {
    case 'like':
    case 'like-via-repost':
      return 'favourite';
    case 'repost':
    case 'repost-via-repost':
      return 'reblog';
    case 'quote':
      return 'quote';
    case 'reply':
    case 'mention':
      return 'mention';
    case 'follow':
      return 'follow';
    default:
      return 'status';
  }
}

export function notificationStatusURI(notification) {
  if (notification.reason === 'like-via-repost') {
    return notification.record?.subject?.uri || notification.reasonSubject;
  }
  if (notification.reason === 'repost-via-repost') {
    return notification.record?.subject?.uri || notification.reasonSubject;
  }
  if (['like', 'repost'].includes(notification.reason)) {
    return notification.reasonSubject || notification.record?.subject?.uri;
  }
  if (['quote', 'reply', 'mention'].includes(notification.reason)) {
    return notification.uri || notification.reasonSubject;
  }
  return (
    notification.reasonSubject ||
    notification.record?.subject?.uri ||
    notification.uri
  );
}

function toGroupedNotificationsPage({ cursor, items }) {
  const accounts = [];
  const statuses = [];
  const accountIds = new Set();
  const statusIds = new Set();
  const notificationGroups = items.map((notification) => {
    const accountId = notification.account?.id;
    const statusId = notification.status?.id;
    if (notification.account && accountId && !accountIds.has(accountId)) {
      accountIds.add(accountId);
      accounts.push(notification.account);
    }
    if (notification.status && statusId && !statusIds.has(statusId)) {
      statusIds.add(statusId);
      statuses.push(notification.status);
    }
    return {
      ...notification,
      groupKey: `${notification.type}:${statusId || ''}:${accountId || ''}:${notification.id}`,
      sampleAccountIds: accountId ? [accountId] : [],
      statusId,
      notificationsCount: 1,
      mostRecentNotificationId: notification.id,
      latestPageNotificationAt: notification.createdAt,
    };
  });
  return {
    cursor,
    items: {
      accounts,
      statuses,
      notificationGroups,
    },
  };
}

async function createMediaUpload({ agent, uploadedMedia, file, description }) {
  if (!file) throw new Error('Missing media file');
  const url = URL.createObjectURL(file);

  if (file.type?.startsWith('image/')) {
    const res = await agent.uploadBlob(file, {
      encoding: file.type,
    });
    const id = String(
      res.data.blob?.ref?.toString?.() ||
        res.data.blob?.ref?.$link ||
        crypto.randomUUID(),
    );
    const media = {
      id,
      type: 'image',
      url,
      previewUrl: url,
      description,
      blob: res.data.blob,
    };
    uploadedMedia.set(id, media);
    return media;
  }

  if (file.type?.startsWith('video/')) {
    const blob = await uploadVideoBlob(agent, file);
    const id = String(
      blob?.ref?.toString?.() || blob?.ref?.$link || crypto.randomUUID(),
    );
    const media = {
      id,
      type: 'video',
      url,
      previewUrl: url,
      description,
      blob,
    };
    uploadedMedia.set(id, media);
    return media;
  }

  throw new Error(
    'Only image and MP4 video uploads are supported for Bluesky posts',
  );
}

function hasUploadableFile(file) {
  return file instanceof Blob && file.size > 0;
}

async function uploadProfileImage(agent, file) {
  if (!hasUploadableFile(file)) return null;
  if (!file.type?.startsWith('image/')) {
    throw new Error('Only images are supported for Bluesky profile media');
  }
  const res = await agent.uploadBlob(file, {
    encoding: file.type,
  });
  return res.data.blob;
}

export function createAtprotoClient({
  session,
  oauthSession,
  service = BSKY_PDS,
  persistSession,
}) {
  const agent = oauthSession
    ? createAtprotoOAuthAgent(oauthSession)
    : new BskyAgent({ service, persistSession });
  if (!agent) throw new Error('Missing Bluesky OAuth session');
  if (session && agent.sessionManager) {
    agent.sessionManager.session = session;
  }
  const uploadedMedia = new Map();

  const statusAPI = (id) => {
    const uri = decodeURIComponent(id);
    const hydrateLegacyLinkQuote = async (status) => {
      if (status.quote) return status;
      const parsed = parseBskyPostURL(status._atproto?.text || '');
      if (!parsed) return status;
      const profile = await agent.getProfile({ actor: parsed.actor });
      const quoteURI = `at://${profile.data.did}/app.bsky.feed.post/${parsed.rkey}`;
      const quoteRes = await agent.getPosts({ uris: [quoteURI] });
      const quotePost = quoteRes.data.posts?.[0];
      if (!quotePost) return status;
      return {
        ...status,
        quote: {
          id: encodeAtprotoID(quotePost.uri),
          state: 'accepted',
          quotedStatus: postToStatus(quotePost, agent),
        },
      };
    };
    return {
      async fetch() {
        const res = await agent.getPosts({ uris: [uri] });
        const post = res.data.posts?.[0];
        if (!post) throw new Error('Post not found');
        const status = await hydrateLegacyLinkQuote(postToStatus(post, agent));
        return status;
      },
      context: {
        async fetch() {
          const res = await agent.getPostThread({
            uri,
            depth: 8,
            parentHeight: 8,
          });
          const flatten = (node, bucket = []) => {
            if (node?.post) bucket.push(postToStatus(node.post, agent));
            node?.replies?.forEach((reply) => flatten(reply, bucket));
            return bucket;
          };
          const ancestors = [];
          let parent = res.data.thread?.parent;
          while (parent?.post) {
            ancestors.unshift(postToStatus(parent.post, agent));
            parent = parent.parent;
          }
          const descendants = res.data.thread?.replies?.flatMap((reply) =>
            flatten(reply, []),
          );
          return { ancestors, descendants: descendants || [] };
        },
      },
      source: {
        async fetch() {
          const current = await statusAPI(id).fetch();
          return {
            id: current.id,
            text: current.content
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<[^>]+>/g, ''),
            spoilerText: current.spoilerText || '',
          };
        },
      },
      history: {
        async list() {
          const current = await statusAPI(id).fetch();
          return [
            {
              id: current.id,
              createdAt: current.createdAt,
              account: current.account,
              content: current.content,
              spoilerText: current.spoilerText,
              mediaAttachments: current.mediaAttachments,
              emojis: current.emojis,
              poll: current.poll,
            },
          ];
        },
      },
      rebloggedBy: {
        list({ limit = 80 } = {}) {
          return makeCollection(async (cursor) => {
            const res = await agent.app.bsky.feed.getRepostedBy({
              uri,
              limit,
              cursor,
            });
            return {
              cursor: res.data.cursor,
              items: res.data.repostedBy.map(actorToAccount),
            };
          });
        },
      },
      favouritedBy: {
        list({ limit = 80 } = {}) {
          return makeCollection(async (cursor) => {
            const res = await agent.app.bsky.feed.getLikes({
              uri,
              limit,
              cursor,
            });
            return {
              cursor: res.data.cursor,
              items: res.data.likes.map((like) => actorToAccount(like.actor)),
            };
          });
        },
      },
      quotes: {
        list({ limit = 20 } = {}) {
          return makeCollection(async (cursor) => {
            const res = await agent.app.bsky.feed.getQuotes({
              uri,
              limit,
              cursor,
            });
            return {
              cursor: res.data.cursor,
              items: res.data.posts.map((post) => postToStatus(post, agent)),
            };
          });
        },
        $select() {
          return {
            revoke: {
              async create() {
                throw new Error('Bluesky quote removal is not supported');
              },
            },
          };
        },
      },
      interactionPolicy: {
        async update() {
          throw new Error('Bluesky quote settings are not supported');
        },
      },
      async favourite() {
        const current = await this.fetch();
        const like = await agent.like(current.uri, current._atproto.cid);
        return {
          ...current,
          favourited: true,
          favouritesCount: current.favouritesCount + 1,
          _atproto: { ...current._atproto, like: like.uri },
        };
      },
      async unfavourite() {
        const current = await this.fetch();
        if (current._atproto.like)
          await agent.deleteLike(current._atproto.like);
        return {
          ...current,
          favourited: false,
          favouritesCount: Math.max(0, current.favouritesCount - 1),
        };
      },
      async reblog() {
        const current = await this.fetch();
        const repost = await agent.repost(current.uri, current._atproto.cid);
        return {
          ...current,
          reblogged: true,
          reblogsCount: current.reblogsCount + 1,
          _atproto: { ...current._atproto, repost: repost.uri },
        };
      },
      async unreblog() {
        const current = await this.fetch();
        if (current._atproto.repost)
          await agent.deleteRepost(current._atproto.repost);
        return {
          ...current,
          reblogged: false,
          reblogsCount: Math.max(0, current.reblogsCount - 1),
        };
      },
      async bookmark() {
        const current = await this.fetch();
        await agent.app.bsky.bookmark.createBookmark({
          uri,
          cid: current._atproto.cid,
        });
        return { ...current, bookmarked: true };
      },
      async unbookmark() {
        const current = await this.fetch();
        await agent.app.bsky.bookmark.deleteBookmark({ uri });
        return { ...current, bookmarked: false };
      },
      async remove() {
        await agent.app.bsky.feed.post.delete({
          repo: agent.did,
          rkey: atprotoRkey(uri),
        });
        return {};
      },
      async update() {
        throw new Error('Bluesky posts cannot be edited');
      },
      async mute() {
        const current = await this.fetch();
        return { ...current, muted: true };
      },
      async unmute() {
        const current = await this.fetch();
        return { ...current, muted: false };
      },
      async pin() {
        throw new Error('Bluesky pinned posts are not supported');
      },
      async unpin() {
        throw new Error('Bluesky pinned posts are not supported');
      },
    };
  };

  async function fetchRelationship(id) {
    const actor = normalizeActor(id);
    const profileRes = await agent.getProfile({ actor });
    const relationshipsRes = await agent.app.bsky.graph.getRelationships({
      actor: agent.did,
      others: [profileRes.data.did],
    });
    return relationshipFromAtproto(
      relationshipsRes.data.relationships?.[0],
      profileRes.data,
    );
  }

  const accountAPI = (id) => ({
    async fetch() {
      const res = await agent.getProfile({ actor: normalizeActor(id) });
      return actorToAccount(res.data);
    },
    statuses: {
      list({
        limit = 20,
        exclude_replies: excludeReplies,
        exclude_reblogs: excludeReposts,
        only_media: onlyMedia,
        tagged,
        pinned,
      } = {}) {
        if (pinned) return emptyCollection();
        return makeCollection(async (cursor) => {
          const res = await agent.getAuthorFeed({
            actor: normalizeActor(id),
            limit,
            cursor,
            filter: 'posts_with_replies',
          });
          const feed = await hydrateFeedReplyContext(res.data.feed, agent);
          let items = feedToStatuses(feed, agent);
          if (excludeReplies) items = items.filter((item) => !item.inReplyToId);
          if (excludeReposts) items = items.filter((item) => !item.reblog);
          if (onlyMedia) {
            items = items.filter((item) => item.mediaAttachments?.length);
          }
          if (tagged) {
            const tag = tagged.toLowerCase();
            items = items.filter((item) =>
              item.tags?.some((itemTag) => itemTag.name?.toLowerCase() === tag),
            );
          }
          return { cursor: res.data.cursor, items };
        });
      },
    },
    followers: {
      list({ limit = 80 } = {}) {
        return makeCollection(async (cursor) => {
          const res = await agent.getFollowers({
            actor: normalizeActor(id),
            limit,
            cursor,
          });
          return {
            cursor: res.data.cursor,
            items: res.data.followers.map(actorToAccount),
          };
        });
      },
    },
    following: {
      list({ limit = 80 } = {}) {
        return makeCollection(async (cursor) => {
          const res = await agent.getFollows({
            actor: normalizeActor(id),
            limit,
            cursor,
          });
          return {
            cursor: res.data.cursor,
            items: res.data.follows.map(actorToAccount),
          };
        });
      },
    },
    featuredTags: {
      async list() {
        return [];
      },
    },
    endorsements: {
      async list() {
        return [];
      },
    },
    note: {
      async create() {
        throw new Error('Bluesky private notes are not supported');
      },
    },
    async follow() {
      const current = await fetchRelationship(id);
      if (!current.following) {
        const follow = await agent.follow(current.id);
        return {
          ...current,
          following: true,
          _atproto: { ...current._atproto, following: follow.uri },
        };
      }
      return current;
    },
    async unfollow() {
      const current = await fetchRelationship(id);
      if (current._atproto?.following) {
        await agent.deleteFollow(current._atproto.following);
      }
      return {
        ...current,
        following: false,
        _atproto: { ...current._atproto, following: undefined },
      };
    },
    async mute() {
      const actor = normalizeActor(id);
      await agent.mute(actor);
      const current = await fetchRelationship(actor);
      return { ...current, muting: true };
    },
    async unmute() {
      const actor = normalizeActor(id);
      await agent.unmute(actor);
      const current = await fetchRelationship(actor);
      return { ...current, muting: false };
    },
    async block() {
      const current = await fetchRelationship(id);
      if (!current.blocking) {
        const block = await agent.app.bsky.graph.block.create(
          { repo: agent.did },
          { subject: current.id, createdAt: new Date().toISOString() },
        );
        return {
          ...current,
          blocking: true,
          _atproto: { ...current._atproto, blocking: block.uri },
        };
      }
      return current;
    },
    async unblock() {
      const current = await fetchRelationship(id);
      if (current._atproto?.blocking) {
        await agent.app.bsky.graph.block.delete({
          repo: agent.did,
          rkey: atprotoRkey(current._atproto.blocking),
        });
      }
      return {
        ...current,
        blocking: false,
        _atproto: { ...current._atproto, blocking: undefined },
      };
    },
    async pin() {
      throw new Error('Bluesky featured profiles are not supported');
    },
    async unpin() {
      throw new Error('Bluesky featured profiles are not supported');
    },
  });

  const listAPI = (id) => {
    const uri = decodeResourceID(id);
    return {
      async fetch() {
        if (uri.includes('/app.bsky.feed.generator/')) {
          const res = await agent.app.bsky.feed.getFeedGenerator({
            feed: uri,
          });
          return feedGeneratorToPhanpyList(res.data.view);
        }
        const res = await agent.app.bsky.graph.getList({
          list: uri,
          limit: 1,
        });
        return listToPhanpyList(res.data.list);
      },
      async update({ title } = {}) {
        if (uri.includes('/app.bsky.feed.generator/')) {
          throw new Error('Feed generators are not editable here');
        }
        const current = await this.fetch();
        await agent.com.atproto.repo.putRecord({
          repo: agent.did,
          collection: 'app.bsky.graph.list',
          rkey: atprotoRkey(uri),
          record: {
            purpose:
              current._atproto?.purpose || 'app.bsky.graph.defs#curatelist',
            name: title || current.title,
            description: '',
            createdAt: new Date().toISOString(),
          },
        });
        return { ...current, title: title || current.title };
      },
      async remove() {
        if (uri.includes('/app.bsky.feed.generator/')) {
          throw new Error('Feed generators are not removable here');
        }
        const listitemURIs = [];
        let cursor;
        do {
          const res = await agent.app.bsky.graph.listitem.list({
            repo: agent.did,
            cursor,
            limit: 100,
          });
          listitemURIs.push(
            ...res.records
              .filter((record) => record.value?.list === uri)
              .map((record) => record.uri),
          );
          cursor = res.cursor;
        } while (cursor);

        const deleteWrite = (recordURI) => ({
          $type: 'com.atproto.repo.applyWrites#delete',
          collection: recordURI.split('/').slice(-2, -1)[0],
          rkey: atprotoRkey(recordURI),
        });
        const writes = [...listitemURIs.map(deleteWrite), deleteWrite(uri)];
        for (let i = 0; i < writes.length; i += 10) {
          await agent.com.atproto.repo.applyWrites({
            repo: agent.did,
            writes: writes.slice(i, i + 10),
          });
        }
        return {};
      },
      accounts: {
        list({ limit = 80 } = {}) {
          return makeCollection(async (cursor) => {
            const res = await agent.app.bsky.graph.getList({
              list: uri,
              limit,
              cursor,
            });
            return {
              cursor: res.data.cursor,
              items: res.data.items.map((item) => actorToAccount(item.subject)),
            };
          });
        },
        async create({ accountIds = [] } = {}) {
          if (uri.includes('/app.bsky.feed.generator/')) {
            throw new Error('Feed generators do not have editable members');
          }
          await Promise.all(
            accountIds.map((accountID) =>
              agent.app.bsky.graph.listitem.create(
                { repo: agent.did },
                {
                  subject: accountID,
                  list: uri,
                  createdAt: new Date().toISOString(),
                },
              ),
            ),
          );
          return {};
        },
        async remove({ accountIds = [] } = {}) {
          if (uri.includes('/app.bsky.feed.generator/')) {
            throw new Error('Feed generators do not have editable members');
          }
          const ids = new Set(accountIds);
          const removals = [];
          let cursor;
          do {
            const res = await agent.app.bsky.graph.listitem.list({
              repo: agent.did,
              cursor,
              limit: 100,
            });
            removals.push(
              ...res.records.filter(
                (record) =>
                  record.value?.list === uri && ids.has(record.value?.subject),
              ),
            );
            cursor = res.cursor;
          } while (cursor);
          await Promise.all(
            removals.map((record) =>
              agent.app.bsky.graph.listitem.delete({
                repo: agent.did,
                rkey: atprotoRkey(record.uri),
              }),
            ),
          );
          return {};
        },
      },
    };
  };

  async function fetchNotifications(
    { limit = 80, types, excludeTypes } = {},
    cursor,
  ) {
    const res = await agent.listNotifications({
      limit,
      cursor,
    });
    const allowedTypes = types?.length ? new Set(types) : null;
    const blockedTypes = excludeTypes?.length ? new Set(excludeTypes) : null;
    const notifications = res.data.notifications.filter((notification) => {
      const type = notificationType(notification.reason);
      if (allowedTypes && !allowedTypes.has(type)) return false;
      if (blockedTypes?.has(type)) return false;
      return true;
    });
    const statusURIs = [
      ...new Set(
        notifications
          .map((notification) => notificationStatusURI(notification))
          .filter(Boolean),
      ),
    ];
    const posts = statusURIs.length
      ? await agent
          .getPosts({ uris: statusURIs })
          .then((res) => res.data.posts)
          .catch(() => [])
      : [];
    const postMap = Object.fromEntries(
      posts.map((post) => [post.uri, postToStatus(post, agent)]),
    );
    const items = notifications.map((notification) => {
      const statusURI = notificationStatusURI(notification);
      return {
        id: `${notification.uri}-${notification.indexedAt}`,
        type: notificationType(notification.reason),
        createdAt: notification.indexedAt,
        account: actorToAccount(notification.author),
        status: postMap[statusURI],
      };
    });
    const statusRequiredTypes = new Set([
      'favourite',
      'reblog',
      'status',
      'mention',
      'quote',
    ]);
    return {
      cursor: res.data.cursor,
      items: items.filter(
        (item) => !statusRequiredTypes.has(item.type) || item.status,
      ),
    };
  }

  return {
    agent,
    v1: {
      accounts: {
        async verifyCredentials() {
          const profile = await agent.getProfile({ actor: agent.did });
          return actorToAccount(profile.data);
        },
        async updateCredentials({
          avatar,
          header,
          displayName,
          note,
          source,
        } = {}) {
          if (source) return this.verifyCredentials();
          const current = await agent.com.atproto.repo
            .getRecord({
              repo: agent.did,
              collection: 'app.bsky.actor.profile',
              rkey: 'self',
            })
            .then((res) => res.data.value)
            .catch(() => ({
              $type: 'app.bsky.actor.profile',
            }));
          const next = {
            ...current,
          };
          if (displayName !== undefined) {
            next.displayName = displayName || '';
          }
          if (note !== undefined) {
            next.description = note || '';
          }
          const avatarBlob = await uploadProfileImage(agent, avatar);
          if (avatarBlob) next.avatar = avatarBlob;
          const headerBlob = await uploadProfileImage(agent, header);
          if (headerBlob) next.banner = headerBlob;
          await agent.com.atproto.repo.putRecord({
            repo: agent.did,
            collection: 'app.bsky.actor.profile',
            rkey: 'self',
            record: next,
          });
          return this.verifyCredentials();
        },
        async lookup({ acct }) {
          const profile = await agent.getProfile({
            actor: normalizeActor(acct),
          });
          return actorToAccount(profile.data);
        },
        $select: accountAPI,
        relationships: {
          async fetch({ id } = {}) {
            const ids = Array.isArray(id) ? id : [id].filter(Boolean);
            if (!ids.length) return [];
            const profilesRes = await agent.getProfiles({
              actors: ids.map(normalizeActor),
            });
            const relationshipsRes =
              await agent.app.bsky.graph.getRelationships({
                actor: agent.did,
                others: ids.map(normalizeActor),
              });
            const profiles = Object.fromEntries(
              profilesRes.data.profiles.map((profile) => [
                profile.did,
                profile,
              ]),
            );
            return relationshipsRes.data.relationships.map((relationship) =>
              relationshipFromAtproto(relationship, profiles[relationship.did]),
            );
          },
        },
        familiarFollowers: {
          async fetch({ id } = {}) {
            const ids = Array.isArray(id) ? id : [id].filter(Boolean);
            return ids.map((accountID) => ({ id: accountID, accounts: [] }));
          },
        },
        search: {
          async list({ q, limit = 10 } = {}) {
            const res = await agent.searchActors({
              term: q || '',
              limit,
            });
            return res.data.actors.map(actorToAccount);
          },
        },
      },
      timelines: {
        home: {
          list({ limit = 20 } = {}) {
            return makeCollection(async (cursor) => {
              const res = await agent.getTimeline({ limit, cursor });
              const feed = await hydrateFeedReplyContext(res.data.feed, agent);
              const processedFeed = postProcessFollowingFeed(feed, agent.did);
              return {
                cursor: res.data.cursor,
                items: feedToStatuses(processedFeed, agent),
              };
            });
          },
        },
        public: {
          list({ limit = 20 } = {}) {
            return makeCollection(async (cursor) => {
              const res = await agent.app.bsky.feed.getFeed({
                feed: BSKY_DISCOVER_FEED,
                limit,
                cursor,
              });
              const feed = await hydrateFeedReplyContext(res.data.feed, agent);
              return {
                cursor: res.data.cursor,
                items: feedToStatuses(feed, agent),
              };
            });
          },
        },
        tag: {
          $select(tag) {
            return {
              list({ limit = 20, any = [], onlyMedia } = {}) {
                const q = [tag, ...any]
                  .filter(Boolean)
                  .map((value) => `#${String(value).replace(/^#/, '')}`)
                  .join(' ');
                return makeCollection(async (cursor) => {
                  const res = await agent.app.bsky.feed.searchPosts({
                    q,
                    limit,
                    cursor,
                  });
                  let items = res.data.posts.map((post) =>
                    postToStatus(post, agent),
                  );
                  if (onlyMedia) {
                    items = items.filter(
                      (item) => item.mediaAttachments?.length,
                    );
                  }
                  return { cursor: res.data.cursor, items };
                });
              },
            };
          },
        },
        link: {
          list({ url, limit = 20 } = {}) {
            if (!url) return emptyCollection();
            return makeCollection(async (cursor) => {
              const res = await agent.app.bsky.feed.searchPosts({
                q: url,
                limit,
                cursor,
              });
              return {
                cursor: res.data.cursor,
                items: res.data.posts.map((post) => postToStatus(post, agent)),
              };
            });
          },
        },
        list: {
          $select(id) {
            const uri = decodeResourceID(id);
            return {
              list({ limit = 20 } = {}) {
                return makeCollection(async (cursor) => {
                  const method = uri.includes('/app.bsky.feed.generator/')
                    ? 'getFeed'
                    : 'getListFeed';
                  const key = method === 'getFeed' ? 'feed' : 'list';
                  const res = await agent.app.bsky.feed[method]({
                    [key]: uri,
                    limit,
                    cursor,
                  });
                  const feed = await hydrateFeedReplyContext(
                    res.data.feed,
                    agent,
                  );
                  return {
                    cursor: res.data.cursor,
                    items: feedToStatuses(feed, agent),
                  };
                });
              },
            };
          },
        },
      },
      lists: {
        async list() {
          const lists = [];
          let cursor;
          do {
            const res = await agent.app.bsky.graph.getLists({
              actor: agent.did,
              limit: 50,
              cursor,
            });
            lists.push(
              ...res.data.lists
                .filter(
                  (list) => list.purpose === 'app.bsky.graph.defs#curatelist',
                )
                .map(listToPhanpyList),
            );
            cursor = res.data.cursor;
          } while (cursor);
          const preferences = await agent.getPreferences().catch(() => null);
          const savedFeeds = preferences?.savedFeeds || [];
          const savedFeedURIs = [
            BSKY_DISCOVER_FEED,
            ...savedFeeds
              .filter((feed) => feed.type === 'feed')
              .map((feed) => feed.value),
          ];
          const feedViews = savedFeedURIs.length
            ? await agent.app.bsky.feed
                .getFeedGenerators({
                  feeds: [...new Set(savedFeedURIs)],
                })
                .then((res) => res.data.feeds)
                .catch(() => [])
            : [];
          const actorFeeds = await agent.app.bsky.feed
            .getActorFeeds({
              actor: agent.did,
              limit: 100,
            })
            .then((res) => res.data.feeds)
            .catch(() => []);
          const savedLists = await Promise.all(
            savedFeeds
              .filter((feed) => feed.type === 'list')
              .map((feed) =>
                agent.app.bsky.graph
                  .getList({ list: feed.value, limit: 1 })
                  .then((res) => listToPhanpyList(res.data.list))
                  .catch(() => null),
              ),
          );
          const allLists = [
            ...lists,
            ...feedViews.map(feedGeneratorToPhanpyList),
            ...actorFeeds.map(feedGeneratorToPhanpyList),
            ...savedLists.filter(Boolean),
          ];
          return [...new Map(allLists.map((list) => [list.id, list])).values()];
        },
        $select: listAPI,
        async create({ title } = {}) {
          const res = await agent.app.bsky.graph.list.create(
            { repo: agent.did },
            {
              purpose: 'app.bsky.graph.defs#curatelist',
              name: title || 'List',
              description: '',
              createdAt: new Date().toISOString(),
            },
          );
          return listAPI(encodeURIComponent(res.uri)).fetch();
        },
      },
      bookmarks: {
        list({ limit = 20 } = {}) {
          return makeCollection(async (cursor) => {
            const res = await agent.app.bsky.bookmark.getBookmarks({
              limit,
              cursor,
            });
            return {
              cursor: res.data.cursor,
              items: res.data.bookmarks.map((post) =>
                postToStatus(post, agent),
              ),
            };
          });
        },
      },
      favourites: {
        list({ limit = 20 } = {}) {
          return makeCollection(async (cursor) => {
            const res = await agent.app.bsky.feed.getActorLikes({
              actor: agent.did,
              limit,
              cursor,
            });
            const feed = await hydrateFeedReplyContext(res.data.feed, agent);
            return {
              cursor: res.data.cursor,
              items: feedToStatuses(feed, agent),
            };
          });
        },
      },
      mutes: {
        list({ limit = 80 } = {}) {
          return makeCollection(async (cursor) => {
            const res = await agent.app.bsky.graph.getMutes({
              limit,
              cursor,
            });
            return {
              cursor: res.data.cursor,
              items: res.data.mutes.map(actorToAccount),
            };
          });
        },
      },
      blocks: {
        list({ limit = 80 } = {}) {
          return makeCollection(async (cursor) => {
            const res = await agent.app.bsky.graph.getBlocks({
              limit,
              cursor,
            });
            return {
              cursor: res.data.cursor,
              items: res.data.blocks.map(actorToAccount),
            };
          });
        },
      },
      tags: {
        $select(name) {
          return {
            async fetch() {
              return {
                name,
                url: `/t/${encodeURIComponent(name)}`,
                history: [],
                following: false,
              };
            },
            async follow() {
              throw new Error('Bluesky hashtag follows are not supported');
            },
            async unfollow() {
              throw new Error('Bluesky hashtag follows are not supported');
            },
          };
        },
      },
      followedTags: {
        list() {
          return emptyCollection();
        },
      },
      featuredTags: {
        async list() {
          return [];
        },
        async create() {
          throw new Error('Bluesky featured hashtags are not supported');
        },
        $select() {
          return {
            async remove() {
              throw new Error('Bluesky featured hashtags are not supported');
            },
          };
        },
      },
      trends: {
        tags: {
          list() {
            return emptyCollection();
          },
        },
        links: {
          list() {
            return emptyCollection();
          },
        },
        statuses: {
          list({ limit = 20 } = {}) {
            return makeCollection(async (cursor) => {
              const res = await agent.app.bsky.feed.getFeed({
                feed: BSKY_DISCOVER_FEED,
                limit,
                cursor,
              });
              const feed = await hydrateFeedReplyContext(res.data.feed, agent);
              return {
                cursor: res.data.cursor,
                items: feedToStatuses(feed, agent),
              };
            });
          },
        },
      },
      notifications: {
        list(opts = {}) {
          return makeCollection((cursor) => fetchNotifications(opts, cursor));
        },
        $select(id) {
          return {
            async fetch() {
              let cursor;
              for (let page = 0; page < 5; page++) {
                const res = await fetchNotifications({ limit: 80 }, cursor);
                const notification = res.items.find((item) => item.id === id);
                if (notification) return notification;
                if (!res.cursor) break;
                cursor = res.cursor;
              }
              throw new Error('Notification not found');
            },
          };
        },
        requests: {
          async list() {
            return [];
          },
          $select(id) {
            return {
              async accept() {
                return { id };
              },
              async dismiss() {
                return { id };
              },
            };
          },
        },
      },
      conversations: {
        list() {
          return emptyCollection();
        },
        $select() {
          return {
            async read() {
              return {};
            },
          };
        },
      },
      announcements: {
        async list() {
          return [];
        },
      },
      push: {
        subscription: {
          async fetch() {
            throw new Error('Push subscription not found');
          },
          async create() {
            throw new Error('Bluesky push subscriptions are not supported');
          },
          async update() {
            throw new Error('Bluesky push subscriptions are not supported');
          },
          async remove() {
            return {};
          },
        },
      },
      markers: {
        async create() {
          return {};
        },
        async fetch() {
          return {};
        },
      },
      customEmojis: {
        async list() {
          return [];
        },
      },
      followRequests: {
        async list() {
          return [];
        },
        $select(id) {
          return {
            async authorize() {
              return relationshipFor(id);
            },
            async reject() {
              return relationshipFor(id);
            },
          };
        },
      },
      scheduledStatuses: {
        list() {
          return emptyCollection();
        },
        $select() {
          return {
            async update() {
              throw new Error('Bluesky scheduled posts are not supported');
            },
            async remove() {
              throw new Error('Bluesky scheduled posts are not supported');
            },
          };
        },
      },
      statuses: {
        $select: statusAPI,
        async list({ id } = {}) {
          const ids = Array.isArray(id) ? id : [id].filter(Boolean);
          if (!ids.length) return [];
          const uris = ids.map((value) => decodeURIComponent(value));
          const res = await agent.getPosts({ uris });
          return res.data.posts.map((post) => postToStatus(post, agent));
        },
        async create(params = {}) {
          if (params.scheduled_at || params.scheduledAt) {
            throw new Error('Bluesky scheduled posts are not supported');
          }
          if (params.poll) {
            throw new Error('Bluesky polls are not supported');
          }
          const inReplyToId = params.in_reply_to_id || params.inReplyToId;
          const quoteId =
            params.quoted_status_id || params.quote_id || params.quoteId;
          const rt = new RichText({ text: params.status || '' });
          await rt.detectFacets(agent);
          const record = {
            text: rt.text,
            facets: rt.facets,
            createdAt: new Date().toISOString(),
          };
          if (inReplyToId) {
            const parent = await statusAPI(inReplyToId).fetch();
            const root = parent._atproto?.root || {
              uri: parent.uri,
              cid: parent._atproto.cid,
            };
            record.reply = {
              root,
              parent: { uri: parent.uri, cid: parent._atproto.cid },
            };
          }
          if (quoteId) {
            const quote = await statusAPI(quoteId).fetch();
            record.embed = {
              $type: 'app.bsky.embed.record',
              record: { uri: quote.uri, cid: quote._atproto.cid },
            };
          }
          const mediaIds = params.media_ids || params.mediaIds || [];
          if (mediaIds.length) {
            const media = mediaIds
              .map((id) => uploadedMedia.get(id))
              .filter((media) => media?.blob);
            const videos = media.filter((media) => media.type === 'video');
            const images = media
              .filter((media) => media.type === 'image')
              .map((media) => ({
                image: media.blob,
                alt: media.description || '',
              }));
            if (videos.length && images.length) {
              throw new Error('Bluesky posts cannot mix images and video');
            }
            if (videos.length > 1) {
              throw new Error('Bluesky posts support one video');
            }
            if (videos.length) {
              const videoEmbed = {
                $type: 'app.bsky.embed.video',
                video: videos[0].blob,
                alt: videos[0].description || '',
              };
              if (record.embed) {
                record.embed = {
                  $type: 'app.bsky.embed.recordWithMedia',
                  record: record.embed,
                  media: videoEmbed,
                };
              } else {
                record.embed = videoEmbed;
              }
            } else if (images.length) {
              if (record.embed) {
                record.embed = {
                  $type: 'app.bsky.embed.recordWithMedia',
                  record: record.embed,
                  media: {
                    $type: 'app.bsky.embed.images',
                    images,
                  },
                };
              } else {
                record.embed = {
                  $type: 'app.bsky.embed.images',
                  images,
                };
              }
            }
          }
          if (!record.embed && !(params.disable_card || params.disableCard)) {
            const externalEmbed = await createAtprotoExternalEmbed(
              agent,
              params.card_url ||
                params.cardUrl ||
                params.external_url ||
                params.externalUrl ||
                getFirstPostURL(rt.text),
            );
            if (externalEmbed) record.embed = externalEmbed;
          }
          const res = await agent.post(record);
          const id = encodeAtprotoID(res.uri);
          for (let i = 0; i < 10; i++) {
            try {
              return await statusAPI(id).fetch();
            } catch (e) {
              await wait(500);
            }
          }
          const profile = await agent.getProfile({ actor: agent.did });
          return postToStatus(
            {
              uri: res.uri,
              cid: res.cid,
              author: profile.data,
              record,
              reply: record.reply,
            },
            agent,
          );
        },
      },
      polls: {
        $select(id) {
          return {
            async fetch() {
              throw new Error('Bluesky polls are not supported');
            },
            votes: {
              async create() {
                throw new Error('Bluesky polls are not supported');
              },
            },
          };
        },
      },
      annualReports: {
        $select(year) {
          return {
            async fetch() {
              return {
                accounts: [],
                statuses: [],
                annualReports: [{ year, data: {} }],
              };
            },
          };
        },
      },
      media: {
        async create({ file, description } = {}) {
          return createMediaUpload({
            agent,
            uploadedMedia,
            file,
            description,
          });
        },
      },
      instance: {
        async fetch() {
          return atprotoInstanceInfo();
        },
      },
      preferences: {
        async fetch() {
          return {};
        },
      },
      reports: {
        async create({ accountId, statusIds, category, comment } = {}) {
          let subject = {
            $type: 'com.atproto.admin.defs#repoRef',
            did: normalizeActor(accountId),
          };
          if (statusIds?.length) {
            const status = await statusAPI(statusIds[0]).fetch();
            subject = {
              $type: 'com.atproto.repo.strongRef',
              uri: status.uri,
              cid: status._atproto.cid,
            };
          }
          return agent.com.atproto.moderation.createReport({
            reasonType:
              category === 'spam'
                ? 'com.atproto.moderation.defs#reasonSpam'
                : 'com.atproto.moderation.defs#reasonViolation',
            reason: comment,
            subject,
          });
        },
      },
    },
    v2: {
      media: {
        async create(params = {}) {
          return this._create(params);
        },
        async _create({ file, description } = {}) {
          return createMediaUpload({
            agent,
            uploadedMedia,
            file,
            description,
          });
        },
      },
      instance: {
        async fetch() {
          return atprotoInstanceInfo();
        },
      },
      notifications: {
        list(opts = {}) {
          return makeCollection((cursor) =>
            fetchNotifications(opts, cursor).then(toGroupedNotificationsPage),
          );
        },
        policy: {
          async fetch() {
            return {};
          },
          async update(policy = {}) {
            return policy;
          },
        },
      },
      filters: {
        async list() {
          return [];
        },
        async create() {
          throw new Error('Bluesky filters are not supported');
        },
        $select() {
          return {
            async update() {
              throw new Error('Bluesky filters are not supported');
            },
            async remove() {
              throw new Error('Bluesky filters are not supported');
            },
          };
        },
      },
      search: {
        async fetch(params = {}) {
          return this.list(params);
        },
        async list({ q = '', type, limit = 20 } = {}) {
          const wanted = type ? [type] : ['accounts', 'statuses', 'hashtags'];
          const results = {
            accounts: [],
            statuses: [],
            hashtags: [],
          };

          if (wanted.includes('accounts')) {
            const res = await agent.searchActors({
              term: q,
              limit,
            });
            results.accounts = res.data.actors.map(actorToAccount);
          }

          if (wanted.includes('statuses')) {
            const res = await agent.app.bsky.feed.searchPosts({
              q,
              limit,
            });
            results.statuses = res.data.posts.map((post) =>
              postToStatus(post, agent),
            );
          }

          if (wanted.includes('hashtags')) {
            const tag = q.replace(/^#/, '').trim();
            results.hashtags = tag
              ? [
                  {
                    name: tag,
                    url: `/t/${encodeURIComponent(tag)}`,
                    history: [],
                  },
                ]
              : [];
          }

          return results;
        },
      },
    },
  };
}

export function atprotoInstanceInfo() {
  return {
    uri: BSKY_INSTANCE,
    domain: BSKY_INSTANCE,
    title: 'Bluesky',
    version: '4.4.0 (compatible; Bluesky ATProto)',
    sourceUrl: 'https://github.com/bluesky-social/social-app',
    configuration: {
      statuses: {
        maxCharacters: 300,
        maxMediaAttachments: 4,
      },
      mediaAttachments: {
        supportedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'video/mp4',
        ],
        imageSizeLimit: 1_000_000,
        videoSizeLimit: 100_000_000,
        descriptionLimit: 1_000,
      },
      polls: {
        maxOptions: 0,
      },
    },
    apiVersions: { mastodon: 7 },
  };
}

export async function loginAtproto({ identifier, password, service }) {
  service = await resolveAtprotoLoginService({ identifier, service });
  const agent = new BskyAgent({ service });
  await agent.login({ identifier, password });
  const profile = await agent.getProfile({ actor: agent.did });
  return {
    agent,
    account: actorToAccount(profile.data),
    session: agent.session,
    service,
  };
}

export function createPublicAtprotoClient() {
  return createAtprotoClient({ service: BSKY_APPVIEW });
}
