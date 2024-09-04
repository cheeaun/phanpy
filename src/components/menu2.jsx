import { Menu } from '@szhsin/react-menu';
import { useRef } from 'preact/hooks';

import isRTL from '../utils/is-rtl';
import safeBoundingBoxPadding from '../utils/safe-bounding-box-padding';
import useWindowSize from '../utils/useWindowSize';

// It's like Menu but with sensible defaults, bug fixes and improvements.
function Menu2(props) {
  const { containerProps, instanceRef: _instanceRef, align } = props;
  const size = useWindowSize();
  const instanceRef = _instanceRef?.current ? _instanceRef : useRef();

  // Values: start, end, center
  // Note: don't mess with 'center'
  const rtlAlign = isRTL()
    ? align === 'end'
      ? 'start'
      : align === 'start'
      ? 'end'
      : align
    : align;

  return (
    <Menu
      boundingBoxPadding={safeBoundingBoxPadding()}
      repositionFlag={`${size.width}x${size.height}`}
      unmountOnClose
      {...props}
      align={rtlAlign}
      instanceRef={instanceRef}
      containerProps={{
        onClick: (e) => {
          if (e.target === e.currentTarget) {
            instanceRef.current?.closeMenu?.();
          }
          containerProps?.onClick?.(e);
        },
        ...containerProps,
      }}
    />
  );
}

export default Menu2;
