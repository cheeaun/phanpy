import { memo } from 'preact/compat';
import { useLayoutEffect } from 'preact/hooks';

import { ICON_NAMESPACE, useIconSprite } from './icon-sprite-manager';
import * as ICONS from './ICONS';

const SIZES = {
  xs: 8,
  s: 12,
  m: 16,
  l: 20,
  xl: 24,
  xxl: 32,
};

const INVALID_ID_CHARS_REGEX = /[^a-zA-Z0-9]/g;

function Icon({
  icon,
  size = 'm',
  alt,
  title,
  class: className = '',
  style = {},
}) {
  title = title || alt;
  const { registerIcon, isIconRegistered } = useIconSprite();

  if (!icon) return null;

  const iconSize = SIZES[size];
  let iconBlock = ICONS[icon];
  if (!iconBlock) {
    console.warn(`Icon ${icon} not found`);
    return null;
  }

  let rotate, flip;
  if (iconBlock.module) {
    ({ rotate, flip } = iconBlock);
    iconBlock = iconBlock.module;
  }
  const rtl = ICONS.RTL_ICONS.has(icon);

  const sanitizedTitle = title?.replace(INVALID_ID_CHARS_REGEX, '-');
  const titleID = `${ICON_NAMESPACE}-title-${icon}-${sanitizedTitle}`;

  useLayoutEffect(() => {
    if (!isIconRegistered(icon)) {
      registerIcon(icon, iconBlock);
    }
  }, [icon, iconBlock]);

  const registered = isIconRegistered(icon);

  return (
    <span
      class={`icon ${className} ${rtl ? 'rtl-flip' : ''}`}
      style={{
        width: `${iconSize}px`,
        height: `${iconSize}px`,
        ...style,
      }}
      data-icon={icon}
      title={registered ? undefined : title || undefined}
    >
      {registered && (
        <svg
          width={iconSize}
          height={iconSize}
          role={title ? 'img' : 'presentation'}
          aria-labelledby={title ? titleID : undefined}
          style={{
            transform: `${rotate ? `rotate(${rotate})` : ''} ${
              flip ? `scaleX(-1)` : ''
            }`,
          }}
        >
          {title ? <title id={titleID}>{title}</title> : null}
          <use href={`#${ICON_NAMESPACE}-${icon}`} />
        </svg>
      )}
    </span>
  );
}

export default memo(Icon, (prevProps, nextProps) => {
  return (
    prevProps.icon === nextProps.icon &&
    prevProps.title === nextProps.title &&
    prevProps.alt === nextProps.alt &&
    prevProps.size === nextProps.size
  );
});
