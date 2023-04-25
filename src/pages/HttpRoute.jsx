import { useLocation } from 'react-router-dom';

import Link from '../components/link';
import getInstanceStatusURL from '../utils/get-instance-status-url';

export default function HttpRoute() {
  const location = useLocation();
  const url = location.pathname.replace(/^\//, '');
  const statusURL = getInstanceStatusURL(url);
  if (statusURL) {
    window.location.hash = statusURL + '?view=full';
    return null;
  }
  return (
    <div class="ui-state" tabIndex="-1">
      <h2>Unable to process URL</h2>
      <p>
        <a href={url} target="_blank">
          {url}
        </a>
      </p>
      <hr />
      <p>
        <Link to="/">Go home</Link>
      </p>
    </div>
  );
}
