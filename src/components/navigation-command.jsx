import { memo } from 'preact/compat';
import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from 'react-router-dom';

export default memo(function NavigationCommand() {
  const navigate = useNavigate();

  const hotkeyOptions = {
    useKey: true,
    ignoreEventWhen: (e) => {
      const hasModal = !!document.querySelector('#modal-container > *');
      return hasModal || e.metaKey || e.ctrlKey || e.altKey;
    },
  };

  useHotkeys('g>h', () => navigate('/'), hotkeyOptions);
  useHotkeys('g>n', () => navigate('/notifications'), hotkeyOptions);

  return null;
});
