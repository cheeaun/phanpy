import moize from 'moize';
import { useEffect, useRef, useState } from 'preact/hooks';

import escapeHTML from '../utils/escape-html';

import { ICONS } from './ICONS';

const SIZES = {
  xs: 8,
  s: 12,
  m: 16,
  l: 20,
  xl: 24,
  xxl: 32,
};

const ICONDATA = {};

// Memoize the dangerouslySetInnerHTML of the SVGs
const INVALID_ID_CHARS_REGEX = /[^a-zA-Z0-9]/g;
const SVGICon = moize(
  function ({ icon, title, width, height, body, rotate, flip }) {
    const titleID = title?.replace(INVALID_ID_CHARS_REGEX, '-') || '';
    const id = `icon-${icon}-${titleID}`;
    const html = title
      ? `<title id="${id}">${escapeHTML(title)}</title>${body}`
      : body;
    return (
      <svg
        role={title ? 'img' : 'presentation'}
        aria-labelledby={id}
        viewBox={`0 0 ${width} ${height}`}
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          transform: `${rotate ? `rotate(${rotate})` : ''} ${
            flip ? `scaleX(-1)` : ''
          }`,
        }}
      />
    );
  },
  {
    isShallowEqual: true,
    maxSize: Object.keys(ICONS).length,
    matchesArg: (cacheKeyArg, keyArg) =>
      cacheKeyArg.icon === keyArg.icon &&
      cacheKeyArg.title === keyArg.title &&
      cacheKeyArg.body === keyArg.body,
  },
);

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
  if (!iconBlock) {
    console.warn(`Icon ${icon} not found`);
    return null;
  }

  let rotate,
    flip,
    rtl = false;
  if (Array.isArray(iconBlock)) {
    [iconBlock, rotate, flip] = iconBlock;
  } else if (typeof iconBlock === 'object') {
    ({ rotate, flip, rtl } = iconBlock);
    iconBlock = iconBlock.module;
  }

  const [iconData, setIconData] = useState(ICONDATA[icon]);
  const currentIcon = useRef(icon);
  useEffect(() => {
    if (iconData && currentIcon.current === icon) return;
    (async () => {
      const iconB = await iconBlock();
      setIconData(iconB.default);
      ICONDATA[icon] = iconB.default;
    })();
    currentIcon.current = icon;
  }, [icon]);

  return (
    <span
      class={`icon ${className} ${rtl ? 'rtl-flip' : ''}`}
      style={{
        width: `${iconSize}px`,
        height: `${iconSize}px`,
        ...style,
      }}
      data-icon={icon}
    >
      {iconData && (
        // <svg
        //   width={iconSize}
        //   height={iconSize}
        //   viewBox={`0 0 ${iconData.width} ${iconData.height}`}
        //   dangerouslySetInnerHTML={{ __html: iconData.body }}
        //   style={{
        //     transform: `${rotate ? `rotate(${rotate})` : ''} ${
        //       flip ? `scaleX(-1)` : ''
        //     }`,
        //   }}
        // />
        <SVGICon
          icon={icon}
          title={title || alt}
          width={iconData.width}
          height={iconData.height}
          body={iconData.body}
          rotate={rotate}
          flip={flip}
        />
      )}
    </span>
  );
}

export default Icon;
