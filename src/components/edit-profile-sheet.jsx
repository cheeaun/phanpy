import './grapheme-input.js';

import { Trans, useLingui } from '@lingui/react/macro';
import { MenuItem, MenuDivider } from '@szhsin/react-menu';
import { useEffect, useState } from 'preact/hooks';

import Menu2 from '../components/menu2';
import { api } from '../utils/api';
import showToast from '../utils/show-toast';
import states from '../utils/states';
import {
  getAPIVersions,
  getCurrentInstanceConfiguration,
} from '../utils/store-utils';

import Icon from './icon';
import Loader from './loader';
import MenuConfirm from './menu-confirm';

let _fieldKeyCounter = 0;
function nextFieldKey() {
  return ++_fieldKeyCounter;
}

const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
const SUPPORTED_IMAGE_FORMATS_STR = SUPPORTED_IMAGE_FORMATS.join(',');

function FieldsAttributesRow({
  defaultName,
  defaultValue,
  disabled,
  index: i,
  nameMaxLength = 255,
  valueMaxLength = 255,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}) {
  const { t } = useLingui();

  return (
    <tr>
      <td>
        <grapheme-input>
          <input
            type="text"
            name={`fields_attributes[${i}][name]`}
            defaultValue={defaultName}
            disabled={disabled}
            maxLength={nameMaxLength}
            required
            dir="auto"
            enterKeyHint="next"
          />
        </grapheme-input>
      </td>
      <td>
        <grapheme-input>
          <input
            type="text"
            name={`fields_attributes[${i}][value]`}
            defaultValue={defaultValue}
            disabled={disabled}
            maxLength={valueMaxLength}
            required
            dir="auto"
            enterKeyHint="done"
          />
        </grapheme-input>
      </td>
      <td style={{ width: 36 }}>
        <Menu2
          align="end"
          menuButton={
            <button
              type="button"
              class="plain4 small more-button"
              disabled={disabled}
            >
              <Icon icon="more" size="l" alt={t`More`} />
            </button>
          }
        >
          <MenuItem disabled={!canMoveUp} onClick={onMoveUp}>
            <Icon icon="arrow-up" />{' '}
            <span>
              <Trans>Move up</Trans>
            </span>
          </MenuItem>
          <MenuItem disabled={!canMoveDown} onClick={onMoveDown}>
            <Icon icon="arrow-down" />{' '}
            <span>
              <Trans>Move down</Trans>
            </span>
          </MenuItem>
          <MenuDivider />
          {defaultName.trim() === '' && defaultValue.trim() === '' ? (
            <MenuItem menuItemClassName="danger" onClick={onDelete}>
              <Icon icon="trash" />{' '}
              <span>
                <Trans>Delete…</Trans>
              </span>
            </MenuItem>
          ) : (
            <MenuConfirm
              subMenu
              menuItemClassName="danger"
              confirmLabel={<Trans>Delete this field?</Trans>}
              onClick={onDelete}
            >
              <Icon icon="trash" size="s" />{' '}
              <span>
                <Trans>Delete…</Trans>
              </span>
            </MenuConfirm>
          )}
        </Menu2>
      </td>
    </tr>
  );
}

