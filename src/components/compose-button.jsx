import { Trans, useLingui } from '@lingui/react/macro';
import { ControlledMenu } from '@szhsin/react-menu';
import { useRef, useState } from 'preact/hooks';
import { useHotkeys } from 'react-hotkeys-hook';
import { useLongPress } from 'use-long-press';
import { useSnapshot } from 'valtio';

import openCompose from '../utils/open-compose';
import openOSK from '../utils/open-osk';
import safeBoundingBoxPadding from '../utils/safe-bounding-box-padding';
import states from '../utils/states';

import Icon from './icon';
import MenuLink from './menu-link';

export default function ComposeButton() {
  const { t } = useLingui();
  const snapStates = useSnapshot(states);

  // Context menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  function handleButton(e) {
    if (snapStates.composerState.minimized) {
      states.composerState.minimized = false;
      openOSK();
      return;
    }

    if (e.shiftKey) {
      const newWin = openCompose();

      if (!newWin) {
        states.showCompose = true;
      }
    } else {
      openOSK();
      states.showCompose = true;
    }
  }

  useHotkeys('c, shift+c', handleButton, {
    ignoreEventWhen: (e) => {
      const hasModal = !!document.querySelector('#modal-container > *');
      return hasModal;
    },
  });

  // Setup longpress handler to open context menu
  const bindLongPress = useLongPress(
    () => {
      setMenuOpen(true);
    },
    {
      threshold: 600,
    },
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        id="compose-button"
        onClick={handleButton}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        {...bindLongPress()}
        class={`${snapStates.composerState.minimized ? 'min' : ''} ${
          snapStates.composerState.publishing ? 'loading' : ''
        } ${snapStates.composerState.publishingError ? 'error' : ''}`}
      >
        <Icon icon="quill" size="xl" alt={t`Compose`} />
      </button>
      <ControlledMenu
        ref={menuRef}
        state={menuOpen ? 'open' : undefined}
        anchorRef={buttonRef}
        onClose={() => setMenuOpen(false)}
        direction="top"
        gap={8} // Add gap between menu and button
        unmountOnClose
        portal={{
          target: document.body,
        }}
        boundingBoxPadding={safeBoundingBoxPadding()}
        containerProps={{
          style: {
            zIndex: 1001,
          },
        }}
      >
        <MenuLink to="/sp">
          <Icon icon="schedule" size="l" />{' '}
          <span>
            <Trans>Scheduled Posts</Trans>
          </span>
        </MenuLink>
      </ControlledMenu>
    </>
  );
}
