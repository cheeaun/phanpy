import './settings.css';

import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import logo from '../assets/logo.svg';

import Icon from '../components/icon';
import LangSelector from '../components/lang-selector';
import Link from '../components/link';
import RelativeTime from '../components/relative-time';
import languages from '../data/translang-languages';
import { api } from '../utils/api';
import getTranslateTargetLanguage from '../utils/get-translate-target-language';
import localeCode2Text from '../utils/localeCode2Text';
import prettyBytes from '../utils/pretty-bytes';
import {
  initSubscription,
  isPushSupported,
  removeSubscription,
  updateSubscription,
} from '../utils/push-notifications';
import showToast from '../utils/show-toast';
import states from '../utils/states';
import store from '../utils/store';
import { getAPIVersions } from '../utils/store-utils';
import supports from '../utils/supports';

const DEFAULT_TEXT_SIZE = 16;
const TEXT_SIZES = [14, 15, 16, 17, 18, 19, 20];
const {
  PHANPY_WEBSITE: WEBSITE,
  PHANPY_PRIVACY_POLICY_URL: PRIVACY_POLICY_URL,
  PHANPY_TRANSLANG_INSTANCES: TRANSLANG_INSTANCES,
  PHANPY_IMG_ALT_API_URL: IMG_ALT_API_URL,
  PHANPY_GIPHY_API_KEY: GIPHY_API_KEY,
} = import.meta.env;

const targetLanguages = Object.entries(languages.tl).map(([code, name]) => ({
  code,
  name,
}));

const TRANSLATION_API_NAME = 'TransLang API';