function EditProfileSheet({ onClose = () => {} }) {
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('start');
  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [headerPreview, setHeaderPreview] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [fieldsList, setFieldsList] = useState([]);

  const isUsingProfileAPI = !!profile;

  const configuration = getCurrentInstanceConfiguration();
  const {
    accounts: {
      maxDisplayNameLength,
      maxNoteLength,
      maxProfileFields,
      profileFieldNameLimit,
      profileFieldValueLimit,
      maxAvatarDescriptionLength,
      maxHeaderDescriptionLength,
    } = {},
  } = configuration || {};

  useEffect(() => {
    (async () => {
      try {
        const profileAPIEnabled = getAPIVersions()?.mastodon >= 9;
        if (profileAPIEnabled) {
          try {
            const prof = await masto.v1.profile.fetch();
            setProfile(prof);
            setFieldsList(
              (prof?.fields || []).map((f) => ({ ...f, _key: nextFieldKey() })),
            );
            setUIState('default');
            return;
          } catch (e) {
            console.error('Failed to fetch profile via Profile API', e);
          }
        }
        const acc = await masto.v1.accounts.verifyCredentials();
        setAccount(acc);
        setFieldsList(
          (acc?.source?.fields || []).map((f) => ({
            ...f,
            _key: nextFieldKey(),
          })),
        );
        setUIState('default');
      } catch (e) {
        console.error(e);
        setUIState('error');
      }
    })();
  }, []);

  console.log('EditProfileSheet', account, profile);

  const sourceData = profile ?? account?.source;
  const { note } = sourceData || {};
  const currentProfile = profile ?? account;
  const {
    avatarDescription = '',
    headerDescription = '',
    displayName = '',
    avatar = '',
    header = '',
  } = currentProfile || {};

  const avatarMediaAttachments = [
    ...(avatar ? [{ type: 'image', url: avatar }] : []),
    ...(avatarPreview ? [{ type: 'image', url: avatarPreview }] : []),
  ];
  const headerMediaAttachments = [
    ...(header ? [{ type: 'image', url: header }] : []),
    ...(headerPreview ? [{ type: 'image', url: headerPreview }] : []),
  ];

  const handleDeleteAvatar = async () => {
    if (!profile) return;
    setUIState('loading');
    try {
      await masto.v1.profile.avatar.remove();
      masto.v1.profile
        .update({
          avatarDescription: '',
        })
        .catch(() => {});
      setUIState('default');
      onClose?.({ state: 'success' });
    } catch (e) {
      setUIState('error');
      console.error(e);
      showToast(t`Unable to remove profile picture.`);
      setUIState('default');
    }
  };

  const handleDeleteHeader = async () => {
    if (!profile) return;
    setUIState('loading');
    try {
      await masto.v1.profile.header.remove();
      masto.v1.profile
        .update({
          headerDescription: '',
        })
        .catch(() => {});
      setUIState('default');
      onClose?.({ state: 'success' });
    } catch (e) {
      setUIState('error');
      console.error(e);
      showToast(t`Unable to remove header picture.`);
      setUIState('default');
    }
  };

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (headerPreview) URL.revokeObjectURL(headerPreview);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [headerPreview, avatarPreview]);

  return (
    <div class="sheet" id="edit-profile-container">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Edit profile</Trans> <Loader hidden={uiState !== 'loading'} />
        </h2>
      </header>
      <main>
        {uiState === 'start' ? (
          <p class="ui-state">
            <Loader abrupt />
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const headerFile = formData.get('header');
              const avatarFile = formData.get('avatar');
              const displayName = formData.get('display_name');
              const note = formData.get('note');

              if (isUsingProfileAPI) {
                const avatarDesc = formData.get('avatar_description');
                const headerDesc = formData.get('header_description');
                const hasAvatarNoDesc =
                  (!!avatar || !!avatarPreview) && !avatarDesc?.trim();
                const hasHeaderNoDesc =
                  (!!header || !!headerPreview) && !headerDesc?.trim();

                if (hasAvatarNoDesc && hasHeaderNoDesc) {
                  if (
                    !confirm(
                      t`Profile and header pictures have no descriptions. Continue?`,
                    )
                  ) {
                    return;
                  }
                } else if (hasAvatarNoDesc) {
                  if (
                    !confirm(t`Profile picture has no description. Continue?`)
                  ) {
                    return;
                  }
                } else if (hasHeaderNoDesc) {
                  if (
                    !confirm(t`Header picture has no description. Continue?`)
                  ) {
                    return;
                  }
                }
              }
              const maxFields = maxProfileFields || 4;
              const completeFieldsAttributes = [];
              for (let idx = 0; idx < maxFields; idx++) {
                const name = formData
                  .get(`fields_attributes[${idx}][name]`)
                  ?.trim();
                const value = formData
                  .get(`fields_attributes[${idx}][value]`)
                  ?.trim();
                if (name && value) {
                  completeFieldsAttributes.push({ name, value });
                }
              }

              (async () => {
                setUIState('loading');
                try {
                  let resultAccount;
                  if (isUsingProfileAPI) {
                    const avatarDesc = formData.get('avatar_description');
                    const headerDesc = formData.get('header_description');

                    const fieldsAttributes = {};
                    completeFieldsAttributes.forEach((field, i) => {
                      fieldsAttributes[i] = field;
                    });
                    const updateParams = {
                      displayName,
                      note,
                      fieldsAttributes,
                    };
                    if (avatarDesc) updateParams.avatarDescription = avatarDesc;
                    if (headerDesc) updateParams.headerDescription = headerDesc;
                    if (avatarFile?.size) updateParams.avatar = avatarFile;
                    if (headerFile?.size) updateParams.header = headerFile;
                    const updatedProfile =
                      await masto.v1.profile.update(updateParams);

                    console.log('updated profile', updatedProfile);
                  } else {
                    resultAccount = await masto.v1.accounts.updateCredentials({
                      header: headerFile,
                      avatar: avatarFile,
                      displayName,
                      note,
                      fieldsAttributes: completeFieldsAttributes,
                    });
                  }
                  setUIState('default');
                  onClose?.({
                    state: 'success',
                    account: resultAccount,
                  });
                } catch (e) {
                  setUIState('error');
                  console.error(e);
                  alert(e?.message || t`Unable to update profile.`);
                  setUIState('default');
                }
              })();
            }}
            onReset={() => {
              if (headerPreview) {
                URL.revokeObjectURL(headerPreview);
                setHeaderPreview(null);
              }
              if (avatarPreview) {
                URL.revokeObjectURL(avatarPreview);
                setAvatarPreview(null);
              }
            }}
          >
            <fieldset class="edit-profile-media-container">
              <legend>
                <Trans>Header picture</Trans>
              </legend>
              <input
                type="file"
                name="header"
                accept={SUPPORTED_IMAGE_FORMATS_STR}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    if (headerPreview) {
                      URL.revokeObjectURL(headerPreview);
                    }
                    const blob = URL.createObjectURL(file);
                    setHeaderPreview(blob);
                  }
                }}
              />
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
                    <img src={header} alt={headerDescription || ''} />
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
              {isUsingProfileAPI && (!!header || !!headerPreview) && (
                <p>
                  <label>
                    <Trans>Image description</Trans>{' '}
                    <grapheme-input>
                      <textarea
                        name="header_description"
                        defaultValue={headerDescription}
                        disabled={uiState === 'loading'}
                        maxLength={maxHeaderDescriptionLength || 150}
                        rows="2"
                        dir="auto"
                      />
                    </grapheme-input>
                  </label>
                </p>
              )}
              {isUsingProfileAPI && !!header && (
                <div class="footer">
                  <div class="spacer" />
                  <MenuConfirm
                    confirmLabel={<Trans>Remove header picture?</Trans>}
                    menuItemClassName="danger"
                    align="end"
                    disabled={uiState === 'loading'}
                    onClick={handleDeleteHeader}
                  >
                    <button
                      type="button"
                      class="light danger"
                      disabled={uiState === 'loading'}
                    >
                      <Trans>Remove…</Trans>
                    </button>
                  </MenuConfirm>
                </div>
              )}
            </fieldset>
            <fieldset class="edit-profile-media-container">
              <legend>
                <Trans>Profile picture</Trans>
              </legend>
              <input
                type="file"
                name="avatar"
                accept={SUPPORTED_IMAGE_FORMATS_STR}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    if (avatarPreview) {
                      URL.revokeObjectURL(avatarPreview);
                    }
                    const blob = URL.createObjectURL(file);
                    setAvatarPreview(blob);
                  }
                }}
              />
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
                    <img src={avatar} alt={avatarDescription || ''} />
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
              {isUsingProfileAPI && (!!avatar || !!avatarPreview) && (
                <p>
                  <label>
                    <Trans>Image description</Trans>{' '}
                    <grapheme-input>
                      <textarea
                        name="avatar_description"
                        defaultValue={avatarDescription}
                        disabled={uiState === 'loading'}
                        maxLength={maxAvatarDescriptionLength || 150}
                        rows="2"
                        dir="auto"
                      />
                    </grapheme-input>
                  </label>
                </p>
              )}
              {isUsingProfileAPI && !!avatar && (
                <div class="footer">
                  <div class="spacer" />
                  <MenuConfirm
                    confirmLabel={<Trans>Remove profile picture?</Trans>}
                    menuItemClassName="danger"
                    align="end"
                    disabled={uiState === 'loading'}
                    onClick={handleDeleteAvatar}
                  >
                    <button
                      type="button"
                      class="light danger"
                      disabled={uiState === 'loading'}
                    >
                      <Trans>Remove…</Trans>
                    </button>
                  </MenuConfirm>
                </div>
              )}
            </fieldset>
            <fieldset>
              <p>
                <label>
                  <Trans>Name</Trans>{' '}
                  <grapheme-input>
                    <input
                      type="text"
                      name="display_name"
                      defaultValue={displayName}
                      maxLength={maxDisplayNameLength || 30}
                      disabled={uiState === 'loading'}
                      dir="auto"
                      enterKeyHint="done"
                    />
                  </grapheme-input>
                </label>
              </p>
              <p>
                <label>
                  <Trans>Bio</Trans>
                  <grapheme-input>
                    <textarea
                      defaultValue={note}
                      name="note"
                      maxLength={maxNoteLength || 500}
                      rows="5"
                      disabled={uiState === 'loading'}
                      dir="auto"
                    />
                  </grapheme-input>
                </label>
              </p>
            </fieldset>
            {/* Table for fields; name and values are in fields, min 4 rows */}
            <fieldset>
              <legend>
                <Trans>Custom fields</Trans>
              </legend>
              <table>
                <thead>
                  <tr>
                    <th>
                      <Trans>Label</Trans>
                    </th>
                    <th>
                      <Trans>Content</Trans>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {fieldsList.map((field, i) => {
                    const { name = '', value = '' } = field;
                    return (
                      <FieldsAttributesRow
                        key={field._key}
                        defaultName={name}
                        defaultValue={value}
                        index={i}
                        disabled={uiState === 'loading'}
                        nameMaxLength={profileFieldNameLimit || 255}
                        valueMaxLength={profileFieldValueLimit || 255}
                        onDelete={() => {
                          setFieldsList(
                            fieldsList.filter((_, idx) => idx !== i),
                          );
                        }}
                        onMoveUp={() => {
                          if (i > 0) {
                            const newList = [...fieldsList];
                            [newList[i - 1], newList[i]] = [
                              newList[i],
                              newList[i - 1],
                            ];
                            setFieldsList(newList);
                          }
                        }}
                        onMoveDown={() => {
                          if (i < fieldsList.length - 1) {
                            const newList = [...fieldsList];
                            [newList[i], newList[i + 1]] = [
                              newList[i + 1],
                              newList[i],
                            ];
                            setFieldsList(newList);
                          }
                        }}
                        canMoveUp={i > 0}
                        canMoveDown={i < fieldsList.length - 1}
                      />
                    );
                  })}
                </tbody>
              </table>
              {fieldsList.length < (maxProfileFields || 4) && (
                <p>
                  <button
                    type="button"
                    class="light"
                    disabled={uiState === 'loading'}
                    onClick={() => {
                      setFieldsList([
                        ...fieldsList,
                        { name: '', value: '', _key: nextFieldKey() },
                      ]);
                    }}
                  >
                    <Trans>Add field</Trans>
                  </button>
                </p>
              )}
            </fieldset>
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
