import { useLayoutEffect } from 'preact/hooks';
import { useLocation } from 'react-router-dom';

import Link from '../components/link';
import getInstanceStatusURL from '../utils/get-instance-status-url';

export default function HttpRoute() {
  const location = useLocation();
  const url = location.pathname.replace(/^\//, '');
  const statusURL = getInstanceStatusURL(url);

  useLayoutEffect(() => {
    if (statusURL) {
      setTimeout(() => {
        window.location.hash = statusURL + '?view=full';
      }, 300);
    }
  }, [statusURL]);

  return (
    <div class="ui-state" tabIndex="-1">
      {statusURL ? (
        <>
          <h2>Redirecting…</h2>
          <p>
            <a href={`#${statusURL}?view=full`}>{statusURL}</a>
          </p>
        </>
      ) : (
        <>
          <h2>Unable to process URL</h2>
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
