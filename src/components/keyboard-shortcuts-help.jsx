import './keyboard-shortcuts-help.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { memo } from 'preact/compat';
import { useHotkeys } from 'react-hotkeys-hook';
import { useSnapshot } from 'valtio';

import states from '../utils/states';

import Icon from './icon';
import Modal from './modal';

export default memo(function KeyboardShortcutsHelp() {
  const { t } = useLingui();
  const snapStates = useSnapshot(states);

  function onClose() {
    states.showKeyboardShortcutsHelp = false;
  }

  useHotkeys(
    '?',
    () => {
      console.log('help');
      states.showKeyboardShortcutsHelp = true;
    },
    {
      useKey: true,
      ignoreEventWhen: (e) => {
        const isCatchUpPage = /\/catchup/i.test(location.hash);
        return isCatchUpPage;
        // const hasModal = !!document.querySelector('#modal-container > *');
        // return hasModal;
      },
    },
  );

  return (
    !!snapStates.showKeyboardShortcutsHelp && (
      <Modal onClose={onClose}>
        <div id="keyboard-shortcuts-help-container" class="sheet" tabindex="-1">
          <button type="button" class="sheet-close" onClick={onClose}>
            <Icon icon="x" alt={t`Close`} />
          </button>
          <header>
            <h2>
              <Trans>Keyboard shortcuts</Trans>
            </h2>
          </header>
          <main>
            <table>
              <tbody>
                {[
                  {
                    action: t`Keyboard shortcuts help`,
                    keys: <kbd>?</kbd>,
                  },
                  {
                    action: t`Next post`,
                    keys: <kbd>j</kbd>,
                  },
                  {
                    action: t`Previous post`,
                    keys: <kbd>k</kbd>,
                  },
                  {
                    action: t`Skip carousel to next post`,
                    keys: (
                      <Trans>
                        <kbd>Shift</kbd> + <kbd>j</kbd>
                      </Trans>
                    ),
                  },
                  {
                    action: t`Skip carousel to previous post`,
                    keys: (
                      <Trans>
                        <kbd>Shift</kbd> + <kbd>k</kbd>
                      </Trans>
                    ),
                  },
                  {
                    action: t`Load new posts`,
                    keys: <kbd>.</kbd>,
                  },
                  {
                    action: t`Open post details`,
                    keys: (
                      <Trans>
                        <kbd>Enter</kbd> or <kbd>o</kbd>
                      </Trans>
                    ),
                  },
                  {
                    action: (
                      <Trans>
                        Expand content warning or
                        <br />
                        toggle expanded/collapsed thread
                      </Trans>
                    ),
                    keys: <kbd>x</kbd>,
                  },
                  {
                    action: t`Close post or dialogs`,
                    keys: (
                      <Trans>
                        <kbd>Esc</kbd> or <kbd>Backspace</kbd>
                      </Trans>
                    ),
                  },
                  {
                    action: t`Focus column in multi-column mode`,
                    keys: (
                      <Trans>
                        <kbd>1</kbd> to <kbd>9</kbd>
                      </Trans>
                    ),
                  },
                  {
                    action: t`Focus next column in multi-column mode`,
                    keys: <kbd>]</kbd>,
                  },
                  {
                    action: t`Focus previous column in multi-column mode`,
                    keys: <kbd>[</kbd>,
                  },
                  {
                    action: t`Compose new post`,
                    keys: <kbd>c</kbd>,
                  },
                  {
                    action: t`Compose new post (new window)`,
                    className: 'insignificant',
                    keys: (
                      <Trans>
                        <kbd>Shift</kbd> + <kbd>c</kbd>
                      </Trans>
                    ),
                  },
                  {
                    action: t`Send post`,
                    keys: (
                      <Trans>
                        <kbd>Ctrl</kbd> + <kbd>Enter</kbd> or <kbd>⌘</kbd> +{' '}
                        <kbd>Enter</kbd>
                      </Trans>
                    ),
                  },
                  {
                    action: t`Search`,
                    keys: <kbd>/</kbd>,
                  },
                  {
                    action: t`Reply`,
                    keys: <kbd>r</kbd>,
                  },
                  {
                    action: t`Reply (new window)`,
                    className: 'insignificant',
                    keys: (
                      <Trans>
                        <kbd>Shift</kbd> + <kbd>r</kbd>
                      </Trans>
                    ),
                  },
                  {
                    action: t`Like (favourite)`,
                    keys: (
                      <Trans>
                        <kbd>l</kbd> or <kbd>f</kbd>
                      </Trans>
                    ),
                  },
                  {
                    action: t`Boost`,
                    keys: (
                      <Trans>
                        <kbd>Shift</kbd> + <kbd>b</kbd>
                      </Trans>
                    ),
                  },
                  {
                    action: t`Bookmark`,
                    keys: <kbd>d</kbd>,
                  },
                  {
                    action: t`Toggle Cloak mode`,
                    keys: (
                      <Trans>
                        <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>k</kbd>
                      </Trans>
                    ),
                  },
                ].map(({ action, className, keys }) => (
                  <tr key={action}>
                    <th class={className}>{action}</th>
                    <td>{keys}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </main>
        </div>
      </Modal>
    )
  );
});
