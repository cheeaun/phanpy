interface ReplyMention {
  readonly id?: unknown;
}

interface ShouldShowReplyBadgeOptions {
  readonly inReplyToAccount?: unknown;
  readonly inReplyToAccountId?: unknown;
  readonly inReplyToId?: unknown;
  readonly instance?: string;
  readonly isReplyParentUnavailable?: unknown;
  readonly mentions?: readonly ReplyMention[];
  readonly spoilerText?: unknown;
}

function shouldShowReplyBadge(options: ShouldShowReplyBadgeOptions): boolean {
  const {
    inReplyToId,
    inReplyToAccount,
    isReplyParentUnavailable,
    instance,
    spoilerText,
    mentions = [],
    inReplyToAccountId,
  } = options;

  return (
    Boolean(inReplyToId) &&
    (Boolean(inReplyToAccount) || Boolean(isReplyParentUnavailable)) &&
    (instance === 'bsky.social' ||
      Boolean(spoilerText) ||
      !mentions.some(
        (mention: Readonly<ReplyMention>) =>
          mention.id === inReplyToAccountId,
      ))
  );
}

export { shouldShowReplyBadge };
