import './floating-bar.css';

import { Children } from 'preact/compat';

export default function FloatingBar({ children, ...props }) {
  if (!Children.toArray(children).some(Boolean)) return null;
  return (
    <div class="floating-bar" {...props}>
      {children}
    </div>
  );
}
