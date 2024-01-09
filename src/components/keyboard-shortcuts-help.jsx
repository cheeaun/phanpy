import './keyboard-shortcuts-help.css';

import { memo } from 'preact/compat';
import { useHotkeys } from 'react-hotkeys-hook';
import { useSnapshot } from 'valtio';

import states from '../utils/states';

import Icon from './icon';
import Modal from './modal';

export default memo(function KeyboardShortcutsHelp() {
  const snapStates = useSnapshot(states);

  function onClose() {
    states.showKeyboardShortcutsHelp = false;
  }

  useHotkeys(
    '?, shift+?, shift+slash',
    (e) => {
      console.log('help');
      states.showKeyboardShortcutsHelp = true;
    },
    {
      ignoreEventWhen: (e) => {
        const hasModal = !!document.querySelector('#modal-container > *');
        return hasModal;
      },
    },
  );

  return (
    !!snapStates.showKeyboardShortcutsHelp && (
      <Modal class="light" onClose={onClose}>
        <div id="keyboard-shortcuts-help-container" class="sheet" tabindex="-1">
          <button type="button" class="sheet-close" onClick={onClose}>
            <Icon icon="x" />
          </button>
          <header>
            <h2>Keyboard shortcuts</h2>
          </header>
          <main>
            <table>
              {[
                {
                  action: 'Keyboard shortcuts help',
                  keys: <kbd>?</kbd>,
                },
                {
                  action: 'Next post',
                  keys: <kbd>j</kbd>,
                },
                {
                  action: 'Previous post',
                  keys: <kbd>k</kbd>,
                },
                {
                  action: 'Skip carousel to next post',
                  keys: (
                    <>
                      <kbd>Shift</kbd> + <kbd>j</kbd>
                    </>
                  ),
                },
                {
                  action: 'Skip carousel to previous post',
                  keys: (
                    <>
                      <kbd>Shift</kbd> + <kbd>k</kbd>
                    </>
                  ),
                },
                {
                  action: 'Load new posts',
                  keys: <kbd>.</kbd>,
                },
                {
                  action: 'Open post details',
                  keys: (
                    <>
                      <kbd>Enter</kbd> or <kbd>o</kbd>
                    </>
                  ),
                },
                {
                  action: (
                    <>
                      Expand content warning or
                      <br />
                      toggle expanded/collapsed thread
                    </>
                  ),
                  keys: <kbd>x</kbd>,
                },
                {
                  action: 'Close post or dialogs',
                  keys: (
                    <>
                      <kbd>Esc</kbd> or <kbd>Backspace</kbd>
                    </>
                  ),
                },
                {
                  action: 'Focus column in multi-column mode',
                  keys: (
                    <>
                      <kbd>1</kbd> to <kbd>9</kbd>
                    </>
                  ),
                },
                {
                  action: 'Compose new post',
                  keys: <kbd>c</kbd>,
                },
                {
                  action: 'Compose new post (new window)',
                  className: 'insignificant',
                  keys: (
                    <>
                      <kbd>Shift</kbd> + <kbd>c</kbd>
                    </>
                  ),
                },
                {
                  action: 'Send post',
                  keys: (
                    <>
                      <kbd>Ctrl</kbd> + <kbd>Enter</kbd> or <kbd>⌘</kbd> +{' '}
                      <kbd>Enter</kbd>
                    </>
                  ),
                },
                {
                  action: 'Search',
                  keys: <kbd>/</kbd>,
                },
                {
                  action: 'Reply',
                  keys: <kbd>r</kbd>,
                },
                {
                  action: 'Reply (new window)',
                  className: 'insignificant',
                  keys: (
                    <>
                      <kbd>Shift</kbd> + <kbd>r</kbd>
                    </>
                  ),
                },
                {
                  action: 'Like (favourite)',
                  keys: (
                    <>
                      <kbd>l</kbd> or <kbd>f</kbd>
                    </>
                  ),
                },
                {
                  action: 'Boost',
                  keys: (
                    <>
                      <kbd>Shift</kbd> + <kbd>b</kbd>
                    </>
                  ),
                },
                {
                  action: 'Bookmark',
                  keys: <kbd>d</kbd>,
                },
                {
                  action: 'Toggle Cloak mode',
                  keys: (
                    <>
                      <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>k</kbd>
                    </>
                  ),
                },
              ].map(({ action, className, keys }) => (
                <tr key={action}>
                  <th class={className}>{action}</th>
                  <td>{keys}</td>
                </tr>
              ))}
            </table>
          </main>
        </div>
      </Modal>
    )
  );
});
