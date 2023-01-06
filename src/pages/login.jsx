import './login.css';

import { useEffect, useRef, useState } from 'preact/hooks';

import Loader from '../components/loader';
import instancesListURL from '../data/instances.json?url';
import { getAuthorizationURL, registerApplication } from '../utils/auth';
import store from '../utils/store';
import useTitle from '../utils/useTitle';

function Login() {
  useTitle('Log in');
  const instanceURLRef = useRef();
  const cachedInstanceURL = store.local.get('instanceURL');
  const [uiState, setUIState] = useState('default');

  const [instancesList, setInstancesList] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(instancesListURL);
        const data = await res.json();
        setInstancesList(data);
      } catch (e) {
        // Silently fail
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    if (cachedInstanceURL) {
      instanceURLRef.current.value = cachedInstanceURL.toLowerCase();
    }
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const { elements } = e.target;
    let instanceURL = elements.instanceURL.value.toLowerCase();
    // Remove protocol from instance URL
    instanceURL = instanceURL.replace(/(^\w+:|^)\/\//, '');
    store.local.set('instanceURL', instanceURL);

    (async () => {
      setUIState('loading');
      try {
        const { client_id, client_secret } = await registerApplication({
          instanceURL,
        });

        if (client_id && client_secret) {
          store.session.set('clientID', client_id);
          store.session.set('clientSecret', client_secret);

          location.href = await getAuthorizationURL({
            instanceURL,
            client_id,
          });
        } else {
          alert('Failed to register application');
        }
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  };

  return (
    <main id="login" style={{ textAlign: 'center' }}>
      <form onSubmit={onSubmit}>
        <h1>Log in</h1>
        <label>
          <p>Instance</p>
          <input
            required
            type="text"
            class="large"
            id="instanceURL"
            ref={instanceURLRef}
            disabled={uiState === 'loading'}
            list="instances-list"
            autocorrect="off"
            autocapitalize="off"
            autocomplete="off"
            spellcheck="false"
          />
          <datalist id="instances-list">
            {instancesList.map((instance) => (
              <option value={instance} />
            ))}
          </datalist>
        </label>
        {uiState === 'error' && (
          <p class="error">
            Failed to log in. Please try again or another instance.
          </p>
        )}
        <p>
          <button class="large" disabled={uiState === 'loading'}>
            Log in
          </button>{' '}
        </p>
        <Loader hidden={uiState !== 'loading'} />
        <hr />
        <p>
          <a href="https://joinmastodon.org/servers" target="_blank">
            Don't have an account? Create one!
          </a>
        </p>
        <p>
          <a href="/#">Go home</a>
        </p>
      </form>
    </main>
  );
}

export default Login;
