import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';

import { api } from '../utils/api';
import { addListStore, deleteListStore, updateListStore } from '../utils/lists';
import supports from '../utils/supports';

import Icon from './icon';
import ListExclusiveBadge from './list-exclusive-badge';
import MenuConfirm from './menu-confirm';

function ListAddEdit({ list, onClose }) {
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const editMode = !!list;
  const nameFieldRef = useRef();
  const repliesPolicyFieldRef = useRef();
  const exclusiveFieldRef = useRef();
  useEffect(() => {
    if (editMode) {
      nameFieldRef.current.value = list.title;
      repliesPolicyFieldRef.current.value = list.repliesPolicy;
      if (exclusiveFieldRef.current) {
        exclusiveFieldRef.current.checked = list.exclusive;
      }
    }
  }, [editMode]);
  const supportsExclusive =
    supports('@mastodon/list-exclusive') ||
    supports('@gotosocial/list-exclusive');

  return (
    <div class="sheet">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}{' '}
      <header>
        <h2>{editMode ? t`Edit list` : t`New list`}</h2>
      </header>
      <main>
        <form
          class="list-form"
          onSubmit={(e) => {
            e.preventDefault(); // Get form values

            const formData = new FormData(e.target);
            const title = formData.get('title');
            const repliesPolicy = formData.get('replies_policy');
            const exclusive = formData.get('exclusive') === 'on';
            console.log({
              title,
              repliesPolicy,
              exclusive,
            });
            setUIState('loading');

            (async () => {
              try {
                let listResult;

                if (editMode) {
                  listResult = await masto.v1.lists.$select(list.id).update({
                    title,
                    replies_policy: repliesPolicy,
                    exclusive,
                  });
                } else {
                  listResult = await masto.v1.lists.create({
                    title,
                    replies_policy: repliesPolicy,
                    exclusive,
                  });
                }

                console.log(listResult);
                setUIState('default');
                onClose?.({
                  state: 'success',
                  list: listResult,
                });

                setTimeout(() => {
                  if (editMode) {
                    updateListStore(listResult);
                  } else {
                    addListStore(listResult);
                  }
                }, 1);
              } catch (e) {
                console.error(e);
                setUIState('error');
                alert(
                  editMode
                    ? t`Unable to edit list.`
                    : t`Unable to create list.`,
                );
              }
            })();
          }}
        >
          <div class="list-form-row">
            <label for="list-title">
              <Trans>Name</Trans>{' '}
              <input
                ref={nameFieldRef}
                type="text"
                id="list-title"
                name="title"
                required
                disabled={uiState === 'loading'}
                dir="auto"
              />
            </label>
          </div>
          <div class="list-form-row">
            <select
              ref={repliesPolicyFieldRef}
              name="replies_policy"
              required
              disabled={uiState === 'loading'}
            >
              <option value="list">
                <Trans>Show replies to list members</Trans>
              </option>
              <option value="followed">
                <Trans>Show replies to people I follow</Trans>
              </option>
              <option value="none">
                <Trans>Don't show replies</Trans>
              </option>
            </select>
          </div>
          {supportsExclusive && (
            <div class="list-form-row">
              <label class="label-block">
                <input
                  ref={exclusiveFieldRef}
                  type="checkbox"
                  name="exclusive"
                  disabled={uiState === 'loading'}
                />{' '}
                <ListExclusiveBadge insignificant />{' '}
                <Trans>Hide posts on this list from Home/Following</Trans>
              </label>
            </div>
          )}
          <div class="list-form-footer">
            <button type="submit" disabled={uiState === 'loading'}>
              {editMode ? t`Save` : t`Create`}
            </button>
            {editMode && (
              <MenuConfirm
                disabled={uiState === 'loading'}
                align="end"
                menuItemClassName="danger"
                confirmLabel={t`Delete this list?`}
                onClick={() => {
                  // const yes = confirm('Delete this list?');
                  // if (!yes) return;
                  setUIState('loading');

                  (async () => {
                    try {
                      await masto.v1.lists.$select(list.id).remove();
                      setUIState('default');
                      onClose?.({
                        state: 'deleted',
                      });
                      setTimeout(() => {
                        deleteListStore(list.id);
                      }, 1);
                    } catch (e) {
                      console.error(e);
                      setUIState('error');
                      alert(t`Unable to delete list.`);
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
          </div>
        </form>
      </main>
    </div>
  );
}

export default ListAddEdit;
