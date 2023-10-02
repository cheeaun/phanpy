import './login.css';

import { useEffect, useRef, useState } from 'preact/hooks';
import { useSearchParams } from 'react-router-dom';

import Link from '../components/link';
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
  const [searchParams] = useSearchParams();
  const instance = searchParams.get('instance');
  const [instanceText, setInstanceText] = useState(
    instance || cachedInstanceURL?.toLowerCase() || '',
  );

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

  // useEffect(() => {
  //   if (cachedInstanceURL) {
  //     instanceURLRef.current.value = cachedInstanceURL.toLowerCase();
  //   }
  // }, []);

  const submitInstance = (instanceURL) => {
    store.local.set('instanceURL', instanceURL);

    (async () => {
      setUIState('loading');
      try {
        const { client_id, client_secret, vapid_key } =
          await registerApplication({
            instanceURL,
          });

        if (client_id && client_secret) {
          store.session.set('clientID', client_id);
          store.session.set('clientSecret', client_secret);
          store.session.set('vapidKey', vapid_key);

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

  const onSubmit = (e) => {
    e.preventDefault();
    const { elements } = e.target;
    let instanceURL = elements.instanceURL.value.toLowerCase();
    // Remove protocol from instance URL
    instanceURL = instanceURL.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    // Remove @acct@ or acct@ from instance URL
    instanceURL = instanceURL.replace(/^@?[^@]+@/, '');
    if (!/\./.test(instanceURL)) {
      instanceURL = instancesList.find((instance) =>
        instance.includes(instanceURL),
      );
    }
    submitInstance(instanceURL);
  };

  const instancesSuggestions = instanceText
    ? instancesList
        .filter((instance) => instance.includes(instanceText))
        .sort((a, b) => {
          // Move text that starts with instanceText to the start
          const aStartsWith = a
            .toLowerCase()
            .startsWith(instanceText.toLowerCase());
          const bStartsWith = b
            .toLowerCase()
            .startsWith(instanceText.toLowerCase());
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          return 0;
        })
        .slice(0, 10)
    : [];

  return (
    <main id="login" style={{ textAlign: 'center' }}>
      <form onSubmit={onSubmit}>
        <h1>Log in</h1>
        <label>
          <p>Instance</p>
          <input
            value={instanceText}
            required
            type="text"
            class="large"
            id="instanceURL"
            ref={instanceURLRef}
            disabled={uiState === 'loading'}
            // list="instances-list"
            autocorrect="off"
            autocapitalize="off"
            autocomplete="off"
            spellcheck={false}
            placeholder="instance domain"
            onInput={(e) => {
              setInstanceText(e.target.value);
            }}
          />
          {instancesSuggestions?.length > 0 ? (
            <ul id="instances-suggestions">
              {instancesSuggestions.map((instance) => (
                <li>
                  <button
                    type="button"
                    class="plain4"
                    onClick={() => {
                      submitInstance(instance);
                    }}
                  >
                    {instance}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div id="instances-eg">e.g. &ldquo;mastodon.social&rsquo;</div>
          )}
          {/* <datalist id="instances-list">
            {instancesList.map((instance) => (
              <option value={instance} />
            ))}
          </datalist> */}
        </label>
        {uiState === 'error' && (
          <p class="error">
            Failed to log in. Please try again or another instance.
          </p>
        )}
        <div>
          <button class="large" disabled={uiState === 'loading'}>
            Log in
          </button>{' '}
        </div>
        <Loader hidden={uiState !== 'loading'} />
        <hr />
        <p>
          <a href="https://joinmastodon.org/servers" target="_blank">
            Don't have an account? Create one!
          </a>
        </p>
        <p>
          <Link to="/">Go home</Link>
        </p>
      </form>
    </main>
  );
}

export default Login;
