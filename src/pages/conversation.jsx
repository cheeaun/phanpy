import './conversation.css';

import { useMemo, useRef, useState, useEffect } from 'preact/hooks';
import { useParams } from 'react-router-dom';
import { useSnapshot } from 'valtio';
import pRetry from 'p-retry';

import Link from '../components/link';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import states, { saveStatus, getStatus, statusKey, threadifyStatus } from '../utils/states';
import useTitle from '../utils/useTitle';
import htmlContentLength from '../utils/html-content-length';
import AccountBlock from '../components/account-block';

const LIMIT = 20;
const emptySearchParams = new URLSearchParams();
const cachedStatusesMap = {};

function Conversation(props) {
  const { masto, instance } = api();
  const [stateType, setStateType] = useState(null);
  const [participants, setParticipants] = useState();
  const id = props?.id || useParams()?.id;
  const snapStates = useSnapshot(states);
  useTitle(`Conversation`, '/c/:id');
  const [statuses, setStatuses] = useState([]);

  async function getThreadForId(id) {
    const sKey = statusKey(id, instance);
    console.debug('initContext conv', id);
    let heroTimer;

    const cachedStatuses = cachedStatusesMap[id];
    if (cachedStatuses) {
      // Case 1: It's cached, let's restore them to make it snappy
      const reallyCachedStatuses = cachedStatuses.filter(
        (s) => states.statuses[sKey],
        // Some are not cached in the global state, so we need to filter them out
      );
      return reallyCachedStatuses;
    }

      const heroFetch = () =>
        pRetry(() => masto.v1.statuses.$select(id).fetch(), {
          retries: 4,
        });
      const contextFetch = pRetry(
        () => masto.v1.statuses.$select(id).context.fetch(),
        {
          retries: 8,
        },
      );

      const hasStatus = !!snapStates.statuses[sKey];
      let heroStatus = snapStates.statuses[sKey];
      if (hasStatus) {
        console.debug('Hero status is cached');
      } else {
        try {
          heroStatus = await heroFetch();
          saveStatus(heroStatus, instance);
          // Give time for context to appear
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
        } catch (e) {
          console.error(e);
          return;
        }
      }

      try {
        const context = await contextFetch;
        const { ancestors, descendants } = context;
        console.log("ancestors", id, ancestors)

        const missingStatuses = new Set();
        ancestors.forEach((status) => {
          saveStatus(status, instance, {
            skipThreading: true,
          });
          if (
            status.inReplyToId &&
            !ancestors.find((s) => s.id === status.inReplyToId)
          ) {
            missingStatuses.add(status.inReplyToId);
          }
        });
        const ancestorsIsThread = ancestors.every(
          (s) => s.account.id === heroStatus.account.id,
        );
        const nestedDescendants = [];
        descendants.forEach((status) => {
          saveStatus(status, instance, {
            skipThreading: true,
          });

          if (
            status.inReplyToId &&
            !descendants.find((s) => s.id === status.inReplyToId) &&
            status.inReplyToId !== heroStatus.id
          ) {
            missingStatuses.add(status.inReplyToId);
          }

          if (status.inReplyToAccountId === status.account.id) {
            // If replying to self, it's part of the thread, level 1
            nestedDescendants.push(status);
          } else if (status.inReplyToId === heroStatus.id) {
            // If replying to the hero status, it's a reply, level 1
            nestedDescendants.push(status);
          } else if (
            !status.inReplyToAccountId &&
            nestedDescendants.find((s) => s.id === status.inReplyToId) &&
            status.account.id === heroStatus.account.id
          ) {
            // If replying to hero's own statuses, it's part of the thread, level 1
            nestedDescendants.push(status);
          } else {
            // If replying to someone else, it's a reply to a reply, level 2
            const parent = descendants.find((s) => s.id === status.inReplyToId);
            if (parent) {
              if (!parent.__replies) {
                parent.__replies = [];
              }
              parent.__replies.push(status);
            } else {
              // If no parent, something is wrong
              console.warn('No parent found for', status);
            }
          }
        });

        console.log({ ancestors, descendants, nestedDescendants });
        if (missingStatuses.size) {
          console.error('Missing statuses', [...missingStatuses]);
        }

        const allStatuses = [
          ...ancestors.map((s) => states.statuses[statusKey(s.id, instance)]),
          states.statuses[statusKey(id, instance)],
          ...nestedDescendants.map((s) => states.statuses[statusKey(s.id, instance)]),
        ];

        console.log({ allStatuses });
        cachedStatusesMap[id] = allStatuses;

        // Let's threadify this one
        // Note that all non-hero statuses will trigger saveStatus which will threadify them too
        // By right, at this point, all descendant statuses should be cached
        threadifyStatus(heroStatus, instance);

        return allStatuses;
      } catch (e) {
        console.error(e);
      }
  }

  const conversationsIterator = useRef();
  const latestConversationItem = useRef();
  async function fetchItems(firstLoad) {
    if (!firstLoad) {
      return {done: true, value: []};
    }
  	const allStatuses = [];
    const value = await masto.v1.conversations.list({
        limit: LIMIT,
    });
    const pointer = value?.filter((item) => item.lastStatus?.id == id)[0];
    const value2 = !!pointer ? value?.filter((convo) => {
    	const convoAccounts = convo.accounts.map((acc) => acc.acct);
    	const matchingAccounts = pointer.accounts.map((acc) => acc.acct);
    	return convoAccounts.length === matchingAccounts.length &&
    		convoAccounts.every((val, index) => val === matchingAccounts[index])
    }) : [];
    const value3 = value2?.map((item) => item.lastStatus)
    if (value3?.length) {
        for (const item of value3) {
      	  const newStatuses = await getThreadForId(item.id)
      	  newStatuses.forEach((item) => allStatuses.push(item))
        }
    }

    setParticipants(pointer.accounts)

  	return {
  	  done: true,
  	  value: allStatuses,
  	}
  }

  async function checkForUpdates() {
      try {
        const pointer = getStatus(id, masto);
        const results = await masto.v1.conversations
          .list({
            since_id: latestConversationItem.current,
          })
          .next();
        let { value } = results;
        value = !!pointer ? value?.filter((convo) => {
        	const convoAccounts = convo.accounts.map((acc) => acc.acct);
        	const matchingAccounts = pointer.accounts.map((acc) => acc.acct);
        	return convoAccounts.length === matchingAccounts.length &&
        		convoAccounts.every((val, index) => val === matchingAccounts[index])
        }) : [];
        console.log(
          'checkForUpdates PRIVATE',
          latestConversationItem.current,
          value,
        );
        if (value?.length) {
          latestConversationItem.current = value[0].lastStatus.id;
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
  }

  const participantsHeader = participants
    ? <div class="participants">
        {participants.map((participant) => <AccountBlock account={participant}/>)}
      </div>
    : "";

  return (
    <Timeline
      key={id}
      title="Conversation"
      timelineStart={participantsHeader}
      id="conversation"
      emptyText="This conversation doesn't exist"
      errorText="Unable to load conversation."
      instance={instance}
      fetchItems={fetchItems}
      checkForUpdates={checkForUpdates}
      useItemID
    />
  );
}

const MEDIA_VIRTUAL_LENGTH = 140;
const POLL_VIRTUAL_LENGTH = 35;
const CARD_VIRTUAL_LENGTH = 70;
const WEIGHT_SEGMENT = 140;
const statusWeightCache = new Map();
function calcStatusWeight(status) {
  const cachedWeight = statusWeightCache.get(status.id);
  if (cachedWeight) return cachedWeight;
  const { spoilerText, content, mediaAttachments, poll, card } = status;
  const length = htmlContentLength(spoilerText + content);
  const mediaLength = mediaAttachments?.length ? MEDIA_VIRTUAL_LENGTH : 0;
  const pollLength = (poll?.options?.length || 0) * POLL_VIRTUAL_LENGTH;
  const cardLength =
    card && (mediaAttachments?.length || poll?.options?.length)
      ? 0
      : CARD_VIRTUAL_LENGTH;
  const totalLength = length + mediaLength + pollLength + cardLength;
  const weight = totalLength / WEIGHT_SEGMENT;
  statusWeightCache.set(status.id, weight);
  return weight;
}

export default Conversation;
