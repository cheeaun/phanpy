import { useEffect, useRef, useState } from 'preact/hooks';

const THRESHOLD = 3;

const HIDDEN_SELECTOR = [
  '.content-container:not(.show-spoiler) .spoiler-button:not(.spoiling)',
  '.content-container:not(.show-media) .spoiler-media-button:not(.spoiling)',
  '.content-container:not(.show-spoiler) .spoiler-media-button[hidden]',
  '.content-container:not(.show-spoiler) .media-first-spoiler-button:not(.spoiling)',
].join(', ');

const REVEAL_SELECTOR = [
  '.spoiler-button:not(.spoiling)',
  '.spoiler-media-button:not(.spoiling)',
  '.media-first-spoiler-button:not(.spoiling)',
].join(', ');

function countHiddenPosts(root) {
  if (!root) return 0;
  const ids = new Set();
  for (const el of root.querySelectorAll(HIDDEN_SELECTOR)) {
    const post = el.closest('[data-state-post-id]');
    ids.add(post?.dataset.statePostId || `~${ids.size}`);
  }
  return ids.size;
}

export default function useRevealAll(rootRef) {
  const [count, setCount] = useState(0);
  const [dismissedAt, setDismissedAt] = useState(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setCount(countHiddenPosts(root));
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden'],
    });
    schedule();

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rootRef]);

  const revealAll = useRef(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll(REVEAL_SELECTOR).forEach((button) => button.click());
    setDismissedAt(countHiddenPosts(root));
  }).current;

  return {
    hiddenCount: count,
    revealAll,
    visible:
      count > THRESHOLD && !(dismissedAt !== null && count <= dismissedAt),
  };
}
