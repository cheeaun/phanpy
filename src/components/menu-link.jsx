import { FocusableItem } from '@szhsin/react-menu';

import Link from './link';

function MenuLink(props) {
  const { className, disabled, ...restProps } = props;
  return (
    <FocusableItem className={className} disabled={disabled}>
      {({ ref, closeMenu }) => (
        <Link
          {...restProps}
          ref={ref}
          onClick={({ detail }) =>
            closeMenu(detail === 0 ? 'Enter' : undefined)
          }
        />
      )}
    </FocusableItem>
  );
}

export default MenuLink;
