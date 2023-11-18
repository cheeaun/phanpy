import { Menu } from '@szhsin/react-menu';
import { useWindowSize } from '@uidotdev/usehooks';
import { useRef } from 'preact/hooks';

import safeBoundingBoxPadding from '../utils/safe-bounding-box-padding';

// It's like Menu but with sensible defaults, bug fixes and improvements.
function Menu2(props) {
  const { containerProps, instanceRef: _instanceRef } = props;
  const size = useWindowSize();
  const instanceRef = _instanceRef?.current ? _instanceRef : useRef();

  return (
    <Menu
      boundingBoxPadding={safeBoundingBoxPadding()}
      repositionFlag={`${size.width}x${size.height}`}
      unmountOnClose
      {...props}
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
