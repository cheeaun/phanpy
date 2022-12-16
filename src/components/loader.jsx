import './loader.css';

function Loader({ abrupt, hidden }) {
  return (
    <div
      class={`loader-container ${abrupt ? 'abrupt' : ''} ${
        hidden ? 'hidden' : ''
      }`}
    >
      <div class="loader" />
    </div>
  );
}

export default Loader;
