import './loader.css';

function Loader({ abrupt, hidden, ...props }) {
  return (
    <span
      {...props}
      class={`loader-container ${abrupt ? 'abrupt' : ''} ${
        hidden ? 'hidden' : ''
      }`}
    >
      <span class="loader" />
    </span>
  );
}

export default Loader;
