import { useEffect, useRef, useState } from 'preact/hooks';
import { useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import Timeline from '../components/timeline';
import states from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function AccountStatuses() {
  const snapStates = useSnapshot(states);
  const { id } = useParams();
  const accountStatusesIterator = useRef();
  async function fetchAccountStatuses(firstLoad) {
    if (firstLoad || !accountStatusesIterator.current) {
      accountStatusesIterator.current = masto.v1.accounts.listStatuses(id, {
        limit: LIMIT,
      });
    }
    return await accountStatusesIterator.current.next();
  }

  const [account, setAccount] = useState({});
  useTitle(`${account?.acct ? '@' + account.acct : 'Posts'}`, '/a/:id');
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

  return (
    <Timeline
      key={id}
      title={`${account?.acct ? '@' + account.acct : 'Posts'}`}
      titleComponent={
        <h1
          class="header-account"
          onClick={() => {
            states.showAccount = account;
          }}
        >
          {account?.displayName}
          <div>
            <span>@{account?.acct}</span>
          </div>
        </h1>
      }
      id="account_statuses"
      emptyText="Nothing to see here yet."
      errorText="Unable to load statuses"
      fetchItems={fetchAccountStatuses}
      boostsCarousel={snapStates.settings.boostsCarousel}
    />
  );
}

export default AccountStatuses;
