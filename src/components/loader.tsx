import './loader.css';

import type { ComponentChildren } from 'preact';

interface LoaderProps {
  abrupt?: boolean;
  hidden?: boolean;
  id?: string;
}

const Loader = (props: Readonly<LoaderProps>): ComponentChildren => {
  const { abrupt, hidden, id } = props;
  const classNames = ['loader-container'];

  if (abrupt === true) {
    classNames.push('abrupt');
  }

  if (hidden === true) {
    classNames.push('hidden');
  }

  return (
    <span id={id} class={classNames.join(' ')}>
      <span class="loader" />
    </span>
  );
};

export default Loader;
