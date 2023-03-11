import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import AccountInfo from '../components/account-info';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import emojifyText from '../utils/emojify-text';
import states from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function AccountStatuses() {
  const snapStates = useSnapshot(states);
  const { id, ...params } = useParams();
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
      if (pinnedStatuses?.length) {
        pinnedStatuses.forEach((status) => {
          status._pinned = true;
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
      });
    }
    const { value, done } = await accountStatusesIterator.current.next();
    if (value?.length) {
      results.push(...value);
    }
    return {
      value: results,
      done,
    };
  }

  const [account, setAccount] = useState();
  useTitle(
    `${account?.acct ? '@' + account.acct : 'Posts'}`,
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
    })();
  }, [id]);

  const { displayName, acct, emojis } = account || {};

  const TimelineStart = useMemo(() => {
    const cachedAccount = snapStates.accounts[`${id}@${instance}`];
    return (
      <AccountInfo
        instance={instance}
        account={cachedAccount || id}
        fetchAccount={() => masto.v1.accounts.fetch(id)}
        authenticated={authenticated}
        standalone
      />
    );
  }, [id, instance, authenticated]);

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
      boostsCarousel={snapStates.settings.boostsCarousel}
      timelineStart={TimelineStart}
    />
  );
}

export default AccountStatuses;
