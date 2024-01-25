import moize from 'moize';
import { useEffect, useRef, useState } from 'preact/hooks';

import { ICONS } from './ICONS';

const SIZES = {
  s: 12,
  m: 16,
  l: 20,
  xl: 24,
  xxl: 32,
};

const ICONDATA = {};

// Memoize the dangerouslySetInnerHTML of the SVGs
const SVGICon = moize(
  function ({ width, height, body, rotate, flip }) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        dangerouslySetInnerHTML={{ __html: body }}
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
      cacheKeyArg.icon === keyArg.icon && cacheKeyArg.body === keyArg.body,
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

  let rotate, flip;
  if (Array.isArray(iconBlock)) {
    [iconBlock, rotate, flip] = iconBlock;
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
      class={`icon ${className}`}
      title={title || alt}
      style={{
        width: `${iconSize}px`,
        height: `${iconSize}px`,
        ...style,
      }}
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
