import { getAPIVersions, getCurrentInstance } from './store-utils';

export function supportsNativeQuote() {
  if (getCurrentInstance()?.domain === 'bsky.social') return true;
  return getAPIVersions()?.mastodon >= 7;
}

export function getPostQuoteApprovalPolicy(quoteApproval) {
  return quoteApproval?.[quoteApproval?.currentUser]?.[0] || 'nobody';
}
