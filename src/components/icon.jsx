import { memo } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';

const SIZES = {
  s: 12,
  m: 16,
  l: 20,
  xl: 24,
  xxl: 32,
};

export const ICONS = {
  x: () => import('@iconify-icons/mingcute/close-line'),
  heart: () => import('@iconify-icons/mingcute/heart-line'),
  bookmark: () => import('@iconify-icons/mingcute/bookmark-line'),
  'check-circle': () => import('@iconify-icons/mingcute/check-circle-line'),
  'x-circle': () => import('@iconify-icons/mingcute/close-circle-line'),
  transfer: () => import('@iconify-icons/mingcute/transfer-4-line'),
  rocket: () => import('@iconify-icons/mingcute/rocket-line'),
  'arrow-left': () => import('@iconify-icons/mingcute/arrow-left-line'),
  'arrow-right': () => import('@iconify-icons/mingcute/arrow-right-line'),
  'arrow-up': () => import('@iconify-icons/mingcute/arrow-up-line'),
  'arrow-down': () => import('@iconify-icons/mingcute/arrow-down-line'),
  earth: () => import('@iconify-icons/mingcute/earth-line'),
  lock: () => import('@iconify-icons/mingcute/lock-line'),
  unlock: () => import('@iconify-icons/mingcute/unlock-line'),
  'eye-close': () => import('@iconify-icons/mingcute/eye-close-line'),
  'eye-open': () => import('@iconify-icons/mingcute/eye-2-line'),
  message: () => import('@iconify-icons/mingcute/mail-line'),
  comment: () => import('@iconify-icons/mingcute/chat-3-line'),
  home: () => import('@iconify-icons/mingcute/home-3-line'),
  notification: () => import('@iconify-icons/mingcute/notification-line'),
  follow: () => import('@iconify-icons/mingcute/user-follow-line'),
  'follow-add': () => import('@iconify-icons/mingcute/user-add-line'),
  poll: [() => import('@iconify-icons/mingcute/chart-bar-line'), '90deg'],
  pencil: () => import('@iconify-icons/mingcute/pencil-line'),
  quill: () => import('@iconify-icons/mingcute/quill-pen-line'),
  at: () => import('@iconify-icons/mingcute/at-line'),
  attachment: () => import('@iconify-icons/mingcute/attachment-line'),
  upload: () => import('@iconify-icons/mingcute/upload-3-line'),
  gear: () => import('@iconify-icons/mingcute/settings-3-line'),
  more: () => import('@iconify-icons/mingcute/more-3-line'),
  external: () => import('@iconify-icons/mingcute/external-link-line'),
  popout: () => import('@iconify-icons/mingcute/external-link-line'),
  popin: [() => import('@iconify-icons/mingcute/external-link-line'), '180deg'],
  plus: () => import('@iconify-icons/mingcute/add-circle-line'),
  'chevron-left': () => import('@iconify-icons/mingcute/left-line'),
  'chevron-right': () => import('@iconify-icons/mingcute/right-line'),
  'chevron-down': () => import('@iconify-icons/mingcute/down-line'),
  reply: [
    () => import('@iconify-icons/mingcute/share-forward-line'),
    '180deg',
    'horizontal',
  ],
  thread: () => import('@iconify-icons/mingcute/route-line'),
  group: () => import('@iconify-icons/mingcute/group-line'),
  bot: () => import('@iconify-icons/mingcute/android-2-line'),
  menu: () => import('@iconify-icons/mingcute/rows-4-line'),
  list: () => import('@iconify-icons/mingcute/list-check-line'),
  search: () => import('@iconify-icons/mingcute/search-2-line'),
  hashtag: () => import('@iconify-icons/mingcute/hashtag-line'),
  info: () => import('@iconify-icons/mingcute/information-line'),
  shortcut: () => import('@iconify-icons/mingcute/lightning-line'),
  user: () => import('@iconify-icons/mingcute/user-4-line'),
  following: () => import('@iconify-icons/mingcute/walk-line'),
  pin: () => import('@iconify-icons/mingcute/pin-line'),
  bus: () => import('@iconify-icons/mingcute/bus-2-line'),
  link: () => import('@iconify-icons/mingcute/link-2-line'),
  history: () => import('@iconify-icons/mingcute/history-line'),
  share: () => import('@iconify-icons/mingcute/share-2-line'),
  sparkles: () => import('@iconify-icons/mingcute/sparkles-line'),
  exit: () => import('@iconify-icons/mingcute/exit-line'),
  translate: () => import('@iconify-icons/mingcute/translate-line'),
  play: () => import('@iconify-icons/mingcute/play-fill'),
  trash: () => import('@iconify-icons/mingcute/delete-2-line'),
  mute: () => import('@iconify-icons/mingcute/volume-mute-line'),
  unmute: () => import('@iconify-icons/mingcute/volume-line'),
  block: () => import('@iconify-icons/mingcute/forbid-circle-line'),
  unblock: [
    () => import('@iconify-icons/mingcute/forbid-circle-line'),
    '180deg',
  ],
  flag: () => import('@iconify-icons/mingcute/flag-4-line'),
  time: () => import('@iconify-icons/mingcute/time-line'),
  refresh: () => import('@iconify-icons/mingcute/refresh-2-line'),
  emoji2: () => import('@iconify-icons/mingcute/emoji-2-line'),
  filter: () => import('@iconify-icons/mingcute/filter-2-line'),
  chart: () => import('@iconify-icons/mingcute/chart-line-line'),
  react: () => import('@iconify-icons/mingcute/react-line'),
  layout4: () => import('@iconify-icons/mingcute/layout-4-line'),
  layout5: () => import('@iconify-icons/mingcute/layout-5-line'),
  announce: () => import('@iconify-icons/mingcute/announcement-line'),
  alert: () => import('@iconify-icons/mingcute/alert-line'),
  round: () => import('@iconify-icons/mingcute/round-fill'),
  'arrow-up-circle': () =>
    import('@iconify-icons/mingcute/arrow-up-circle-line'),
  'arrow-down-circle': () =>
    import('@iconify-icons/mingcute/arrow-down-circle-line'),
  clipboard: () => import('@iconify-icons/mingcute/clipboard-line'),
  'account-edit': () => import('@iconify-icons/mingcute/user-edit-line'),
  'account-warning': () => import('@iconify-icons/mingcute/user-warning-line'),
  keyboard: () => import('@iconify-icons/mingcute/keyboard-line'),
  cloud: () => import('@iconify-icons/mingcute/cloud-line'),
  month: () => import('@iconify-icons/mingcute/calendar-month-line'),
};

function Icon({
  icon,
  size = 'm',
  alt,
  title,
  class: className = '',
  style = {},
}) {
  if (!icon) return null;

  const iconSize = SIZES[size];
  let iconBlock = ICONS[icon];
  let rotate, flip;
  if (Array.isArray(iconBlock)) {
    [iconBlock, rotate, flip] = iconBlock;
  }

  const [iconData, setIconData] = useState(null);
  useEffect(async () => {
    const icon = await iconBlock();
    setIconData(icon.default);
  }, [iconBlock]);

  return (
    <span
      class={`icon ${className}`}
      title={title || alt}
      style={{
        width: `${iconSize}px`,
        height: `${iconSize}px`,
        ...style,
      }}
    >
      {iconData && (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox={`0 0 ${iconData.width} ${iconData.height}`}
          dangerouslySetInnerHTML={{ __html: iconData.body }}
          style={{
            transform: `${rotate ? `rotate(${rotate})` : ''} ${
              flip ? `scaleX(-1)` : ''
            }`,
          }}
        />
      )}
    </span>
  );
}

export default memo(Icon);
