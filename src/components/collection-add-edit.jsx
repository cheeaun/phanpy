import './collection-add-edit.css';

import './grapheme-input.js';

import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';

import supportedLanguages from '../data/status-supported-languages';
import { api } from '../utils/api';
import localeCode2Text from '../utils/localeCode2Text';
import showToast from '../utils/show-toast';

import Icon from './icon';
import Loader from './loader';
import MenuConfirm from './menu-confirm';

function CollectionAddEdit({ collection, onClose }) {
  const { t } = useLingui();
  const { masto } = api();
  const editMode = !!collection;
  const [uiState, setUIState] = useState('default');
  const nameFieldRef = useRef();
  const descriptionFieldRef = useRef();
  const languageFieldRef = useRef();
  const sensitiveFieldRef = useRef();

  useEffect(() => {
    if (editMode) {
      nameFieldRef.current.value = collection.name || '';
      descriptionFieldRef.current.value = collection.description || '';
      languageFieldRef.current.value = collection.language || '';
      sensitiveFieldRef.current.checked = collection.sensitive === true;
    }
  }, [editMode]);

  return (
    <div class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}{' '}
      <header>
        <h2>
          {editMode ? t`Edit collection` : t`New collection`}{' '}
          <Loader hidden={uiState !== 'loading'} />
        </h2>
      </header>
      <main>
        <form
          class="collection-add-edit-form"
          onSubmit={(e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const name = formData.get('name')?.trim();
            const description = formData.get('description')?.trim();
            const language = formData.get('language');
            const sensitive = formData.get('sensitive') === 'on';
            const discoverable = formData.get('discoverable') === 'public';
            if (!name) return;

            setUIState('loading');

            (async () => {
              try {
                let result;
                if (editMode) {
                  result = await masto.v1.collections
                    .$select(collection.id)
                    .update({
                      name,
                      ...(description ? { description } : {}),
                      ...(language ? { language } : {}),
                      sensitive,
                      discoverable,
                    });
                } else {
                  result = await masto.v1.collections.create({
                    name,
                    ...(description ? { description } : {}),
                    ...(language ? { language } : {}),
                    sensitive,
                    discoverable,
                  });
                }
                setUIState('default');
                onClose?.({
                  state: 'success',
                  collection: result?.collection || result,
                });
              } catch (e) {
                console.error(e);
                setUIState('error');
                showToast(
                  editMode
                    ? t`Unable to update collection.`
                    : t`Unable to create collection.`,
                );
              }
            })();
          }}
        >
          <div class="collection-form-row">
            <label for="collection-name">
              <Trans>Name</Trans>{' '}
              <grapheme-input>
                <input
                  ref={nameFieldRef}
                  type="text"
                  id="collection-name"
                  name="name"
                  required
                  maxLength={40}
                  disabled={uiState === 'loading'}
                  dir="auto"
                  autoFocus
                />
              </grapheme-input>
            </label>
          </div>
          <div class="collection-form-row">
            <label for="collection-description">
              <Trans>Description</Trans>{' '}
              <grapheme-input>
                <textarea
                  ref={descriptionFieldRef}
                  id="collection-description"
                  name="description"
                  maxLength={100}
                  readOnly={uiState === 'loading'}
                  dir="auto"
                  rows={1}
                />
              </grapheme-input>
            </label>
          </div>
          <div class="collection-toolbar">
            <select
              ref={languageFieldRef}
              id="collection-language"
              name="language"
              disabled={uiState === 'loading'}
            >
              <option value="">
                <Trans>Language</Trans>
              </option>
              <hr />
              {supportedLanguages.map(([code, common, native]) => {
                const commonText = localeCode2Text({
                  code,
                  fallback: common,
                });
                const showCommon = commonText !== native;
                return (
                  <option value={code} key={code}>
                    {showCommon ? `${native} - ${commonText}` : commonText}
                  </option>
                );
              })}
            </select>
            <label class="collection-option">
              <input
                ref={sensitiveFieldRef}
                type="checkbox"
                name="sensitive"
                disabled={uiState === 'loading'}
              />{' '}
              <Trans>Mark as sensitive</Trans>
            </label>
            <select
              name="discoverable"
              defaultValue={
                editMode
                  ? collection.discoverable
                    ? 'public'
                    : 'unlisted'
                  : 'public'
              }
              disabled={uiState === 'loading'}
            >
              <option value="public">
                <Trans>Public</Trans>
              </option>
              <option value="unlisted">
                <Trans>Unlisted</Trans>
              </option>
            </select>
          </div>
          <footer>
            <button type="submit" disabled={uiState === 'loading'}>
              {editMode ? t`Save` : t`Create`}
            </button>
            {editMode && (
              <MenuConfirm
                disabled={uiState === 'loading'}
                align="end"
                menuItemClassName="danger"
                confirmLabel={t`Delete this collection?`}
                onClick={() => {
                  setUIState('loading');

                  (async () => {
                    try {
                      await masto.v1.collections
                        .$select(collection.id)
                        .remove();
                      setUIState('default');
                      onClose?.({
                        state: 'deleted',
                      });
                    } catch (e) {
                      console.error(e);
                      setUIState('error');
                      showToast(t`Unable to delete collection.`);
                    }
                  })();
                }}
              >
                <button
                  type="button"
                  class="light danger"
                  disabled={uiState === 'loading'}
                >
                  <Trans>Delete…</Trans>
                </button>
              </MenuConfirm>
            )}
          </footer>
        </form>
      </main>
    </div>
  );
}

export default CollectionAddEdit;
