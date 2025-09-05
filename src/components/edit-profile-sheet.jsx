import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';

import { api } from '../utils/api';
import states from '../utils/states';

import Icon from './icon';
import Loader from './loader';

const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
const SUPPORTED_IMAGE_FORMATS_STR = SUPPORTED_IMAGE_FORMATS.join(',');

function FieldsAttributesRow({ name, value, disabled, index: i }) {
  const [hasValue, setHasValue] = useState(!!value);
  return (
    <tr>
      <td>
        <input
          type="text"
          name={`fields_attributes[${i}][name]`}
          defaultValue={name}
          disabled={disabled}
          maxLength={255}
          required={hasValue}
          dir="auto"
        />
      </td>
      <td>
        <input
          type="text"
          name={`fields_attributes[${i}][value]`}
          defaultValue={value}
          disabled={disabled}
          maxLength={255}
          onChange={(e) => setHasValue(!!e.currentTarget.value)}
          dir="auto"
        />
      </td>
    </tr>
  );
}

function EditProfileSheet({ onClose = () => {} }) {
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('loading');
  const [account, setAccount] = useState(null);
  const [headerPreview, setHeaderPreview] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const acc = await masto.v1.accounts.verifyCredentials();
        setAccount(acc);
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, []);

  console.log('EditProfileSheet', account);
  const { displayName, source, avatar, header } = account || {};
  const { note, fields } = source || {};
  const fieldsAttributesRef = useRef(null);

  const avatarMediaAttachments = [
    ...(avatar ? [{ type: 'image', url: avatar }] : []),
    ...(avatarPreview ? [{ type: 'image', url: avatarPreview }] : []),
  ];
  const headerMediaAttachments = [
    ...(header ? [{ type: 'image', url: header }] : []),
    ...(headerPreview ? [{ type: 'image', url: headerPreview }] : []),
  ];

  return (
    <div class="sheet" id="edit-profile-container">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <b>
          <Trans>Edit profile</Trans>
        </b>
      </header>
      <main>
        {uiState === 'loading' ? (
          <p class="ui-state">
            <Loader abrupt />
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const header = formData.get('header');
              const avatar = formData.get('avatar');
              const displayName = formData.get('display_name');
              const note = formData.get('note');
              const fieldsAttributesFields =
                fieldsAttributesRef.current.querySelectorAll(
                  'input[name^="fields_attributes"]',
                );
              const fieldsAttributes = [];
              fieldsAttributesFields.forEach((field) => {
                const name = field.name;
                const [_, index, key] =
                  name.match(/fields_attributes\[(\d+)\]\[(.+)\]/) || [];
                const value = field.value ? field.value.trim() : '';
                if (index && key && value) {
                  if (!fieldsAttributes[index]) fieldsAttributes[index] = {};
                  fieldsAttributes[index][key] = value;
                }
              });
              // Fill in the blanks
              fieldsAttributes.forEach((field) => {
                if (field.name && !field.value) {
                  field.value = '';
                }
              });

              (async () => {
                try {
                  const newAccount = await masto.v1.accounts.updateCredentials({
                    header,
                    avatar,
                    displayName,
                    note,
                    fieldsAttributes,
                  });
                  console.log('updated account', newAccount);
                  onClose?.({
                    state: 'success',
                    account: newAccount,
                  });
                } catch (e) {
                  console.error(e);
                  alert(e?.message || t`Unable to update profile.`);
                }
              })();
            }}
          >
            <div class="edit-profile-media-container">
              <label>
                <Trans>Header picture</Trans>{' '}
                <input
                  type="file"
                  name="header"
                  accept={SUPPORTED_IMAGE_FORMATS_STR}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const blob = URL.createObjectURL(file);
                      setHeaderPreview(blob);
                    }
                  }}
                />
              </label>
              <div class="edit-profile-media-field">
                {header ? (
                  <div
                    class="edit-media"
                    tabIndex="0"
                    onClick={() => {
                      states.showMediaModal = {
                        mediaAttachments: headerMediaAttachments,
                        mediaIndex: 0,
                      };
                    }}
                  >
                    <img src={header} alt="" />
                  </div>
                ) : (
                  <div class="edit-media"></div>
                )}
                {headerPreview && (
                  <>
                    <Icon icon="arrow-right" />
                    <div
                      class="edit-media"
                      tabIndex="0"
                      onClick={() => {
                        states.showMediaModal = {
                          mediaAttachments: headerMediaAttachments,
                          mediaIndex: 1,
                        };
                      }}
                    >
                      <img src={headerPreview} alt="" />
                    </div>
                  </>
                )}
              </div>
            </div>
            <div class="edit-profile-media-container">
              <label>
                <Trans>Profile picture</Trans>{' '}
                <input
                  type="file"
                  name="avatar"
                  accept={SUPPORTED_IMAGE_FORMATS_STR}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const blob = URL.createObjectURL(file);
                      setAvatarPreview(blob);
                    }
                  }}
                />
              </label>
              <div class="edit-profile-media-field">
                {avatar ? (
                  <div
                    class="edit-media"
                    tabIndex="0"
                    onClick={() => {
                      states.showMediaModal = {
                        mediaAttachments: avatarMediaAttachments,
                        mediaIndex: 0,
                      };
                    }}
                  >
                    <img src={avatar} alt="" />
                  </div>
                ) : (
                  <div class="edit-media"></div>
                )}
                {avatarPreview && (
                  <>
                    <Icon icon="arrow-right" />
                    <div
                      class="edit-media"
                      tabIndex="0"
                      onClick={() => {
                        states.showMediaModal = {
                          mediaAttachments: avatarMediaAttachments,
                          mediaIndex: 1,
                        };
                      }}
                    >
                      <img src={avatarPreview} alt="" />
                    </div>
                  </>
                )}
              </div>
            </div>
            <p>
              <label>
                <Trans>Name</Trans>{' '}
                <input
                  type="text"
                  name="display_name"
                  defaultValue={displayName}
                  maxLength={30}
                  disabled={uiState === 'loading'}
                  dir="auto"
                />
              </label>
            </p>
            <p>
              <label>
                <Trans>Bio</Trans>
                <textarea
                  defaultValue={note}
                  name="note"
                  maxLength={500}
                  rows="5"
                  disabled={uiState === 'loading'}
                  dir="auto"
                />
              </label>
            </p>
            {/* Table for fields; name and values are in fields, min 4 rows */}
            <p>
              <Trans>Extra fields</Trans>
            </p>
            <table ref={fieldsAttributesRef}>
              <thead>
                <tr>
                  <th>
                    <Trans>Label</Trans>
                  </th>
                  <th>
                    <Trans>Content</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(4, fields.length) }).map(
                  (_, i) => {
                    const { name = '', value = '' } = fields[i] || {};
                    return (
                      <FieldsAttributesRow
                        key={i}
                        name={name}
                        value={value}
                        index={i}
                        disabled={uiState === 'loading'}
                      />
                    );
                  },
                )}
              </tbody>
            </table>
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
              <button type="submit" disabled={uiState === 'loading'}>
                <Trans>Save</Trans>
              </button>
            </footer>
          </form>
        )}
      </main>
    </div>
  );
}

export default EditProfileSheet;
