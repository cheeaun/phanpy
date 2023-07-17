import { Menu, MenuItem, SubMenu } from '@szhsin/react-menu';
import { cloneElement } from 'preact';

function MenuConfirm({
  subMenu = false,
  confirm = true,
  confirmLabel,
  menuItemClassName,
  menuFooter,
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
  const Parent = subMenu ? SubMenu : Menu;
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
      {menuFooter}
    </Parent>
  );
}

export default MenuConfirm;
