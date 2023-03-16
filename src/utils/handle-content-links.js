import states from './states';

function handleContentLinks(opts) {
  const { mentions = [], instance, previewMode } = opts || {};
  return (e) => {
    let { target } = e;
    target = target.closest('a');
    if (!target) return;
    if (target.classList.contains('u-url')) {
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
        states.showAccount = {
          account: mention.acct,
          instance,
        };
      } else if (!/^http/i.test(targetText)) {
        console.log('mention not found', targetText);
        e.preventDefault();
        e.stopPropagation();
        const href = target.getAttribute('href');
        states.showAccount = {
          account: href,
          instance,
        };
      }
    } else if (!previewMode) {
      if (target.classList.contains('hashtag')) {
        e.preventDefault();
        e.stopPropagation();
        const tag = target.innerText.replace(/^#/, '').trim();
        const hashURL = instance ? `#/${instance}/t/${tag}` : `#/t/${tag}`;
        console.log({ hashURL });
        location.hash = hashURL;
      } else if (states.unfurledLinks[target.href]?.url) {
        e.preventDefault();
        e.stopPropagation();
        states.prevLocation = {
          pathname: location.hash.replace(/^#/, ''),
        };
        location.hash = `#${states.unfurledLinks[target.href].url}`;
      }
    }
  };
}

export default handleContentLinks;
