import openOSK from './open-osk';
import showToast from './show-toast';
import states from './states';

const TOAST_DURATION = 5_000; // 5 seconds

export default function showCompose(opts) {
  if (!opts) opts = true;

  if (states.showCompose) {
    if (states.composerState.minimized) {
      showToast({
        duration: TOAST_DURATION,
        text: `A draft post is currently minimized. Post or discard it before creating a new one.`,
      });
    } else {
      showToast({
        duration: TOAST_DURATION,
        text: `A post is currently open. Post or discard it before creating a new one.`,
      });
    }
    return;
  }

  openOSK();
  states.showCompose = opts;
}
