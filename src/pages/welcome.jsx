import './welcome.css';

import { Trans, useLingui } from '@lingui/react/macro';

import boostsCarouselUrl from '../assets/features/boosts-carousel.jpg';
import catchupUrl from '../assets/features/catch-up.png';
import multiColumnUrl from '../assets/features/multi-column.jpg';
import multiHashtagTimelineUrl from '../assets/features/multi-hashtag-timeline.jpg';
import nestedCommentsThreadUrl from '../assets/features/nested-comments-thread.jpg';
import logo from '../assets/logo.svg';
import logoText from '../assets/logo-text-2.svg';
import homeMobileDark from '../assets/screenshots/home-mobile-dark@2x.png';
import homeMobileLight from '../assets/screenshots/home-mobile-light@2x.png';
import homeTabletDark from '../assets/screenshots/home-tablet-dark@2x.png';
import homeTabletLight from '../assets/screenshots/home-tablet-light@2x.png';

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
const sameSite = WEBSITE
  ? WEBSITE.toLowerCase().includes(location.hostname)
  : false;
const appVersion = __COMMIT_TIME__
  ? `${__COMMIT_TIME__.slice(0, 10).replace(/-/g, '.')}${
      __COMMIT_HASH__ ? `.${__COMMIT_HASH__}` : ''
    }`
  : null;

function Welcome() {
  const { t } = useLingui();
  useTitle(null, ['/', '/welcome']);
  return (
    <main id="welcome">
      <div class="hero-container">
        <div class="hero-content">
          <h1>
            <img src={logo} alt="" width="100" height="100" />
            <img src={logoText} alt="Phanpy" width="180" height="52" />
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
              class="button plain6"
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
      </div>
      <div id="device-showcase">
        <div class="device mobile">
          <div class="device-frame">
            <picture>
              <source
                srcSet={homeMobileDark}
                media="(prefers-color-scheme: dark)"
              />
              <img
                src={homeMobileLight}
                alt={t`Screenshot of Phanpy home timeline on mobile device`}
                width="375"
                height="812"
                loading="lazy"
              />
            </picture>
          </div>
        </div>
        <div class="device tablet">
          <div class="device-frame">
            <picture>
              <source
                srcSet={homeTabletDark}
                media="(prefers-color-scheme: dark)"
              />
              <img
                src={homeTabletLight}
                alt={t`Screenshot of Phanpy home timeline on tablet device`}
                width="768"
                height="1024"
                loading="lazy"
              />
            </picture>
          </div>
        </div>
      </div>
      <div id="why-container">
        <div class="sections">
          <section>
            <img
              src={boostsCarouselUrl}
              alt={t`Screenshot of Boosts Carousel`}
              width="400"
              height="303"
              loading="lazy"
            />
            <div>
              <h4>
                <Trans>Boosts Carousel</Trans>
              </h4>
              <p>
                <Trans>
                  Visually separate original posts and re-shared posts (boosted
                  posts).
                </Trans>
              </p>
            </div>
          </section>
          <section>
            <img
              src={catchupUrl}
              alt={t`Screenshot of Catch-up`}
              width="600"
              height="450"
              loading="lazy"
            />
            <div>
              <h4>
                <Trans>Catch-up</Trans>
              </h4>
              <p>
                <Trans>
                  A separate timeline for followings. Email-inspired interface
                  to sort and filter posts.
                </Trans>
              </p>
            </div>
          </section>
          <section>
            <img
              src={nestedCommentsThreadUrl}
              alt={t`Screenshot of nested comments thread`}
              width="400"
              height="474"
              loading="lazy"
            />
            <div>
              <h4>
                <Trans>Nested comments thread</Trans>
              </h4>
              <p>
                <Trans>
                  Effortlessly follow conversations. Semi-collapsible replies.
                </Trans>
              </p>
            </div>
          </section>
          <section>
            <img
              src={multiColumnUrl}
              alt={t`Screenshot of multi-column UI`}
              width="400"
              height="209"
              loading="lazy"
            />
            <div>
              <h4>
                <Trans>Single or multi-column</Trans>
              </h4>
              <p>
                <Trans>
                  By default, single column for zen-mode seekers. Configurable
                  multi-column for power users.
                </Trans>
              </p>
            </div>
          </section>
          <section>
            <img
              src={multiHashtagTimelineUrl}
              alt={t`Screenshot of multi-hashtag timeline with a form to add more hashtags`}
              width="400"
              height="196"
              loading="lazy"
            />
            <div>
              <h4>
                <Trans>Multi-hashtag timeline</Trans>
              </h4>
              <p>
                <Trans>Up to 5 hashtags combined into a single timeline.</Trans>
              </p>
            </div>
          </section>
        </div>
      </div>
      <footer>
        {(appSite || appVersion) && (
          <p class="app-site-version">
            <small>
              {sameSite ? appSite : ''} {appVersion}
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
      </footer>
    </main>
  );
}

export default Welcome;
