import { MenuItem } from '@szhsin/react-menu';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useParams, useSearchParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import AccountInfo from '../components/account-info';
import EmojiText from '../components/emoji-text';
import Icon from '../components/icon';
import Link from '../components/link';
import Menu2 from '../components/menu2';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import showToast from '../utils/show-toast';
import states from '../utils/states';
import { saveStatus } from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function AccountStatuses() {
  const snapStates = useSnapshot(states);
  const { id, ...params } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const excludeReplies = !searchParams.get('replies');
  const excludeBoosts = !!searchParams.get('boosts');
  const tagged = searchParams.get('tagged');
  const media = !!searchParams.get('media');
  const { masto, instance, authenticated } = api({ instance: params.instance });
  const accountStatusesIterator = useRef();
  async function fetchAccountStatuses(firstLoad) {
    const results = [];
    if (firstLoad) {
      const { value: pinnedStatuses } = await masto.v1.accounts
        .$select(id)
        .statuses.list({
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
      accountStatusesIterator.current = masto.v1.accounts
        .$select(id)
        .statuses.list({
          limit: LIMIT,
          exclude_replies: excludeReplies,
          exclude_reblogs: excludeBoosts,
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
        const acc = await masto.v1.accounts.$select(id).fetch();
        console.log(acc);
        setAccount(acc);
      } catch (e) {
        console.error(e);
      }
      try {
        const featuredTags = await masto.v1.accounts
          .$select(id)
          .featuredTags.list(id);
        console.log({ featuredTags });
        setFeaturedTags(featuredTags);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [id]);

  const { displayName, acct, emojis } = account || {};

  const filterBarRef = useRef();
  const TimelineStart = useMemo(() => {
    const cachedAccount = snapStates.accounts[`${id}@${instance}`];
    const filtered = !excludeReplies || excludeBoosts || tagged || media;
    return (
      <>
        <AccountInfo
          instance={instance}
          account={cachedAccount || id}
          fetchAccount={() => masto.v1.accounts.$select(id).fetch()}
          authenticated={authenticated}
          standalone
        />
        <div class="filter-bar" ref={filterBarRef}>
          {filtered ? (
            <Link
              to={`/${instance}/a/${id}`}
              class="insignificant filter-clear"
              title="Clear filters"
            >
              <Icon icon="x" size="l" />
            </Link>
          ) : (
            <Icon icon="filter" class="insignificant" size="l" />
          )}
          <Link
            to={`/${instance}/a/${id}${excludeReplies ? '?replies=1' : ''}`}
            onClick={() => {
              if (excludeReplies) {
                showToast('Showing post with replies');
              }
            }}
            class={excludeReplies ? '' : 'is-active'}
          >
            + Replies
          </Link>
          <Link
            to={`/${instance}/a/${id}${excludeBoosts ? '' : '?boosts=0'}`}
            onClick={() => {
              if (!excludeBoosts) {
                showToast('Showing posts without boosts');
              }
            }}
            class={!excludeBoosts ? '' : 'is-active'}
          >
            - Boosts
          </Link>
          <Link
            to={`/${instance}/a/${id}${media ? '' : '?media=1'}`}
            onClick={() => {
              if (!media) {
                showToast('Showing posts with media');
              }
            }}
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
              onClick={() => {
                if (tagged !== tag.name) {
                  showToast(`Showing posts tagged with #${tag.name}`);
                }
              }}
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
    excludeBoosts,
    featuredTags,
    tagged,
    media,
  ]);

  useEffect(() => {
    // Focus on .is-active
    const active = filterBarRef.current?.querySelector('.is-active');
    if (active) {
      console.log('active', active, active.offsetLeft);
      filterBarRef.current.scrollTo({
        behavior: 'smooth',
        left:
          active.offsetLeft -
          (filterBarRef.current.offsetWidth - active.offsetWidth) / 2,
      });
    }
  }, [featuredTags, tagged, media, excludeReplies, excludeBoosts]);

  const accountInstance = useMemo(() => {
    if (!account?.url) return null;
    const domain = new URL(account.url).hostname;
    return domain;
  }, [account]);
  const sameInstance = instance === accountInstance;
  const allowSwitch = !!account && !sameInstance;

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
          <b>
            <EmojiText text={displayName} emojis={emojis} />
          </b>
          <div>
            <span>@{acct}</span>
          </div>
        </h1>
      }
      id="account-statuses"
      instance={instance}
      emptyText="Nothing to see here yet."
      errorText="Unable to load posts"
      fetchItems={fetchAccountStatuses}
      useItemID
      boostsCarousel={snapStates.settings.boostsCarousel}
      timelineStart={TimelineStart}
      refresh={excludeReplies + excludeBoosts + tagged + media}
      headerEnd={
        <Menu2
          portal
          // setDownOverflow
          overflow="auto"
          viewScroll="close"
          position="anchor"
          menuButton={
            <button type="button" class="plain">
              <Icon icon="more" size="l" />
            </button>
          }
        >
          <MenuItem
            disabled={!allowSwitch}
            onClick={() => {
              (async () => {
                try {
                  const { masto } = api({
                    instance: accountInstance,
                  });
                  const acc = await masto.v1.accounts.lookup({
                    acct: account.acct,
                  });
                  const { id } = acc;
                  location.hash = `/${accountInstance}/a/${id}`;
                } catch (e) {
                  console.error(e);
                  alert('Unable to fetch account info');
                }
              })();
            }}
          >
            <Icon icon="transfer" />{' '}
            <small class="menu-double-lines">
              Switch to account's instance (<b>{accountInstance}</b>)
            </small>
          </MenuItem>
        </Menu2>
      }
    />
  );
}

export default AccountStatuses;
