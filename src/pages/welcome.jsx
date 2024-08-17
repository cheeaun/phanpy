import './welcome.css';

import { t, Trans } from '@lingui/macro';

import boostsCarouselUrl from '../assets/features/boosts-carousel.jpg';
import groupedNotificationsUrl from '../assets/features/grouped-notifications.jpg';
import multiColumnUrl from '../assets/features/multi-column.jpg';
import multiHashtagTimelineUrl from '../assets/features/multi-hashtag-timeline.jpg';
import nestedCommentsThreadUrl from '../assets/features/nested-comments-thread.jpg';
import logoText from '../assets/logo-text.svg';
import logo from '../assets/logo.svg';

import LangSelector from '../components/lang-selector';
import Link from '../components/link';
import states from '../utils/states';
import useTitle from '../utils/useTitle';

const {
  PHANPY_DEFAULT_INSTANCE: DEFAULT_INSTANCE,
  PHANPY_WEBSITE: WEBSITE,
  PHANPY_PRIVACY_POLICY_URL: PRIVACY_POLICY_URL,
  PHANPY_DEFAULT_INSTANCE_REGISTRATION_URL: DEFAULT_INSTANCE_REGISTRATION_URL,
} = import.meta.env;
const appSite = WEBSITE
  ? WEBSITE.replace(/https?:\/\//g, '').replace(/\/$/, '')
  : null;
const appVersion = __BUILD_TIME__
  ? `${__BUILD_TIME__.slice(0, 10).replace(/-/g, '.')}${
      __COMMIT_HASH__ ? `.${__COMMIT_HASH__}` : ''
    }`
  : null;

function Welcome() {
  useTitle(null, ['/', '/welcome']);
  return (
    <main id="welcome">
      <div class="hero-container">
        <div class="hero-content">
          <h1>
            <img
              src={logo}
              alt=""
              width="160"
              height="160"
              style={{
                aspectRatio: '1/1',
                marginBlockEnd: -16,
              }}
            />
            <img src={logoText} alt="Phanpy" width="200" />
          </h1>
          <p class="desc">
            <Trans>A minimalistic opinionated Mastodon web client.</Trans>
          </p>
          <p>
            <Link
              to={
                DEFAULT_INSTANCE
                  ? `/login?instance=${DEFAULT_INSTANCE}&submit=1`
                  : '/login'
              }
              class="button"
            >
              {DEFAULT_INSTANCE ? t`Log in` : t`Log in with Mastodon`}
            </Link>
          </p>
          {DEFAULT_INSTANCE && DEFAULT_INSTANCE_REGISTRATION_URL && (
            <p>
              <a href={DEFAULT_INSTANCE_REGISTRATION_URL} class="button plain5">
                <Trans>Sign up</Trans>
              </a>
            </p>
          )}
          {!DEFAULT_INSTANCE && (
            <p class="insignificant">
              <small>
                <Trans>
                  Connect your existing Mastodon/Fediverse account.
                  <br />
                  Your credentials are not stored on this server.
                </Trans>
              </small>
            </p>
          )}
        </div>
        {(appSite || appVersion) && (
          <p class="app-site-version">
            <small>
              {appSite} {appVersion}
            </small>
          </p>
        )}
        <p>
          <Trans>
            <a href="https://github.com/cheeaun/phanpy" target="_blank">
              Built
            </a>{' '}
            by{' '}
            <a
              href="https://mastodon.social/@cheeaun"
              target="_blank"
              onClick={(e) => {
                e.preventDefault();
                states.showAccount = 'cheeaun@mastodon.social';
              }}
            >
              @cheeaun
            </a>
            .{' '}
            <a href={PRIVACY_POLICY_URL} target="_blank">
              Privacy Policy
            </a>
            .
          </Trans>
        </p>
        <div>
          <LangSelector />
        </div>
      </div>
      <div id="why-container">
        <div class="sections">
          <section>
            <img
              src={boostsCarouselUrl}
              alt={t`Screenshot of Boosts Carousel`}
              loading="lazy"
            />
            <h4>
              <Trans>Boosts Carousel</Trans>
            </h4>
            <p>
              <Trans>
                Visually separate original posts and re-shared posts (boosted
                posts).
              </Trans>
            </p>
          </section>
          <section>
            <img
              src={nestedCommentsThreadUrl}
              alt={t`Screenshot of nested comments thread`}
              loading="lazy"
            />
            <h4>
              <Trans>Nested comments thread</Trans>
            </h4>
            <p>
              <Trans>
                Effortlessly follow conversations. Semi-collapsible replies.
              </Trans>
            </p>
          </section>
          <section>
            <img
              src={groupedNotificationsUrl}
              alt={t`Screenshot of grouped notifications`}
              loading="lazy"
            />
            <h4>
              <Trans>Grouped notifications</Trans>
            </h4>
            <p>
              <Trans>
                Similar notifications are grouped and collapsed to reduce
                clutter.
              </Trans>
            </p>
          </section>
          <section>
            <img
              src={multiColumnUrl}
              alt={t`Screenshot of multi-column UI`}
              loading="lazy"
            />
            <h4>
              <Trans>Single or multi-column</Trans>
            </h4>
            <p>
              <Trans>
                By default, single column for zen-mode seekers. Configurable
                multi-column for power users.
              </Trans>
            </p>
          </section>
          <section>
            <img
              src={multiHashtagTimelineUrl}
              alt={t`Screenshot of multi-hashtag timeline with a form to add more hashtags`}
              loading="lazy"
            />
            <h4>
              <Trans>Multi-hashtag timeline</Trans>
            </h4>
            <p>
              <Trans>Up to 5 hashtags combined into a single timeline.</Trans>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

export default Welcome;
