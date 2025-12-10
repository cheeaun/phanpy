// https://adactio.com/journal/22278
// https://gist.github.com/adactio/a445544723363d37b9c31a74a03ef928

class ButtonInstall extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('button');
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.button.remove();
      return;
    }
    if (!navigator.install) {
      this.button.remove();
      return;
    }
    this.button.addEventListener('click', async (ev) => {
      await navigator.install();
    });
  }
}

customElements.define('button-install', ButtonInstall);
