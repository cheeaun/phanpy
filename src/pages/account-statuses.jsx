import { useEffect, useRef, useState } from 'preact/hooks';
import { useParams } from 'react-router-dom';

import Timeline from '../components/timeline';

const LIMIT = 20;

function AccountStatuses() {
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
      id="account_statuses"
      emptyText="Nothing to see here yet."
      errorText="Unable to load statuses"
      fetchItems={fetchAccountStatuses}
    />
  );
}

export default AccountStatuses;
