import { createContext } from 'preact';
import { useContext, useRef, useState } from 'preact/hooks';

import { api } from '../utils/api';

const EditHistoryContext = createContext({});

const supportsViewTransition = !!document.startViewTransition;

export function EditHistoryProvider({ children, statusID }) {
  const editHistoryRef = useRef([]);
  const [editHistoryMode, setEditHistoryMode] = useState(false);
  // 0 is latest
  const [editedAtIndex, _setEditedAtIndex] = useState(0);

  // setEditedAtIndex, with View Transitions API
  function setEditedAtIndex(i) {
    if (i === editedAtIndex) return;
    if (supportsViewTransition) {
      document.startViewTransition(() => {
        _setEditedAtIndex(i);
      });
    } else {
      _setEditedAtIndex(i);
    }
  }

  async function fetchEditHistory() {
    const { masto } = api();
    const history = await masto.v1.statuses.$select(statusID).history.list();
    // sort latest first
    history.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    editHistoryRef.current = history;
  }

  async function initEditHistory() {
    console.log('initEditHistory', statusID);
    try {
      await fetchEditHistory();
      setEditHistoryMode(true);
      setEditedAtIndex(0);
    } catch (e) {
      console.error(e);
      setEditHistoryMode(false);
    }
  }

  function exitEditHistory() {
    editHistoryRef.current = [];
    setEditHistoryMode(false);
    setEditedAtIndex(0);
  }

  function prevEditedAt() {
    setEditedAtIndex((i) => Math.min(i + 1, editHistoryRef.current.length - 1));
  }

  function nextEditedAt() {
    setEditedAtIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <EditHistoryContext.Provider
      value={{
        editHistoryRef,
        initEditHistory,
        exitEditHistory,
        editHistoryMode,
        editedAtIndex,
        prevEditedAt,
        nextEditedAt,
      }}
    >
      {children}
    </EditHistoryContext.Provider>
  );
}

export function useEditHistory() {
  return useContext(EditHistoryContext);
}
