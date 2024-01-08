import { useLayoutEffect, useState } from 'preact/hooks';
import { useLocation } from 'react-router-dom';

import Link from '../components/link';
import Loader from '../components/loader';
import { api } from '../utils/api';
import getInstanceStatusURL, {
  getInstanceStatusObject,
} from '../utils/get-instance-status-url';

export default function HttpRoute() {
  const location = useLocation();
  const url = location.pathname.replace(/^\//, '');
  const statusObject = getInstanceStatusObject(url);
  // const statusURL = getInstanceStatusURL(url);
  const statusURL = statusObject?.instance
    ? `/${statusObject.instance}/s/${statusObject.id}`
    : null;
  const [uiState, setUIState] = useState('loading');

  useLayoutEffect(() => {
    setUIState('loading');
    (async () => {
      // Check if status returns 200
      try {
        const { instance, id } = statusObject;
        const { masto } = api({ instance });
        const status = await masto.v1.statuses.$select(id).fetch();
        if (status) {
          window.location.hash = statusURL + '?view=full';
          return;
        }
      } catch (e) {}

      // Fallback to search
      {
        const { masto: currentMasto, instance: currentInstance } = api();
        const result = await currentMasto.v2.search.fetch({
          q: url,
          limit: 1,
          resolve: true,
        });
        if (result.statuses.length) {
          const status = result.statuses[0];
          window.location.hash = `/${currentInstance}/s/${status.id}?view=full`;
        } else if (result.accounts.length) {
          const account = result.accounts[0];
          window.location.hash = `/${currentInstance}/a/${account.id}`;
        } else if (statusURL) {
          // Fallback to original URL, which will probably show error
          window.location.hash = statusURL + '?view=full';
        } else {
          setUIState('error');
        }
      }
    })();
  }, [statusURL]);

  return (
    <div class="ui-state" tabIndex="-1">
      {uiState === 'loading' ? (
        <>
          <Loader abrupt />
          <h2>Resolving…</h2>
          <p>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {url}
            </a>
          </p>
        </>
      ) : (
        <>
          <h2>Unable to resolve URL</h2>
          <p>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {url}
            </a>
          </p>
        </>
      )}
      <hr />
      <p>
        <Link to="/">Go home</Link>
      </p>
    </div>
  );
}
