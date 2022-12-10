import './welcome.css';

import logo from '../assets/logo.svg';
import useTitle from '../utils/useTitle';

export default () => {
  useTitle();
  return (
    <main id="welcome" class="box">
      <img
        src={logo}
        alt=""
        width="140"
        height="140"
        style={{
          aspectRatio: '1/1',
        }}
      />
      <h1>Welcome</h1>
      <p>Phanpy is a minimalistic opinionated Mastodon web client.</p>
      <p class="warning">
        🚧 This is an early ALPHA project. Many features are missing, many bugs
        are present. Please report issues as detailed as possible. Thanks 🙏
      </p>
      <p>
        <big>
          <b>
            <a href="#/login" class="button">
              Log in
            </a>
          </b>
        </big>
      </p>
    </main>
  );
};
