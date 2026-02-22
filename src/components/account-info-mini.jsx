import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useRef } from 'preact/hooks';

import { api } from '../utils/api';
import shortenNumber from '../utils/shorten-number';
import states from '../utils/states';

import Link from './link';

const LIMIT = 80;

export default function AccountInfoMini({ account, instance }) {
  const { t } = useLingui();

  if (!account) return null;

  const { followersCount, followingCount, statusesCount, id, hideCollections } =
    account;
  const accountLink = instance ? `/${instance}/a/${id}` : `/a/${id}`;

  const { masto } = api({ instance });

  const followersIterator = useRef();
  async function fetchFollowers(firstLoad) {
    if (!id) return { value: [], done: true };
    if (firstLoad || !followersIterator.current) {
      followersIterator.current = masto.v1.accounts
        .$select(id)
        .followers.list({ limit: LIMIT })
        .values();
    }
    return await followersIterator.current.next();
  }

  const followingIterator = useRef();
  async function fetchFollowing(firstLoad) {
    if (!id) return { value: [], done: true };
    if (firstLoad || !followingIterator.current) {
      followingIterator.current = masto.v1.accounts
        .$select(id)
        .following.list({ limit: LIMIT })
        .values();
    }
    return await followingIterator.current.next();
  }

  return (
    <div class="account-container mini">
      <div class="account-metadata-box">
        <div class="stats">
          <div
            tabIndex={0}
            onClick={() => {
              setTimeout(() => {
                states.showGenericAccounts = {
                  id: 'followers',
                  heading: t`Followers`,
                  fetchAccounts: fetchFollowers,
                  instance,
                  blankCopy: hideCollections
                    ? t`This user has chosen to not make this information available.`
                    : undefined,
                };
              }, 0);
            }}
          >
            <Plural
              value={followersCount}
              one={
                <Trans>
                  <span title={followersCount}>
                    {shortenNumber(followersCount)}
                  </span>{' '}
                  Follower
                </Trans>
              }
              other={
                <Trans>
                  <span title={followersCount}>
                    {shortenNumber(followersCount)}
                  </span>{' '}
                  Followers
                </Trans>
              }
            />
          </div>
          <div
            class="insignificant"
            tabIndex={0}
            onClick={() => {
              setTimeout(() => {
                states.showGenericAccounts = {
                  heading: t({
                    id: 'following.stats',
                    message: 'Following',
                  }),
                  fetchAccounts: fetchFollowing,
                  instance,
                  blankCopy: hideCollections
                    ? t`This user has chosen to not make this information available.`
                    : undefined,
                };
              }, 0);
            }}
          >
            <Plural
              value={followingCount}
              other={
                <Trans>
                  <span title={followingCount}>
                    {shortenNumber(followingCount)}
                  </span>{' '}
                  Following
                </Trans>
              }
            />
          </div>
          <Link class="insignificant" to={accountLink}>
            <Plural
              value={statusesCount}
              one={
                <Trans>
                  <span title={statusesCount}>
                    {shortenNumber(statusesCount)}
                  </span>{' '}
                  Post
                </Trans>
              }
              other={
                <Trans>
                  <span title={statusesCount}>
                    {shortenNumber(statusesCount)}
                  </span>{' '}
                  Posts
                </Trans>
              }
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
