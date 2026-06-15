import './collection-card.css';

import { ph } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import { api } from '../utils/api';
import states from '../utils/states';

import Avatar from './avatar';

const ACCOUNT_ITEMS_LIMIT = 5;
const ACCOUNT_ROTATION_INTERVAL = 300_000; // 5 min in ms

function CollectionCard({ collection, instance, sensitive, creatorAccount }) {
  const snapStates = useSnapshot(states);
  const { i18n } = useLingui();
  const {
    name,
    description,
    url,
    items = [],
    itemsCount,
    accountId,
    language,
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

  const overflowCount = (itemsCount || items.length) - ACCOUNT_ITEMS_LIMIT;

  return (
    <a
      href={url}
      target="_blank"
      rel="nofollow noopener"
      class={`collection-card ${sensitive ? 'sensitive' : ''}`}
      lang={language || undefined}
    >
      {accountItems.length > 0 && (
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
          {accountItems.map((account) => (
            <Avatar
              key={account.id}
              url={account.avatarStatic || account.avatar}
              size="l"
              alt={account.displayName || account.username || ''}
              squircle={account.bot}
            />
          ))}
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
      </div>
    </a>
  );
}

export default CollectionCard;
