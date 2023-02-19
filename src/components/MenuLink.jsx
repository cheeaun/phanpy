import { FocusableItem } from '@szhsin/react-menu';

import Link from './link';

function MenuLink(props) {
  return (
    <FocusableItem>
      {({ ref, closeMenu }) => (
        <Link
          {...props}
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