function Settings({ onClose }) {
  const { t } = useLingui();
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
    <div
      id="settings-container"
      class="sheet"
      tabIndex="-1"
      style={{
        '--current-text-size': `${currentTextSize}px`,
      }}
    >
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Settings</Trans>
        </h2>
      </header>
      <main>
        <section>
          <ul>
            <li>
              <div>
                <label>
                  <Trans>Appearance</Trans>
                </label>
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
                      <span>
                        <Trans>Light</Trans>
                      </span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="theme"
                        value="dark"
                        defaultChecked={currentTheme === 'dark'}
                      />
                      <span>
                        <Trans>Dark</Trans>
                      </span>
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
                      <span>
                        <Trans>Auto</Trans>
                      </span>
                    </label>
                  </div>
                </form>
              </div>
            </li>
            <li>
              <div>
                <label>
                  <Trans>Text size</Trans>
                </label>
              </div>
              <div class="range-group">
                <span style={{ fontSize: TEXT_SIZES[0] }}>
                  <Trans comment="Preview of one character, in smallest size">
                    A
                  </Trans>
                </span>{' '}
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
                  <Trans comment="Preview of one character, in largest size">
                    A
                  </Trans>
                </span>
                <datalist id="sizes">
                  {TEXT_SIZES.map((size) => (
                    <option value={size} />
                  ))}
                </datalist>
              </div>
            </li>
            <li>
              <span>
                <label>
                  <Trans>Display language</Trans>
                </label>
                <br />
                <small>
                  <a
                    href="https://crowdin.com/project/phanpy"
                    target="_blank"
                    rel="noopener"
                  >
                    <Trans>Volunteer translations</Trans>
                  </a>
                </small>
              </span>
              <LangSelector />
            </li>
          </ul>
        </section>
        {authenticated && (
          <>
            <h3>
              <Trans>Posting</Trans>
            </h3>
            <section>
              <ul>
                <li>
                  <div>
                    <label for="posting-privacy-field">
                      <Trans>Default visibility</Trans>{' '}
                      <Icon icon="cloud" alt={t`Synced`} class="synced-icon" />
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
                            alert(t`Failed to update posting privacy`);
                            console.error(e);
                          }
                        })();
                      }}
                    >
                      <option value="public">
                        <Trans>Public</Trans>
                      </option>
                      <option value="unlisted">
                        <Trans>Unlisted</Trans>
                      </option>
                      <option value="private">
                        <Trans>Followers only</Trans>
                      </option>
                    </select>
                  </div>
                </li>
              </ul>
            </section>
            <p class="section-postnote">
              <Icon icon="cloud" alt={t`Synced`} class="synced-icon" />{' '}
              <small>
                <Trans>
                  Synced to your instance server's settings.{' '}
                  <a
                    href={`https://${instance}/`}
                    target="_blank"
                    rel="noopener"
                  >
                    Go to your instance ({instance}) for more settings.
                  </a>
                </Trans>
              </small>
            </p>
          </>
        )}
        <h3>
          <Trans>Experiments</Trans>
        </h3>
        <section>
          <ul>
            <li class="block">
              <label>
                <input
                  type="checkbox"
                  checked={snapStates.settings.autoRefresh}
                  onChange={(e) => {
                    states.settings.autoRefresh = e.target.checked;
                  }}
                />{' '}
                <Trans>Auto refresh timeline posts</Trans>
              </label>
            </li>
            <li class="block">
              <label>
                <input
                  type="checkbox"
                  checked={snapStates.settings.boostsCarousel}
                  onChange={(e) => {
                    states.settings.boostsCarousel = e.target.checked;
                  }}
                />{' '}
                <Trans>Boosts carousel</Trans>
              </label>
            </li>
            {!!TRANSLANG_INSTANCES && (
              <li class="block">
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
                  <Trans>Post translation</Trans>
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
                      <Trans>Translate to </Trans>{' '}
                      <select
                        value={targetLanguage || ''}
                        disabled={!snapStates.settings.contentTranslation}
                        style={{ width: '10em' }}
                        onChange={(e) => {
                          states.settings.contentTranslationTargetLanguage =
                            e.target.value || null;
                        }}
                      >
                        <option value="">
                          <Trans>
                            System language ({systemTargetLanguageText})
                          </Trans>
                        </option>
                        <option disabled>──────────</option>
                        {targetLanguages.map((lang) => {
                          const common = localeCode2Text({
                            code: lang.code,
                            fallback: lang.name,
                          });
                          const native = localeCode2Text({
                            code: lang.code,
                            locale: lang.code,
                          });
                          const showCommon = native && common !== native;
                          return (
                            <option value={lang.code}>
                              {showCommon ? `${native} - ${common}` : common}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  </div>
                  <hr />
                  <div class="checkbox-fieldset">
                    <Plural
                      value={
                        snapStates.settings.contentTranslationHideLanguages
                          .length
                      }
                      _0={`Hide "Translate" button for:`}
                      other={`Hide "Translate" button for (#):`}
                    />
                    <div class="checkbox-fields">
                      {targetLanguages.map((lang) => {
                        const common = localeCode2Text({
                          code: lang.code,
                          fallback: lang.name,
                        });
                        const native = localeCode2Text({
                          code: lang.code,
                          locale: lang.code,
                        });
                        const showCommon = native && common !== native;
                        return (
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
                            {showCommon ? (
                              <span>
                                {native}{' '}
                                <span class="insignificant ib">- {common}</span>
                              </span>
                            ) : (
                              common
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <p class="insignificant">
                    <small>
                      <Trans>
                        Note: This feature uses external translation services,
                        powered by{' '}
                        <a
                          href="https://github.com/cheeaun/translang-api"
                          target="_blank"
                          rel="noopener"
                        >
                          {TRANSLATION_API_NAME}
                        </a>
                        .
                      </Trans>
                    </small>
                  </p>
                  <hr />
                  <div>
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          snapStates.settings.contentTranslationAutoInline
                        }
                        disabled={!snapStates.settings.contentTranslation}
                        onChange={(e) => {
                          states.settings.contentTranslationAutoInline =
                            e.target.checked;
                        }}
                      />{' '}
                      <Trans>Auto inline translation</Trans>
                    </label>
                    <p class="insignificant">
                      <small>
                        <Trans>
                          Automatically show translation for posts in timeline.
                          Only works for <b>short</b> posts without content
                          warning, media and poll.
                        </Trans>
                      </small>
                    </p>
                  </div>
                </div>
              </li>
            )}
            {!!GIPHY_API_KEY && authenticated && (
              <li class="block">
                <label>
                  <input
                    type="checkbox"
                    checked={snapStates.settings.composerGIFPicker}
                    onChange={(e) => {
                      states.settings.composerGIFPicker = e.target.checked;
                    }}
                  />{' '}
                  <Trans>GIF Picker for composer</Trans>
                </label>
                <div class="sub-section insignificant">
                  <small>
                    <Trans>
                      Note: This feature uses external GIF search service,
                      powered by{' '}
                      <a
                        href="https://developers.giphy.com/"
                        target="_blank"
                        rel="noopener"
                      >
                        GIPHY
                      </a>
                      . G-rated (suitable for viewing by all ages), tracking
                      parameters are stripped, referrer information is omitted
                      from requests, but search queries and IP address
                      information will still reach their servers.
                    </Trans>
                  </small>
                </div>
              </li>
            )}
            {!!IMG_ALT_API_URL && authenticated && (
              <li class="block">
                <label>
                  <input
                    type="checkbox"
                    checked={snapStates.settings.mediaAltGenerator}
                    onChange={(e) => {
                      states.settings.mediaAltGenerator = e.target.checked;
                    }}
                  />{' '}
                  <Trans>Image description generator</Trans>{' '}
                  <Icon icon="sparkles2" class="more-insignificant" />
                </label>
                <div class="sub-section insignificant">
                  <small>
                    <Trans>
                      Only for new images while composing new posts.
                    </Trans>
                  </small>
                </div>
                <div class="sub-section insignificant">
                  <small>
                    <Trans>
                      Note: This feature uses external AI service, powered by{' '}
                      <a
                        href="https://github.com/cheeaun/img-alt-api"
                        target="_blank"
                        rel="noopener"
                      >
                        img-alt-api
                      </a>
                      . May not work well. Only for images and in English.
                    </Trans>
                  </small>
                </div>
              </li>
            )}
            {authenticated &&
              supports('@mastodon/grouped-notifications') &&
              getAPIVersions()?.mastodon >= 2 && (
                <li class="block">
                  <label>
                    <input
                      type="checkbox"
                      checked={snapStates.settings.groupedNotificationsAlpha}
                      onChange={(e) => {
                        states.settings.groupedNotificationsAlpha =
                          e.target.checked;
                      }}
                    />{' '}
                    <Trans>Server-side grouped notifications</Trans>
                  </label>
                  <div class="sub-section insignificant">
                    <small>
                      <Trans>
                        Alpha-stage feature. Potentially improved grouping
                        window but basic grouping logic.
                      </Trans>
                    </small>
                  </div>
                </li>
              )}
            {authenticated && (
              <li class="block">
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
                  <Trans>"Cloud" import/export for shortcuts settings</Trans>{' '}
                  <Icon icon="cloud" class="more-insignificant" />
                </label>
                <div class="sub-section insignificant">
                  <small>
                    <Trans>
                      ⚠️⚠️⚠️ Very experimental.
                      <br />
                      Stored in your own profile’s notes. Profile (private)
                      notes are mainly used for other profiles, and hidden for
                      own profile.
                    </Trans>
                  </small>
                </div>
                <div class="sub-section insignificant">
                  <small>
                    <Trans>
                      Note: This feature uses currently-logged-in instance
                      server API.
                    </Trans>
                  </small>
                </div>
              </li>
            )}
            <li class="block">
              <label>
                <input
                  type="checkbox"
                  checked={snapStates.settings.cloakMode}
                  onChange={(e) => {
                    states.settings.cloakMode = e.target.checked;
                  }}
                />{' '}
                <Trans>
                  Cloak mode{' '}
                  <span class="insignificant">
                    (<samp>Text</samp> → <samp>████</samp>)
                  </span>
                </Trans>
              </label>
              <div class="sub-section insignificant">
                <small>
                  <Trans>
                    Replace text as blocks, useful when taking screenshots, for
                    privacy reasons.
                  </Trans>
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
                  <Trans>Unsent drafts</Trans>
                </button>
              </li>
            )}
          </ul>
        </section>
        {authenticated && <PushNotificationsSection onClose={onClose} />}
        <h3>
          <Trans>About</Trans>
        </h3>
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
                rel="noopener"
                onClick={(e) => {
                  e.preventDefault();
                  states.showAccount = 'phanpy@hachyderm.io';
                }}
              >
                @phanpy
              </a>
              <br />
              <Trans>
                <a
                  href="https://github.com/cheeaun/phanpy"
                  target="_blank"
                  rel="noopener"
                >
                  Built
                </a>{' '}
                by{' '}
                <a
                  href="https://mastodon.social/@cheeaun"
                  // target="_blank"
                  rel="noopener"
                  onClick={(e) => {
                    e.preventDefault();
                    states.showAccount = 'cheeaun@mastodon.social';
                  }}
                >
                  @cheeaun
                </a>
              </Trans>
            </div>
          </div>
          <p>
            <a
              href="https://github.com/sponsors/cheeaun"
              target="_blank"
              rel="noopener"
            >
              <Trans>Sponsor</Trans>
            </a>{' '}
            &middot;{' '}
            <a
              href="https://www.buymeacoffee.com/cheeaun"
              target="_blank"
              rel="noopener"
            >
              <Trans>Donate</Trans>
            </a>{' '}
            &middot;{' '}
            <a
              href="https://patreon.com/cheeaun"
              target="_blank"
              rel="noopener"
            >
              Patreon
            </a>{' '}
            &middot;{' '}
            <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener">
              <Trans>Privacy Policy</Trans>
            </a>
          </p>
          {__BUILD_TIME__ && (
            <p>
              {WEBSITE && (
                <>
                  <Trans>
                    <span class="insignificant">Site:</span>{' '}
                    {WEBSITE.replace(/https?:\/\//g, '').replace(/\/$/, '')}
                  </Trans>
                  <br />
                </>
              )}
              <Trans>
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
                      showToast(t`Version string copied`);
                    } catch (e) {
                      console.warn(e);
                      showToast(t`Unable to copy version string`);
                    }
                  }}
                />{' '}
                {!__FAKE_COMMIT_HASH__ && (
                  <span class="ib insignificant">
                    (
                    <a
                      href={`https://github.com/cheeaun/phanpy/commit/${__COMMIT_HASH__}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <RelativeTime datetime={new Date(__BUILD_TIME__)} />
                    </a>
                    )
                  </span>
                )}
              </Trans>
            </p>
          )}
        </section>
        {(import.meta.env.DEV || import.meta.env.PHANPY_DEV) && (
          <details class="debug-info">
            <summary></summary>
            <p>Debugging</p>
            {__BENCH_RESULTS?.size > 0 && (
              <ul>
                {Array.from(__BENCH_RESULTS.entries()).map(
                  ([name, duration]) => (
                    <li>
                      <b>{name}</b>: {duration}ms
                    </li>
                  ),
                )}
              </ul>
            )}
            <p>Service Worker Cache</p>
            <button
              type="button"
              class="plain2 small"
              onClick={async () => alert(await getCachesKeys())}
            >
              Show keys count
            </button>{' '}
            <button
              type="button"
              class="plain2 small"
              onClick={async () => alert(await getCachesSize())}
            >
              Show cache size
            </button>{' '}
            <button
              type="button"
              class="plain2 small"
              onClick={() => {
                const key = prompt('Enter cache key');
                if (!key) return;
                try {
                  clearCacheKey(key);
                } catch (e) {
                  alert(e);
                }
              }}
            >
              Clear cache key
            </button>{' '}
            <button
              type="button"
              class="plain2 small"
              onClick={() => {
                try {
                  clearCaches();
                } catch (e) {
                  alert(e);
                }
              }}
            >
              Clear all caches
            </button>
          </details>
        )}
      </main>
    </div>
  );
}

async function getCachesKeys() {
  const keys = await caches.keys();
  const total = {};
  for (const key of keys) {
    const cache = await caches.open(key);
    const k = await cache.keys();
    total[key] = k.length;
  }
  return total;
}

async function getCachesSize() {
  const keys = await caches.keys();
  let total = {};
  let TOTAL = 0;
  for (const key of keys) {
    const cache = await caches.open(key);
    const k = await cache.keys();
    for (const item of k) {
      try {
        const response = await cache.match(item);
        const blob = await response.blob();
        total[key] = (total[key] || 0) + blob.size;
        TOTAL += blob.size;
      } catch (e) {
        alert('Failed to get cache size for ' + item);
        alert(e);
      }
    }
  }
  return {
    ...Object.fromEntries(
      Object.entries(total).map(([k, v]) => [k, prettyBytes(v)]),
    ),
    TOTAL: prettyBytes(TOTAL),
  };
}

function clearCacheKey(key) {
  return caches.delete(key);
}

async function clearCaches() {
  const keys = await caches.keys();
  for (const key of keys) {
    await caches.delete(key);
  }
}

function PushNotificationsSection({ onClose }) {
  const { t } = useLingui();
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
          Object.entries(alerts).forEach(([alert, value]) => {
            const el = elements.namedItem(alert);
            if (el?.type === 'checkbox') {
              el.checked = !!value;
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
                  alert(t`Failed to update subscription. Please try again.`);
                });
            } else {
              updateSubscription(params).catch((err) => {
                console.warn(err);
                alert(t`Failed to update subscription. Please try again.`);
              });
            }
          } else {
            removeSubscription().catch((err) => {
              console.warn(err);
              alert(t`Failed to remove subscription. Please try again.`);
            });
          }
        }, 100);
      }}
    >
      <h3>
        <Trans>Push Notifications (beta)</Trans>
      </h3>
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
                          t`Push notifications are blocked. Please enable them in your browser settings.`,
                        );
                      }
                    }
                  } else {
                    setAllowNotifications(false);
                  }
                }}
              />{' '}
              <Trans>
                Allow from{' '}
                <select
                  name="policy"
                  disabled={isLoading || needRelogin || !allowNotifications}
                >
                  {[
                    {
                      value: 'all',
                      label: t`anyone`,
                    },
                    {
                      value: 'followed',
                      label: t`people I follow`,
                    },
                    {
                      value: 'follower',
                      label: t`followers`,
                    },
                  ].map((type) => (
                    <option value={type.value}>{type.label}</option>
                  ))}
                </select>
              </Trans>
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
                        label: t`Mentions`,
                      },
                      {
                        value: 'favourite',
                        label: t`Likes`,
                      },
                      {
                        value: 'reblog',
                        label: t`Boosts`,
                      },
                      {
                        value: 'follow',
                        label: t`Follows`,
                      },
                      {
                        value: 'followRequest',
                        label: t`Follow requests`,
                      },
                      {
                        value: 'poll',
                        label: t`Polls`,
                      },
                      {
                        value: 'update',
                        label: t`Post edits`,
                      },
                      {
                        value: 'status',
                        label: t`New posts`,
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
                  <Trans>
                    Push permission was not granted since your last login.
                    You'll need to{' '}
                    <Link to={`/login?instance=${instance}`} onClick={onClose}>
                      <b>log in</b> again to grant push permission
                    </Link>
                    .
                  </Trans>
                </p>
              </div>
            )}
          </li>
        </ul>
      </section>
      <p class="section-postnote">
        <small>
          <Trans>
            NOTE: Push notifications only work for <b>one account</b>.
          </Trans>
        </small>
      </p>
    </form>
  );
}

export default Settings;
