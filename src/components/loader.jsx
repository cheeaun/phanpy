import './loader.css';

function Loader({ abrupt, hidden, ...props }) {
  return (
    <div
      {...props}
      class={`loader-container ${abrupt ? 'abrupt' : ''} ${
        hidden ? 'hidden' : ''
      }`}
    >
      <div class="loader" />
    </div>
  );
}

export default Loader;
