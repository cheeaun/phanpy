import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useParams, useSearchParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import AccountInfo from '../components/account-info';
import Icon from '../components/icon';
import Link from '../components/link';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import emojifyText from '../utils/emojify-text';
import states from '../utils/states';
import { saveStatus } from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function AccountStatuses() {
  const snapStates = useSnapshot(states);
  const { id, ...params } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const excludeReplies = !searchParams.get('replies');
  const tagged = searchParams.get('tagged');
  const media = !!searchParams.get('media');
  console.log({ excludeReplies });
  const { masto, instance, authenticated } = api({ instance: params.instance });
  const accountStatusesIterator = useRef();
  async function fetchAccountStatuses(firstLoad) {
    const results = [];
    if (firstLoad) {
      const { value: pinnedStatuses } = await masto.v1.accounts
        .listStatuses(id, {
          pinned: true,
        })
        .next();
      if (pinnedStatuses?.length && !tagged && !media) {
        pinnedStatuses.forEach((status) => {
          status._pinned = true;
          saveStatus(status, instance);
        });
        if (pinnedStatuses.length >= 3) {
          const pinnedStatusesIds = pinnedStatuses.map((status) => status.id);
          results.push({
            id: pinnedStatusesIds,
            items: pinnedStatuses,
            type: 'pinned',
          });
        } else {
          results.push(...pinnedStatuses);
        }
      }
    }
    if (firstLoad || !accountStatusesIterator.current) {
      accountStatusesIterator.current = masto.v1.accounts.listStatuses(id, {
        limit: LIMIT,
        exclude_replies: excludeReplies,
        only_media: media,
        tagged,
      });
    }
    const { value, done } = await accountStatusesIterator.current.next();
    if (value?.length) {
      results.push(...value);

      value.forEach((item) => {
        saveStatus(item, instance);
      });
    }
    return {
      value: results,
      done,
    };
  }

  const [account, setAccount] = useState();
  const [featuredTags, setFeaturedTags] = useState([]);
  useTitle(
    `${account?.displayName ? account.displayName + ' ' : ''}@${
      account?.acct ? account.acct : 'Account posts'
    }`,
    '/:instance?/a/:id',
  );
  useEffect(() => {
    (async () => {
      try {
        const acc = await masto.v1.accounts.fetch(id);
        console.log(acc);
        setAccount(acc);
      } catch (e) {
        console.error(e);
      }
      try {
        const featuredTags = await masto.v1.accounts.listFeaturedTags(id);
        console.log({ featuredTags });
        setFeaturedTags(featuredTags);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [id]);

  const { displayName, acct, emojis } = account || {};

  const TimelineStart = useMemo(() => {
    const cachedAccount = snapStates.accounts[`${id}@${instance}`];
    return (
      <>
        <AccountInfo
          instance={instance}
          account={cachedAccount || id}
          fetchAccount={() => masto.v1.accounts.fetch(id)}
          authenticated={authenticated}
          standalone
        />
        <div class="filter-bar">
          <Icon icon="filter" class="insignificant" size="l" />
          <Link
            to={`/${instance}/a/${id}${excludeReplies ? '?replies=1' : ''}`}
            class={excludeReplies ? '' : 'is-active'}
          >
            + Replies
          </Link>
          <Link
            to={`/${instance}/a/${id}${media ? '' : '?media=1'}`}
            class={media ? 'is-active' : ''}
          >
            Media
          </Link>
          {featuredTags.map((tag) => (
            <Link
              to={`/${instance}/a/${id}${
                tagged === tag.name
                  ? ''
                  : `?tagged=${encodeURIComponent(tag.name)}`
              }`}
              class={tagged === tag.name ? 'is-active' : ''}
            >
              <span>
                <span class="more-insignificant">#</span>
                {tag.name}
              </span>
              {
                // The count differs based on instance 😅
              }
              {/* <span class="filter-count">{tag.statusesCount}</span> */}
            </Link>
          ))}
        </div>
      </>
    );
  }, [
    id,
    instance,
    authenticated,
    excludeReplies,
    featuredTags,
    tagged,
    media,
  ]);

  return (
    <Timeline
      key={id}
      title={`${account?.acct ? '@' + account.acct : 'Posts'}`}
      titleComponent={
        <h1
          class="header-account"
          // onClick={() => {
          //   states.showAccount = {
          //     account,
          //     instance,
          //   };
          // }}
        >
          <b
            dangerouslySetInnerHTML={{
              __html: emojifyText(displayName, emojis),
            }}
          />
          <div>
            <span>@{acct}</span>
          </div>
        </h1>
      }
      id="account-statuses"
      instance={instance}
      emptyText="Nothing to see here yet."
      errorText="Unable to load statuses"
      fetchItems={fetchAccountStatuses}
      useItemID
      boostsCarousel={snapStates.settings.boostsCarousel}
      timelineStart={TimelineStart}
      refresh={excludeReplies + tagged + media}
    />
  );
}

export default AccountStatuses;
