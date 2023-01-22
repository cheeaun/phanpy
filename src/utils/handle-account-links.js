import states from './states';

function handleAccountLinks(opts) {
  const { mentions = [] } = opts || {};
  return (e) => {
    let { target } = e;
    if (target.parentNode.tagName.toLowerCase() === 'a') {
      target = target.parentNode;
    }
    if (
      target.tagName.toLowerCase() === 'a' &&
      target.classList.contains('u-url')
    ) {
      const targetText = (
        target.querySelector('span') || target
      ).innerText.trim();
      const username = targetText.replace(/^@/, '');
      const url = target.getAttribute('href');
      const mention = mentions.find(
        (mention) =>
          mention.username === username ||
          mention.acct === username ||
          mention.url === url,
      );
      if (mention) {
        e.preventDefault();
        e.stopPropagation();
        states.showAccount = mention.acct;
      } else if (!/^http/i.test(targetText)) {
        console.log('mention not found', targetText);
        e.preventDefault();
        e.stopPropagation();
        const href = target.getAttribute('href');
        states.showAccount = href;
      }
    }
  };
}

export default handleAccountLinks;
