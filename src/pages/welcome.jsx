import './welcome.css';

import boostsCarouselUrl from '../assets/features/boosts-carousel.jpg';
import groupedNotificationsUrl from '../assets/features/grouped-notifications.jpg';
import multiColumnUrl from '../assets/features/multi-column.jpg';
import multiHashtagTimelineUrl from '../assets/features/multi-hashtag-timeline.jpg';
import nestedCommentsThreadUrl from '../assets/features/nested-comments-thread.jpg';
import logo from '../assets/logo.svg';
import Link from '../components/link';
import states from '../utils/states';
import useTitle from '../utils/useTitle';

function Welcome() {
  useTitle(null, ['/', '/welcome']);
  return (
    <main id="welcome">
      <h1>
        <img
          src={logo}
          alt=""
          width="24"
          height="24"
          style={{
            aspectRatio: '1/1',
          }}
        />{' '}
        Phanpy
      </h1>
      <h2>
        Trunk-tastic
        <br />
        Mastodon Experience
      </h2>
      <p>A minimalistic opinionated Mastodon web client.</p>
      <p>
        <big>
          <b>
            <Link to="/login" class="button">
              Log in
            </Link>
          </b>
        </big>
      </p>
      <details id="why-container">
        <summary>Why Phanpy?</summary>
        <div class="sections">
          <section>
            <h4>Boosts Carousel</h4>
            <p>
              Visually separate original posts and re-shared posts (boosted
              posts).
            </p>
            <img
              src={boostsCarouselUrl}
              alt="Screenshot of Boosts Carousel"
              loading="lazy"
            />
          </section>
          <section>
            <h4>Nested comments thread</h4>
            <p>Effortlessly follow conversations. Semi-collapsible replies.</p>
            <img
              src={nestedCommentsThreadUrl}
              alt="Screenshot of nested comments thread"
              loading="lazy"
            />
          </section>
          <section>
            <h4>Grouped notifications</h4>
            <p>
              Similar notifications are grouped and collapsed to reduce clutter.
            </p>
            <img
              src={groupedNotificationsUrl}
              alt="Screenshot of grouped notifications"
              loading="lazy"
            />
          </section>
          <section>
            <h4>Single or multi-column</h4>
            <p>
              By default, single column for zen-mode seekers. Configurable
              multi-column for power users.
            </p>
            <img
              src={multiColumnUrl}
              alt="Screenshot of multi-column UI"
              loading="lazy"
            />
          </section>
          <section>
            <h4>Multi-hashtag timeline</h4>
            <p>Up to 5 hashtags combined into a single timeline.</p>
            <img
              src={multiHashtagTimelineUrl}
              alt="Screenshot of multi-hashtag timeline with a form to add more hashtags"
              loading="lazy"
            />
          </section>
          <p>Convinced yet?</p>
          <p>
            <big>
              <b>
                <Link to="/login" class="button">
                  Log in
                </Link>
              </b>
            </big>
          </p>
        </div>
      </details>
      <hr />
      <p>
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
        <a
          href="https://github.com/cheeaun/phanpy/blob/main/PRIVACY.MD"
          target="_blank"
        >
          Privacy Policy
        </a>
        .
      </p>
    </main>
  );
}

export default Welcome;
