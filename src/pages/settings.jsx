import './settings.css';

import { useEffect, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import logo from '../assets/logo.svg';

import Icon from '../components/icon';
import Link from '../components/link';
import RelativeTime from '../components/relative-time';
import targetLanguages from '../data/lingva-target-languages';
import { api } from '../utils/api';
import getTranslateTargetLanguage from '../utils/get-translate-target-language';
import localeCode2Text from '../utils/localeCode2Text';
import {
  initSubscription,
  isPushSupported,
  removeSubscription,
  updateSubscription,
} from '../utils/push-notifications';
import showToast from '../utils/show-toast';
import states from '../utils/states';
import store from '../utils/store';

const DEFAULT_TEXT_SIZE = 16;
const TEXT_SIZES = [14, 15, 16, 17, 18, 19, 20];
const {
  PHANPY_WEBSITE: WEBSITE,
  PHANPY_PRIVACY_POLICY_URL: PRIVACY_POLICY_URL,
  PHANPY_IMG_ALT_API_URL: IMG_ALT_API_URL,
  PHANPY_GIPHY_API_KEY: GIPHY_API_KEY,
} = import.meta.env;

function Settings({ onClose }) {
  const snapStates = useSnapshot(states);
  const currentTheme = store.local.get('theme') || 'auto';
  const themeFormRef = useRef();
  const targetLanguage =
    snapStates.settings.contentTranslationTargetLanguage || null;
  const systemTargetLanguage = getTranslateTargetLanguage();
  const systemTargetLanguageText = localeCode2Text(systemTargetLanguage);
  const currentTextSize = store.local.get('textSize') || DEFAULT_TEXT_SIZE;

  const [prefs, setPrefs] = useState(store.account.get('preferences') || {});
  const { masto, authenticated, instance } = api();
  // Get preferences every time Settings is opened
  // NOTE: Disabled for now because I don't expect this to change often. Also for some reason, the /api/v1/preferences endpoint is cached for a while and return old prefs if refresh immediately after changing them.
  // useEffect(() => {
  //   const { masto } = api();
  //   (async () => {
  //     try {
  //       const preferences = await masto.v1.preferences.fetch();
  //       setPrefs(preferences);
  //       store.account.set('preferences', preferences);
  //     } catch (e) {
  //       // Silently fail
  //       console.error(e);
  //     }
  //   })();
  // }, []);

  return (
    <div id="settings-container" class="sheet" tabIndex="-1">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" />
        </button>
      )}
      <header>
        <h2>Settings</h2>
      </header>
      <main>
        <section>
          <ul>
            <li>
              <div>
                <label>Appearance</label>
              </div>
              <div>
                <form
                  ref={themeFormRef}
                  onInput={(e) => {
                    console.log(e);
                    e.preventDefault();
                    const formData = new FormData(themeFormRef.current);
                    const theme = formData.get('theme');
                    const html = document.documentElement;

                    if (theme === 'auto') {
                      html.classList.remove('is-light', 'is-dark');

                      // Disable manual theme <meta>
                      const $manualMeta = document.querySelector(
                        'meta[data-theme-setting="manual"]',
                      );
                      if ($manualMeta) {
                        $manualMeta.name = '';
                      }
                      // Enable auto theme <meta>s
                      const $autoMetas = document.querySelectorAll(
                        'meta[data-theme-setting="auto"]',
                      );
                      $autoMetas.forEach((m) => {
                        m.name = 'theme-color';
                      });
                    } else {
                      html.classList.toggle('is-light', theme === 'light');
                      html.classList.toggle('is-dark', theme === 'dark');

                      // Enable manual theme <meta>
                      const $manualMeta = document.querySelector(
                        'meta[data-theme-setting="manual"]',
                      );
                      if ($manualMeta) {
                        $manualMeta.name = 'theme-color';
                        $manualMeta.content =
                          theme === 'light'
                            ? $manualMeta.dataset.themeLightColor
                            : $manualMeta.dataset.themeDarkColor;
                      }
                      // Disable auto theme <meta>s
                      const $autoMetas = document.querySelectorAll(
                        'meta[data-theme-setting="auto"]',
                      );
                      $autoMetas.forEach((m) => {
                        m.name = '';
                      });
                    }
                    document
                      .querySelector('meta[name="color-scheme"]')
                      .setAttribute(
                        'content',
                        theme === 'auto' ? 'dark light' : theme,
                      );

                    if (theme === 'auto') {
                      store.local.del('theme');
                    } else {
                      store.local.set('theme', theme);
                    }
                  }}
                >
                  <div class="radio-group">
                    <label>
                      <input
                        type="radio"
                        name="theme"
                        value="light"
                        defaultChecked={currentTheme === 'light'}
                      />
                      <span>Light</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="theme"
                        value="dark"
                        defaultChecked={currentTheme === 'dark'}
                      />
                      <span>Dark</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="theme"
                        value="auto"
                        defaultChecked={
                          currentTheme !== 'light' && currentTheme !== 'dark'
                        }
                      />
                      <span>Auto</span>
                    </label>
                  </div>
                </form>
              </div>
            </li>
            <li>
              <div>
                <label>Text size</label>
              </div>
              <div class="range-group">
                <span style={{ fontSize: TEXT_SIZES[0] }}>A</span>{' '}
                <input
                  type="range"
                  min={TEXT_SIZES[0]}
                  max={TEXT_SIZES[TEXT_SIZES.length - 1]}
                  step="1"
                  value={currentTextSize}
                  list="sizes"
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    const html = document.documentElement;
                    // set CSS variable
                    html.style.setProperty('--text-size', `${value}px`);
                    // save to local storage
                    if (value === DEFAULT_TEXT_SIZE) {
                      store.local.del('textSize');
                    } else {
                      store.local.set('textSize', e.target.value);
                    }
                  }}
                />{' '}
                <span style={{ fontSize: TEXT_SIZES[TEXT_SIZES.length - 1] }}>
                  A
                </span>
                <datalist id="sizes">
                  {TEXT_SIZES.map((size) => (
                    <option value={size} />
                  ))}
                </datalist>
              </div>
            </li>
          </ul>
        </section>
        {authenticated && (
          <>
            <h3>Posting</h3>
            <section>
              <ul>
                <li>
                  <div>
                    <label for="posting-privacy-field">
                      Default visibility{' '}
                      <Icon icon="cloud" alt="Synced" class="synced-icon" />
                    </label>
                  </div>
                  <div>
                    <select
                      id="posting-privacy-field"
                      value={prefs['posting:default:visibility'] || 'public'}
                      onChange={(e) => {
                        const { value } = e.target;
                        (async () => {
                          try {
                            await masto.v1.accounts.updateCredentials({
                              source: {
                                privacy: value,
                              },
                            });
                            setPrefs({
                              ...prefs,
                              'posting:default:visibility': value,
                            });
                            store.account.set('preferences', {
                              ...prefs,
                              'posting:default:visibility': value,
                            });
                          } catch (e) {
                            alert('Failed to update posting privacy');
                            console.error(e);
                          }
                        })();
                      }}
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Followers only</option>
                    </select>
                  </div>
                </li>
              </ul>
            </section>
            <p class="section-postnote">
              <Icon icon="cloud" alt="Synced" class="synced-icon" />{' '}
              <small>
                Synced to your instance server's settings.{' '}
                <a
                  href={`https://${instance}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Go to your instance ({instance}) for more settings.
                </a>
              </small>
            </p>
          </>
        )}
        <h3>Experiments</h3>
        <section>
          <ul>
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={snapStates.settings.autoRefresh}
                  onChange={(e) => {
                    states.settings.autoRefresh = e.target.checked;
                  }}
                />{' '}
                Auto refresh timeline posts
              </label>
            </li>
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={snapStates.settings.boostsCarousel}
                  onChange={(e) => {
                    states.settings.boostsCarousel = e.target.checked;
                  }}
                />{' '}
                Boosts carousel
              </label>
            </li>
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={snapStates.settings.contentTranslation}
                  onChange={(e) => {
                    const { checked } = e.target;
                    states.settings.contentTranslation = checked;
                    if (!checked) {
                      states.settings.contentTranslationTargetLanguage = null;
                    }
                  }}
                />{' '}
                Post translation
              </label>
              <div
                class={`sub-section ${
                  !snapStates.settings.contentTranslation
                    ? 'more-insignificant'
                    : ''
                }`}
              >
                <div>
                  <label>
                    Translate to{' '}
                    <select
                      value={targetLanguage || ''}
                      disabled={!snapStates.settings.contentTranslation}
                      onChange={(e) => {
                        states.settings.contentTranslationTargetLanguage =
                          e.target.value || null;
                      }}
                    >
                      <option value="">
                        System language ({systemTargetLanguageText})
                      </option>
                      <option disabled>──────────</option>
                      {targetLanguages.map((lang) => (
                        <option value={lang.code}>{lang.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <hr />
                <p class="checkbox-fieldset">
                  Hide "Translate" button for
                  {snapStates.settings.contentTranslationHideLanguages.length >
                    0 && (
                    <>
                      {' '}
                      (
                      {
                        snapStates.settings.contentTranslationHideLanguages
                          .length
                      }
                      )
                    </>
                  )}
                  :
                  <div class="checkbox-fields">
                    {targetLanguages.map((lang) => (
                      <label>
                        <input
                          type="checkbox"
                          checked={snapStates.settings.contentTranslationHideLanguages.includes(
                            lang.code,
                          )}
                          onChange={(e) => {
                            const { checked } = e.target;
                            if (checked) {
                              states.settings.contentTranslationHideLanguages.push(
                                lang.code,
                              );
                            } else {
                              states.settings.contentTranslationHideLanguages =
                                snapStates.settings.contentTranslationHideLanguages.filter(
                                  (code) => code !== lang.code,
                                );
                            }
                          }}
                        />{' '}
                        {lang.name}
                      </label>
                    ))}
                  </div>
                </p>
                <p class="insignificant">
                  <small>
                    Note: This feature uses external translation services,
                    powered by{' '}
                    <a
                      href="https://github.com/cheeaun/lingva-api"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Lingva API
                    </a>{' '}
                    &amp;{' '}
                    <a
                      href="https://github.com/thedaviddelta/lingva-translate"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Lingva Translate
                    </a>
                    .
                  </small>
                </p>
                <hr />
                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={snapStates.settings.contentTranslationAutoInline}
                      disabled={!snapStates.settings.contentTranslation}
                      onChange={(e) => {
                        states.settings.contentTranslationAutoInline =
                          e.target.checked;
                      }}
                    />{' '}
                    Auto inline translation
                  </label>
                  <p class="insignificant">
                    <small>
                      Automatically show translation for posts in timeline. Only
                      works for <b>short</b> posts without content warning,
                      media and poll.
                    </small>
                  </p>
                </div>
              </div>
            </li>
            {!!GIPHY_API_KEY && authenticated && (
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={snapStates.settings.composerGIFPicker}
                    onChange={(e) => {
                      states.settings.composerGIFPicker = e.target.checked;
                    }}
                  />{' '}
                  GIF Picker for composer
                </label>
                <div class="sub-section insignificant">
                  <small>
                    Note: This feature uses external GIF search service, powered
                    by{' '}
                    <a
                      href="https://developers.giphy.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      GIPHY
                    </a>
                    . G-rated (suitable for viewing by all ages), tracking
                    parameters are stripped, referrer information is omitted
                    from requests, but search queries and IP address information
                    will still reach their servers.
                  </small>
                </div>
              </li>
            )}
            {!!IMG_ALT_API_URL && authenticated && (
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={snapStates.settings.mediaAltGenerator}
                    onChange={(e) => {
                      states.settings.mediaAltGenerator = e.target.checked;
                    }}
                  />{' '}
                  Image description generator{' '}
                  <Icon icon="sparkles2" class="more-insignificant" />
                </label>
                <div class="sub-section insignificant">
                  <small>Only for new images while composing new posts.</small>
                </div>
                <div class="sub-section insignificant">
                  <small>
                    Note: This feature uses external AI service, powered by{' '}
                    <a
                      href="https://github.com/cheeaun/img-alt-api"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      img-alt-api
                    </a>
                    . May not work well. Only for images and in English.
                  </small>
                </div>
              </li>
            )}
            {authenticated && (
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={
                      snapStates.settings.shortcutSettingsCloudImportExport
                    }
                    onChange={(e) => {
                      states.settings.shortcutSettingsCloudImportExport =
                        e.target.checked;
                    }}
                  />{' '}
                  "Cloud" import/export for shortcuts settings{' '}
                  <Icon icon="cloud" class="more-insignificant" />
                </label>
                <div class="sub-section insignificant">
                  <small>
                    ⚠️⚠️⚠️ Very experimental.
                    <br />
                    Stored in your own profile’s notes. Profile (private) notes
                    are mainly used for other profiles, and hidden for own
                    profile.
                  </small>
                </div>
                <div class="sub-section insignificant">
                  <small>
                    Note: This feature uses currently-logged-in instance server
                    API.
                  </small>
                </div>
              </li>
            )}
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={snapStates.settings.cloakMode}
                  onChange={(e) => {
                    states.settings.cloakMode = e.target.checked;
                  }}
                />{' '}
                Cloak mode{' '}
                <span class="insignificant">
                  (<samp>Text</samp> → <samp>████</samp>)
                </span>
              </label>
              <div class="sub-section insignificant">
                <small>
                  Replace text as blocks, useful when taking screenshots, for
                  privacy reasons.
                </small>
              </div>
            </li>
            {authenticated && (
              <li>
                <button
                  type="button"
                  class="light"
                  onClick={() => {
                    states.showDrafts = true;
                    states.showSettings = false;
                  }}
                >
                  Unsent drafts
                </button>
              </li>
            )}
          </ul>
        </section>
        {authenticated && <PushNotificationsSection onClose={onClose} />}
        <h3>About</h3>
        <section>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              lineHeight: 1.25,
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <img
              src={logo}
              alt=""
              width="64"
              height="64"
              style={{
                aspectRatio: '1/1',
                verticalAlign: 'middle',
                background: '#b7cdf9',
                borderRadius: 12,
              }}
            />
            <div>
              <b>Phanpy</b>{' '}
              <a
                href="https://hachyderm.io/@phanpy"
                // target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  states.showAccount = 'phanpy@hachyderm.io';
                }}
              >
                @phanpy
              </a>
              <br />
              <a
                href="https://github.com/cheeaun/phanpy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Built
              </a>{' '}
              by{' '}
              <a
                href="https://mastodon.social/@cheeaun"
                // target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  states.showAccount = 'cheeaun@mastodon.social';
                }}
              >
                @cheeaun
              </a>
            </div>
          </div>
          <p>
            <a
              href="https://github.com/sponsors/cheeaun"
              target="_blank"
              rel="noopener noreferrer"
            >
              Sponsor
            </a>{' '}
            &middot;{' '}
            <a
              href="https://www.buymeacoffee.com/cheeaun"
              target="_blank"
              rel="noopener noreferrer"
            >
              Donate
            </a>{' '}
            &middot;{' '}
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
          </p>
          {__BUILD_TIME__ && (
            <p>
              {WEBSITE && (
                <>
                  <span class="insignificant">Site:</span>{' '}
                  {WEBSITE.replace(/https?:\/\//g, '').replace(/\/$/, '')}
                  <br />
                </>
              )}
              <span class="insignificant">Version:</span>{' '}
              <input
                type="text"
                class="version-string"
                readOnly
                size="18" // Manually calculated here
                value={`${__BUILD_TIME__.slice(0, 10).replace(/-/g, '.')}${
                  __COMMIT_HASH__ ? `.${__COMMIT_HASH__}` : ''
                }`}
                onClick={(e) => {
                  e.target.select();
                  // Copy to clipboard
                  try {
                    navigator.clipboard.writeText(e.target.value);
                    showToast('Version string copied');
                  } catch (e) {
                    console.warn(e);
                    showToast('Unable to copy version string');
                  }
                }}
              />{' '}
              {!__FAKE_COMMIT_HASH__ && (
                <span class="ib insignificant">
                  (
                  <a
                    href={`https://github.com/cheeaun/phanpy/commit/${__COMMIT_HASH__}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <RelativeTime datetime={new Date(__BUILD_TIME__)} />
                  </a>
                  )
                </span>
              )}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function PushNotificationsSection({ onClose }) {
  if (!isPushSupported()) return null;

  const { instance } = api();
  const [uiState, setUIState] = useState('default');
  const pushFormRef = useRef();
  const [allowNotifications, setAllowNotifications] = useState(false);
  const [needRelogin, setNeedRelogin] = useState(false);
  const previousPolicyRef = useRef();
  useEffect(() => {
    (async () => {
      setUIState('loading');
      try {
        const { subscription, backendSubscription } = await initSubscription();
        if (
          backendSubscription?.policy &&
          backendSubscription.policy !== 'none'
        ) {
          setAllowNotifications(true);
          const { alerts, policy } = backendSubscription;
          console.log('backendSubscription', backendSubscription);
          previousPolicyRef.current = policy;
          const { elements } = pushFormRef.current;
          const policyEl = elements.namedItem('policy');
          if (policyEl) policyEl.value = policy;
          // alerts is {}, iterate it
          Object.keys(alerts).forEach((alert) => {
            const el = elements.namedItem(alert);
            if (el?.type === 'checkbox') {
              el.checked = true;
            }
          });
        }
        setUIState('default');
      } catch (err) {
        console.warn(err);
        if (/outside.*authorized/i.test(err.message)) {
          setNeedRelogin(true);
        } else {
          alert(err?.message || err);
        }
        setUIState('error');
      }
    })();
  }, []);

  const isLoading = uiState === 'loading';

  return (
    <form
      ref={pushFormRef}
      onChange={() => {
        setTimeout(() => {
          const values = Object.fromEntries(new FormData(pushFormRef.current));
          const allowNotifications = !!values['policy-allow'];
          const params = {
            data: {
              policy: values.policy,
              alerts: {
                mention: !!values.mention,
                favourite: !!values.favourite,
                reblog: !!values.reblog,
                follow: !!values.follow,
                follow_request: !!values.followRequest,
                poll: !!values.poll,
                update: !!values.update,
                status: !!values.status,
              },
            },
          };

          let alertsCount = 0;
          // Remove false values from data.alerts
          // API defaults to false anyway
          Object.keys(params.data.alerts).forEach((key) => {
            if (!params.data.alerts[key]) {
              delete params.data.alerts[key];
            } else {
              alertsCount++;
            }
          });
          const policyChanged =
            previousPolicyRef.current !== params.data.policy;

          console.log('PN Form', {
            values,
            allowNotifications: allowNotifications,
            params,
          });

          if (allowNotifications && alertsCount > 0) {
            if (policyChanged) {
              console.debug('Policy changed.');
              removeSubscription()
                .then(() => {
                  updateSubscription(params);
                })
                .catch((err) => {
                  console.warn(err);
                  alert('Failed to update subscription. Please try again.');
                });
            } else {
              updateSubscription(params).catch((err) => {
                console.warn(err);
                alert('Failed to update subscription. Please try again.');
              });
            }
          } else {
            removeSubscription().catch((err) => {
              console.warn(err);
              alert('Failed to remove subscription. Please try again.');
            });
          }
        }, 100);
      }}
    >
      <h3>Push Notifications (beta)</h3>
      <section>
        <ul>
          <li>
            <label>
              <input
                type="checkbox"
                disabled={isLoading || needRelogin}
                name="policy-allow"
                checked={allowNotifications}
                onChange={async (e) => {
                  const { checked } = e.target;
                  if (checked) {
                    // Request permission
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                      setAllowNotifications(true);
                    } else {
                      setAllowNotifications(false);
                      if (permission === 'denied') {
                        alert(
                          'Push notifications are blocked. Please enable them in your browser settings.',
                        );
                      }
                    }
                  } else {
                    setAllowNotifications(false);
                  }
                }}
              />{' '}
              Allow from{' '}
              <select
                name="policy"
                disabled={isLoading || needRelogin || !allowNotifications}
              >
                {[
                  {
                    value: 'all',
                    label: 'anyone',
                  },
                  {
                    value: 'followed',
                    label: 'people I follow',
                  },
                  {
                    value: 'follower',
                    label: 'followers',
                  },
                ].map((type) => (
                  <option value={type.value}>{type.label}</option>
                ))}
              </select>
            </label>
            <div
              class="shazam-container no-animation"
              style={{
                width: '100%',
              }}
              hidden={!allowNotifications}
            >
              <div class="shazam-container-inner">
                <div class="sub-section">
                  <ul>
                    {[
                      {
                        value: 'mention',
                        label: 'Mentions',
                      },
                      {
                        value: 'favourite',
                        label: 'Likes',
                      },
                      {
                        value: 'reblog',
                        label: 'Boosts',
                      },
                      {
                        value: 'follow',
                        label: 'Follows',
                      },
                      {
                        value: 'followRequest',
                        label: 'Follow requests',
                      },
                      {
                        value: 'poll',
                        label: 'Polls',
                      },
                      {
                        value: 'update',
                        label: 'Post edits',
                      },
                      {
                        value: 'status',
                        label: 'New posts',
                      },
                    ].map((alert) => (
                      <li>
                        <label>
                          <input type="checkbox" name={alert.value} />{' '}
                          {alert.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            {needRelogin && (
              <div class="sub-section">
                <p>
                  Push permission was not granted since your last login. You'll
                  need to{' '}
                  <Link to={`/login?instance=${instance}`} onClick={onClose}>
                    <b>log in</b> again to grant push permission
                  </Link>
                  .
                </p>
              </div>
            )}
          </li>
        </ul>
      </section>
      <p class="section-postnote">
        <small>
          NOTE: Push notifications only work for <b>one account</b>.
        </small>
      </p>
    </form>
  );
}

export default Settings;
