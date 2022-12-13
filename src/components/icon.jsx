import 'iconify-icon';

const SIZES = {
  s: 12,
  m: 16,
  l: 20,
  xl: 24,
  xxl: 32,
};

const ICONS = {
  x: 'mingcute:close-line',
  heart: 'mingcute:heart-line',
  bookmark: 'mingcute:bookmark-line',
  'check-circle': 'mingcute:check-circle-line',
  transfer: 'mingcute:transfer-4-line',
  rocket: 'mingcute:rocket-line',
  'arrow-left': 'mingcute:arrow-left-line',
  'arrow-right': 'mingcute:arrow-right-line',
  'arrow-up': 'mingcute:arrow-up-line',
  earth: 'mingcute:earth-line',
  lock: 'mingcute:lock-line',
  unlock: 'mingcute:unlock-line',
  'eye-close': 'mingcute:eye-close-line',
  'eye-open': 'mingcute:eye-2-line',
  message: 'mingcute:mail-line',
  comment: 'mingcute:chat-3-line',
  home: 'mingcute:home-5-line',
  notification: 'mingcute:notification-line',
  follow: 'mingcute:user-follow-line',
  'follow-add': 'mingcute:user-add-line',
  poll: 'mingcute:chart-bar-line',
  pencil: 'mingcute:pencil-line',
  quill: 'mingcute:quill-pen-line',
  at: 'mingcute:at-line',
  attachment: 'mingcute:attachment-line',
  upload: 'mingcute:upload-3-line',
  gear: 'mingcute:settings-3-line',
  more: 'mingcute:more-1-line',
  external: 'mingcute:external-link-line',
  popout: 'mingcute:external-link-line',
  popin: ['mingcute:external-link-line', '180deg'],
};

export default ({ icon, size = 'm', alt, title, class: className = '' }) => {
  const iconSize = SIZES[size];
  let iconName = ICONS[icon];
  let rotate;
  if (Array.isArray(iconName)) {
    [iconName, rotate] = iconName;
  }
  return (
    <div
      class={`icon ${className}`}
      title={title || alt}
      style={{
        width: `${iconSize}px`,
        height: `${iconSize}px`,
        display: 'inline-block',
        overflow: 'hidden',
        lineHeight: 0,
      }}
    >
      <iconify-icon
        width={iconSize}
        height={iconSize}
        icon={iconName}
        rotate={rotate}
      >
        {alt}
      </iconify-icon>
    </div>
  );
};
