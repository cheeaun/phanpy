import { Trans } from '@lingui/react/macro';
import { useEffect, useRef, useState } from 'preact/hooks';

import { api } from '../utils/api';
import { fetchRelationships } from '../utils/relationships';
import supports from '../utils/supports';

import AccountBlock from './account-block';
import Loader from './loader';

const ENDORSEMENTS_LIMIT = 80;

function Endorsements({
  accountID: id,
  info,
  open = false,
  onlyOpenIfHasEndorsements = false,
}) {
  const { masto } = api();
  const endorsementsContainer = useRef();
  const [endorsementsUIState, setEndorsementsUIState] = useState('default');
  const [endorsements, setEndorsements] = useState([]);
  const [relationshipsMap, setRelationshipsMap] = useState({});
  useEffect(() => {
    if (!supports('@mastodon/endorsements')) return;
    if (!open) return;
    (async () => {
      setEndorsementsUIState('loading');
      try {
        const accounts = await masto.v1.accounts.$select(id).endorsements.list({
          limit: ENDORSEMENTS_LIMIT,
        });
        console.log({ endorsements: accounts });
        if (!accounts.length) {
          setEndorsementsUIState('default');
          return;
        }
        setEndorsements(accounts);
        setEndorsementsUIState('default');
        setTimeout(() => {
          endorsementsContainer.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }, 300);

        const relationships = await fetchRelationships(
          accounts,
          relationshipsMap,
        );
        if (relationships) {
          setRelationshipsMap(relationships);
        }
      } catch (e) {
        console.error(e);
        setEndorsementsUIState('error');
      }
    })();
  }, [open, id]);

  const reallyOpen = onlyOpenIfHasEndorsements
    ? open && endorsements.length > 0
    : open;

  if (!reallyOpen) return null;

  return (
    <div class="shazam-container">
      <div class="shazam-container-inner">
        <div class="endorsements-container" ref={endorsementsContainer}>
          <h3>
            <Trans>Profiles featured by @{info.username}</Trans>
          </h3>
          {endorsementsUIState === 'loading' ? (
            <p class="ui-state">
              <Loader abrupt />
            </p>
          ) : endorsements.length > 0 ? (
            <ul
              class={`endorsements ${
                endorsements.length > 10 ? 'expanded' : ''
              }`}
            >
              {endorsements.map((account) => (
                <li>
                  <AccountBlock
                    key={account.id}
                    account={account}
                    showStats
                    avatarSize="xxl"
                    relationship={relationshipsMap[account.id]}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p class="ui-state insignificant">
              <Trans>No featured profiles.</Trans>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Endorsements;
