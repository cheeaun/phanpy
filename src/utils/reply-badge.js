export function shouldShowReplyBadge({
  inReplyToId,
  inReplyToAccount,
  isReplyParentUnavailable,
  instance,
  spoilerText,
  mentions = [],
  inReplyToAccountId,
}) {
  return (
    !!inReplyToId &&
    (!!inReplyToAccount || !!isReplyParentUnavailable) &&
    (instance === 'bsky.social' ||
      !!spoilerText ||
      !mentions.find((mention) => mention.id === inReplyToAccountId))
  );
}
