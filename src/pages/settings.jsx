import './settings.css';

import { useEffect, useRef, useState } from 'preact/hooks';
import { useSnapshot } from 'valtio';

import logo from '../assets/logo.svg';
import Icon from '../components/icon';
import RelativeTime from '../components/relative-time';
import targetLanguages from '../data/lingva-target-languages';
import { api } from '../utils/api';
import getTranslateTargetLanguage from '../utils/get-translate-target-language';
import localeCode2Text from '../utils/localeCode2Text';
import states from '../utils/states';
import store from '../utils/store';

const DEFAULT_TEXT_SIZE = 16;
const TEXT_SIZES = [16, 17, 18, 19, 20];

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
                    } else {
                      html.classList.toggle('is-light', theme === 'light');
                      html.classList.toggle('is-dark', theme === 'dark');
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
        <h3>Posting</h3>
        <section>
          <ul>
            <li>
              <div>
                <label for="posting-privacy-field">Default visibility</label>
              </div>
              <div>
                <select
                  id="posting-privacy-field"
                  value={prefs['posting:default:visibility'] || 'public'}
                  onChange={(e) => {
                    const { value } = e.target;
                    const { masto } = api();
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
                    Note: This feature uses an external API to translate,
                    powered by{' '}
                    <a
                      href="https://github.com/thedaviddelta/lingva-translate"
                      target="_blank"
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
          </ul>
        </section>
        <h3>About</h3>
        <section>
          <div
            style={{
              display: 'flex',
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
                onClick={(e) => {
                  e.preventDefault();
                  states.showAccount = 'phanpy@hachyderm.io';
                }}
              >
                @phanpy
              </a>
              <br />
              <a href="https://github.com/cheeaun/phanpy" target="_blank">
                Built
              </a>{' '}
              by{' '}
              <a
                href="https://mastodon.social/@cheeaun"
                // target="_blank"
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
              href="https://github.com/cheeaun/phanpy/blob/main/PRIVACY.MD"
              target="_blank"
            >
              Privacy Policy
            </a>
          </p>
          {__BUILD_TIME__ && (
            <p>
              <span class="insignificant">Last build:</span>{' '}
              <RelativeTime datetime={new Date(__BUILD_TIME__)} />{' '}
              {__COMMIT_HASH__ && (
                <>
                  (
                  <a
                    href={`https://github.com/cheeaun/phanpy/commit/${__COMMIT_HASH__}`}
                    target="_blank"
                  >
                    <code>{__COMMIT_HASH__}</code>
                  </a>
                  )
                </>
              )}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default Settings;
