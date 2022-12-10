import './loader.css';

export default ({ abrupt, hidden }) => (
  <div
    class={`loader-container ${abrupt ? 'abrupt' : ''} ${
      hidden ? 'hidden' : ''
    }`}
  >
    <div class="loader" />
  </div>
);
