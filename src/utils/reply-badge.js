export function shouldShowReplyBadge({
  inReplyToId,
  inReplyToAccount,
  instance,
  spoilerText,
  mentions = [],
  inReplyToAccountId,
}) {
  return (
    !!inReplyToId &&
    !!inReplyToAccount &&
    (instance === 'bsky.social' ||
      !!spoilerText ||
      !mentions.find((mention) => mention.id === inReplyToAccountId))
  );
}
