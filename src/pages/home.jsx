import { useEffect } from 'preact/hooks';

import Icon from '../components/icon';
import db from '../utils/db';
import openCompose from '../utils/open-compose';
import states from '../utils/states';
import { getCurrentAccountNS } from '../utils/store-utils';

import Following from './following';

function Home() {
  useEffect(() => {
    (async () => {
      const keys = await db.drafts.keys();
      if (keys.length) {
        const ns = getCurrentAccountNS();
        const ownKeys = keys.filter((key) => key.startsWith(ns));
        if (ownKeys.length) {
          states.showDrafts = true;
        }
      }
    })();
  }, []);

  return (
    <>
      <Following title="Home" path="/" id="home" headerStart={false} />
      <button
        // hidden={scrollDirection === 'end' && !nearReachStart}
        type="button"
        id="compose-button"
        onClick={(e) => {
          if (e.shiftKey) {
            const newWin = openCompose();
            if (!newWin) {
              alert('Looks like your browser is blocking popups.');
              states.showCompose = true;
            }
          } else {
            states.showCompose = true;
          }
        }}
      >
        <Icon icon="quill" size="xxl" alt="Compose" />
      </button>
    </>
  );
}

export default Home;
