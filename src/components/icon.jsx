import { useEffect, useState } from 'preact/hooks';

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
  'arrow-down': 'mingcute:arrow-down-line',
  earth: 'mingcute:earth-line',
  lock: 'mingcute:lock-line',
  unlock: 'mingcute:unlock-line',
  'eye-close': 'mingcute:eye-close-line',
  'eye-open': 'mingcute:eye-2-line',
  message: 'mingcute:mail-line',
  comment: 'mingcute:chat-3-line',
  home: 'mingcute:home-3-line',
  notification: 'mingcute:notification-line',
  follow: 'mingcute:user-follow-line',
  'follow-add': 'mingcute:user-add-line',
  poll: ['mingcute:chart-bar-line', '90deg'],
  pencil: 'mingcute:pencil-line',
  quill: 'mingcute:quill-pen-line',
  at: 'mingcute:at-line',
  attachment: 'mingcute:attachment-line',
  upload: 'mingcute:upload-3-line',
  gear: 'mingcute:settings-3-line',
  more: 'mingcute:more-3-line',
  external: 'mingcute:external-link-line',
  popout: 'mingcute:external-link-line',
  popin: ['mingcute:external-link-line', '180deg'],
  plus: 'mingcute:add-circle-line',
  'chevron-left': 'mingcute:left-line',
  'chevron-right': 'mingcute:right-line',
  reply: ['mingcute:share-forward-line', '180deg', 'horizontal'],
  thread: 'mingcute:route-line',
  group: 'mingcute:group-line',
  bot: 'mingcute:android-2-line',
  menu: 'mingcute:rows-4-line',
  list: 'mingcute:list-check-line',
  search: 'mingcute:search-2-line',
  hashtag: 'mingcute:hashtag-line',
  info: 'mingcute:information-line',
  shortcut: 'mingcute:lightning-line',
  user: 'mingcute:user-4-line',
  following: 'mingcute:walk-line',
  pin: 'mingcute:pin-line',
  bus: 'mingcute:bus-2-line',
  link: 'mingcute:link-2-line',
  history: 'mingcute:history-line',
  share: 'mingcute:share-2-line',
};

const modules = import.meta.glob('/node_modules/@iconify-icons/mingcute/*.js');

function Icon({ icon, size = 'm', alt, title, class: className = '' }) {
  if (!icon) return null;

  const iconSize = SIZES[size];
  let iconName = ICONS[icon];
  let rotate, flip;
  if (Array.isArray(iconName)) {
    [iconName, rotate, flip] = iconName;
  }

  const [iconData, setIconData] = useState(null);
  useEffect(async () => {
    const name = iconName.replace('mingcute:', '');
    const icon = await modules[
      `/node_modules/@iconify-icons/mingcute/${name}.js`
    ]();
    setIconData(icon.default);
  }, [iconName]);

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
    </div>
  );
}

export default Icon;
