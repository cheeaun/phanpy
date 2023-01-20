import './welcome.css';

import logo from '../assets/logo.svg';
import Link from '../components/link';
import useTitle from '../utils/useTitle';

function Welcome() {
  useTitle();
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
      <hr />
      <p>
        <a href="https://github.com/cheeaun/phanpy" target="_blank">
          Built
        </a>{' '}
        by{' '}
        <a href="https://mastodon.social/@cheeaun" target="_blank">
          @cheeaun
        </a>
        .
      </p>
    </main>
  );
}

export default Welcome;
