import { SubMenu } from '@szhsin/react-menu';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

export default function SubMenu2(props) {
  const menuRef = useRef();
  const itemRef = useRef();
  const { label, direction, shift, ...restProps } = props;
  const [computedDirection, setComputedDirection] = useState(direction);
  const [computedShift, setComputedShift] = useState(shift);

  // If menu item width is >50% of viewport, use bottom direction
  useLayoutEffect(() => {
    if (itemRef.current) {
      const width = itemRef.current.offsetWidth;
      const viewportWidth = window.innerWidth;
      if (width > viewportWidth * 0.5) {
        setComputedDirection('bottom');
        setComputedShift(shift || 8);
      } else {
        setComputedDirection(direction);
        setComputedShift(shift);
      }
    }
  }, [direction, shift]);

  return (
    <SubMenu
      {...restProps}
      direction={computedDirection}
      shift={computedShift}
      label={label}
      instanceRef={menuRef}
      // Test fix for bug; submenus not opening on Android
      itemProps={{
        ref: itemRef,
        onPointerMove: (e) => {
          if (e.pointerType === 'touch') {
            menuRef.current?.openMenu?.();
          }
        },
        onPointerLeave: (e) => {
          if (e.pointerType === 'touch') {
            menuRef.current?.openMenu?.();
          }
        },
        ...props.itemProps,
      }}
    />
  );
}
