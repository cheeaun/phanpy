import { MenuItem, SubMenu } from '@szhsin/react-menu';
import { cloneElement } from 'preact';
import { useRef } from 'preact/hooks';

import Menu2 from './menu2';

function MenuConfirm({
  subMenu = false,
  confirm = true,
  confirmLabel,
  menuItemClassName,
  menuFooter,
  menuExtras,
  ...props
}) {
  const { children, onClick, ...restProps } = props;
  if (!confirm) {
    if (subMenu) return <MenuItem {...props} />;
    if (onClick) {
      return cloneElement(children, {
        onClick,
      });
    }
    return children;
  }
  const Parent = subMenu ? SubMenu : Menu2;
  const menuRef = useRef();
  return (
    <Parent
      instanceRef={menuRef}
      openTrigger="clickOnly"
      direction="bottom"
      overflow="auto"
      gap={-8}
      shift={8}
      menuClassName="menu-emphasized"
      {...restProps}
      menuButton={subMenu ? undefined : children}
      label={subMenu ? children : undefined}
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
    >
      <MenuItem className={menuItemClassName} onClick={onClick}>
        {confirmLabel}
      </MenuItem>
      {menuExtras}
      {menuFooter}
    </Parent>
  );
}

export default MenuConfirm;
