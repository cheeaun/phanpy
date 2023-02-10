import './search.css';

import { useEffect, useRef, useState } from 'preact/hooks';
import { useSearchParams } from 'react-router-dom';

import Avatar from '../components/avatar';
import Link from '../components/link';
import Menu from '../components/menu';
import NameText from '../components/name-text';
import Status from '../components/status';
import { api } from '../utils/api';

function Search() {
  const { masto, instance, authenticated } = api();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchFieldRef = useRef();
  const q = searchParams.get('q');
  const [statusResults, setStatusResults] = useState([]);
  const [accountResults, setAccountResults] = useState([]);
  useEffect(() => {
    if (q) {
      searchFieldRef.current.value = q;

      (async () => {
        const results = await masto.v2.search({
          q,
          limit: 20,
          resolve: authenticated,
        });
        console.log(results);
        setStatusResults(results.statuses);
        setAccountResults(results.accounts);
      })();
    }
  }, [q]);

  console.log({ accountResults });

  return (
    <div id="search-page" class="deck-container">
      <div class="timeline-deck deck">
        <header>
          <div class="header-grid">
            <div class="header-side">
              <Menu />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const { q } = e.target;
                if (q.value) {
                  setSearchParams({ q: q.value });
                }
              }}
            >
              <input
                ref={searchFieldRef}
                name="q"
                type="search"
                autofocus
                placeholder="Search or paste URL"
              />
            </form>
            <div class="header-side" />
          </div>
        </header>
        <main>
          <h2 class="timeline-header">Accounts</h2>
          {accountResults.length > 0 && (
            <ul class="timeline flat accounts-list">
              {accountResults.map((account) => (
                <li>
                  <Avatar url={account.avatar} size="xl" />
                  <NameText account={account} instance={instance} showAcct />
                </li>
              ))}
            </ul>
          )}
          <h2 class="timeline-header">Posts</h2>
          {statusResults.length > 0 && (
            <ul class="timeline">
              {statusResults.map((status) => (
                <li>
                  <Link
                    class="status-link"
                    to={
                      instance
                        ? `/${instance}/s/${status.id}`
                        : `/s/${status.id}`
                    }
                  >
                    <Status status={status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}

export default Search;
