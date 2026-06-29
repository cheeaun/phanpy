const segmenter =
  typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter() : null;

class GraphemeInput extends HTMLElement {
  #input;
  #inputHandler;
  #maxLengthNum;

  connectedCallback() {
    // connectedCallback may fire before child elements are fully parsed/available.
    // Using setTimeout defers execution until the next event loop tick, ensuring
    // the DOM is settled and child elements are accessible.
    setTimeout(() => {
      if (!this.isConnected) return;

      const input = this.querySelector('input, textarea');
      if (!input) return;

      const maxLength = input.getAttribute('maxlength');
      if (!maxLength) return;

      const maxLengthNum = parseInt(maxLength, 10);
      if (isNaN(maxLengthNum)) return;

      input.removeAttribute('maxlength');
      this.setAttribute('maxlength', maxLength);

      this.#input = input;
      this.#maxLengthNum = maxLengthNum;

      this.#inputHandler = () => this.#enforceLimit();
      input.addEventListener('input', this.#inputHandler);

      // Initialize current length for existing value
      const value = input.value;
      let currentLength;
      if (segmenter) {
        currentLength = [...segmenter.segment(value)].length;
      } else {
        currentLength = [...value].length;
      }
      this.setAttribute('current-length', currentLength);
    }, 0);
  }

  #enforceLimit() {
    const input = this.#input;
    const maxLengthNum = this.#maxLengthNum;
    const value = input.value;

    let truncatedValue;
    let currentLength;

    if (segmenter) {
      // Grapheme counting
      const segments = [...segmenter.segment(value)];
      currentLength = segments.length;
      if (segments.length > maxLengthNum) {
        truncatedValue = segments
          .slice(0, maxLengthNum)
          .map((s) => s.segment)
          .join('');
        currentLength = maxLengthNum;
      }
    } else {
      // Fallback to code points
      const codePoints = [...value];
      currentLength = codePoints.length;
      if (codePoints.length > maxLengthNum) {
        truncatedValue = codePoints.slice(0, maxLengthNum).join('');
        currentLength = maxLengthNum;
      }
    }

    this.setAttribute('current-length', currentLength);

    if (truncatedValue !== undefined) {
      input.value = truncatedValue;
      input.dispatchEvent(
        new Event('input', { bubbles: true, cancelable: true, composed: true }),
      );
    }
  }

  disconnectedCallback() {
    if (this.#input) {
      this.#input.removeEventListener('input', this.#inputHandler);
    }
  }
}

customElements.define('grapheme-input', GraphemeInput);
