import { MenuItem } from '@szhsin/react-menu';
import { cloneElement } from 'preact';

import Menu2 from './menu2';
import SubMenu2 from './submenu2';

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
  const Parent = subMenu ? SubMenu2 : Menu2;
  return (
    <Parent
      openTrigger="clickOnly"
      direction="bottom"
      overflow="auto"
      gap={-8}
      shift={8}
      menuClassName="menu-emphasized"
      {...restProps}
      menuButton={subMenu ? undefined : children}
      label={subMenu ? children : undefined}
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
