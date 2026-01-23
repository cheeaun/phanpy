import { memo } from 'preact/compat';
import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from 'react-router-dom';

import states from '../utils/states';
import { getCurrentAccount } from '../utils/store-utils';

// ignoreEventWhen doesn't work with sequence shortcuts, so we wrap callbacks instead
const useGoHotkeys = (key, callback) => {
  useHotkeys(
    `g>${key}`,
    (e) => {
      const hasModal = !!document.querySelector('#modal-container > *');
      const shouldIgnore = hasModal || e.metaKey || e.ctrlKey || e.altKey;
      if (!shouldIgnore) {
        callback(e);
      }
    },
    { useKey: true },
  );
};

export default memo(function NavigationCommand() {
  const navigate = useNavigate();

  useGoHotkeys('h', () => navigate('/'));
  useGoHotkeys('n', () => navigate('/notifications'));
  useGoHotkeys('s', () => {
    states.showSettings = true;
  });
  useGoHotkeys('p', () => {
    const account = getCurrentAccount();
    if (account) {
      const { instanceURL } = account;
      const { id } = account.info;
      navigate(`/${instanceURL}/a/${id}`);
    }
  });
  useGoHotkeys('b', () => navigate('/b'));

  return null;
});
