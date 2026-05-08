export function shouldFetchReplyContextForInstance(instance) {
  return instance !== 'bsky.social';
}

export function shouldFetchThreadParent({ status, instance }) {
  return (
    shouldFetchReplyContextForInstance(instance) &&
    !!status?.inReplyToId &&
    status.inReplyToAccountId === status.account?.id
  );
}
