import { getAPIVersions } from './store-utils';

export function supportsNativeQuote() {
  return getAPIVersions()?.mastodon >= 7;
}

export function getPostQuoteApprovalPolicy(quoteApproval) {
  return quoteApproval?.[quoteApproval?.currentUser]?.[0] || 'nobody';
}
