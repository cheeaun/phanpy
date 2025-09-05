import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';

import { api } from '../utils/api';

import Icon from './icon';
import Loader from './loader';

function PrivateNoteSheet({
  account,
  note: initialNote,
  onRelationshipChange = () => {},
  onClose = () => {},
}) {
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const textareaRef = useRef(null);

  useEffect(() => {
    let timer;
    if (textareaRef.current && !initialNote) {
      timer = setTimeout(() => {
        textareaRef.current.focus?.();
      }, 100);
    }
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div class="sheet" id="private-note-container">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <b>
          <Trans>
            Private note about{' '}
            <span class="bidi-isolate">
              @{account?.username || account?.acct}
            </span>
          </Trans>
        </b>
      </header>
      <main>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const note = formData.get('note');
            if (note?.trim() !== initialNote?.trim()) {
              setUIState('loading');
              (async () => {
                try {
                  const newRelationship = await masto.v1.accounts
                    .$select(account?.id)
                    .note.create({
                      comment: note,
                    });
                  console.log('updated relationship', newRelationship);
                  setUIState('default');
                  onRelationshipChange(newRelationship);
                  onClose();
                } catch (e) {
                  console.error(e);
                  setUIState('error');
                  alert(e?.message || t`Unable to update private note.`);
                }
              })();
            }
          }}
        >
          <textarea
            ref={textareaRef}
            name="note"
            disabled={uiState === 'loading'}
            dir="auto"
          >
            {initialNote}
          </textarea>
          <footer>
            <button
              type="button"
              class="light"
              disabled={uiState === 'loading'}
              onClick={() => {
                onClose?.();
              }}
            >
              <Trans>Cancel</Trans>
            </button>
            <span>
              <Loader abrupt hidden={uiState !== 'loading'} />
              <button disabled={uiState === 'loading'} type="submit">
                <Trans>Save &amp; close</Trans>
              </button>
            </span>
          </footer>
        </form>
      </main>
    </div>
  );
}

export default PrivateNoteSheet;
