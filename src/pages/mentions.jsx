import './mentions.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useRef, useState } from 'preact/hooks';
import { useSearchParams } from 'react-router-dom';

import Link from '../components/link';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { fixNotifications } from '../utils/group-notifications';
import { fetchRelationships } from '../utils/relationships';
import { saveStatus } from '../utils/states';
import { getCurrentAccountID } from '../utils/store-utils';
import useTitle from '../utils/useTitle';

const LIMIT = 20;
const emptySearchParams = new URLSearchParams();

function Mentions({ columnMode, ...props }) {
  const { t } = useLingui();
  const { masto, instance } = api();
  const [searchParams] = columnMode ? [emptySearchParams] : useSearchParams();
  const [stateType, setStateType] = useState(null);
  const type = props?.type || searchParams.get('type') || stateType;
  useTitle(type === 'private' ? t`Private mentions` : t`Mentions`, '/mentions');

  const [onlyFollowings, setOnlyFollowings] = useState(false);
  const relationshipsMap = useRef({});

  const mentionsIterator = useRef();
  const latestItem = useRef();

  function filterByFollowings(items) {
    if (!onlyFollowings || !items?.length) return items;

    const currentAccountID = getCurrentAccountID();
    return items.filter((item) => {
      const accountID = item.account?.id;
      if (!accountID) return false;

      // Exclude self-posts
      if (accountID === currentAccountID) {
        return false;
      }

      const relationship = relationshipsMap.current[accountID];
      return relationship?.following === true;
    });
  }

  async function fetchMentions(firstLoad) {
    if (firstLoad || !mentionsIterator.current) {
      mentionsIterator.current = masto.v1.notifications
        .list({
          limit: LIMIT,
          types: ['mention'],
        })
        .values();
    }
    const results = await mentionsIterator.current.next();
    let { value } = results;
    if (value?.length) {
      value = fixNotifications(value);

      if (firstLoad) {
        latestItem.current = value[0].id;
        console.log('First load', latestItem.current);
      }

      value.forEach(({ status: item }) => {
        saveStatus(item, instance);
      });

      let statuses = value.map((item) => item.status);
      if (onlyFollowings && statuses?.length) {
        const accounts = statuses.map((status) => status.account);
        const relationships = await fetchRelationships(
          accounts,
          relationshipsMap.current,
        );
        if (relationships) {
          relationshipsMap.current = {
            ...relationshipsMap.current,
            ...relationships,
          };
        }
        statuses = filterByFollowings(statuses);
      }

      return {
        ...results,
        value: statuses,
      };
    }
    return {
      ...results,
      value: value?.map((item) => item.status),
    };
  }

  const conversationsIterator = useRef();
  const latestConversationItem = useRef();
  async function fetchConversations(firstLoad) {
    if (firstLoad || !conversationsIterator.current) {
      conversationsIterator.current = masto.v1.conversations
        .list({
          limit: LIMIT,
        })
        .values();
    }
    const results = await conversationsIterator.current.next();
    let { value } = results;
    value = value?.filter((item) => item.lastStatus);
    if (value?.length) {
      if (firstLoad) {
        latestConversationItem.current = value[0].lastStatus.id;
        console.log('First load', latestConversationItem.current);
      }

      value.forEach(({ lastStatus: item }) => {
        saveStatus(item, instance);
      });

      let statuses = value.map((item) => item.lastStatus);
      if (onlyFollowings && statuses?.length) {
        const accounts = statuses.map((status) => status.account);
        const relationships = await fetchRelationships(
          accounts,
          relationshipsMap.current,
        );
        if (relationships) {
          relationshipsMap.current = {
            ...relationshipsMap.current,
            ...relationships,
          };
        }
        statuses = filterByFollowings(statuses);
      }

      console.log('results', results);
      return {
        ...results,
        value: statuses,
      };
    }
    console.log('results', results);
    return {
      ...results,
      value: value?.map((item) => item.lastStatus),
    };
  }

  function fetchItems(...args) {
    if (type === 'private') {
      return fetchConversations(...args);
    }
    return fetchMentions(...args);
  }

  async function checkForUpdates() {
    if (type === 'private') {
      try {
        const results = await masto.v1.conversations
          .list({
            limit: 1,
            since_id: latestConversationItem.current,
          })
          .values()
          .next();
        let { value } = results;
        console.log(
          'checkForUpdates PRIVATE',
          latestConversationItem.current,
          value,
        );
        const valueContainsLatestItem =
          value[0]?.id === latestConversationItem.current; // since_id might not be supported
        if (value?.length && !valueContainsLatestItem) {
          latestConversationItem.current = value[0].lastStatus.id;
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    } else {
      try {
        const results = await masto.v1.notifications
          .list({
            limit: 1,
            types: ['mention'],
            since_id: latestItem.current,
          })
          .values()
          .next();
        let { value } = results;
        console.log('checkForUpdates ALL', latestItem.current, value);
        if (value?.length) {
          latestItem.current = value[0].id;
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    }
  }

  const TimelineStart = useMemo(() => {
    return (
      <>
        <div id="followings-option">
          <label>
            <input
              type="checkbox"
              checked={onlyFollowings}
              onChange={(e) => {
                setOnlyFollowings(e.target.checked);
              }}
            />{' '}
            <Trans>Only followings</Trans>
          </label>
        </div>
        <div class="filter-bar">
          <Link
            to="/mentions"
            class={!type ? 'is-active' : ''}
            onClick={(e) => {
              if (columnMode) {
                e.preventDefault();
                setStateType(null);
              }
            }}
          >
            <Trans>All</Trans>
          </Link>
          <Link
            to="/mentions?type=private"
            class={type === 'private' ? 'is-active' : ''}
            onClick={(e) => {
              if (columnMode) {
                e.preventDefault();
                setStateType('private');
              }
            }}
          >
            <Trans>Private</Trans>
          </Link>
        </div>
      </>
    );
  }, [type, onlyFollowings]);

  return (
    <Timeline
      title={t`Mentions`}
      id="mentions"
      emptyText={t`No one mentioned you :(`}
      errorText={t`Unable to load mentions.`}
      instance={instance}
      fetchItems={fetchItems}
      checkForUpdates={checkForUpdates}
      useItemID
      timelineStart={TimelineStart}
      refresh={`${type}-${onlyFollowings}`}
      filterContext="notifications"
    />
  );
}

export default Mentions;
