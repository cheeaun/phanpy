import { useHotkeys } from 'react-hotkeys-hook';
import { useSnapshot } from 'valtio';

import openCompose from '../utils/open-compose';
import openOSK from '../utils/open-osk';
import states from '../utils/states';

import Icon from './icon';

export default function ComposeButton() {
  const snapStates = useSnapshot(states);

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

  return (
    <button
      type="button"
      id="compose-button"
      onClick={handleButton}
      class={`${snapStates.composerState.minimized ? 'min' : ''} ${
        snapStates.composerState.publishing ? 'loading' : ''
      } ${snapStates.composerState.publishingError ? 'error' : ''}`}
    >
      <Icon icon="quill" size="xl" alt="Compose" />
    </button>
  );
}
