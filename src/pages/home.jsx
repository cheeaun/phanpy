import { useEffect, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { useSnapshot } from 'valtio';

import Icon from '../components/icon';
import Link from '../components/link';
import db from '../utils/db';
import openCompose from '../utils/open-compose';
import states from '../utils/states';
import { getCurrentAccountNS } from '../utils/store-utils';

import Following from './following';

function Home() {
  const snapStates = useSnapshot(states);
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

  const { shortcuts } = snapStates;
  const { shortcutsColumnsMode } = snapStates.settings || {};
  const [shortcutsComponents, setShortcutsComponents] = useState([]);
  useEffect(() => {
    if (shortcutsColumnsMode) {
      const componentsPromises = shortcuts.map((shortcut) => {
        const { type, ...params } = shortcut;
        // Uppercase type
        return import(`./${type}`).then((module) => {
          const { default: Component } = module;
          return <Component {...params} />;
        });
      });
      Promise.all(componentsPromises)
        .then((components) => {
          setShortcutsComponents(components);
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }, [shortcutsColumnsMode, shortcuts]);

  useHotkeys(
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    (e, handler) => {
      try {
        const index = parseInt(handler.keys[0], 10) - 1;
        document.querySelectorAll('#columns > *')[index].focus();
      } catch (e) {
        console.error(e);
      }
    },
    {
      enabled: shortcutsColumnsMode,
    },
  );

  return (
    <>
      {shortcutsColumnsMode ? (
        <div id="columns">{shortcutsComponents}</div>
      ) : (
        <Following
          title="Home"
          path="/"
          id="home"
          headerStart={false}
          headerEnd={
            <Link
              to="/notifications"
              class={`button plain ${
                snapStates.notificationsShowNew ? 'has-badge' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Icon icon="notification" size="l" alt="Notifications" />
            </Link>
          }
        />
      )}
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
        <Icon icon="quill" size="xl" alt="Compose" />
      </button>
    </>
  );
}

export default Home;
