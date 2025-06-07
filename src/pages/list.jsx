import './lists.css';

import { Trans, useLingui } from '@lingui/react/macro';
import { Menu, MenuDivider, MenuHeader, MenuItem } from '@szhsin/react-menu';
import { useEffect, useRef, useState } from 'preact/hooks';
import { InView } from 'react-intersection-observer';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';

import AccountBlock from '../components/account-block';
import Icon from '../components/icon';
import ListAddEdit from '../components/list-add-edit';
import ListExclusiveBadge from '../components/list-exclusive-badge';
import MenuConfirm from '../components/menu-confirm';
import MenuLink from '../components/menu-link';
import Menu2 from '../components/menu2';
import Modal from '../components/modal';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { filteredItems } from '../utils/filters';
import { getList, getLists } from '../utils/lists';
import states, { saveStatus } from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;

function List(props) {
  const { t } = useLingui();
  const snapStates = useSnapshot(states);
  const { masto, instance } = api();
  const id = props?.id || useParams()?.id;
  // const navigate = useNavigate();
  const latestItem = useRef();
  // const [reloadCount, reload] = useReducer((c) => c + 1, 0);

  const listIterator = useRef();
  async function fetchList(firstLoad) {
    if (firstLoad || !listIterator.current) {
      listIterator.current = masto.v1.timelines.list
        .$select(id)
        .list({
          limit: LIMIT,
        })
        .values();
    }
    const results = await listIterator.current.next();
    let { value } = results;
    if (value?.length) {
      if (firstLoad) {
        latestItem.current = value[0].id;
      }

      // value = filteredItems(value, 'home');
      value.forEach((item) => {
        saveStatus(item, instance);
      });
    }
    return {
      ...results,
      value,
    };
  }

  async function checkForUpdates() {
    try {
      const results = await masto.v1.timelines.list.$select(id).list({
        limit: 1,
        since_id: latestItem.current,
      });
      let { value } = results;
      const valueContainsLatestItem = value[0]?.id === latestItem.current; // since_id might not be supported
      if (value?.length && !valueContainsLatestItem) {
        value = filteredItems(value, 'home');
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  const [lists, setLists] = useState([]);

  const [list, setList] = useState({ title: 'List' });
  // const [title, setTitle] = useState(`List`);
  useTitle(list.title, `/l/:id`);
  useEffect(() => {
    (async () => {
      try {
        const list = await getList(id);
        setList(list);
        // setTitle(list.title);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [id]);

  const [showListAddEditModal, setShowListAddEditModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);

  return (
    <>
      <Timeline
        key={id}
        title={list.title}
        id="list"
        emptyText={t`Nothing yet.`}
        errorText={t`Unable to load posts.`}
        instance={instance}
        fetchItems={fetchList}
        checkForUpdates={checkForUpdates}
        useItemID
        boostsCarousel={snapStates.settings.boostsCarousel}
        // allowFilters
        filterContext="home"
        showReplyParent
        // refresh={reloadCount}
        headerStart={
          // <Link to="/l" class="button plain">
          //   <Icon icon="list" size="l" />
          // </Link>
          <Menu2
            overflow="auto"
            menuButton={
              <button type="button" class="plain">
                <Icon icon="list" size="l" alt={t`Lists`} />
                <Icon icon="chevron-down" size="s" />
              </button>
            }
            onMenuChange={(e) => {
              if (e.open) {
                getLists().then(setLists);
              }
            }}
          >
            <MenuLink to="/l">
              <span>
                <Trans>All Lists</Trans>
              </span>
            </MenuLink>
            {lists?.length > 0 && (
              <>
                <MenuDivider />
                {lists.map((list) => (
                  <MenuLink key={list.id} to={`/l/${list.id}`}>
                    <span>
                      {list.title}
                      {list.exclusive && (
                        <>
                          {' '}
                          <ListExclusiveBadge />
                        </>
                      )}
                    </span>
                  </MenuLink>
                ))}
              </>
            )}
          </Menu2>
        }
        headerEnd={
          <Menu2
            portal
            setDownOverflow
            overflow="auto"
            viewScroll="close"
            position="anchor"
            menuButton={
              <button type="button" class="plain">
                <Icon icon="more" size="l" alt={t`More`} />
              </button>
            }
          >
            {list?.exclusive && (
              <>
                <MenuHeader className="plain">
                  <ListExclusiveBadge />{' '}
                  <Trans>
                    Posts on this list are hidden from Home/Following
                  </Trans>
                </MenuHeader>
                <MenuDivider />
              </>
            )}
            <MenuItem
              onClick={() =>
                setShowListAddEditModal({
                  list,
                })
              }
            >
              <Icon icon="pencil" size="l" />
              <span>
                <Trans>Edit</Trans>
              </span>
            </MenuItem>
            <MenuItem onClick={() => setShowManageMembersModal(true)}>
              <Icon icon="group" size="l" />
              <span>
                <Trans>Manage members</Trans>
              </span>
            </MenuItem>
          </Menu2>
        }
      />
      {showListAddEditModal && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowListAddEditModal(false);
            }
          }}
        >
          <ListAddEdit
            list={showListAddEditModal?.list}
            onClose={(result) => {
              if (result.state === 'success' && result.list) {
                setList(result.list);
                // reload();
              } else if (result.state === 'deleted') {
                // navigate('/l');
                location.hash = '/l';
              }
              setShowListAddEditModal(false);
            }}
          />
        </Modal>
      )}
      {showManageMembersModal && (
        <Modal
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowManageMembersModal(false);
            }
          }}
        >
          <ListManageMembers
            listID={id}
            onClose={() => setShowManageMembersModal(false)}
          />
        </Modal>
      )}
    </>
  );
}

const MEMBERS_LIMIT = 40;

function ListManageMembers({ listID, onClose }) {
  const { t } = useLingui();
  // Show list of members with [Remove] button
  // API only returns 40 members at a time, so this need to be paginated with infinite scroll
  // Show [Add] button after removing a member
  const { masto, instance } = api();
  const [members, setMembers] = useState([]);
  const [uiState, setUIState] = useState('default');
  const [showMore, setShowMore] = useState(false);

  const membersIterator = useRef();

  async function fetchMembers(firstLoad) {
    setShowMore(false);
    setUIState('loading');
    (async () => {
      try {
        if (firstLoad || !membersIterator.current) {
          membersIterator.current = masto.v1.lists
            .$select(listID)
            .accounts.list({
              limit: MEMBERS_LIMIT,
            })
            .values();
        }
        const results = await membersIterator.current.next();
        let { done, value } = results;
        if (value?.length) {
          if (firstLoad) {
            setMembers(value);
          } else {
            setMembers(members.concat(value));
          }
          setShowMore(!done);
        } else {
          setShowMore(false);
        }
        setUIState('default');
      } catch (e) {
        setUIState('error');
      }
    })();
  }

  useEffect(() => {
    fetchMembers(true);
  }, []);

  return (
    <div class="sheet" id="list-manage-members-container">
      {!!onClose && (
        <button type="button" class="sheet-close" onClick={onClose}>
          <Icon icon="x" alt={t`Close`} />
        </button>
      )}
      <header>
        <h2>
          <Trans>Manage members</Trans>
        </h2>
      </header>
      <main>
        <ul>
          {members.map((member) => (
            <li key={member.id}>
              <AccountBlock account={member} instance={instance} />
              <RemoveAddButton account={member} listID={listID} />
            </li>
          ))}
          {showMore && uiState === 'default' && (
            <InView as="li" onChange={(inView) => inView && fetchMembers()}>
              <button type="button" class="light block" onClick={fetchMembers}>
                <Trans>Show more…</Trans>
              </button>
            </InView>
          )}
        </ul>
      </main>
    </div>
  );
}

function RemoveAddButton({ account, listID }) {
  const { t } = useLingui();
  const { masto } = api();
  const [uiState, setUIState] = useState('default');
  const [removed, setRemoved] = useState(false);

  return (
    <MenuConfirm
      confirm={!removed}
      confirmLabel={
        <span>
          <Trans>
            Remove <span class="bidi-isolate">@{account.username}</span> from
            list?
          </Trans>
        </span>
      }
      align="end"
      menuItemClassName="danger"
      onClick={() => {
        if (removed) {
          setUIState('loading');
          (async () => {
            try {
              await masto.v1.lists.$select(listID).accounts.create({
                accountIds: [account.id],
              });
              setUIState('default');
              setRemoved(false);
            } catch (e) {
              setUIState('error');
            }
          })();
        } else {
          // const yes = confirm(`Remove ${account.username} from this list?`);
          // if (!yes) return;
          setUIState('loading');

          (async () => {
            try {
              await masto.v1.lists.$select(listID).accounts.remove({
                accountIds: [account.id],
              });
              setUIState('default');
              setRemoved(true);
            } catch (e) {
              setUIState('error');
            }
          })();
        }
      }}
    >
      <button
        type="button"
        class={`light ${removed ? '' : 'danger'}`}
        disabled={uiState === 'loading'}
      >
        {removed ? t`Add` : t`Remove…`}
      </button>
    </MenuConfirm>
  );
}

export default List;
