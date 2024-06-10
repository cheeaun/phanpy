import { useEffect } from 'preact/hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { subscribe, useSnapshot } from 'valtio';

import Accounts from '../pages/accounts';
import Settings from '../pages/settings';
import focusDeck from '../utils/focus-deck';
import showToast from '../utils/show-toast';
import states from '../utils/states';

import AccountSheet from './account-sheet';
import ComposeSuspense, { preload } from './compose-suspense';
import Drafts from './drafts';
import EmbedModal from './embed-modal';
import GenericAccounts from './generic-accounts';
import MediaAltModal from './media-alt-modal';
import MediaModal from './media-modal';
import Modal from './modal';
import ReportModal from './report-modal';
import ShortcutsSettings from './shortcuts-settings';

subscribe(states, (changes) => {
  for (const [action, path, value, prevValue] of changes) {
    // When closing modal, focus on deck
    if (/^show/i.test(path) && !value) {
      focusDeck();
    }
  }
});

export default function Modals() {
  const snapStates = useSnapshot(states);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setTimeout(preload, 1000);
  }, []);

  return (
    <>
      {!!snapStates.showCompose && (
        <Modal
          class={`solid ${snapStates.composerState.minimized ? 'min' : ''}`}
          minimized={!!snapStates.composerState.minimized}
        >
          <ComposeSuspense
            replyToStatus={
              typeof snapStates.showCompose !== 'boolean'
                ? snapStates.showCompose.replyToStatus
                : window.__COMPOSE__?.replyToStatus || null
            }
            editStatus={
              states.showCompose?.editStatus ||
              window.__COMPOSE__?.editStatus ||
              null
            }
            draftStatus={
              states.showCompose?.draftStatus ||
              window.__COMPOSE__?.draftStatus ||
              null
            }
            onClose={(results) => {
              const { newStatus, instance, type } = results || {};
              states.showCompose = false;
              window.__COMPOSE__ = null;
              if (newStatus) {
                states.reloadStatusPage++;
                showToast({
                  text: {
                    post: 'Post published. Check it out.',
                    reply: 'Reply posted. Check it out.',
                    edit: 'Post updated. Check it out.',
                  }[type || 'post'],
                  delay: 1000,
                  duration: 10_000, // 10 seconds
                  onClick: (toast) => {
                    toast.hideToast();
                    states.prevLocation = location;
                    navigate(
                      instance
                        ? `/${instance}/s/${newStatus.id}`
                        : `/s/${newStatus.id}`,
                    );
                  },
                });
              }
            }}
          />
        </Modal>
      )}
      {!!snapStates.showSettings && (
        <Modal
          onClose={() => {
            states.showSettings = false;
          }}
        >
          <Settings
            onClose={() => {
              states.showSettings = false;
            }}
          />
        </Modal>
      )}
      {!!snapStates.showAccounts && (
        <Modal
          onClose={() => {
            states.showAccounts = false;
          }}
        >
          <Accounts
            onClose={() => {
              states.showAccounts = false;
            }}
          />
        </Modal>
      )}
      {!!snapStates.showAccount && (
        <Modal
          onClose={() => {
            states.showAccount = false;
          }}
        >
          <AccountSheet
            account={snapStates.showAccount?.account || snapStates.showAccount}
            instance={snapStates.showAccount?.instance}
            onClose={({ destination } = {}) => {
              states.showAccount = false;
              // states.showGenericAccounts = false;
              // if (destination) {
              //   states.showAccounts = false;
              // }
            }}
          />
        </Modal>
      )}
      {!!snapStates.showDrafts && (
        <Modal
          onClose={() => {
            states.showDrafts = false;
          }}
        >
          <Drafts onClose={() => (states.showDrafts = false)} />
        </Modal>
      )}
      {!!snapStates.showMediaModal && (
        <Modal
          onClick={(e) => {
            if (
              e.target === e.currentTarget ||
              e.target.classList.contains('media')
            ) {
              states.showMediaModal = false;
            }
          }}
        >
          <MediaModal
            mediaAttachments={snapStates.showMediaModal.mediaAttachments}
            instance={snapStates.showMediaModal.instance}
            index={snapStates.showMediaModal.index}
            statusID={snapStates.showMediaModal.statusID}
            onClose={() => {
              states.showMediaModal = false;
            }}
          />
        </Modal>
      )}
      {!!snapStates.showShortcutsSettings && (
        <Modal
          onClose={() => {
            states.showShortcutsSettings = false;
          }}
        >
          <ShortcutsSettings
            onClose={() => (states.showShortcutsSettings = false)}
          />
        </Modal>
      )}
      {!!snapStates.showGenericAccounts && (
        <Modal
          onClose={() => {
            states.showGenericAccounts = false;
          }}
        >
          <GenericAccounts
            instance={snapStates.showGenericAccounts.instance}
            excludeRelationshipAttrs={
              snapStates.showGenericAccounts.excludeRelationshipAttrs
            }
            postID={snapStates.showGenericAccounts.postID}
            onClose={() => (states.showGenericAccounts = false)}
            blankCopy={snapStates.showGenericAccounts.blankCopy}
          />
        </Modal>
      )}
      {!!snapStates.showMediaAlt && (
        <Modal
          onClose={(e) => {
            states.showMediaAlt = false;
          }}
        >
          <MediaAltModal
            alt={snapStates.showMediaAlt.alt || snapStates.showMediaAlt}
            lang={snapStates.showMediaAlt?.lang}
            onClose={() => {
              states.showMediaAlt = false;
            }}
          />
        </Modal>
      )}
      {!!snapStates.showEmbedModal && (
        <Modal
          class="solid"
          onClose={() => {
            states.showEmbedModal = false;
          }}
        >
          <EmbedModal
            html={snapStates.showEmbedModal.html}
            url={snapStates.showEmbedModal.url}
            width={snapStates.showEmbedModal.width}
            height={snapStates.showEmbedModal.height}
            onClose={() => {
              states.showEmbedModal = false;
            }}
          />
        </Modal>
      )}
      {!!snapStates.showReportModal && (
        <Modal
          onClose={() => {
            states.showReportModal = false;
          }}
        >
          <ReportModal
            account={snapStates.showReportModal.account}
            post={snapStates.showReportModal.post}
            onClose={() => {
              states.showReportModal = false;
            }}
          />
        </Modal>
      )}
    </>
  );
}
