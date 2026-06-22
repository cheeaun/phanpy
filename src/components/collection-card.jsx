import './collection-card.css';

import { ph } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import { api } from '../utils/api';
import states from '../utils/states';

import Avatar from './avatar';
import Icon from './icon';
import RelativeTime from './relative-time';

const ACCOUNT_ITEMS_LIMIT = 5;
const ACCOUNT_ROTATION_INTERVAL = 300_000; // 5 min in ms

function CollectionCard({
  collection,
  instance,
  creatorAccount,
  size,
  showMeta,
}) {
  const snapStates = useSnapshot(states);
  const { i18n } = useLingui();
  const {
    id,
    name,
    description,
    url,
    items = [],
    itemsCount,
    accountId,
    language,
    updatedAt,
    discoverable,
    sensitive,
  } = collection;

  // Rotate start index by 1 every interval when items exceed the limit
  const rotationSlot = Math.floor(Date.now() / ACCOUNT_ROTATION_INTERVAL);
  const selectedItems = useMemo(() => {
    if (items.length > ACCOUNT_ITEMS_LIMIT) {
      const offset = rotationSlot % items.length;
      return [...items.slice(offset), ...items.slice(0, offset)].slice(
        0,
        ACCOUNT_ITEMS_LIMIT,
      );
    }
    return items;
  }, [rotationSlot, items]);

  // Resolve up to ACCOUNT_ITEMS_LIMIT accounts from items
  const accountItems = selectedItems
    .slice(0, ACCOUNT_ITEMS_LIMIT)
    .map((item) => snapStates.accounts[item.accountId])
    .filter(Boolean);

  // Background shows first and last account avatars (or just one if there's only one)
  const bgAccounts =
    accountItems.length === 1
      ? [accountItems[0]]
      : [accountItems[0], accountItems[accountItems.length - 1]];

  // Resolve creator account
  const creator = creatorAccount || snapStates.accounts[accountId];

  // Fetch missing accounts
  useEffect(() => {
    let aborted = false;
    const { masto } = api({ instance });

    const missingIDs = [
      ...new Set(
        selectedItems
          .slice(0, ACCOUNT_ITEMS_LIMIT)
          .map((item) => item.accountId)
          .concat(!creatorAccount ? accountId : [])
          .filter(Boolean),
      ),
    ].filter((id) => !states.accounts[id]);

    if (missingIDs.length > 0) {
      masto.v1.accounts
        .fetch({ id: missingIDs })
        .then((accounts) => {
          if (!aborted) {
            for (const account of accounts) {
              states.accounts[account.id] = account;
            }
          }
        })
        .catch(() => {});
    }

    return () => {
      aborted = true;
    };
  }, [selectedItems, instance]);

  const visibleCount = Math.min(selectedItems.length, ACCOUNT_ITEMS_LIMIT);
  const overflowCount = (itemsCount || items.length) - ACCOUNT_ITEMS_LIMIT;

  return (
    <a
      href={url}
      target="_blank"
      rel="nofollow noopener"
      class={`collection-card ${sensitive ? 'sensitive' : ''} ${size === 'l' ? 'large' : ''}`}
      lang={language || undefined}
      onClick={(e) => {
        if (!id) return;
        // If cmd/ctrl/shift/alt key is pressed or middle-click, let the browser handle it
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.which === 2) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        location.hash = `#${instance ? `/${instance}` : ''}/c/${id}`;
      }}
    >
      {!sensitive && accountItems.length > 0 && (
        <div class="collection-card-bg" aria-hidden="true">
          {bgAccounts.map((a) => (
            <img
              key={a.id}
              src={a.avatarStatic || a.avatar}
              alt=""
              decoding="async"
              loading="lazy"
            />
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div class="collection-accounts">
          {sensitive ? (
            <>
              {Array.from({ length: visibleCount }, (_, i) => (
                <div key={i} class="avatar-placeholder">
                  {i === 0 && <Icon icon="alert" />}
                </div>
              ))}
            </>
          ) : (
            Array.from({ length: visibleCount }, (_, i) => {
              const account = snapStates.accounts[selectedItems[i].accountId];
              return account ? (
                <Avatar
                  key={account.id}
                  url={account.avatarStatic || account.avatar}
                  size="l"
                  alt={account.displayName || account.username || ''}
                  squircle={account.bot}
                />
              ) : (
                <div key={selectedItems[i].accountId} class="avatar-spacer" />
              );
            })
          )}
          {overflowCount > 0 && (
            <span class="account-overflow-count">+{overflowCount}</span>
          )}
        </div>
      )}
      <div class="meta-container">
        <p class="title" dir="auto">
          {name}
        </p>
        {!!description && (
          <p class="meta" dir="auto">
            {description}
          </p>
        )}
        {!!creator && (
          <p class="meta" lang={i18n.locale} dir="auto">
            <Trans>
              Collection by{' '}
              <span class="bidi-isolate">
                @{ph({ username: creator.acct })}
              </span>
            </Trans>
          </p>
        )}
        {showMeta && (
          <p class="meta" dir="auto">
            {updatedAt && (
              <Trans>
                Last updated:{' '}
                <RelativeTime
                  _t="relativeTime"
                  datetime={updatedAt}
                  format="micro"
                />
              </Trans>
            )}
            {discoverable === false && (
              <>
                {updatedAt && ' · '}
                <Trans>Unlisted</Trans>
              </>
            )}
          </p>
        )}
      </div>
    </a>
  );
}

export default CollectionCard;
