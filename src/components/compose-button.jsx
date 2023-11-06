import { useHotkeys } from 'react-hotkeys-hook';

import openCompose from '../utils/open-compose';
import states from '../utils/states';

import Icon from './icon';

export default function ComposeButton() {
  function handleButton(e) {
    if (e.shiftKey) {
      const newWin = openCompose();

      if (!newWin) {
        states.showCompose = true;
      }
    } else {
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
    <button type="button" id="compose-button" onClick={handleButton}>
      <Icon icon="quill" size="xl" alt="Compose" />
    </button>
  );
}
