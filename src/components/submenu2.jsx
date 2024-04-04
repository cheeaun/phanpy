import { SubMenu } from '@szhsin/react-menu';
import { useRef } from 'preact/hooks';

export default function SubMenu2(props) {
  const menuRef = useRef();
  return (
    <SubMenu
      {...props}
      instanceRef={menuRef}
      // Test fix for bug; submenus not opening on Android
      itemProps={{
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
      }}
    />
  );
}
